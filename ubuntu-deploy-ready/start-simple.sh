#!/bin/bash

# 简单可靠的启动脚本
echo "🚀 启动客服系统..."

# 检查是否在正确目录
if [ ! -f "customer-service-backend" ]; then
    echo "❌ 错误: 请在部署目录中运行此脚本"
    exit 1
fi

# 停止现有服务
echo "⏸️  停止现有服务..."
pkill -f customer-service-backend
sleep 2

# 设置执行权限
chmod +x customer-service-backend

# 设置环境变量
export DATABASE_URL="sqlite:customer_service.db"
export JWT_SECRET="production-jwt-secret-$(date +%s)"
export SERVER_HOST="0.0.0.0"
export SERVER_PORT="8080"
export RUST_LOG="info"
export TLS_MODE="disabled"

# 确保数据库文件存在并有正确权限
touch customer_service.db
chmod 666 customer_service.db

echo "🔧 配置信息:"
echo "  数据库: $(pwd)/customer_service.db"
echo "  监听地址: 0.0.0.0:8080"
echo "  日志级别: info"

# 启动服务
echo "🌟 启动服务..."
nohup ./customer-service-backend > backend.log 2>&1 &
BACKEND_PID=$!

# 等待启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查状态
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ 后端服务启动成功!"
    echo "📋 进程信息:"
    ps aux | grep $BACKEND_PID | grep -v grep
    
    # 检查端口
    if netstat -tlnp | grep :8080 >/dev/null; then
        echo "✅ 端口8080监听成功"
        
        # 获取外网IP
        EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || echo "获取失败")
        echo "🌐 访问地址: http://$EXTERNAL_IP:8080"
        
        # 测试健康检查
        sleep 2
        if curl -s http://localhost:8080/health >/dev/null 2>&1; then
            echo "✅ 服务健康检查通过"
        else
            echo "⚠️ 健康检查失败，但服务可能仍在启动中"
        fi
    else
        echo "❌ 端口8080未监听"
        echo "📄 最近日志:"
        tail -n 10 backend.log
    fi
else
    echo "❌ 服务启动失败!"
    echo "📄 错误日志:"
    tail -n 20 backend.log
    exit 1
fi

echo ""
echo "🎯 后续操作:"
echo "  1. 访问: http://$EXTERNAL_IP:8080"
echo "  2. 查看日志: tail -f backend.log"
echo "  3. 停止服务: pkill -f customer-service-backend"
echo ""