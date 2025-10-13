#!/bin/bash

# ==============================================
# ELonTalk 客服系统 - 智能启动脚本 v2.0
# ==============================================

# 自动检测部署路径
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 启动 ELonTalk 客服系统 (智能模式)"
echo "=============================================="
echo "📁 部署路径: $DEPLOY_DIR"
echo "⏰ 启动时间: $(date '+%Y-%m-%d %H:%M:%S')"

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

# 检查数据库状态
echo "🗃️  检查数据库状态..."
DB_FILE="customer_service.db"
if [ ! -f "$DB_FILE" ]; then
    echo "📋 数据库文件不存在，将在启动时创建"
elif [ ! -s "$DB_FILE" ]; then
    echo "⚠️  数据库文件为空，将重新初始化"
    rm -f "$DB_FILE"
    echo "🗑️  已删除空数据库文件"
else
    db_size=$(ls -lh "$DB_FILE" | awk '{print $5}')
    echo "✅ 数据库文件正常 (大小: $db_size)"
fi

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
    echo "💡 要启用HTTPS，请运行:"
    echo "   - 自签名证书: ./generate-cert.sh"
    echo "   - Let's Encrypt: ./setup-ssl.sh"
fi

# 检查端口占用
HTTP_PORT=${SERVER_PORT:-8080}
HTTPS_PORT=${TLS_PORT:-8443}

check_port() {
    local port=$1
    if command -v netstat >/dev/null 2>&1; then
        netstat -ln 2>/dev/null | grep ":$port " >/dev/null
    elif command -v ss >/dev/null 2>&1; then
        ss -ln 2>/dev/null | grep ":$port " >/dev/null
    else
        return 1  # 无法检查，假设端口可用
    fi
}

if check_port $HTTP_PORT; then
    echo "⚠️  警告: 端口 $HTTP_PORT 已被占用"
    echo "💡 请检查是否有其他服务在运行，或修改 .env 中的 SERVER_PORT"
fi

if [ "$HTTPS_AVAILABLE" = true ] && check_port $HTTPS_PORT; then
    echo "⚠️  警告: 端口 $HTTPS_PORT 已被占用"
    echo "💡 请检查是否有其他服务在运行，或修改 .env 中的 TLS_PORT"
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
    echo "   证书路径: $CERT_PATH"
    
    # 获取服务器IP
    if command -v curl >/dev/null 2>&1; then
        server_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")
    else
        server_ip="YOUR_SERVER_IP"
    fi
    
    echo ""
    echo "🔗 访问地址:"
    echo "   HTTPS: https://${TLS_DOMAIN:-localhost}:$TLS_PORT"
    echo "   HTTPS (IP): https://$server_ip:$TLS_PORT"
    echo "   HTTP: http://$server_ip:${SERVER_PORT:-8080} (自动重定向)"
else
    export SERVER_PORT=${SERVER_PORT:-8080}
    echo "🌐 服务器配置："
    echo "   模式: 智能模式 (HTTP回退)"
    echo "   HTTP端口: $SERVER_PORT"
    
    # 获取服务器IP  
    if command -v curl >/dev/null 2>&1; then
        server_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")
    else
        server_ip="YOUR_SERVER_IP"
    fi
    
    echo ""
    echo "🔗 访问地址:"
    echo "   HTTP: http://$server_ip:$SERVER_PORT"
    echo ""
    echo "💡 要启用HTTPS，请配置证书文件后重启"
fi

echo ""
echo "📝 日志输出："
echo "=============================================="

# 确保数据库目录权限正确
mkdir -p "$(dirname "$DB_FILE")" 2>/dev/null || true
touch "$DB_FILE" 2>/dev/null || true

# 设置必要的环境变量
export DATABASE_URL="sqlite:./customer_service.db"
export RUST_LOG="${RUST_LOG:-info}"

# 启动服务器
./customer-service-backend