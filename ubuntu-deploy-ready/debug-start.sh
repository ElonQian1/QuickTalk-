#!/bin/bash

# ELonTalk 客服系统 - 调试启动脚本
# 此脚本用于诊断服务器为什么意外终止

set -e

echo "========================================="
echo "🔍 ELonTalk 调试启动"
echo "========================================="
echo ""

# 切换到正确的目录
cd /root/ubuntu-deploy-ready || exit 1

echo "📂 当前工作目录: $(pwd)"
echo ""

# 检查可执行文件
if [ ! -f "./customer-service-backend" ]; then
    echo "❌ 错误: 找不到可执行文件 customer-service-backend"
    exit 1
fi

echo "✅ 找到可执行文件: ./customer-service-backend"
echo ""

# 检查权限
if [ ! -x "./customer-service-backend" ]; then
    echo "⚠️  警告: 文件没有执行权限，正在添加..."
    chmod +x ./customer-service-backend
fi

# 检查环境文件
if [ -f ".env" ]; then
    echo "✅ 找到 .env 文件"
    echo "📋 关键配置:"
    grep -E "^(TLS_MODE|DATABASE_URL|ACME_ENABLED|TLS_DOMAIN)" .env || true
else
    echo "⚠️  警告: 找不到 .env 文件"
fi
echo ""

# 检查证书文件
if [ -f "certs/server.crt" ] && [ -f "certs/server.key" ]; then
    echo "✅ 证书文件存在"
    echo "📅 证书信息:"
    openssl x509 -in certs/server.crt -noout -dates 2>/dev/null || echo "   (无法读取证书信息)"
else
    echo "⚠️  警告: 证书文件不存在"
fi
echo ""

# 检查数据库
if [ -f "customer_service.db" ]; then
    echo "✅ 数据库文件存在"
    echo "📊 数据库大小: $(du -h customer_service.db | cut -f1)"
else
    echo "⚠️  警告: 数据库文件不存在，将自动创建"
fi
echo ""

# 检查端口占用
echo "🔍 检查端口占用:"
if command -v lsof &> /dev/null; then
    echo "   端口 8443: $(lsof -ti:8443 | wc -l) 个进程"
    echo "   端口 8080: $(lsof -ti:8080 | wc -l) 个进程"
else
    echo "   (lsof 命令不可用)"
fi
echo ""

# 检查旧进程
echo "🔍 检查是否有旧进程:"
OLD_PIDS=$(pgrep -f "customer-service-backend" || true)
if [ -n "$OLD_PIDS" ]; then
    echo "⚠️  发现旧进程: $OLD_PIDS"
    echo "   程序启动时会自动终止这些进程"
else
    echo "✅ 没有旧进程"
fi
echo ""

echo "========================================="
echo "🚀 启动服务器"
echo "========================================="
echo ""

# 使用 nohup 在后台运行，防止SSH断开时终止
# 输出重定向到文件以便查看
nohup ./customer-service-backend > server.log 2>&1 &
PID=$!

echo "✅ 服务器已启动"
echo "📋 进程 ID: $PID"
echo "📝 日志文件: $(pwd)/server.log"
echo ""

# 等待几秒并检查进程状态
sleep 3

if ps -p $PID > /dev/null 2>&1; then
    echo "✅ 服务器运行正常"
    echo ""
    echo "📖 查看实时日志:"
    echo "   tail -f $(pwd)/server.log"
    echo ""
    echo "🛑 停止服务器:"
    echo "   kill $PID"
    echo "   或者: systemctl stop customer-service"
    echo ""
    
    # 显示最后几行日志
    echo "========================================="
    echo "📝 最新日志 (最后 20 行):"
    echo "========================================="
    tail -n 20 server.log
else
    echo "❌ 错误: 服务器启动后立即退出"
    echo ""
    echo "📝 查看日志文件以了解详情:"
    cat server.log
    exit 1
fi
