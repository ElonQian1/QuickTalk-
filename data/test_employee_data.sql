-- 插入测试用户数据
INSERT OR IGNORE INTO users (id, username, email, role, created_at) VALUES 
('user_001', 'alice', 'alice@example.com', 'user', '2024-01-15 10:00:00'),
('user_002', 'bob', 'bob@example.com', 'user', '2024-01-16 11:00:00'),
('user_003', 'charlie', 'charlie@example.com', 'shop_owner', '2024-01-17 12:00:00'),
('user_004', 'diana', 'diana@example.com', 'user', '2024-01-18 13:00:00'),
('user_005', 'eve', 'eve@example.com', 'user', '2024-01-19 14:00:00');

-- 插入测试员工数据
INSERT OR IGNORE INTO employees (id, shop_id, name, email, role, status, created_at) VALUES 
('emp_001', 'test_shop_001', 'Alice Johnson', 'alice@example.com', 'agent', 'active', '2024-01-20 10:00:00'),
('emp_002', 'test_shop_001', 'Bob Smith', 'bob@example.com', 'manager', 'active', '2024-01-21 11:00:00'),
('emp_003', 'test_shop_002', 'Charlie Brown', 'charlie@example.com', 'agent', 'inactive', '2024-01-22 12:00:00');

-- 插入测试邀请数据
INSERT OR IGNORE INTO employee_invitations (id, shop_id, inviter_id, invitee_email, role, message, token, status, expires_at, created_at) VALUES 
('inv_001', 'test_shop_001', 'user_003', 'diana@example.com', 'agent', '欢迎加入我们的客服团队！', 'token_diana_001', 'pending', '2024-02-15 23:59:59', '2024-01-25 10:00:00'),
('inv_002', 'test_shop_001', 'user_003', 'eve@example.com', 'viewer', '邀请您查看我们的客服数据', 'token_eve_002', 'pending', '2024-02-16 23:59:59', '2024-01-26 11:00:00'),
('inv_003', 'test_shop_001', 'user_003', 'rejected@example.com', 'agent', '', 'token_rejected_003', 'rejected', '2024-02-10 23:59:59', '2024-01-20 10:00:00'),
('inv_004', 'test_shop_001', 'user_003', 'expired@example.com', 'agent', '', 'token_expired_004', 'expired', '2024-01-25 23:59:59', '2024-01-15 10:00:00');

-- 插入测试权限数据
INSERT OR IGNORE INTO employee_permissions (id, employee_id, permission, granted_at) VALUES 
('perm_001', 'emp_001', 'read_conversations', '2024-01-20 10:00:00'),
('perm_002', 'emp_001', 'write_messages', '2024-01-20 10:00:00'),
('perm_003', 'emp_002', 'read_conversations', '2024-01-21 11:00:00'),
('perm_004', 'emp_002', 'write_messages', '2024-01-21 11:00:00'),
('perm_005', 'emp_002', 'manage_employees', '2024-01-21 11:00:00'),
('perm_006', 'emp_002', 'view_analytics', '2024-01-21 11:00:00');

-- 验证数据插入
SELECT 'Users:' as table_name, count(*) as count FROM users
UNION ALL
SELECT 'Employees:', count(*) FROM employees
UNION ALL
SELECT 'Invitations:', count(*) FROM employee_invitations
UNION ALL
SELECT 'Permissions:', count(*) FROM employee_permissions;