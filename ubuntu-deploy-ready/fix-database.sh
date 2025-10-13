#!/bin/bash

# 数据库修复脚本
echo "🔧 ELonTalk 数据库修复工具"
echo "=========================="

# 检查当前数据库状态
if [ -f "customer_service.db" ]; then
    db_size=$(ls -lh customer_service.db | awk '{print $5}')
    echo "📊 当前数据库大小: $db_size"
    
    if [ "$db_size" = "0" ]; then
        echo "⚠️  数据库文件为空，需要初始化"
    else
        echo "✅ 数据库文件有内容"
    fi
else
    echo "❌ 数据库文件不存在"
fi

# 备份现有数据库（如果存在且有内容）
if [ -f "customer_service.db" ] && [ -s "customer_service.db" ]; then
    echo "💾 备份现有数据库..."
    cp customer_service.db "customer_service.db.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ 备份完成"
fi

# 停止服务
echo "⏹️  停止后端服务..."
pkill -f customer-service-backend
sleep 2

# 删除空的数据库文件
if [ -f "customer_service.db" ]; then
    if [ ! -s "customer_service.db" ]; then
        echo "🗑️  删除空数据库文件..."
        rm customer_service.db
    fi
fi

# 重启服务，让它重新创建数据库
echo "🚀 重启服务并初始化数据库..."
nohup ./customer-service-backend > fix-db.log 2>&1 &

# 等待数据库初始化
echo "⏳ 等待数据库初始化..."
sleep 5

# 检查新数据库
if [ -f "customer_service.db" ]; then
    new_db_size=$(ls -lh customer_service.db | awk '{print $5}')
    echo "📊 新数据库大小: $new_db_size"
    
    if [ "$new_db_size" != "0" ]; then
        echo "✅ 数据库初始化成功！"
    else
        echo "❌ 数据库仍然为空"
        echo "📋 查看错误日志:"
        tail -20 fix-db.log
        exit 1
    fi
else
    echo "❌ 数据库文件未创建"
    exit 1
fi

# 测试数据库连接
echo "🔗 测试数据库连接..."
sleep 2

# 测试API
auth_response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}' \
    -o /dev/null http://localhost:8080/api/auth/login 2>/dev/null)

if [ "$auth_response" = "401" ] || [ "$auth_response" = "400" ]; then
    echo "✅ 登录API正常响应 ($auth_response)"
elif [ "$auth_response" = "500" ]; then
    echo "❌ 仍然返回500错误"
    echo "📋 查看详细日志:"
    tail -20 fix-db.log
    exit 1
else
    echo "⚠️  API响应: $auth_response"
fi

# 显示服务状态
echo ""
echo "🎉 修复完成！"
echo "📊 当前状态:"
echo "   - 数据库大小: $(ls -lh customer_service.db | awk '{print $5}')"
echo "   - 进程状态: $(pgrep -f customer-service-backend > /dev/null && echo '运行中' || echo '未运行')"
echo "   - 访问地址: http://$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP"):8080"
echo ""
echo "📋 实时日志: tail -f fix-db.log"