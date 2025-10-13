#!/bin/bash

# ELonTalk 客服系统启动脚本 (HTTPS模式)
# 需要 SSL 证书支持

echo "========================================="
echo "  ELonTalk 客服系统 - HTTPS 启动中..."
echo "========================================="

# 检查二进制文件
if [ ! -f "./customer-service-backend" ]; then
    echo "❌ 错误: 找不到 customer-service-backend 文件"
    exit 1
fi

# 设置权限
chmod +x ./customer-service-backend

# 检查 SSL 证书
if [ ! -f "certs/server.crt" ] || [ ! -f "certs/server.key" ]; then
    echo "❌ 错误: 未找到 SSL 证书文件"
    echo "请确保以下文件存在:"
    echo "  - certs/server.crt"
    echo "  - certs/server.key"
    echo ""
    echo "💡 提示: 您可以:"
    echo "  1. 使用 Let's Encrypt 获取免费证书"
    echo "  2. 生成自签名证书用于测试"
    echo "  3. 使用商业 SSL 证书"
    exit 1
fi

# 检查环境配置
if [ ! -f ".env" ]; then
    echo "⚠️  警告: 未找到 .env 文件，复制示例配置..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ 已创建 .env 文件，请根据需要修改配置"
    fi
fi

# 创建数据库目录
mkdir -p data

# 显示配置信息
echo ""
echo "📋 HTTPS 配置信息:"
echo "   - 服务器地址: https://0.0.0.0:8443"
echo "   - 管理后台: https://您的域名:8443"
echo "   - SSL 证书: ./certs/server.crt"
echo "   - SSL 私钥: ./certs/server.key"
echo "   - 数据库文件: ./data/customer_service.db"
echo ""

# 启动 HTTPS 服务器
echo "🔒 启动 HTTPS 服务器..."
echo "💡 提示: 按 Ctrl+C 停止服务器"
echo ""

export RUST_LOG=info
export DATABASE_URL=sqlite:./data/customer_service.db
export STATIC_DIR=./static
export ENABLE_HTTPS=true
export HTTPS_PORT=8443
export CERT_FILE=./certs/server.crt
export KEY_FILE=./certs/server.key

./customer-service-backend --https