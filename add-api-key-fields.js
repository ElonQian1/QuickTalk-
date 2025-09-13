const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function addApiKeyFields() {
    console.log('🔄 开始添加API密钥字段到shops表...');

    const dbPath = path.join(__dirname, 'data/customer_service.db');
    const db = new sqlite3.Database(dbPath);

    return new Promise((resolve, reject) => {
        // 检查字段是否已存在
        db.all("PRAGMA table_info(shops)", (err, columns) => {
            if (err) {
                reject(err);
                return;
            }

            const hasApiKey = columns.some(col => col.name === 'api_key');
            const hasApiKeyCreatedAt = columns.some(col => col.name === 'api_key_created_at');

            if (hasApiKey && hasApiKeyCreatedAt) {
                console.log('✅ API密钥字段已存在，无需添加');
                db.close();
                resolve();
                return;
            }

            console.log('📋 当前shops表字段:');
            columns.forEach(col => {
                console.log(`  - ${col.name}: ${col.type}`);
            });

            // 添加api_key字段
            const addFields = [];
            if (!hasApiKey) {
                addFields.push("ALTER TABLE shops ADD COLUMN api_key TEXT");
            }
            if (!hasApiKeyCreatedAt) {
                addFields.push("ALTER TABLE shops ADD COLUMN api_key_created_at DATETIME");
            }

            let completed = 0;
            const total = addFields.length;

            if (total === 0) {
                console.log('✅ 所有字段已存在');
                db.close();
                resolve();
                return;
            }

            addFields.forEach((sql, index) => {
                db.run(sql, (err) => {
                    if (err) {
                        console.error(`❌ 添加字段失败 (${index + 1}/${total}):`, err.message);
                        reject(err);
                        return;
                    }

                    completed++;
                    console.log(`✅ 字段添加成功 (${completed}/${total}): ${sql}`);

                    if (completed === total) {
                        console.log('🎉 所有API密钥字段添加完成！');
                        
                        // 验证字段添加成功
                        db.all("PRAGMA table_info(shops)", (err, newColumns) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            console.log('\n📋 更新后的shops表字段:');
                            newColumns.forEach(col => {
                                console.log(`  - ${col.name}: ${col.type}`);
                            });

                            db.close();
                            resolve();
                        });
                    }
                });
            });
        });
    });
}

// 运行迁移
addApiKeyFields().then(() => {
    console.log('✅ 数据库迁移完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 数据库迁移失败:', error.message);
    process.exit(1);
});
