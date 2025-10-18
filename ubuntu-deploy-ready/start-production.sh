#!/bin/bash

# QuickTalk 客服系统 - 生产环境启动脚本
# 部署路径: /root/ubuntu-deploy-ready
# 启用 HTTPS 和 Sea-ORM 自动迁移

set -e

echo "========================================"
echo "  QuickTalk 客服系统 - 生产环境启动"
echo "========================================"
echo ""

# 切换到部署目录
cd /root/ubuntu-deploy-ready

# 检查后端程序
if [ ! -f "customer-service-backend" ]; then
    echo "❌ 错误: 后端程序不存在"
    exit 1
fi

# 赋予执行权限
chmod +x customer-service-backend

# 加载环境变量
if [ -f ".env.production" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
    echo "✅ 已加载生产环境配置"
else
    echo "⚠️  警告: .env.production 不存在，使用默认配置"
fi

# 设置必要的环境变量
export DATABASE_URL="sqlite:customer_service.db"
export RUST_LOG="info"
export SERVER_HOST="0.0.0.0"
export SERVER_PORT="8080"
export HTTPS_PORT="8443"
export ENABLE_HTTPS="true"
export TLS_CERT_PATH="certs/server.crt"
export TLS_KEY_PATH="certs/server.key"
export STATIC_DIR="static"

# 检查证书文件
if [ ! -f "certs/server.crt" ] || [ ! -f "certs/server.key" ]; then
    echo "⚠️  警告: HTTPS 证书文件不完整"
    echo "   请确保以下文件存在:"
    echo "   - certs/server.crt"
    echo "   - certs/server.key"
fi

# 检查静态文件目录
if [ ! -d "static" ]; then
    echo "⚠️  警告: 静态文件目录不存在"
    mkdir -p static
fi

echo ""
echo "📋 配置信息:"
echo "   - 数据库: $DATABASE_URL"
echo "   - HTTP 端口: $SERVER_PORT"
echo "   - HTTPS 端口: $HTTPS_PORT"
echo "   - HTTPS 状态: $ENABLE_HTTPS"
echo "   - 静态文件: $STATIC_DIR"
echo "   - 证书路径: $TLS_CERT_PATH"
echo ""

# 停止旧进程
if pgrep -f "customer-service-backend" > /dev/null; then
    echo "🛑 停止旧进程..."
    pkill -9 -f "customer-service-backend" || true
    sleep 2
fi

# 启动服务器
echo "🚀 启动服务器..."
echo ""
echo "=========================================="
echo "  服务器已启动"
echo "=========================================="
echo ""
echo "🌐 访问地址:"
echo "   HTTP:  http://43.139.82.12:$SERVER_PORT"
echo "   HTTPS: https://elontalk.duckdns.org:$HTTPS_PORT"
echo ""
echo "📝 查看日志:"
echo "   tail -f /root/ubuntu-deploy-ready/server.log"
echo ""
echo "🛑 停止服务:"
echo "   pkill -f customer-service-backend"
echo ""

# 启动服务器（后台运行）
nohup ./customer-service-backend > server.log 2>&1 &

echo "✅ 服务器已在后台启动 (PID: $!)"
echo ""
echo "提示: 使用以下命令查看实时日志:"
echo "   tail -f server.log"
echo ""
