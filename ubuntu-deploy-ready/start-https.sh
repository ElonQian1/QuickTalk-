#!/bin/bash

# ==============================================
# ELonTalk 客服系统 - HTTPS 启动脚本
# ==============================================

echo "🔒 启动 ELonTalk 客服系统 (HTTPS 模式)"
echo "=============================================="

# 检查必要文件
if [ ! -f "./customer-service-backend" ]; then
    echo "❌ 错误: 找不到 customer-service-backend 可执行文件"
    exit 1
fi

# 检查配置文件
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "📋 未找到 .env 配置文件，复制示例配置..."
        cp .env.example .env
        echo "⚠️  请编辑 .env 文件配置您的证书路径"
    else
        echo "❌ 错误: 找不到配置文件"
        exit 1
    fi
fi

# 读取配置文件
source .env

# 检查证书文件
CERT_PATH=${TLS_CERT_PATH:-"certs/server.crt"}
KEY_PATH=${TLS_KEY_PATH:-"certs/server.key"}

echo "🔍 检查证书文件..."
echo "   证书文件: $CERT_PATH"
echo "   私钥文件: $KEY_PATH"

if [ ! -f "$CERT_PATH" ]; then
    echo "❌ 错误: 找不到证书文件: $CERT_PATH"
    echo ""
    echo "💡 解决方案："
    echo "1. 使用 Let's Encrypt:"
    echo "   sudo certbot certonly --standalone -d elontalk.duckdns.org"
    echo ""
    echo "2. 生成自签名证书 (测试用):"
    echo "   cd certs"
    echo "   openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -days 365 -nodes"
    echo ""
    exit 1
fi

if [ ! -f "$KEY_PATH" ]; then
    echo "❌ 错误: 找不到私钥文件: $KEY_PATH"
    exit 1
fi

# 检查证书权限
echo "🔒 检查证书权限..."
if [ -r "$CERT_PATH" ] && [ -r "$KEY_PATH" ]; then
    echo "✅ 证书文件权限正常"
else
    echo "⚠️  证书文件权限可能有问题，尝试修复..."
    chmod 644 "$CERT_PATH" 2>/dev/null || true
    chmod 600 "$KEY_PATH" 2>/dev/null || true
fi

# 设置执行权限
chmod +x ./customer-service-backend

# 设置 HTTPS 模式环境变量
export TLS_MODE=https
export TLS_PORT=${TLS_PORT:-8443}

echo "🌐 服务器配置："
echo "   模式: HTTPS"
echo "   HTTPS端口: $TLS_PORT"
echo "   HTTP端口: ${SERVER_PORT:-8080} (重定向到HTTPS)"
echo "   域名: ${TLS_DOMAIN:-localhost}"
echo "   访问: https://${TLS_DOMAIN:-localhost}:$TLS_PORT"
echo ""
echo "📝 日志输出："
echo "=============================================="

# 启动服务器
./customer-service-backend