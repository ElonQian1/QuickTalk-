#!/bin/bash

# ==============================================
# ELonTalk HTTPS 启动脚本
# ==============================================

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔒 启动 ELonTalk 客服系统 (HTTPS模式)"
echo "=============================================="

cd "$DEPLOY_DIR"

# 检查必要文件
if [ ! -f "./customer-service-backend" ]; then
    echo "❌ 错误: 找不到可执行文件"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "❌ 错误: 找不到配置文件 .env"
    exit 1
fi

# 读取配置
source .env

# 检查证书文件
CERT_PATH=${TLS_CERT_PATH:-"certs/server.crt"}
KEY_PATH=${TLS_KEY_PATH:-"certs/server.key"}

if [ ! -f "$CERT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
    echo "❌ 错误: 找不到SSL证书文件"
    echo "   证书路径: $CERT_PATH"
    echo "   私钥路径: $KEY_PATH"
    echo ""
    echo "💡 请先生成证书:"
    echo "   自签名证书: ./generate-cert.sh"
    echo "   Let's Encrypt: ./setup-ssl.sh"
    exit 1
fi

# 验证证书文件权限
if [ ! -r "$CERT_PATH" ] || [ ! -r "$KEY_PATH" ]; then
    echo "❌ 错误: 证书文件权限不足"
    echo "💡 请检查文件权限:"
    echo "   chmod 644 $CERT_PATH"
    echo "   chmod 600 $KEY_PATH"
    exit 1
fi

# 设置HTTPS模式
export TLS_MODE=force
export TLS_PORT=${TLS_PORT:-8443}
export TLS_DOMAIN=${TLS_DOMAIN:-localhost}

chmod +x ./customer-service-backend

echo "🔒 HTTPS服务器配置："
echo "   端口: $TLS_PORT"
echo "   域名: $TLS_DOMAIN"
echo "   证书: $CERT_PATH"
echo "   私钥: $KEY_PATH"

# 获取服务器IP
server_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")

echo ""
echo "🔗 HTTPS访问地址:"
echo "   https://$TLS_DOMAIN:$TLS_PORT"
echo "   https://$server_ip:$TLS_PORT"

echo ""
echo "📝 日志输出："
echo "=============================================="

# 启动服务器
./customer-service-backend