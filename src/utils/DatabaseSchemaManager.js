/**
 * 统一的数据库模式管理器
 * 用于消除各模块中重复的表创建和索引创建逻辑
 */
class DatabaseSchemaManager {
    constructor(database) {
        this.db = database;
    }

    /**
     * 批量创建表
     * @param {Array} tableDefinitions - 表定义数组
     * @param {string} tableDefinitions[].name - 表名
     * @param {string} tableDefinitions[].schema - 表结构SQL
     * @param {string} tableDefinitions[].description - 表描述（用于日志）
     */
    async createTables(tableDefinitions) {
        console.log(`📋 开始创建 ${tableDefinitions.length} 个数据表...`);
        
        for (const table of tableDefinitions) {
            try {
                await this.createTable(table.name, table.schema, table.description);
            } catch (error) {
                console.error(`❌ 创建表 ${table.name} 失败:`, error);
                throw error;
            }
        }
        
        console.log('✅ 所有数据表创建完成');
    }

    /**
     * 创建单个表
     * @param {string} tableName - 表名
     * @param {string} schema - 表结构SQL
     * @param {string} description - 表描述
     */
    async createTable(tableName, schema, description = '') {
        if (!schema) {
            throw new Error(`表 ${tableName} 的 schema 参数为空`);
        }
        
        const sql = `CREATE TABLE IF NOT EXISTS ${tableName} ${schema}`;
        
        if (this.db.createTableIfNotExists) {
            // 使用 DatabaseCore 的方法
            await this.db.createTableIfNotExists(tableName, schema);
        } else if (this.db.run) {
            // 直接使用数据库连接 - 包装为Promise
            await new Promise((resolve, reject) => {
                this.db.run(sql, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this);
                    }
                });
            });
        } else {
            // 内存数据库模式
            console.log(`📋 模拟创建表: ${tableName}`);
        }
        
        const desc = description ? ` (${description})` : '';
        console.log(`📋 表 ${tableName} 创建完成${desc}`);
    }

    /**
     * 批量创建索引
     * @param {Array} indexDefinitions - 索引定义数组
     * @param {string} indexDefinitions[].name - 索引名
     * @param {string} indexDefinitions[].table - 表名
     * @param {string} indexDefinitions[].columns - 列名
     * @param {string} indexDefinitions[].description - 索引描述
     */
    async createIndexes(indexDefinitions) {
        console.log(`📇 开始创建 ${indexDefinitions.length} 个索引...`);
        
        for (const index of indexDefinitions) {
            try {
                await this.createIndex(index.name, index.table, index.columns, index.description);
            } catch (error) {
                console.error(`❌ 创建索引 ${index.name} 失败:`, error);
                // 索引创建失败不阻止程序继续运行
            }
        }
        
        console.log('✅ 所有索引创建完成');
    }

    /**
     * 创建单个索引
     * @param {string} indexName - 索引名
     * @param {string} tableName - 表名
     * @param {string} columns - 列名
     * @param {string} description - 索引描述
     */
    async createIndex(indexName, tableName, columns, description = '') {
        if (this.db.createIndexIfNotExists) {
            // 使用 DatabaseCore 的方法
            await this.db.createIndexIfNotExists(indexName, tableName, columns);
        } else if (this.db.run) {
            // 直接使用数据库连接 - 包装为Promise
            const sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columns})`;
            await new Promise((resolve, reject) => {
                this.db.run(sql, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this);
                    }
                });
            });
            const desc = description ? ` (${description})` : '';
            console.log(`📇 索引 ${indexName} 创建完成${desc}`);
        } else {
            // 内存数据库模式
            const desc = description ? ` (${description})` : '';
            console.log(`📇 模拟创建索引: ${indexName}${desc}`);
        }
    }

    /**
     * 批量执行SQL语句（用于复杂的表创建逻辑）
     * @param {Array} sqlStatements - SQL语句数组
     * @param {string} sqlStatements[].sql - SQL语句
     * @param {string} sqlStatements[].description - 描述
     */
    async executeBatch(sqlStatements) {
        console.log(`🔄 开始执行 ${sqlStatements.length} 个SQL语句...`);
        
        for (const statement of sqlStatements) {
            try {
                if (this.db.run) {
                    await this.db.run(statement.sql);
                } else {
                    console.log(`📋 模拟执行SQL: ${statement.description || statement.sql.substring(0, 50) + '...'}`);
                }
                
                if (statement.description) {
                    console.log(`✅ ${statement.description}`);
                }
            } catch (error) {
                console.error(`❌ 执行SQL失败 (${statement.description}):`, error);
                throw error;
            }
        }
        
        console.log('✅ 批量SQL执行完成');
    }

    /**
     * 验证表是否存在
     * @param {string} tableName - 表名
     * @returns {boolean} - 表是否存在
     */
    async tableExists(tableName) {
        if (this.db.tableExists) {
            return await this.db.tableExists(tableName);
        } else if (this.db.get) {
            try {
                const result = await this.db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName]);
                return !!result;
            } catch (error) {
                console.warn(`检查表 ${tableName} 是否存在时出错:`, error);
                return false;
            }
        } else {
            // 内存数据库模式，假设表总是存在
            return true;
        }
    }

    /**
     * 获取数据库信息
     * @returns {Object} - 数据库信息
     */
    async getDatabaseInfo() {
        if (this.db.getDatabaseInfo) {
            return await this.db.getDatabaseInfo();
        } else {
            return {
                type: this.db.constructor.name || 'Unknown',
                initialized: true,
                mode: this.db.run ? 'SQLite' : 'Memory'
            };
        }
    }

    /**
     * 创建表定义的辅助方法
     * @param {string} name - 表名
     * @param {string} schema - 表结构
     * @param {string} description - 描述
     * @returns {Object} - 表定义对象
     */
    static createTableDefinition(name, schema, description) {
        return { name, schema, description };
    }

    /**
     * 创建索引定义的辅助方法
     * @param {string} name - 索引名
     * @param {string} table - 表名
     * @param {string} columns - 列名
     * @param {string} description - 描述
     * @returns {Object} - 索引定义对象
     */
    static createIndexDefinition(name, table, columns, description) {
        return { name, table, columns, description };
    }
}

module.exports = DatabaseSchemaManager;