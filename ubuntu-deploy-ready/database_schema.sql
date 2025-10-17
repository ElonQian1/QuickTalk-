CREATE TABLE users (
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
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    shop_name VARCHAR(100) NOT NULL,
    shop_url VARCHAR(255),
    api_key VARCHAR(64) UNIQUE NOT NULL,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, contact_phone VARCHAR(20), contact_email VARCHAR(100), description TEXT, logo_url VARCHAR(255), website_url VARCHAR(255), settings TEXT, slug VARCHAR(100), is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);
CREATE TABLE customers (
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
CREATE TABLE sessions (
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
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    sender_type VARCHAR(10) NOT NULL,
    sender_id INTEGER,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    file_url VARCHAR(255),
    status VARCHAR(20) DEFAULT 'sent',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, sender_name TEXT, rich_content TEXT, metadata TEXT, reply_to INTEGER, is_read BOOLEAN NOT NULL DEFAULT 0, read_at TIMESTAMP, is_deleted BOOLEAN NOT NULL DEFAULT 0, deleted_at TIMESTAMP, updated_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
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
CREATE TABLE online_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_type VARCHAR(10) NOT NULL,
    user_id INTEGER NOT NULL,
    shop_id INTEGER,
    websocket_id VARCHAR(100),
    last_ping_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'online',
    FOREIGN KEY (shop_id) REFERENCES shops(id)
);
CREATE INDEX idx_shops_owner_id ON shops(owner_id);
CREATE INDEX idx_customers_shop_id ON customers(shop_id);
CREATE INDEX idx_sessions_shop_customer ON sessions(shop_id, customer_id);
CREATE INDEX idx_sessions_staff_id ON sessions(staff_id);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_unread_counts_shop_customer ON unread_counts(shop_id, customer_id);
CREATE INDEX idx_online_status_user ON online_status(user_type, user_id);
CREATE TABLE shop_staffs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            shop_id INTEGER NOT NULL,
                            user_id INTEGER NOT NULL,
                            role VARCHAR(20) NOT NULL DEFAULT 'staff',
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(shop_id, user_id),
                            FOREIGN KEY (shop_id) REFERENCES shops(id),
                            FOREIGN KEY (user_id) REFERENCES users(id)
                        );
CREATE UNIQUE INDEX idx_shops_slug_unique ON shops(slug);
