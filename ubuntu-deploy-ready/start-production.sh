#!/bin/bash
# ELonTalk 客服系统 - 生产环境启动脚本
# 路径: /root/ubuntu-deploy-ready/
# 使用方法: ./start-production.sh

set -e

echo "==================================="
echo "  ELonTalk 客服系统 - 生产部署"
echo "==================================="

# 检查必要文件
echo ""
echo "1. 检查必要文件..."

if [ ! -f "customer-service-backend" ]; then
    echo "❌ 错误: 找不到后端程序 customer-service-backend"
    exit 1
fi
echo "✓ 后端程序存在"

if [ ! -f ".env.production" ]; then
    echo "❌ 错误: 找不到环境配置文件 .env.production"
    exit 1
fi
echo "✓ 环境配置文件存在"

if [ ! -d "static" ]; then
    echo "❌ 错误: 找不到前端静态文件目录 static"
    exit 1
fi
echo "✓ 前端静态文件目录存在"

if [ ! -d "certs" ]; then
    echo "⚠️  警告: 找不到证书目录 certs (将使用 ACME 自动申请)"
    mkdir -p certs
fi
echo "✓ 证书目录已准备"

# 设置权限
echo ""
echo "2. 设置执行权限..."
chmod +x customer-service-backend
echo "✓ 后端程序已设置为可执行"

# 使用生产环境配置
echo ""
echo "3. 配置环境..."
cp .env.production .env
echo "✓ 已切换到生产环境配置"

# 启动服务
echo ""
echo "4. 启动服务..."
echo "   - HTTPS 端口: 8443"
echo "   - HTTP 端口: 8080"
echo "   - 域名: elontalk.duckdns.org"
echo "   - ACME: 启用（Let's Encrypt 生产环境）"
echo ""
echo "按 Ctrl+C 停止服务"
echo "-----------------------------------"
echo ""

# 启动后端
./customer-service-backend
