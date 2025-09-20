-- 店铺支付系统数据库迁移脚本

-- 1. 修改现有shops表，添加支付状态字段
ALTER TABLE shops ADD COLUMN payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE shops ADD COLUMN subscription_type TEXT DEFAULT 'basic';
ALTER TABLE shops ADD COLUMN subscription_expires_at DATETIME;
ALTER TABLE shops ADD COLUMN contact_email TEXT;
ALTER TABLE shops ADD COLUMN contact_phone TEXT;
ALTER TABLE shops ADD COLUMN business_license TEXT;

-- 2. 创建支付订单表
CREATE TABLE IF NOT EXISTS payment_orders (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    order_number TEXT NOT NULL UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'CNY',
    payment_method TEXT NOT NULL, -- 'alipay', 'wechat'
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'expired'
    qr_code_url TEXT,
    payment_url TEXT,
    third_party_order_id TEXT,
    subscription_type TEXT NOT NULL, -- 'basic', 'standard', 'premium'
    subscription_duration INTEGER DEFAULT 12, -- 订阅月数
    expires_at DATETIME NOT NULL,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- 3. 创建支付配置表
CREATE TABLE IF NOT EXISTS payment_configs (
    id TEXT PRIMARY KEY,
    payment_method TEXT NOT NULL UNIQUE, -- 'alipay', 'wechat'
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

-- 4. 创建订阅套餐表
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL UNIQUE, -- 'basic', 'standard', 'premium'
    price DECIMAL(10,2) NOT NULL,
    duration INTEGER NOT NULL, -- 月数
    max_customers INTEGER, -- 最大客户数，NULL表示无限制
    max_agents INTEGER, -- 最大客服数
    features TEXT, -- JSON格式的功能列表
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. 创建支付通知记录表
CREATE TABLE IF NOT EXISTS payment_notifications (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    notification_data TEXT NOT NULL, -- JSON格式的通知数据
    status TEXT NOT NULL, -- 'received', 'processed', 'failed'
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES payment_orders(id)
);

-- 6. 插入默认订阅套餐
INSERT OR IGNORE INTO subscription_plans (id, name, type, price, duration, max_customers, max_agents, features) VALUES 
('plan_basic', '基础版', 'basic', 99.00, 12, 100, 2, '{"features": ["基础客服功能", "最多2个客服", "最多100个客户", "基础数据统计"]}'),
('plan_standard', '标准版', 'standard', 299.00, 12, 500, 10, '{"features": ["完整客服功能", "最多10个客服", "最多500个客户", "高级数据分析", "员工管理", "API接口"]}'),
('plan_premium', '高级版', 'premium', 599.00, 12, NULL, NULL, '{"features": ["全部功能", "无限客服", "无限客户", "高级数据分析", "员工管理", "API接口", "自定义品牌", "优先技术支持"]}');

-- 7. 插入测试支付配置（沙箱环境）
INSERT OR IGNORE INTO payment_configs (id, payment_method, app_id, merchant_id, private_key, public_key, notify_url, return_url, is_sandbox) VALUES 
('config_alipay', 'alipay', 'sandbox_app_id', 'sandbox_merchant_id', 'sandbox_private_key', 'sandbox_public_key', '/api/payments/notify/alipay', '/api/payments/return/alipay', true),
('config_wechat', 'wechat', 'sandbox_app_id', 'sandbox_mch_id', 'sandbox_key', '', '/api/payments/notify/wechat', '/api/payments/return/wechat', true);

-- 8. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_payment_orders_shop_id ON payment_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_order_id ON payment_notifications(order_id);

-- 9. 验证表创建
SELECT 'payment_orders' as table_name, count(*) as count FROM payment_orders
UNION ALL
SELECT 'payment_configs', count(*) FROM payment_configs
UNION ALL
SELECT 'subscription_plans', count(*) FROM subscription_plans
UNION ALL
SELECT 'payment_notifications', count(*) FROM payment_notifications;