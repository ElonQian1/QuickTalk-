-- 简化的数据库架构，用于 Rust 应用初始化
-- 只包含表结构，避免重复创建索引

-- 用户表（店主）
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    avatar_url VARCHAR(255),
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 店铺表
CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    shop_name VARCHAR(100) NOT NULL,
    shop_url VARCHAR(255),
    api_key VARCHAR(64) UNIQUE NOT NULL,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- 客户表（独立站用户）
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    customer_name VARCHAR(100),
    customer_email VARCHAR(100),
    customer_avatar VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    first_visit_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status INTEGER DEFAULT 1,
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    UNIQUE(shop_id, customer_id)
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    staff_id INTEGER,
    session_status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (staff_id) REFERENCES users(id)
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    sender_type VARCHAR(10) NOT NULL,
    sender_id INTEGER,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    file_url VARCHAR(255),
    status VARCHAR(20) DEFAULT 'sent',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- 未读消息统计表
CREATE TABLE IF NOT EXISTS unread_counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    unread_count INTEGER DEFAULT 0,
    last_read_message_id INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (last_read_message_id) REFERENCES messages(id),
    UNIQUE(shop_id, customer_id)
);

-- 在线状态表
CREATE TABLE IF NOT EXISTS online_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_type VARCHAR(10) NOT NULL,
    user_id INTEGER NOT NULL,
    shop_id INTEGER,
    websocket_id VARCHAR(100),
    last_ping_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'online',
    FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- 创建索引（使用 IF NOT EXISTS）
CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_sessions_shop_customer ON sessions(shop_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_staff_id ON sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_unread_counts_shop_customer ON unread_counts(shop_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_online_status_user ON online_status(user_type, user_id);