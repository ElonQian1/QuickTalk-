#!/bin/bash
# Ubuntu 快速部署脚本
# 执行路径: /root/ubuntu-deploy-ready/

set -e

echo "=========================================="
echo "  ELonTalk 客服系统 - Ubuntu 部署"
echo "=========================================="

# 设置权限
echo "🔧 设置执行权限..."
chmod +x customer-service-backend

# 停止旧服务（如果存在）
echo "🛑 停止旧服务..."
systemctl stop customer-service.service 2>/dev/null || echo "   服务未运行，跳过"

# 安装/更新 systemd 服务
echo "📋 安装 systemd 服务..."
cp customer-service.service /etc/systemd/system/
systemctl daemon-reload

# 加载环境变量
echo "🔐 加载环境配置..."
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  警告: .env 文件不存在"
fi

# 检查数据库
echo "💾 检查数据库..."
if [ ! -f customer_service.db ]; then
    echo "   数据库文件不存在，程序将自动创建"
fi

# 启动服务
echo "🚀 启动服务..."
systemctl enable customer-service.service
systemctl start customer-service.service

# 等待服务启动
sleep 3

# 检查服务状态
echo ""
echo "=========================================="
echo "  服务状态"
echo "=========================================="
systemctl status customer-service.service --no-pager -l

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo "📍 服务地址: https://elontalk.duckdns.org:8443"
echo "📊 查看日志: journalctl -u customer-service.service -f"
echo "🔄 重启服务: systemctl restart customer-service.service"
echo "🛑 停止服务: systemctl stop customer-service.service"
echo "=========================================="
