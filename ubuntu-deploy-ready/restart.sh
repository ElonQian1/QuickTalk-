#!/bin/bash

# 重启服务脚本
echo "🔄 重启 ELonTalk 客服系统"
echo "========================"

# 停止当前服务
echo "⏹️  停止当前服务..."
pkill -f customer-service-backend
sleep 2

# 检查是否完全停止
if pgrep -f customer-service-backend > /dev/null; then
    echo "⚠️  强制终止残留进程..."
    pkill -9 -f customer-service-backend
    sleep 1
fi

# 重新启动
echo "🚀 启动服务..."
nohup ./customer-service-backend > backend.log 2>&1 &

# 等待启动
echo "⏳ 等待服务启动..."
sleep 3

# 检查启动状态
if pgrep -f customer-service-backend > /dev/null; then
    echo "✅ 服务启动成功!"
    echo "📊 进程信息:"
    ps aux | grep customer-service-backend | grep -v grep
    
    # 测试连接
    echo ""
    echo "🔗 测试连接..."
    sleep 2
    health_response=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:8080/health 2>/dev/null)
    if [ "$health_response" = "200" ]; then
        echo "✅ 服务运行正常"
        echo "🌐 访问地址: http://$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP"):8080"
    else
        echo "⚠️  服务可能未完全启动，状态码: $health_response"
        echo "📋 查看日志: tail -f backend.log"
    fi
else
    echo "❌ 服务启动失败"
    echo "📋 查看错误日志:"
    tail -20 backend.log
fi