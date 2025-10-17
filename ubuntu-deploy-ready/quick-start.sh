#!/bin/bash
# Ubuntu 快速启动脚本 - HTTPS 生产环境
# 部署路径: /root/ubuntu-deploy-ready/

set -e

echo "=== ElonTalk 客服系统 - 快速启动 (HTTPS) ==="
echo ""

cd /root/ubuntu-deploy-ready

# 检查二进制文件
if [ ! -f "customer-service-backend" ]; then
    echo "❌ 错误: 未找到 customer-service-backend 二进制文件"
    exit 1
fi

# 设置执行权限
chmod +x customer-service-backend

# 检查配置文件
if [ ! -f ".env" ]; then
    echo "⚠️  警告: 未找到 .env 文件，使用 .env.production"
    cp .env.production .env
fi

# 显示配置信息
echo "📋 当前配置:"
echo "  - TLS_MODE: $(grep TLS_MODE .env | cut -d'=' -f2)"
echo "  - TLS_PORT: $(grep TLS_PORT .env | cut -d'=' -f2)"
echo "  - TLS_DOMAIN: $(grep TLS_DOMAIN .env | cut -d'=' -f2)"
echo "  - ACME_ENABLED: $(grep ACME_ENABLED .env | cut -d'=' -f2)"
echo ""

# 检查数据库
if [ ! -f "customer_service.db" ]; then
    echo "ℹ️  首次运行，Sea-ORM 将自动创建数据库..."
fi

echo "🚀 启动服务器 (HTTPS 模式)..."
echo "   访问地址: https://$(grep TLS_DOMAIN .env | cut -d'=' -f2):$(grep TLS_PORT .env | cut -d'=' -f2)"
echo ""
echo "⏱️  首次运行可能需要几分钟获取 Let's Encrypt 证书..."
echo "   按 Ctrl+C 停止服务器"
echo ""

# 启动服务器
./customer-service-backend
