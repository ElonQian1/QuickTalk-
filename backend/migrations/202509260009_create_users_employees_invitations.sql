-- 创建 users / employees / employee_invitations 表（缺失补齐）
-- 注意：与现有 API 结构对齐，部分字段允许为 NULL 以兼容不同添加流程

-- 普通用户表（用于搜索/邀请）
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    phone TEXT,
    avatar TEXT,
    role TEXT NOT NULL DEFAULT 'user', -- user/agent/manager 等
    status TEXT NOT NULL DEFAULT 'active',
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- 员工表（隶属店铺的成员）
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    user_id TEXT,            -- 可为空：直接通过邮箱添加时暂未绑定用户
    invited_by TEXT,         -- 邀请人（店主/管理员）
    name TEXT,
    email TEXT,
    role TEXT NOT NULL,      -- employee/manager 等
    status TEXT NOT NULL DEFAULT 'active',
    hired_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id)
);
CREATE INDEX IF NOT EXISTS idx_employees_shop_id ON employees(shop_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- 员工邀请表（通过邀请加入店铺）
CREATE TABLE IF NOT EXISTS employee_invitations (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    inviter_id TEXT NOT NULL,
    invitee_email TEXT NOT NULL,
    invitee_id TEXT,         -- 被邀请人（若已注册）
    role TEXT NOT NULL,
    message TEXT,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending', -- pending/accepted/rejected/expired
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_shop_id ON employee_invitations(shop_id);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_status ON employee_invitations(status);
