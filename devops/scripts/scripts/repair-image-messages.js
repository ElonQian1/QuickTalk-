#!/usr/bin/env node

/**
 * 历史图片消息数据修复脚本
 * 
 * 功能：
 * 1. 扫描 uploads/image 目录中的所有图片文件
 * 2. 重建 uploaded_files 表的文件记录
 * 3. 关联到对应的消息记录
 * 4. 修复历史图片消息的显示问题
 */

const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class ImageMessageRepairer {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/customer_service.db');
        this.uploadsDir = path.join(__dirname, '../uploads/image');
        this.db = null;
        this.stats = {
            foundFiles: 0,
            repairedMessages: 0,
            createdRecords: 0,
            errors: 0
        };
    }

    /**
     * 初始化数据库连接
     */
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
     * 扫描上传目录中的所有图片文件
     */
    async scanImageFiles() {
        try {
            console.log('🔍 扫描图片文件...');
            const files = await fs.readdir(this.uploadsDir);
            
            const imageFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
            });

            console.log(`📁 找到 ${imageFiles.length} 个图片文件`);
            this.stats.foundFiles = imageFiles.length;
            
            return imageFiles;
        } catch (error) {
            console.error('❌ 扫描文件失败:', error);
            return [];
        }
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
     * 从文件名提取可能的file_id
     */
    extractFileIdFromName(filename) {
        // 假设文件名格式: timestamp_randomstring.ext
        // 生成对应的file_id: file_timestamp_randomstring
        const nameWithoutExt = path.parse(filename).name;
        
        // 尝试匹配时间戳_随机字符串格式
        const match = nameWithoutExt.match(/^(\d{13})_([a-z0-9]+)$/);
        if (match) {
            return `file_${match[1]}_${match[2]}`;
        }
        
        // 如果格式不匹配，生成一个新的ID
        return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 检查文件记录是否已存在
     */
    async fileRecordExists(filename) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT id FROM uploaded_files WHERE filename = ?',
                [filename],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(!!row);
                }
            );
        });
    }

    /**
     * 查找使用该文件的消息
     */
    async findMessagesUsingFile(possibleFileIds) {
        return new Promise((resolve, reject) => {
            const placeholders = possibleFileIds.map(() => '?').join(',');
            this.db.all(
                `SELECT id, file_id, message_type FROM messages WHERE file_id IN (${placeholders}) AND message_type = 'image'`,
                possibleFileIds,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    /**
     * 创建文件记录
     */
    async createFileRecord(filename, fileId, stats) {
        return new Promise((resolve, reject) => {
            const mimeType = this.getMimeType(filename);
            
            this.db.run(
                `INSERT OR IGNORE INTO uploaded_files 
                 (id, original_name, filename, file_path, file_size, mime_type, upload_time, uploader_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    fileId,
                    filename, // 原始文件名
                    filename, // 存储文件名
                    path.join('uploads/image', filename), // 文件路径
                    stats.size,
                    mimeType,
                    stats.createdAt.toISOString(),
                    'system_repair' // 标记为系统修复
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
     * 修复单个文件
     */
    async repairFile(filename) {
        try {
            // 检查文件记录是否已存在
            if (await this.fileRecordExists(filename)) {
                console.log(`⏭️  文件记录已存在: ${filename}`);
                return;
            }

            // 获取文件统计信息
            const stats = await this.getFileStats(filename);
            if (!stats) return;

            // 提取可能的file_id
            const possibleFileId = this.extractFileIdFromName(filename);
            
            // 查找使用该文件的消息
            const messages = await this.findMessagesUsingFile([possibleFileId]);
            
            if (messages.length > 0) {
                // 创建文件记录
                const created = await this.createFileRecord(filename, possibleFileId, stats);
                if (created) {
                    this.stats.createdRecords++;
                    this.stats.repairedMessages += messages.length;
                    console.log(`✅ 修复成功: ${filename} -> ${messages.length} 条消息`);
                }
            } else {
                // 创建一个新的文件记录，即使没有关联的消息
                const newFileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const created = await this.createFileRecord(filename, newFileId, stats);
                if (created) {
                    this.stats.createdRecords++;
                    console.log(`📝 创建孤立文件记录: ${filename}`);
                }
            }

        } catch (error) {
            console.error(`❌ 修复文件失败: ${filename}`, error);
            this.stats.errors++;
        }
    }

    /**
     * 执行修复
     */
    async repair() {
        console.log('🔧 开始历史图片消息数据修复...\n');

        try {
            // 初始化数据库
            await this.initDatabase();

            // 扫描图片文件
            const imageFiles = await this.scanImageFiles();
            
            if (imageFiles.length === 0) {
                console.log('❓ 没有找到需要修复的图片文件');
                return;
            }

            // 逐个修复文件
            console.log('\n🔄 开始修复文件记录...');
            for (const filename of imageFiles) {
                await this.repairFile(filename);
            }

            // 输出统计信息
            console.log('\n📊 修复统计:');
            console.log(`   📁 扫描文件数: ${this.stats.foundFiles}`);
            console.log(`   💾 创建记录数: ${this.stats.createdRecords}`);
            console.log(`   🔗 修复消息数: ${this.stats.repairedMessages}`);
            console.log(`   ❌ 错误数量: ${this.stats.errors}`);

            if (this.stats.createdRecords > 0) {
                console.log('\n✅ 历史数据修复完成！');
                console.log('💡 建议: 重新加载聊天窗口查看修复效果');
            } else {
                console.log('\n🤔 没有创建新的文件记录，可能数据已经是最新的');
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
    const repairer = new ImageMessageRepairer();
    await repairer.repair();
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ImageMessageRepairer;