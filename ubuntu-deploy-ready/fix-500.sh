#!/bin/bash

# 500错误修复脚本
echo "🛠️ 修复服务器500错误..."

# 1. 停止现有服务
echo "1. 停止现有服务..."
pkill -f customer-service-backend
sleep 2

# 2. 检查并创建数据库
echo "2. 初始化数据库..."
if [ ! -f "customer_service.db" ]; then
    echo "📄 创建新的数据库文件..."
    touch customer_service.db
fi

# 设置正确的数据库权限
chmod 666 customer_service.db
chown $(whoami):$(whoami) customer_service.db

# 3. 设置环境变量
echo "3. 设置环境变量..."
export DATABASE_URL="sqlite:customer_service.db"
export JWT_SECRET="your-super-secret-jwt-key-for-production"
export SERVER_HOST="0.0.0.0"
export SERVER_PORT="8080"
export RUST_LOG="info"
export TLS_MODE="disabled"

# 4. 创建.env文件（如果不存在）
if [ ! -f ".env" ]; then
    echo "📝 创建.env配置文件..."
    cat > .env << 'EOF'
# 生产环境配置
DATABASE_URL=sqlite:customer_service.db
JWT_SECRET=your-super-secret-jwt-key-for-production-change-this
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
RUST_LOG=info
TLS_MODE=disabled

# CORS配置
CORS_ALLOWED_ORIGINS=*
EOF
fi

# 5. 测试数据库初始化
echo "4. 测试数据库初始化..."
sqlite3 customer_service.db << 'EOF'
-- 创建基础表结构（如果不存在）
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    api_key TEXT UNIQUE,
    owner_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    name TEXT,
    email TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops (id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops (id),
    FOREIGN KEY (customer_id) REFERENCES customers (id)
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'staff')),
    sender_id INTEGER,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions (id)
);
EOF

if [ $? -eq 0 ]; then
    echo "✅ 数据库表创建成功"
else
    echo "❌ 数据库表创建失败"
fi

# 6. 启动服务
echo "5. 启动后端服务..."
nohup ./customer-service-backend > backend.log 2>&1 &
BACKEND_PID=$!

# 等待服务启动
sleep 5

# 7. 检查服务状态
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ 后端服务启动成功 (PID: $BACKEND_PID)"
    
    # 测试健康检查
    sleep 2
    if curl -s http://localhost:8080/health >/dev/null; then
        echo "✅ 健康检查通过"
        echo "🌐 服务地址: http://$(curl -s ifconfig.me):8080"
    else
        echo "⚠️ 健康检查失败，检查日志："
        tail -n 10 backend.log
    fi
else
    echo "❌ 后端服务启动失败，检查日志："
    tail -n 20 backend.log
fi

echo "🎉 修复完成！请测试登录功能。"