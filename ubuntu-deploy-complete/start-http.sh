#!/bin/bash

# ==============================================
# ELonTalk HTTP 启动脚本
# ==============================================

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🌐 启动 ELonTalk 客服系统 (HTTP模式)"
echo "=============================================="

cd "$DEPLOY_DIR"

# 检查必要文件
if [ ! -f "./customer-service-backend" ]; then
    echo "❌ 错误: 找不到可执行文件"
    exit 1
fi

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ 已创建 .env 配置文件"
    fi
fi

# 读取配置
if [ -f ".env" ]; then
    source .env
fi

# 强制HTTP模式
export TLS_MODE=disable
export SERVER_PORT=${SERVER_PORT:-8080}

chmod +x ./customer-service-backend

echo "🌐 HTTP服务器配置："
echo "   端口: $SERVER_PORT"
echo "   模式: HTTP Only (HTTPS已禁用)"

# 获取服务器IP
server_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")

echo ""
echo "🔗 HTTP访问地址:"
echo "   http://localhost:$SERVER_PORT (本地)"
echo "   http://$server_ip:$SERVER_PORT (远程)"

echo ""
echo "⚠️  安全提醒: HTTP模式下数据传输未加密"
echo "💡 生产环境建议使用HTTPS: ./start-https.sh"

echo ""
echo "📝 日志输出："
echo "=============================================="

# 启动服务器
./customer-service-backend