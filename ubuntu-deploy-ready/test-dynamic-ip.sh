#!/bin/bash

# 快速测试脚本 - 验证动态IP配置
echo "🔍 动态IP配置测试"
echo "===================="

# 检查当前IP
echo "📡 获取当前公网IP..."
CURRENT_IP=$(curl -s ifconfig.me)
echo "当前IP: $CURRENT_IP"

# 检查服务器状态
echo ""
echo "🌐 检查服务器状态..."
if curl -s "http://$CURRENT_IP:8080/api/dashboard/stats" > /dev/null; then
    echo "✅ API服务正常"
else
    echo "❌ API服务不可达"
fi

# 检查静态文件
echo ""
echo "📁 检查前端文件..."
if curl -s "http://$CURRENT_IP:8080/" | grep -q "<!doctype html"; then
    echo "✅ 前端静态文件正常"
else
    echo "❌ 前端静态文件问题"
fi

# 显示访问地址
echo ""
echo "🎯 访问地址:"
echo "主页面: http://$CURRENT_IP:8080"
echo "API状态: http://$CURRENT_IP:8080/api/dashboard/stats"

echo ""
echo "💡 测试提示:"
echo "1. 在浏览器中访问上述地址"
echo "2. 打开开发者工具查看网络面板"
echo "3. API请求应该自动使用当前IP地址"
echo "4. 如果IP变化，重新访问即可自动适配"