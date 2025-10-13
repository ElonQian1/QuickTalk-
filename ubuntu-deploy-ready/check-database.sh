#!/bin/bash

# 检查并创建数据库表结构
echo "📋 数据库表结构检查"
echo "=================="

if [ ! -f "customer_service.db" ]; then
    echo "❌ 数据库文件不存在"
    exit 1
fi

# 使用sqlite3检查表结构
echo "🔍 检查现有表..."
tables=$(sqlite3 customer_service.db ".tables" 2>/dev/null)

if [ -z "$tables" ]; then
    echo "❌ 数据库中没有表"
    echo "🔧 手动创建基础表结构..."
    
    # 创建基础表结构
    sqlite3 customer_service.db << 'EOF'
-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 店铺表
CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL,
    api_key TEXT UNIQUE,
    authorized_domains TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users (id)
);

-- 客户表
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    shop_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops (id)
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    shop_id INTEGER NOT NULL,
    staff_id INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers (id),
    FOREIGN KEY (shop_id) REFERENCES shops (id),
    FOREIGN KEY (staff_id) REFERENCES users (id)
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    sender_type TEXT NOT NULL, -- 'customer' or 'staff'
    sender_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- 'text', 'image', 'file'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions (id)
);
EOF

    echo "✅ 基础表结构创建完成"
else
    echo "✅ 发现表: $tables"
fi

# 验证表结构
echo ""
echo "📊 数据库统计:"
echo "   - 数据库大小: $(ls -lh customer_service.db | awk '{print $5}')"

for table in users shops customers sessions messages; do
    count=$(sqlite3 customer_service.db "SELECT COUNT(*) FROM $table;" 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "   - $table 表: $count 条记录"
    else
        echo "   - $table 表: 不存在或有错误"
    fi
done

echo ""
echo "🎯 测试建议:"
echo "   1. 先创建用户: 访问注册页面"
echo "   2. 然后创建店铺"
echo "   3. 测试客服功能"