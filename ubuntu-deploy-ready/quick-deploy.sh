#!/bin/bash

# 快速部署脚本
# 在Ubuntu服务器上运行此脚本即可完成部署

set -e

echo "=========================================="
echo "  ELonTalk 客服系统 - 快速部署"
echo "=========================================="
echo ""

# 检查是否在 /root/ubuntu-deploy-ready/ 目录
DEPLOY_DIR="/root/ubuntu-deploy-ready"
if [ "$PWD" != "$DEPLOY_DIR" ]; then
    echo "❌ 错误: 请在 $DEPLOY_DIR 目录下运行此脚本"
    echo "   当前目录: $PWD"
    exit 1
fi

# 1. 设置权限
echo "1. 设置文件权限..."
chmod +x *.sh
chmod +x customer-service-backend
chmod 644 .env
chmod 644 *.service
echo "   ✓ 权限设置完成"
echo ""

# 2. 配置防火墙
echo "2. 配置防火墙..."
if command -v ufw >/dev/null 2>&1; then
    ufw allow 22/tcp
    ufw allow 8080/tcp
    ufw allow 8443/tcp
    echo "y" | ufw enable
    echo "   ✓ 防火墙配置完成"
else
    echo "   ⚠️  UFW 未安装，跳过防火墙配置"
fi
echo ""

# 3. 创建必要的目录
echo "3. 创建必要的目录..."
mkdir -p certs
mkdir -p logs
echo "   ✓ 目录创建完成"
echo ""

# 4. 启动服务
echo "4. 启动生产服务..."
./start-production.sh
echo ""

echo "=========================================="
echo "  ✅ 部署完成！"
echo "=========================================="
echo ""
echo "访问地址:"
echo "  HTTP:  http://43.139.82.12:8080"
echo "  HTTPS: https://elontalk.duckdns.org:8443"
echo ""
echo "管理命令:"
echo "  查看日志: tail -f server.log"
echo "  停止服务: kill \$(cat server.pid)"
echo "  重启服务: kill \$(cat server.pid) && ./start-production.sh"
echo ""
