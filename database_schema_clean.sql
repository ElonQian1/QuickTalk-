-- 多店铺客服系统数据库设计
-- SQLite Schema (纯净版本，无测试数据)

-- 用户表（店主）
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    avatar_url VARCHAR(255),
    status INTEGER DEFAULT 1, -- 1: 活跃, 0: 禁用
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 店铺表
CREATE TABLE shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    shop_name VARCHAR(100) NOT NULL,
    shop_url VARCHAR(255),
    api_key VARCHAR(64) UNIQUE NOT NULL, -- SDK认证密钥
    status INTEGER DEFAULT 1, -- 1: 活跃, 0: 禁用
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- 客户表（独立站用户）
CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    customer_id VARCHAR(100) NOT NULL, -- 由独立站提供的用户ID
    customer_name VARCHAR(100),
    customer_email VARCHAR(100),
    customer_avatar VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    first_visit_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status INTEGER DEFAULT 1, -- 1: 在线, 0: 离线
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    UNIQUE(shop_id, customer_id)
);

-- 会话表
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    staff_id INTEGER, -- 分配的客服人员ID
    status VARCHAR(20) DEFAULT 'active', -- active, closed, pending
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (staff_id) REFERENCES users(id)
);

-- 消息表
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    sender_type VARCHAR(10) NOT NULL, -- 'customer' 或 'staff'
    sender_id INTEGER NOT NULL, -- 发送者的ID（customer_id或staff_id）
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, file, system
    content TEXT NOT NULL,
    file_url VARCHAR(255), -- 如果是文件或图片消息
    status VARCHAR(20) DEFAULT 'sent', -- sent, delivered, read
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- 未读消息统计表
CREATE TABLE unread_counts (
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
CREATE TABLE online_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_type VARCHAR(10) NOT NULL, -- 'staff' 或 'customer'
    user_id INTEGER NOT NULL,
    shop_id INTEGER,
    websocket_id VARCHAR(100), -- WebSocket连接ID
    last_ping_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'online', -- online, away, offline
    FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- 创建索引优化查询性能
CREATE INDEX idx_shops_owner_id ON shops(owner_id);
CREATE INDEX idx_customers_shop_id ON customers(shop_id);
CREATE INDEX idx_sessions_shop_customer ON sessions(shop_id, customer_id);
CREATE INDEX idx_sessions_staff_id ON sessions(staff_id);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_unread_counts_shop_customer ON unread_counts(shop_id, customer_id);
CREATE INDEX idx_online_status_user ON online_status(user_type, user_id);