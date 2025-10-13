#!/bin/bash

# 前端热更新脚本 - 适用于动态IP环境
# 使用方法: ./update-frontend.sh

echo "🚀 开始更新前端文件..."

# 检查是否在正确目录
if [ ! -f "customer-service-backend" ]; then
    echo "❌ 错误: 请在部署目录中运行此脚本"
    exit 1
fi

# 停止后端服务
echo "⏸️  停止服务..."
pkill -f customer-service-backend

# 等待进程完全停止
sleep 2

# 备份当前静态文件（可选）
if [ -d "static.backup" ]; then
    rm -rf static.backup
fi
cp -r static static.backup
echo "💾 已备份当前静态文件"

# 重新启动服务
echo "🔄 重启服务..."
nohup ./customer-service-backend > backend.log 2>&1 &

# 等待服务启动
sleep 3

# 检查服务状态
if pgrep -f customer-service-backend > /dev/null; then
    echo "✅ 服务启动成功!"
    echo "🌐 访问地址: http://$(curl -s ifconfig.me):8080"
else
    echo "❌ 服务启动失败，请检查日志:"
    tail -n 20 backend.log
    exit 1
fi

echo "📊 当前进程状态:"
ps aux | grep customer-service-backend | grep -v grep

echo "🎉 前端更新完成!"
echo "💡 提示: 前端已配置为自动适配当前访问地址，无需修改IP配置"