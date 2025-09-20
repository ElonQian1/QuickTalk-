-- 员工管理系统数据库迁移脚本
-- 创建日期: 2025-09-20

-- 1. 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    avatar TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'shop_owner', 'user')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'banned')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 更新员工表结构
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    user_id TEXT NOT NULL,  -- 关联到users表
    invited_by TEXT NOT NULL, -- 邀请人(店主)ID
    role TEXT DEFAULT 'agent' CHECK (role IN ('manager', 'agent', 'viewer')),
    permissions TEXT, -- JSON格式的权限配置
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'rejected')),
    hired_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (invited_by) REFERENCES users(id),
    UNIQUE(shop_id, user_id) -- 防止重复邀请
);

-- 3. 创建员工邀请表
CREATE TABLE IF NOT EXISTS employee_invitations (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    inviter_id TEXT NOT NULL, -- 邀请人ID
    invitee_email TEXT NOT NULL, -- 被邀请人邮箱
    invitee_id TEXT, -- 如果用户已注册
    role TEXT DEFAULT 'agent' CHECK (role IN ('manager', 'agent', 'viewer')),
    message TEXT, -- 邀请消息
    token TEXT NOT NULL UNIQUE, -- 邀请令牌
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    FOREIGN KEY (inviter_id) REFERENCES users(id),
    FOREIGN KEY (invitee_id) REFERENCES users(id)
);

-- 4. 创建员工权限配置表
CREATE TABLE IF NOT EXISTS employee_permissions (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    permission_type TEXT NOT NULL, -- 'conversation', 'customer', 'report', 'setting'
    permission_action TEXT NOT NULL, -- 'read', 'write', 'delete', 'manage'
    resource_id TEXT, -- 特定资源ID（如特定对话）
    granted_by TEXT NOT NULL, -- 授权人ID
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME, -- 权限过期时间
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- 5. 创建用户会话表 (用于登录管理)
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    refresh_token TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6. 创建操作日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    shop_id TEXT,
    action TEXT NOT NULL, -- 'invite_employee', 'remove_employee', 'update_permissions'
    resource_type TEXT NOT NULL, -- 'employee', 'invitation', 'permission'
    resource_id TEXT,
    details TEXT, -- JSON格式的详细信息
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- 7. 创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_employees_shop_id ON employees(shop_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_token ON employee_invitations(token);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_email ON employee_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_employee_id ON employee_permissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_id ON audit_logs(shop_id);

-- 8. 将现有的admins数据迁移到users表 (如果需要)
INSERT OR IGNORE INTO users (id, username, email, password_hash, name, role, status, created_at)
SELECT 
    id,
    username,
    username || '@quicktalk.local' as email, -- 临时邮箱
    password_hash,
    username as name,
    CASE 
        WHEN role = 'admin' THEN 'admin'
        ELSE 'super_admin'
    END as role,
    'active' as status,
    created_at
FROM admins 
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='admins');

-- 9. 插入示例数据（可选）
-- 创建一个测试店主用户
INSERT OR IGNORE INTO users (id, username, email, password_hash, name, role, status) 
VALUES 
('shop_owner_001', 'test_shop_owner', 'shop@test.com', '$2a$10$example_hash', '测试店主', 'shop_owner', 'active');

-- 创建几个测试用户用于邀请
INSERT OR IGNORE INTO users (id, username, email, password_hash, name, role, status) 
VALUES 
('user_001', 'alice', 'alice@test.com', '$2a$10$example_hash', 'Alice', 'user', 'active'),
('user_002', 'bob', 'bob@test.com', '$2a$10$example_hash', 'Bob', 'user', 'active'),
('user_003', 'charlie', 'charlie@test.com', '$2a$10$example_hash', 'Charlie', 'user', 'active');

-- 提交事务
COMMIT;