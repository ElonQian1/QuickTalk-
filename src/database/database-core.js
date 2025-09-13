/**
 * 数据库核心操作模块
 * 提供统一的数据库连接和基础操作
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseCore {
    constructor(dbPath = './data/customer_service.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.isInitialized = false;
    }

    /**
     * 初始化数据库连接
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ 数据库连接失败:', err.message);
                    reject(err);
                } else {
                    console.log('✅ 数据库连接成功');
                    this.isInitialized = true;
                    resolve();
                }
            });
        });
    }

    /**
     * 执行SQL查询
     */
    async query(sql, params = []) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('❌ SQL查询失败:', err.message);
                    console.error('SQL:', sql);
                    console.error('参数:', params);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * 执行SQL命令（INSERT, UPDATE, DELETE）
     */
    async run(sql, params = []) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('❌ SQL执行失败:', err.message);
                    console.error('SQL:', sql);
                    console.error('参数:', params);
                    reject(err);
                } else {
                    resolve({
                        changes: this.changes,
                        lastID: this.lastID
                    });
                }
            });
        });
    }

    /**
     * 获取单行数据
     */
    async get(sql, params = []) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('❌ SQL获取失败:', err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * 开始事务
     */
    async beginTransaction() {
        await this.run('BEGIN TRANSACTION');
    }

    /**
     * 提交事务
     */
    async commit() {
        await this.run('COMMIT');
    }

    /**
     * 回滚事务
     */
    async rollback() {
        await this.run('ROLLBACK');
    }

    /**
     * 执行事务
     */
    async transaction(callback) {
        try {
            await this.beginTransaction();
            const result = await callback(this);
            await this.commit();
            return result;
        } catch (error) {
            await this.rollback();
            throw error;
        }
    }

    /**
     * 检查表是否存在
     */
    async tableExists(tableName) {
        const sql = `
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name=?
        `;
        const row = await this.get(sql, [tableName]);
        return !!row;
    }

    /**
     * 创建表（如果不存在）
     */
    async createTableIfNotExists(tableName, schema) {
        const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${schema})`;
        await this.run(sql);
        console.log(`📋 表 ${tableName} 创建完成`);
    }

    /**
     * 创建索引（如果不存在）
     */
    async createIndexIfNotExists(indexName, tableName, columns) {
        const sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columns})`;
        await this.run(sql);
        console.log(`📇 索引 ${indexName} 创建完成`);
    }

    /**
     * 关闭数据库连接
     */
    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ 数据库关闭失败:', err.message);
                    } else {
                        console.log('✅ 数据库连接已关闭');
                    }
                    this.isInitialized = false;
                    resolve();
                });
            });
        }
    }

    /**
     * 获取数据库信息
     */
    async getDatabaseInfo() {
        const tables = await this.query(`
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            ORDER BY name
        `);

        const info = {
            path: this.dbPath,
            connected: this.isInitialized,
            tables: tables.map(t => t.name),
            version: await this.query('SELECT sqlite_version() as version')
        };

        return info;
    }
}

module.exports = DatabaseCore;
