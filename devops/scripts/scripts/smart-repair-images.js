#!/usr/bin/env node

/**
 * 智能图片消息修复脚本 v2
 * 
 * 策略：
 * 1. 从messages表中获取所有file_id
 * 2. 根据file_id的时间戳匹配对应的物理文件
 * 3. 重建uploaded_files记录
 */

const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class SmartImageRepairer {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/customer_service.db');
        this.uploadsDir = path.join(__dirname, '../uploads/image');
        this.db = null;
        this.stats = {
            foundMessages: 0,
            matchedFiles: 0,
            repairedRecords: 0,
            errors: 0
        };
    }

    async initDatabase() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ 数据库连接失败:', err);
                    reject(err);
                } else {
                    console.log('✅ 数据库连接成功');
                    resolve();
                }
            });
        });
    }

    /**
     * 获取所有缺失文件记录的图片消息
     */
    async getMissingFileMessages() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT m.id, m.file_id, m.created_at, m.message
                FROM messages m
                LEFT JOIN uploaded_files uf ON m.file_id = uf.id
                WHERE m.message_type = 'image' AND m.file_id IS NOT NULL AND uf.id IS NULL
                ORDER BY m.created_at DESC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * 扫描所有图片文件并按时间戳分组
     */
    async scanAndGroupFiles() {
        try {
            const files = await fs.readdir(this.uploadsDir);
            const imageFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
            });

            // 按时间戳分组
            const filesByTimestamp = {};
            for (const file of imageFiles) {
                const timestamp = this.extractTimestamp(file);
                if (timestamp) {
                    if (!filesByTimestamp[timestamp]) {
                        filesByTimestamp[timestamp] = [];
                    }
                    filesByTimestamp[timestamp].push(file);
                }
            }

            return filesByTimestamp;
        } catch (error) {
            console.error('❌ 扫描文件失败:', error);
            return {};
        }
    }

    /**
     * 从文件名中提取时间戳
     */
    extractTimestamp(filename) {
        const match = filename.match(/^(\d{13})_/);
        return match ? match[1] : null;
    }

    /**
     * 从file_id中提取时间戳
     */
    extractTimestampFromFileId(fileId) {
        const match = fileId.match(/^file_(\d{13})_/);
        return match ? match[1] : null;
    }

    /**
     * 获取文件统计信息
     */
    async getFileStats(filename) {
        try {
            const filePath = path.join(this.uploadsDir, filename);
            const stats = await fs.stat(filePath);
            return {
                size: stats.size,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime
            };
        } catch (error) {
            console.error(`❌ 获取文件统计失败: ${filename}`, error);
            return null;
        }
    }

    /**
     * 创建文件记录
     */
    async createFileRecord(fileId, filename, stats) {
        return new Promise((resolve, reject) => {
            const mimeType = this.getMimeType(filename);
            
            this.db.run(
                `INSERT OR REPLACE INTO uploaded_files 
                 (id, original_name, filename, file_path, file_size, mime_type, upload_time, uploader_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    fileId,
                    filename,
                    filename,
                    path.join('uploads/image', filename),
                    stats.size,
                    mimeType,
                    stats.createdAt.toISOString(),
                    'smart_repair'
                ],
                function(err) {
                    if (err) reject(err);
                    else {
                        console.log(`💾 创建文件记录: ${fileId} -> ${filename}`);
                        resolve(this.changes > 0);
                    }
                }
            );
        });
    }

    /**
     * 获取MIME类型
     */
    getMimeType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * 匹配消息和文件
     */
    async matchMessageToFile(message, filesByTimestamp) {
        const messageTimestamp = this.extractTimestampFromFileId(message.file_id);
        if (!messageTimestamp) {
            console.log(`⚠️  无法从file_id提取时间戳: ${message.file_id}`);
            return null;
        }

        // 精确匹配
        if (filesByTimestamp[messageTimestamp]) {
            return filesByTimestamp[messageTimestamp][0]; // 取第一个匹配的文件
        }

        // 模糊匹配：查找时间最接近的文件
        const timestamps = Object.keys(filesByTimestamp).map(Number);
        const closest = timestamps.reduce((prev, curr) => {
            return Math.abs(curr - messageTimestamp) < Math.abs(prev - messageTimestamp) ? curr : prev;
        });

        const timeDiff = Math.abs(closest - messageTimestamp);
        if (timeDiff < 60000) { // 1分钟内的误差可以接受
            console.log(`🎯 模糊匹配成功: ${message.file_id} -> ${filesByTimestamp[closest][0]} (误差: ${timeDiff}ms)`);
            return filesByTimestamp[closest][0];
        }

        return null;
    }

    /**
     * 执行智能修复
     */
    async repair() {
        console.log('🧠 开始智能图片消息修复...\n');

        try {
            await this.initDatabase();

            // 获取缺失文件记录的消息
            const missingMessages = await this.getMissingFileMessages();
            console.log(`📋 找到 ${missingMessages.length} 条需要修复的图片消息`);
            this.stats.foundMessages = missingMessages.length;

            if (missingMessages.length === 0) {
                console.log('✅ 所有图片消息都有对应的文件记录');
                return;
            }

            // 扫描和分组文件
            const filesByTimestamp = await this.scanAndGroupFiles();
            console.log(`📁 扫描到 ${Object.keys(filesByTimestamp).length} 个不同时间戳的文件组`);

            // 逐个修复消息
            console.log('\n🔄 开始匹配和修复...');
            for (const message of missingMessages) {
                try {
                    const matchedFile = await this.matchMessageToFile(message, filesByTimestamp);
                    if (matchedFile) {
                        const stats = await this.getFileStats(matchedFile);
                        if (stats) {
                            await this.createFileRecord(message.file_id, matchedFile, stats);
                            this.stats.repairedRecords++;
                            this.stats.matchedFiles++;
                        }
                    } else {
                        console.log(`❓ 未找到匹配文件: ${message.file_id}`);
                    }
                } catch (error) {
                    console.error(`❌ 修复消息失败: ${message.id}`, error);
                    this.stats.errors++;
                }
            }

            // 输出统计信息
            console.log('\n📊 修复统计:');
            console.log(`   📋 需修复消息: ${this.stats.foundMessages}`);
            console.log(`   📁 匹配文件数: ${this.stats.matchedFiles}`);
            console.log(`   💾 创建记录数: ${this.stats.repairedRecords}`);
            console.log(`   ❌ 错误数量: ${this.stats.errors}`);

            if (this.stats.repairedRecords > 0) {
                console.log('\n✅ 智能修复完成！');
                console.log('💡 建议: 重新加载聊天窗口查看修复效果');
            } else {
                console.log('\n🤔 没有成功修复任何记录');
            }

        } catch (error) {
            console.error('❌ 修复过程出错:', error);
        } finally {
            if (this.db) {
                this.db.close();
                console.log('📝 数据库连接已关闭');
            }
        }
    }
}

// 主函数
async function main() {
    const repairer = new SmartImageRepairer();
    await repairer.repair();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = SmartImageRepairer;