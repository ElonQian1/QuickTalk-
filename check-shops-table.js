const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function checkShopsTable() {
    console.log('🔍 检查shops表结构...');

    const dbPath = path.join(__dirname, 'data/customer_service.db');
    const db = new sqlite3.Database(dbPath);

    db.all("PRAGMA table_info(shops)", (err, columns) => {
        if (err) {
            console.error('❌ 检查失败:', err.message);
            db.close();
            return;
        }

        console.log('\n📋 shops表字段列表:');
        columns.forEach((col, index) => {
            console.log(`${index + 1}. ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
        });

        // 检查API密钥相关字段
        const hasApiKey = columns.some(col => col.name === 'api_key');
        const hasApiKeyCreatedAt = columns.some(col => col.name === 'api_key_created_at');

        console.log('\n🔍 API密钥字段状态:');
        console.log(`api_key: ${hasApiKey ? '✅ 存在' : '❌ 不存在'}`);
        console.log(`api_key_created_at: ${hasApiKeyCreatedAt ? '✅ 存在' : '❌ 不存在'}`);

        if (!hasApiKey || !hasApiKeyCreatedAt) {
            console.log('\n⚠️  发现缺失字段，需要添加');
        } else {
            console.log('\n✅ 所有API密钥字段都存在');
        }

        db.close();
    });
}

checkShopsTable();
