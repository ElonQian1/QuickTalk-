-- ==============================================
-- ELonTalk 客服系统 - 自动生成数据库架构
-- 生成时间: 2025-10-14 04:01:45 UTC
-- 生成器: Rust Schema Generator
-- ==============================================

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- ==============================================
-- users 表
-- ==============================================

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    display_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'staff',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- users 表索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ==============================================
-- shops 表
-- ==============================================

CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    owner_id INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- shops 表索引
CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug);
CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_id);

-- ==============================================
-- shop_staffs 表
-- ==============================================

CREATE TABLE IF NOT EXISTS shop_staffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'staff',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(shop_id, user_id)
);

-- shop_staffs 表索引
CREATE INDEX IF NOT EXISTS idx_shop_staffs_shop ON shop_staffs(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_staffs_user ON shop_staffs(user_id);

-- ==============================================
-- 触发器 (自动更新时间戳)
-- ==============================================

CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
                   AFTER UPDATE ON users
                   FOR EACH ROW 
                   BEGIN
                       UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                   END;

