-- 完全重置数据库到干净状态
-- 禁用外键约束
PRAGMA foreign_keys = OFF;

-- 删除所有数据
DELETE FROM messages;
DELETE FROM conversations;
DELETE FROM customers;
DELETE FROM employees;
DELETE FROM activation_orders;
DELETE FROM shops;
DELETE FROM admins;

-- 重新启用外键约束
PRAGMA foreign_keys = ON;

-- 验证清理结果
SELECT 'admins' as table_name, COUNT(*) as count FROM admins
UNION ALL
SELECT 'shops' as table_name, COUNT(*) as count FROM shops
UNION ALL
SELECT 'customers' as table_name, COUNT(*) as count FROM customers
UNION ALL
SELECT 'messages' as table_name, COUNT(*) as count FROM messages
UNION ALL
SELECT 'conversations' as table_name, COUNT(*) as count FROM conversations;