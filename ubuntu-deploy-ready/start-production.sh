#!/bin/bash
# ELonTalk 客服系统 - 生产环境启动脚本
# 部署路径: /root/ubuntu-deploy-ready/
# 配置文件: .env.production

set -e

echo "=========================================="
echo "  ELonTalk 客服系统 - 生产环境启动"
echo "=========================================="

# 切换到项目目录
cd /root/ubuntu-deploy-ready

# 设置执行权限
echo "🔧 设置执行权限..."
chmod +x customer-service-backend

# 停止旧进程（如果存在）
echo "🛑 停止旧进程..."
pkill -f customer-service-backend || echo "   无运行中的进程"

# 检查生产环境配置
if [ ! -f .env.production ]; then
    echo "❌ 错误: .env.production 文件不存在！"
    exit 1
fi

# 备份当前 .env（如果存在）
if [ -f .env ]; then
    echo "📦 备份现有 .env..."
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
fi

# 使用生产环境配置
echo "🔐 应用生产环境配置..."
cp .env.production .env

# 检查证书（HTTPS 必需）
echo "🔒 检查 HTTPS 证书..."
if [ ! -d certs ]; then
    echo "   创建证书目录..."
    mkdir -p certs
fi

if [ ! -f certs/server.crt ] || [ ! -f certs/server.key ]; then
    echo "⚠️  警告: HTTPS 证书不存在，将使用 ACME 自动申请"
    echo "   首次启动可能需要几分钟..."
fi

# 检查数据库
echo "💾 检查数据库..."
if [ ! -f customer_service.db ]; then
    echo "   数据库文件不存在，将自动创建并初始化"
fi

# 启动服务（后台运行）
echo "🚀 启动生产服务（HTTPS 模式）..."
nohup ./customer-service-backend > logs/app.log 2>&1 &
APP_PID=$!

echo "   进程 PID: $APP_PID"

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查进程是否运行
if ps -p $APP_PID > /dev/null; then
    echo "✅ 服务启动成功！"
    echo ""
    echo "=========================================="
    echo "  服务信息"
    echo "=========================================="
    echo "📍 HTTPS 地址: https://elontalk.duckdns.org:8443"
    echo "📍 HTTP 地址:  http://43.139.82.12:8080"
    echo "🔧 进程 ID:    $APP_PID"
    echo "📊 查看日志:   tail -f logs/app.log"
    echo "🛑 停止服务:   kill $APP_PID"
    echo "=========================================="
else
    echo "❌ 服务启动失败！"
    echo "查看日志: tail -n 50 logs/app.log"
    exit 1
fi
