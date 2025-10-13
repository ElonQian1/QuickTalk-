#!/bin/bash

# 服务器状态检查脚本
echo "🔍 ELonTalk 服务器诊断"
echo "======================="

# 1. 检查进程状态
echo "📊 1. 检查后端进程..."
if pgrep -f customer-service-backend > /dev/null; then
    echo "✅ 后端进程正在运行"
    ps aux | grep customer-service-backend | grep -v grep
else
    echo "❌ 后端进程未运行"
fi

# 2. 检查端口监听
echo ""
echo "🌐 2. 检查端口监听..."
netstat_output=$(netstat -tlnp 2>/dev/null | grep ":8080")
if [ -n "$netstat_output" ]; then
    echo "✅ 端口8080正在监听:"
    echo "$netstat_output"
else
    echo "❌ 端口8080未监听"
fi

# 3. 测试本地API连接
echo ""
echo "🔗 3. 测试本地API连接..."
health_response=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:8080/health 2>/dev/null)
if [ "$health_response" = "200" ]; then
    echo "✅ Health检查正常 (200)"
elif [ "$health_response" = "000" ]; then
    echo "❌ 无法连接到服务器"
else
    echo "⚠️  Health检查返回: $health_response"
fi

# 4. 测试API端点
echo ""
echo "📡 4. 测试API端点..."
api_response=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:8080/api/dashboard/stats 2>/dev/null)
if [ "$api_response" = "401" ]; then
    echo "✅ API端点正常 (401未授权是正常的)"
elif [ "$api_response" = "500" ]; then
    echo "❌ API端点返回500错误"
elif [ "$api_response" = "000" ]; then
    echo "❌ 无法连接到API"
else
    echo "⚠️  API端点返回: $api_response"
fi

# 5. 检查数据库文件
echo ""
echo "💾 5. 检查数据库..."
if [ -f "customer_service.db" ]; then
    db_size=$(ls -lh customer_service.db | awk '{print $5}')
    echo "✅ 数据库文件存在 (大小: $db_size)"
else
    echo "❌ 数据库文件不存在"
fi

# 6. 检查日志
echo ""
echo "📋 6. 最近的错误日志..."
if [ -f "backend.log" ]; then
    echo "最近10行日志:"
    tail -10 backend.log
else
    echo "⚠️  未找到backend.log文件"
fi

echo ""
echo "🔧 如需查看实时日志: tail -f backend.log"
echo "🔄 如需重启服务: ./restart.sh"
