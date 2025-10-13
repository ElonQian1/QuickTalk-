#!/bin/bash

# ELonTalk 客服系统启动脚本 (HTTP模式)
# 适用于 Ubuntu/Linux 系统

echo "========================================="
echo "  ELonTalk 客服系统 - 启动中..."
echo "========================================="

# 检查二进制文件
if [ ! -f "./customer-service-backend" ]; then
    echo "❌ 错误: 找不到 customer-service-backend 文件"
    echo "请确保您在正确的目录中运行此脚本"
    exit 1
fi

# 设置权限
chmod +x ./customer-service-backend

# 检查环境配置
if [ ! -f ".env" ]; then
    echo "⚠️  警告: 未找到 .env 文件，复制示例配置..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ 已创建 .env 文件，请根据需要修改配置"
    else
        echo "❌ 错误: 未找到 .env.example 文件"
        exit 1
    fi
fi

# 创建数据库目录
mkdir -p data

# 显示配置信息
echo ""
echo "📋 配置信息:"
echo "   - 服务器地址: http://0.0.0.0:8080"
echo "   - 管理后台: http://您的服务器IP:8080"
echo "   - 数据库文件: ./data/customer_service.db"
echo "   - 静态文件: ./static/"
echo ""

# 启动服务器
echo "🚀 启动服务器..."
echo "💡 提示: 按 Ctrl+C 停止服务器"
echo ""

export RUST_LOG=info
export DATABASE_URL=sqlite:./data/customer_service.db
export STATIC_DIR=./static

./customer-service-backend