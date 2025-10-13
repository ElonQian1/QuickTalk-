#!/bin/bash

# ==============================================
# ELonTalk 客服系统 - HTTP 启动脚本
# ==============================================

echo "🚀 启动 ELonTalk 客服系统 (HTTP 模式)"
echo "=============================================="

# 检查必要文件
if [ ! -f "./customer-service-backend" ]; then
    echo "❌ 错误: 找不到 customer-service-backend 可执行文件"
    exit 1
fi

# 检查配置文件
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "📋 未找到 .env 配置文件，复制示例配置..."
        cp .env.example .env
        echo "⚠️  请编辑 .env 文件配置您的设置"
        echo "   特别是 JWT_SECRET 和域名相关配置"
    else
        echo "❌ 错误: 找不到配置文件"
        exit 1
    fi
fi

# 设置执行权限
chmod +x ./customer-service-backend

# 设置 HTTP 模式环境变量
export TLS_MODE=http
export SERVER_PORT=8080

echo "🌐 服务器配置："
echo "   模式: HTTP"
echo "   端口: 8080"
echo "   访问: http://localhost:8080"
echo ""
echo "📝 日志输出："
echo "=============================================="

# 启动服务器
./customer-service-backend