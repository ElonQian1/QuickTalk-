#!/usr/bin/env node
/**
 * 数据库迁移脚本
 * 从旧版 Node.js 数据库迁移数据到新版 Rust 数据库
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🔄 开始数据库迁移...');

// 数据库文件路径
const OLD_DB = './temp_old_database.db';
const NEW_DB = './quicktalk.sqlite';

if (!fs.existsSync(OLD_DB)) {
    console.error('❌ 旧数据库文件不存在:', OLD_DB);
    process.exit(1);
}

if (!fs.existsSync(NEW_DB)) {
    console.error('❌ 新数据库文件不存在:', NEW_DB);
    console.log('💡 请先启动 Rust 服务器以创建新数据库');
    process.exit(1);
}

async function migrateData() {
    const oldDb = new sqlite3.Database(OLD_DB);
    const newDb = new sqlite3.Database(NEW_DB);

    console.log('📊 分析旧数据库...');
    
    // 获取统计信息
    const oldStats = await new Promise((resolve, reject) => {
        const stats = {};
        let completed = 0;
        const tables = ['messages', 'conversations', 'shops', 'users'];
        
        tables.forEach(table => {
            oldDb.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
                if (err) {
                    stats[table] = 0;
                } else {
                    stats[table] = row.count;
                }
                completed++;
                if (completed === tables.length) resolve(stats);
            });
        });
    });

    console.log('📈 旧数据库统计:');
    Object.entries(oldStats).forEach(([table, count]) => {
        console.log(`   ${table}: ${count}条记录`);
    });

    console.log('\n🔄 开始数据迁移...');

    try {
        // 1. 清理新数据库
        console.log('🧹 清理新数据库现有数据...');
        await runQuery(newDb, 'DELETE FROM messages');
        await runQuery(newDb, 'DELETE FROM conversations');
        await runQuery(newDb, 'DELETE FROM customers');
        await runQuery(newDb, 'DELETE FROM shops');
        await runQuery(newDb, 'DELETE FROM admins');

        // 2. 迁移商店数据
        console.log('🏪 迁移商店数据...');
        const shops = await getRows(oldDb, `
            SELECT id, name, domain, api_key, status, created_at 
            FROM shops
        `);

        for (const shop of shops) {
            await runQuery(newDb, `
                INSERT INTO shops (id, name, domain, api_key, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                shop.id,
                shop.name || 'Unknown Shop',
                shop.domain || 'localhost',
                shop.api_key || `key_${shop.id}`,
                shop.status || 'active',
                shop.created_at || new Date().toISOString()
            ]);
        }
        console.log(`✅ 迁移了 ${shops.length} 个商店`);

        // 3. 基于消息创建客户数据
        console.log('👥 创建客户数据...');
        const customers = await getRows(oldDb, `
            SELECT DISTINCT user_id, MIN(created_at) as first_seen
            FROM messages 
            WHERE user_id IS NOT NULL AND user_id != ''
            GROUP BY user_id
        `);

        for (const customer of customers) {
            await runQuery(newDb, `
                INSERT OR IGNORE INTO customers (id, name, email, phone, avatar, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                customer.user_id,
                `Customer_${customer.user_id}`,
                null,
                null,
                null,
                customer.first_seen || new Date().toISOString()
            ]);
        }
        console.log(`✅ 创建了 ${customers.length} 个客户`);

        // 4. 创建会话数据
        console.log('💬 创建会话数据...');
        const conversationGroups = await getRows(oldDb, `
            SELECT shop_id, user_id, 
                   MIN(created_at) as created_at, 
                   MAX(created_at) as updated_at,
                   COUNT(*) as message_count
            FROM messages 
            WHERE shop_id IS NOT NULL AND user_id IS NOT NULL 
                AND shop_id != '' AND user_id != ''
            GROUP BY shop_id, user_id
        `);

        for (const group of conversationGroups) {
            const conversationId = `conv_${group.shop_id}_${group.user_id}`;
            await runQuery(newDb, `
                INSERT OR IGNORE INTO conversations (id, shop_id, customer_id, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                conversationId,
                group.shop_id,
                group.user_id,
                'active',
                group.created_at,
                group.updated_at
            ]);
        }
        console.log(`✅ 创建了 ${conversationGroups.length} 个会话`);

        // 5. 迁移消息数据
        console.log('📝 迁移消息数据...');
        const messages = await getRows(oldDb, `
            SELECT id, shop_id, user_id, admin_id, message, sender, 
                   message_type, created_at
            FROM messages 
            WHERE shop_id IS NOT NULL AND user_id IS NOT NULL 
                AND shop_id != '' AND user_id != ''
                AND message IS NOT NULL AND message != ''
            ORDER BY created_at
        `);

        let migratedMessages = 0;
        for (const msg of messages) {
            const conversationId = `conv_${msg.shop_id}_${msg.user_id}`;
            let senderId, senderType;

            if (msg.sender === 'user') {
                senderId = msg.user_id;
                senderType = 'customer';
            } else if (msg.sender === 'admin' && msg.admin_id) {
                senderId = msg.admin_id;
                senderType = 'agent';
            } else {
                senderId = 'system';
                senderType = 'agent';
            }

            try {
                await runQuery(newDb, `
                    INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, message_type, timestamp, shop_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    msg.id,
                    conversationId,
                    senderId,
                    senderType,
                    msg.message,
                    msg.message_type || 'text',
                    msg.created_at,
                    msg.shop_id
                ]);
                migratedMessages++;
            } catch (error) {
                console.warn(`⚠️ 跳过消息 ${msg.id}: ${error.message}`);
            }
        }
        console.log(`✅ 迁移了 ${migratedMessages}/${messages.length} 条消息`);

        // 6. 创建默认管理员
        console.log('👨‍💼 创建管理员数据...');
        const admins = await getRows(oldDb, `
            SELECT DISTINCT admin_id, MIN(created_at) as first_seen
            FROM messages 
            WHERE admin_id IS NOT NULL AND admin_id != '' AND sender = 'admin'
            GROUP BY admin_id
        `);

        for (const admin of admins) {
            await runQuery(newDb, `
                INSERT OR IGNORE INTO admins (id, username, password_hash, role, created_at)
                VALUES (?, ?, ?, ?, ?)
            `, [
                admin.admin_id,
                `admin_${admin.admin_id}`,
                '$2b$10$defaulthashedfakepassword',
                'admin',
                admin.first_seen || new Date().toISOString()
            ]);
        }
        console.log(`✅ 创建了 ${admins.length} 个管理员`);

        // 验证迁移结果
        console.log('\n📊 验证迁移结果...');
        const newStats = await new Promise((resolve, reject) => {
            const stats = {};
            let completed = 0;
            const tables = ['messages', 'conversations', 'customers', 'shops', 'admins'];
            
            tables.forEach(table => {
                newDb.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
                    if (err) {
                        stats[table] = 0;
                    } else {
                        stats[table] = row.count;
                    }
                    completed++;
                    if (completed === tables.length) resolve(stats);
                });
            });
        });

        console.log('📈 新数据库统计:');
        Object.entries(newStats).forEach(([table, count]) => {
            console.log(`   ${table}: ${count}条记录`);
        });

        console.log('\n🎉 数据迁移完成！');
        
    } catch (error) {
        console.error('❌ 迁移过程中出错:', error);
        throw error;
    } finally {
        oldDb.close();
        newDb.close();
    }
}

// 辅助函数
function runQuery(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function getRows(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// 执行迁移
migrateData().catch(error => {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
});