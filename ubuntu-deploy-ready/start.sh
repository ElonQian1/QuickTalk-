#!/bin/bash

# ==============================================
# ELonTalk 客服系统 - 智能启动脚本 (推荐)
# ==============================================

# 自动检测部署路径
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🤖 启动 ELonTalk 客服系统 (智能模式)"
echo "=============================================="
echo "📁 部署路径: $DEPLOY_DIR"

# 切换到脚本所在目录
cd "$DEPLOY_DIR"

# 检查必要文件
if [ ! -f "./customer-service-backend" ]; then
    echo "❌ 错误: 找不到 customer-service-backend 可执行文件"
    echo "   当前目录: $DEPLOY_DIR"
    exit 1
fi

# 检查配置文件
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "📋 未找到 .env 配置文件，复制示例配置..."
        cp .env.example .env
        echo "✅ 已创建 .env 配置文件"
    else
        echo "❌ 错误: 找不到配置文件"
        exit 1
    fi
fi

# 读取配置文件
source .env

# 设置执行权限
chmod +x ./customer-service-backend

# 检查证书可用性
CERT_PATH=${TLS_CERT_PATH:-"certs/server.crt"}
KEY_PATH=${TLS_KEY_PATH:-"certs/server.key"}

echo "🔍 检测运行模式..."

HTTPS_AVAILABLE=false
if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ] && [ -r "$CERT_PATH" ] && [ -r "$KEY_PATH" ]; then
    echo "✅ 检测到可用的HTTPS证书"
    HTTPS_AVAILABLE=true
else
    echo "⚠️  未检测到HTTPS证书，将使用HTTP模式"
fi

# 设置智能模式环境变量
export TLS_MODE=auto

if [ "$HTTPS_AVAILABLE" = true ]; then
    export TLS_PORT=${TLS_PORT:-8443}
    echo "🌐 服务器配置："
    echo "   模式: 智能模式 (HTTPS优先)"
    echo "   HTTPS端口: $TLS_PORT"
    echo "   HTTP端口: ${SERVER_PORT:-8080} (重定向到HTTPS)"
    echo "   域名: ${TLS_DOMAIN:-localhost}"
    echo "   访问: https://${TLS_DOMAIN:-localhost}:$TLS_PORT"
else
    export SERVER_PORT=${SERVER_PORT:-8080}
    echo "🌐 服务器配置："
    echo "   模式: 智能模式 (HTTP回退)"
    echo "   HTTP端口: $SERVER_PORT"
    echo "   访问: http://localhost:$SERVER_PORT"
    echo ""
    echo "💡 要启用HTTPS，请配置证书文件后重启"
fi

echo ""
echo "📝 日志输出："
echo "=============================================="

# 启动服务器
./customer-service-backend