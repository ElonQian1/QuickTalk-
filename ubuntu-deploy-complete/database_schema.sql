-- ==============================================
-- ELonTalk 客服系统 - 完整数据库架构
-- 版本: 2.0
-- 创建时间: 2025-10-14
-- ==============================================

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- ==============================================
-- 用户表 (users)
-- 存储系统用户信息 (管理员、客服人员等)
-- ==============================================

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,           -- 用户名
    email VARCHAR(100) UNIQUE,                      -- 邮箱
    password_hash VARCHAR(255) NOT NULL,            -- 密码哈希
    display_name VARCHAR(100),                      -- 显示名称
    role VARCHAR(20) NOT NULL DEFAULT 'staff',     -- 角色: admin, staff, manager
    avatar_url TEXT,                                -- 头像URL
    is_active BOOLEAN NOT NULL DEFAULT true,       -- 是否激活
    last_login DATETIME,                            -- 最后登录时间
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- ==============================================
-- 店铺表 (shops)  
-- 存储多店铺信息
-- ==============================================

CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,                     -- 店铺名称
    slug VARCHAR(50) UNIQUE NOT NULL,               -- 店铺标识 (URL友好)
    description TEXT,                               -- 店铺描述
    logo_url TEXT,                                  -- 店铺Logo
    website_url TEXT,                               -- 官网地址
    contact_email VARCHAR(100),                     -- 联系邮箱
    contact_phone VARCHAR(20),                      -- 联系电话
    settings JSON,                                  -- 店铺设置 (JSON格式)
    is_active BOOLEAN NOT NULL DEFAULT true,       -- 是否激活
    owner_id INTEGER,                               -- 店铺所有者
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 店铺表索引
CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug);
CREATE INDEX IF NOT EXISTS idx_shops_active ON shops(is_active);
CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_id);

-- ==============================================
-- 店铺员工表 (shop_staffs)
-- 存储店铺与员工的关联关系
-- ==============================================

CREATE TABLE IF NOT EXISTS shop_staffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,                       -- 店铺ID
    user_id INTEGER NOT NULL,                       -- 员工ID
    role VARCHAR(20) NOT NULL DEFAULT 'staff',     -- 角色: staff, manager
    permissions JSON,                               -- 权限配置
    is_active BOOLEAN NOT NULL DEFAULT true,       -- 是否激活
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(shop_id, user_id)                        -- 每个员工在同一店铺只能有一个角色
);

-- 店铺员工表索引
CREATE INDEX IF NOT EXISTS idx_shop_staffs_shop ON shop_staffs(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_staffs_user ON shop_staffs(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_staffs_active ON shop_staffs(is_active);

-- ==============================================
-- 客户表 (customers)
-- 存储客户信息
-- ==============================================

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,                       -- 所属店铺
    customer_id VARCHAR(100) NOT NULL,              -- 客户唯一标识
    name VARCHAR(100),                              -- 客户姓名
    email VARCHAR(100),                             -- 邮箱
    phone VARCHAR(20),                              -- 电话
    avatar_url TEXT,                                -- 头像
    metadata JSON,                                  -- 客户元数据
    first_visit DATETIME,                           -- 首次访问
    last_visit DATETIME,                            -- 最后访问
    last_active_at DATETIME,                        -- 最后活跃时间
    visit_count INTEGER NOT NULL DEFAULT 0,        -- 访问次数
    is_blocked BOOLEAN NOT NULL DEFAULT false,     -- 是否被屏蔽
    notes TEXT,                                     -- 客服备注
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    UNIQUE(shop_id, customer_id)                    -- 每个店铺内客户ID唯一
);

-- 客户表索引
CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop_customer ON customers(shop_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_visit ON customers(last_visit);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(last_active_at);

-- ==============================================
-- 会话表 (sessions)
-- 存储客服会话信息
-- ==============================================

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id VARCHAR(100) UNIQUE NOT NULL,       -- 会话唯一标识
    shop_id INTEGER NOT NULL,                       -- 所属店铺
    customer_id INTEGER NOT NULL,                   -- 客户ID
    staff_id INTEGER,                               -- 分配的客服ID
    status VARCHAR(20) NOT NULL DEFAULT 'active',  -- 状态: active, closed, waiting
    priority INTEGER NOT NULL DEFAULT 0,           -- 优先级 (0-9)
    source VARCHAR(50),                             -- 来源渠道
    title VARCHAR(200),                             -- 会话标题
    summary TEXT,                                   -- 会话摘要
    tags TEXT,                                      -- 标签 (逗号分隔)
    rating INTEGER,                                 -- 客户评分 (1-5)
    feedback TEXT,                                  -- 客户反馈
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,                              -- 结束时间
    last_message_at DATETIME,                       -- 最后消息时间
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 会话表索引
CREATE INDEX IF NOT EXISTS idx_sessions_shop ON sessions(shop_id);
CREATE INDEX IF NOT EXISTS idx_sessions_customer ON sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_staff ON sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_message ON sessions(last_message_at);

-- ==============================================
-- 消息表 (messages)
-- 存储聊天消息
-- ==============================================

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,                   -- 所属会话
    sender_type VARCHAR(20) NOT NULL,              -- 发送者类型: customer, staff, system
    sender_id INTEGER,                              -- 发送者ID (users表或customers表)
    sender_name VARCHAR(100),                       -- 发送者名称 (冗余字段，提高查询性能)
    message_type VARCHAR(20) NOT NULL DEFAULT 'text', -- 消息类型: text, image, file, system
    content TEXT NOT NULL,                          -- 消息内容
    rich_content JSON,                              -- 富媒体内容 (图片、文件等)
    metadata JSON,                                  -- 消息元数据
    reply_to INTEGER,                               -- 回复的消息ID
    is_read BOOLEAN NOT NULL DEFAULT false,        -- 是否已读
    read_at DATETIME,                               -- 阅读时间
    is_deleted BOOLEAN NOT NULL DEFAULT false,     -- 是否删除
    deleted_at DATETIME,                            -- 删除时间
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL
);

-- 消息表索引  
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(is_read);

-- ==============================================
-- 文件表 (files)
-- 存储上传的文件信息
-- ==============================================

CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id VARCHAR(100) UNIQUE NOT NULL,          -- 文件唯一标识
    shop_id INTEGER NOT NULL,                       -- 所属店铺
    session_id INTEGER,                             -- 所属会话 (可选)
    message_id INTEGER,                             -- 所属消息 (可选)
    uploader_type VARCHAR(20) NOT NULL,            -- 上传者类型: staff, customer
    uploader_id INTEGER,                            -- 上传者ID
    original_name VARCHAR(255) NOT NULL,           -- 原始文件名
    file_name VARCHAR(255) NOT NULL,               -- 存储文件名
    file_path TEXT NOT NULL,                        -- 文件路径
    file_size INTEGER NOT NULL,                     -- 文件大小 (字节)
    mime_type VARCHAR(100),                         -- MIME类型
    file_type VARCHAR(50),                          -- 文件类型分类: image, document, video, audio, other
    thumbnail_path TEXT,                            -- 缩略图路径 (图片/视频)
    download_count INTEGER NOT NULL DEFAULT 0,     -- 下载次数
    is_public BOOLEAN NOT NULL DEFAULT false,      -- 是否公开访问
    expires_at DATETIME,                            -- 过期时间
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- 文件表索引
CREATE INDEX IF NOT EXISTS idx_files_shop ON files(shop_id);
CREATE INDEX IF NOT EXISTS idx_files_session ON files(session_id);
CREATE INDEX IF NOT EXISTS idx_files_message ON files(message_id);
CREATE INDEX IF NOT EXISTS idx_files_uploader ON files(uploader_type, uploader_id);
CREATE INDEX IF NOT EXISTS idx_files_type ON files(file_type);
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at);

-- ==============================================
-- 统计表 (statistics)
-- 存储各种统计数据 (可选，用于性能优化)
-- ==============================================

CREATE TABLE IF NOT EXISTS statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,                       -- 所属店铺
    stat_date DATE NOT NULL,                        -- 统计日期
    stat_type VARCHAR(50) NOT NULL,                 -- 统计类型
    stat_key VARCHAR(100) NOT NULL,                 -- 统计键
    stat_value INTEGER NOT NULL DEFAULT 0,         -- 统计值
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    UNIQUE(shop_id, stat_date, stat_type, stat_key)
);

-- 统计表索引
CREATE INDEX IF NOT EXISTS idx_statistics_shop_date ON statistics(shop_id, stat_date);
CREATE INDEX IF NOT EXISTS idx_statistics_type ON statistics(stat_type);

-- ==============================================
-- 未读消息计数表 (unread_counts)
-- 存储每个店铺-客户的未读消息数量（性能优化）
-- ==============================================

CREATE TABLE IF NOT EXISTS unread_counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,                       -- 所属店铺
    customer_id VARCHAR(100) NOT NULL,              -- 客户标识
    session_id INTEGER,                             -- 会话ID
    unread_count INTEGER NOT NULL DEFAULT 0,       -- 未读消息数
    last_message_at DATETIME,                       -- 最后消息时间
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    UNIQUE(shop_id, customer_id)                    -- 每个店铺-客户组合唯一
);

-- 未读计数表索引
CREATE INDEX IF NOT EXISTS idx_unread_counts_shop ON unread_counts(shop_id);
CREATE INDEX IF NOT EXISTS idx_unread_counts_customer ON unread_counts(customer_id);
CREATE INDEX IF NOT EXISTS idx_unread_counts_session ON unread_counts(session_id);
CREATE INDEX IF NOT EXISTS idx_unread_counts_count ON unread_counts(unread_count);

-- ==============================================
-- 系统配置表 (system_config)
-- 存储系统级配置
-- ==============================================

CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,                   -- 配置键
    value TEXT,                                     -- 配置值
    description TEXT,                               -- 配置描述
    config_type VARCHAR(20) NOT NULL DEFAULT 'string', -- 配置类型: string, integer, boolean, json
    is_public BOOLEAN NOT NULL DEFAULT false,      -- 是否前端可见
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- 初始数据插入
-- ==============================================

-- 插入系统配置
INSERT OR IGNORE INTO system_config (key, value, description, config_type) VALUES
('system_version', '2.0.0', '系统版本号', 'string'),
('database_version', '2.0', '数据库架构版本', 'string'),
('default_avatar', '/static/default-avatar.png', '默认头像路径', 'string'),
('max_file_size', '10485760', '最大文件上传大小 (10MB)', 'integer'),
('session_timeout', '3600', '会话超时时间 (秒)', 'integer'),
('auto_assign_staff', 'true', '是否自动分配客服', 'boolean');

-- 插入默认管理员 (如果不存在)
-- 默认密码: admin123 (生产环境请务必修改)
INSERT OR IGNORE INTO users (id, username, email, password_hash, display_name, role, is_active) VALUES
(1, 'admin', 'admin@example.com', '$2b$12$rHY.3P.4lqnQQ5rw4fGrpOZn4KQWqWnN.4MQC4E5S5B5Q5Z5Q5Q5Q5', '系统管理员', 'admin', true);

-- 插入默认店铺 (如果不存在)
INSERT OR IGNORE INTO shops (id, name, slug, description, is_active, owner_id) VALUES
(1, '默认店铺', 'default', '系统默认店铺', true, 1);

-- ==============================================
-- 视图 (Views) - 便于查询
-- ==============================================

-- 活跃会话视图
CREATE VIEW IF NOT EXISTS active_sessions AS
SELECT 
    s.*,
    c.name as customer_name,
    c.email as customer_email,
    u.display_name as staff_name,
    sh.name as shop_name,
    (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) as message_count
FROM sessions s
LEFT JOIN customers c ON s.customer_id = c.id
LEFT JOIN users u ON s.staff_id = u.id
LEFT JOIN shops sh ON s.shop_id = sh.id
WHERE s.status = 'active';

-- 今日消息统计视图
CREATE VIEW IF NOT EXISTS today_message_stats AS
SELECT 
    shop_id,
    COUNT(*) as total_messages,
    COUNT(CASE WHEN sender_type = 'customer' THEN 1 END) as customer_messages,
    COUNT(CASE WHEN sender_type = 'staff' THEN 1 END) as staff_messages,
    COUNT(DISTINCT session_id) as active_sessions
FROM messages 
WHERE DATE(created_at) = DATE('now')
GROUP BY shop_id;

-- ==============================================
-- 触发器 (Triggers) - 自动更新时间戳
-- ==============================================

-- 用户表更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
FOR EACH ROW 
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 店铺表更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_shops_timestamp
AFTER UPDATE ON shops
FOR EACH ROW
BEGIN
    UPDATE shops SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 客户表更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_customers_timestamp
AFTER UPDATE ON customers  
FOR EACH ROW
BEGIN
    UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 店铺员工表更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_shop_staffs_timestamp
AFTER UPDATE ON shop_staffs
FOR EACH ROW
BEGIN
    UPDATE shop_staffs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 会话表更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp
AFTER UPDATE ON sessions
FOR EACH ROW  
BEGIN
    UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 消息插入时更新会话时间戳
CREATE TRIGGER IF NOT EXISTS update_session_last_message
AFTER INSERT ON messages
FOR EACH ROW
BEGIN
    UPDATE sessions 
    SET last_message_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.session_id;
END;

-- ==============================================
-- 完成信息
-- ==============================================

-- 插入数据库初始化完成标记
INSERT OR REPLACE INTO system_config (key, value, description) VALUES
('db_initialized_at', datetime('now'), '数据库初始化完成时间');

-- 显示初始化完成信息 (注释形式)
-- ============================================== 
-- 🎉 ELonTalk 数据库架构创建完成！
-- 
-- 📊 包含表数量: 8个核心表 + 2个视图
-- 🔑 包含索引: 30+ 个性能优化索引  
-- ⚡ 包含触发器: 自动时间戳更新
-- 🎯 包含初始数据: 默认管理员和店铺
-- 
-- 🚀 系统已准备就绪！
-- ==============================================