-- 初始核心表结构
CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'unpaid',
    subscription_type TEXT DEFAULT 'basic',
    subscription_status TEXT,
    subscription_expires_at DATETIME,
    contact_email TEXT,
    contact_phone TEXT,
    business_license TEXT,
    admin_password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES admins(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_shops_domain_nonempty ON shops(domain) WHERE domain != '';

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_shop_id ON conversations(shop_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer','agent')),
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text','image','file')),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    shop_id TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_admin_id ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS payment_orders (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    order_number TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'CNY',
    payment_method TEXT NOT NULL,
    payment_status TEXT DEFAULT 'pending',
    qr_code_url TEXT,
    payment_url TEXT,
    third_party_order_id TEXT,
    subscription_type TEXT NOT NULL,
    subscription_duration INTEGER DEFAULT 12,
    expires_at DATETIME NOT NULL,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id)
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_shop_id ON payment_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at);

CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL UNIQUE,
    price REAL NOT NULL,
    duration INTEGER NOT NULL,
    max_customers INTEGER,
    max_agents INTEGER,
    features TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_configs (
    id TEXT PRIMARY KEY,
    payment_method TEXT NOT NULL UNIQUE,
    app_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    private_key TEXT NOT NULL,
    public_key TEXT,
    app_secret TEXT,
    notify_url TEXT,
    return_url TEXT,
    is_sandbox BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_notifications (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    notification_data TEXT NOT NULL,
    status TEXT NOT NULL,
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES payment_orders(id)
);

CREATE TABLE IF NOT EXISTS activation_orders (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    order_number TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CNY',
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT,
    qr_code_url TEXT,
    expires_at DATETIME NOT NULL,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id)
);
CREATE INDEX IF NOT EXISTS idx_activation_orders_shop_id ON activation_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_activation_orders_status ON activation_orders(status);
CREATE INDEX IF NOT EXISTS idx_activation_orders_created_at ON activation_orders(created_at);
