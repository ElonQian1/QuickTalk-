#!/bin/bash
# ELonTalk 客服系统 - 测试环境启动脚本
# 路径: /root/ubuntu-deploy-ready/
# 使用方法: ./start-staging.sh

set -e

echo "==================================="
echo "  ELonTalk 客服系统 - 测试环境"
echo "==================================="

# 检查必要文件
echo ""
echo "1. 检查必要文件..."

if [ ! -f "customer-service-backend" ]; then
    echo "❌ 错误: 找不到后端程序 customer-service-backend"
    exit 1
fi
echo "✓ 后端程序存在"

if [ ! -f ".env.staging" ]; then
    echo "❌ 错误: 找不到环境配置文件 .env.staging"
    exit 1
fi
echo "✓ 环境配置文件存在"

# 设置权限
echo ""
echo "2. 设置执行权限..."
chmod +x customer-service-backend
echo "✓ 后端程序已设置为可执行"

# 使用测试环境配置
echo ""
echo "3. 配置环境..."
cp .env.staging .env
echo "✓ 已切换到测试环境配置"

# 启动服务
echo ""
echo "4. 启动服务 (测试环境 - Let's Encrypt Staging)..."
echo "   - HTTPS 端口: 8443"
echo "   - HTTP 端口: 8080"
echo "   - ACME: Let's Encrypt Staging (不受信任，仅测试用)"
echo ""
echo "按 Ctrl+C 停止服务"
echo "-----------------------------------"
echo ""

# 启动后端
./customer-service-backend
