-- 数据库迁移脚本：从旧版本迁移到新版本
-- 从 customer_service.db (Node.js版本) 迁移到 quicktalk.sqlite (Rust版本)

-- 1. 首先清理新数据库的现有数据
DELETE FROM messages;
DELETE FROM conversations;
DELETE FROM customers;
DELETE FROM shops;
DELETE FROM admins;

-- 2. 迁移商店数据
INSERT INTO shops (id, name, domain, api_key, status, created_at)
SELECT 
    id,
    name,
    COALESCE(domain, 'localhost') as domain,
    COALESCE(api_key, 'default_key_' || id) as api_key,
    CASE 
        WHEN status IS NULL OR status = '' THEN 'active'
        ELSE status 
    END as status,
    COALESCE(created_at, CURRENT_TIMESTAMP) as created_at
FROM temp_shops;

-- 3. 创建默认客户数据（基于消息中的用户）
INSERT OR IGNORE INTO customers (id, name, email, phone, avatar, created_at)
SELECT DISTINCT
    user_id as id,
    'Customer_' || user_id as name,
    NULL as email,
    NULL as phone,
    NULL as avatar,
    MIN(created_at) as created_at
FROM temp_messages
WHERE user_id IS NOT NULL AND user_id != '';

-- 4. 创建会话数据（基于消息中的shop_id和user_id组合）
INSERT OR IGNORE INTO conversations (id, shop_id, customer_id, status, created_at, updated_at)
SELECT DISTINCT
    'conv_' || shop_id || '_' || user_id as id,
    shop_id,
    user_id as customer_id,
    'active' as status,
    MIN(created_at) as created_at,
    MAX(created_at) as updated_at
FROM temp_messages
WHERE shop_id IS NOT NULL AND user_id IS NOT NULL 
    AND shop_id != '' AND user_id != ''
GROUP BY shop_id, user_id;

-- 5. 迁移消息数据（需要映射字段）
INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, message_type, timestamp, shop_id)
SELECT 
    id,
    'conv_' || shop_id || '_' || user_id as conversation_id,
    CASE 
        WHEN sender = 'user' THEN user_id
        WHEN sender = 'admin' AND admin_id IS NOT NULL THEN admin_id
        ELSE 'unknown'
    END as sender_id,
    CASE 
        WHEN sender = 'user' THEN 'customer'
        WHEN sender = 'admin' THEN 'agent'
        ELSE 'agent'
    END as sender_type,
    message as content,
    COALESCE(message_type, 'text') as message_type,
    created_at as timestamp,
    shop_id
FROM temp_messages
WHERE shop_id IS NOT NULL AND user_id IS NOT NULL
    AND shop_id != '' AND user_id != ''
    AND message IS NOT NULL AND message != '';

-- 6. 创建默认管理员用户（基于消息中的admin_id）
INSERT OR IGNORE INTO admins (id, username, password_hash, role, created_at)
SELECT DISTINCT
    admin_id as id,
    'admin_' || admin_id as username,
    '$2b$10$defaulthashedfakepassword' as password_hash,
    'admin' as role,
    MIN(created_at) as created_at
FROM temp_messages
WHERE admin_id IS NOT NULL AND admin_id != ''
    AND sender = 'admin';