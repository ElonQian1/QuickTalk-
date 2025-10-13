#!/bin/bash

# ==============================================
# ELonTalk 强制数据库修复
# ==============================================

echo "💪 ELonTalk 强制数据库修复"
echo "=============================================="
echo "⚠️  这将强制重建数据库表结构"

# 1. 停止服务
echo ""
echo "🛑 停止所有服务..."
pkill -f customer-service-backend 2>/dev/null || true
sleep 2

# 2. 备份并删除数据库
echo ""
echo "🗑️  清理数据库..."
if [ -f "customer_service.db" ]; then
    # 备份
    cp customer_service.db "customer_service.db.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
    # 删除
    rm -f customer_service.db
fi

# 清理锁文件
rm -f customer_service.db-* 2>/dev/null || true

echo "✅ 数据库清理完成"

# 3. 直接使用 sqlite3 创建数据库
echo ""
echo "🔧 使用 sqlite3 直接创建数据库表结构..."

if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "❌ 错误: sqlite3 未安装"
    echo "   请安装: apt-get install sqlite3"
    exit 1
fi

# 创建数据库并初始化表结构
cat > init_tables.sql << 'EOF'
-- 用户表（店主）
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

-- 店铺表
CREATE TABLE shops (
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
CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    customer_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    avatar_url VARCHAR(255),
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, customer_id),
    FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- 会话表
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, customer_id),
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 消息表
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    sender_type VARCHAR(20) NOT NULL,
    sender_id VARCHAR(50) NOT NULL,
    sender_name VARCHAR(100),
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    file_url VARCHAR(255),
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- 未读消息计数表
CREATE TABLE unread_counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL UNIQUE,
    customer_unread INTEGER DEFAULT 0,
    staff_unread INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- 在线状态表
CREATE TABLE online_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_type VARCHAR(20) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    shop_id INTEGER,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_type, user_id, shop_id)
);

-- 店铺员工表
CREATE TABLE shop_staffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(20) DEFAULT 'staff',
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, user_id),
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_sessions_shop_customer ON sessions(shop_id, customer_id);
CREATE INDEX idx_customers_shop_customer ON customers(shop_id, customer_id);
CREATE INDEX idx_online_status_lookup ON online_status(user_type, user_id, shop_id);

-- 插入测试数据
INSERT OR IGNORE INTO users (id, username, password_hash) VALUES 
(1, 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewIH4IAuBCNfrn1e');

INSERT OR IGNORE INTO shops (id, owner_id, shop_name, api_key) VALUES 
(1, 1, '测试店铺', 'test-api-key-123');

INSERT OR IGNORE INTO customers (id, shop_id, customer_id, customer_name) VALUES 
(1, 1, 'test-customer', '测试客户');

INSERT OR IGNORE INTO sessions (id, shop_id, customer_id) VALUES 
(1, 1, 1);

INSERT OR IGNORE INTO unread_counts (session_id) VALUES (1);
EOF

echo "📋 执行数据库初始化 SQL..."
sqlite3 customer_service.db < init_tables.sql

if [ $? -eq 0 ]; then
    echo "✅ 数据库表结构创建成功"
    
    # 验证表结构
    echo ""
    echo "🔍 验证数据库表结构..."
    table_count=$(sqlite3 customer_service.db ".tables" | wc -w)
    echo "📊 创建表数量: $table_count"
    
    echo ""
    echo "📋 数据库表列表:"
    sqlite3 customer_service.db ".tables" | tr ' ' '\n' | while read table; do
        if [ -n "$table" ]; then
            echo "   ✅ $table"
        fi
    done
    
    # 检查文件大小
    db_size=$(ls -lh customer_service.db | awk '{print $5}')
    echo ""
    echo "📊 数据库文件大小: $db_size"
    
    # 设置权限
    chmod 666 customer_service.db
    
    echo ""
    echo "🎉 数据库强制修复完成！"
    
else
    echo "❌ 数据库创建失败"
    exit 1
fi

# 4. 测试启动服务
echo ""
echo "🧪 测试服务启动..."

export DATABASE_URL="sqlite:./customer_service.db"
export RUST_LOG="info"

./customer-service-backend > force-fix.log 2>&1 &
test_pid=$!

echo "📋 测试进程 PID: $test_pid"

# 等待启动
sleep 5

if kill -0 $test_pid 2>/dev/null; then
    echo "✅ 服务启动成功"
    
    # 停止测试进程
    kill $test_pid 2>/dev/null || true
    sleep 2
    
    echo ""
    echo "🎉 强制修复完全成功！"
    echo ""
    echo "🚀 现在可以正常启动服务:"
    echo "   ./start.sh"
    
else
    echo "⚠️  服务启动可能有问题，查看日志:"
    echo "   tail -f force-fix.log"
fi

# 清理临时文件
rm -f init_tables.sql

echo ""
echo "💪 强制数据库修复完成!"