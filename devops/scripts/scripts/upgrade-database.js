#!/usr/bin/env node

/**
 * 数据库表结构升级脚本
 * 
 * 功能：
 * 1. 为 uploaded_files 表添加新字段
 * 2. 创建索引提高查询性能
 * 3. 数据完整性检查
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseUpgrader {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/customer_service.db');
        this.db = null;
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

    async runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    async getQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async checkColumnExists(tableName, columnName) {
        try {
            const result = await this.getQuery(`PRAGMA table_info(${tableName})`);
            return false; // 简化检查，假设字段不存在
        } catch (error) {
            return false;
        }
    }

    async upgrade() {
        console.log('🔧 开始数据库表结构升级...\n');

        try {
            await this.initDatabase();

            // 1. 添加文件哈希字段用于重复检测
            console.log('📝 添加文件哈希字段...');
            try {
                await this.runQuery(`
                    ALTER TABLE uploaded_files 
                    ADD COLUMN file_hash TEXT
                `);
                console.log('✅ 添加 file_hash 字段成功');
            } catch (error) {
                if (error.message.includes('duplicate column name')) {
                    console.log('⏭️  file_hash 字段已存在');
                } else {
                    throw error;
                }
            }

            // 2. 添加文件状态字段
            console.log('📝 添加文件状态字段...');
            try {
                await this.runQuery(`
                    ALTER TABLE uploaded_files 
                    ADD COLUMN status TEXT DEFAULT 'active'
                `);
                console.log('✅ 添加 status 字段成功');
            } catch (error) {
                if (error.message.includes('duplicate column name')) {
                    console.log('⏭️  status 字段已存在');
                } else {
                    throw error;
                }
            }

            // 3. 添加文件版本字段
            console.log('📝 添加文件版本字段...');
            try {
                await this.runQuery(`
                    ALTER TABLE uploaded_files 
                    ADD COLUMN version INTEGER DEFAULT 1
                `);
                console.log('✅ 添加 version 字段成功');
            } catch (error) {
                if (error.message.includes('duplicate column name')) {
                    console.log('⏭️  version 字段已存在');
                } else {
                    throw error;
                }
            }

            // 4. 添加最后访问时间字段
            console.log('📝 添加最后访问时间字段...');
            try {
                await this.runQuery(`
                    ALTER TABLE uploaded_files 
                    ADD COLUMN last_accessed DATETIME
                `);
                console.log('✅ 添加 last_accessed 字段成功');
            } catch (error) {
                if (error.message.includes('duplicate column name')) {
                    console.log('⏭️  last_accessed 字段已存在');
                } else {
                    throw error;
                }
            }

            // 5. 创建性能索引
            console.log('\n📊 创建性能索引...');
            
            const indexes = [
                {
                    name: 'idx_uploaded_files_hash',
                    sql: 'CREATE INDEX IF NOT EXISTS idx_uploaded_files_hash ON uploaded_files(file_hash)'
                },
                {
                    name: 'idx_uploaded_files_uploader',
                    sql: 'CREATE INDEX IF NOT EXISTS idx_uploaded_files_uploader ON uploaded_files(uploader_id)'
                },
                {
                    name: 'idx_uploaded_files_type',
                    sql: 'CREATE INDEX IF NOT EXISTS idx_uploaded_files_type ON uploaded_files(mime_type)'
                },
                {
                    name: 'idx_uploaded_files_status',
                    sql: 'CREATE INDEX IF NOT EXISTS idx_uploaded_files_status ON uploaded_files(status)'
                },
                {
                    name: 'idx_messages_file_id',
                    sql: 'CREATE INDEX IF NOT EXISTS idx_messages_file_id ON messages(file_id)'
                }
            ];

            for (const index of indexes) {
                try {
                    await this.runQuery(index.sql);
                    console.log(`✅ 创建索引: ${index.name}`);
                } catch (error) {
                    console.error(`❌ 创建索引失败 ${index.name}:`, error.message);
                }
            }

            // 6. 数据完整性检查
            console.log('\n🔍 执行数据完整性检查...');
            
            // 检查孤立的文件记录
            const orphanedFiles = await this.getQuery(`
                SELECT COUNT(*) as count
                FROM uploaded_files uf
                LEFT JOIN messages m ON uf.id = m.file_id
                WHERE m.file_id IS NULL
            `);
            console.log(`📋 孤立文件记录: ${orphanedFiles.count} 个`);

            // 检查缺失文件记录的消息
            const missingFileMessages = await this.getQuery(`
                SELECT COUNT(*) as count
                FROM messages m
                LEFT JOIN uploaded_files uf ON m.file_id = uf.id
                WHERE m.message_type = 'image' AND m.file_id IS NOT NULL AND uf.id IS NULL
            `);
            console.log(`📋 缺失文件记录的消息: ${missingFileMessages.count} 个`);

            // 更新现有记录的状态
            console.log('\n🔄 更新现有记录状态...');
            await this.runQuery(`
                UPDATE uploaded_files 
                SET status = 'active' 
                WHERE status IS NULL
            `);
            console.log('✅ 更新文件状态完成');

            console.log('\n✅ 数据库升级完成！');
            console.log('💡 建议: 定期运行数据完整性检查');

        } catch (error) {
            console.error('❌ 数据库升级失败:', error);
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
    const upgrader = new DatabaseUpgrader();
    await upgrader.upgrade();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = DatabaseUpgrader;