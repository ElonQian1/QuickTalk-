#!/bin/bash

# ELonTalk 客服系统 - 生产环境启动脚本
# 部署路径: /root/ubuntu-deploy-ready/
# 功能: 启动 HTTPS 服务器 (Let's Encrypt Production 证书)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  ELonTalk 客服系统 - 生产环境启动"
echo "=========================================="
echo "部署路径: $SCRIPT_DIR"
echo "启动时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 检查环境文件
if [ ! -f ".env" ]; then
    echo "❌ 错误: .env 文件不存在"
    exit 1
fi

# 加载环境变量
set -a
source .env
set +a

echo "✓ 环境配置已加载"
echo "  - 数据库: $DATABASE_URL"
echo "  - HTTP端口: $SERVER_PORT"
echo "  - HTTPS端口: $TLS_PORT"
echo "  - 域名: $TLS_DOMAIN"
echo "  - ACME模式: ${ACME_DIRECTORY_URL##*/directory}"
echo ""

# 检查后端程序
if [ ! -f "customer-service-backend" ]; then
    echo "❌ 错误: 后端程序不存在"
    exit 1
fi

# 确保可执行权限
chmod +x customer-service-backend
echo "✓ 后端程序已设置可执行权限"

# 检查静态文件
if [ ! -d "static" ]; then
    echo "⚠️  警告: static 文件夹不存在，前端功能可能不可用"
else
    echo "✓ 前端静态文件已就绪"
fi

# 创建证书目录
mkdir -p certs
echo "✓ 证书目录已创建"

# 检查防火墙配置
echo ""
echo "检查防火墙配置..."
if command -v ufw >/dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
        echo "  防火墙状态: 已启用"
        ufw status | grep -E "8080|8443|22"
    else
        echo "  防火墙状态: 未启用"
    fi
fi

# 启动服务器
echo ""
echo "=========================================="
echo "  正在启动生产服务器..."
echo "=========================================="
echo ""
echo "🚀 HTTP 访问: http://43.139.82.12:$SERVER_PORT"
echo "🔒 HTTPS 访问: https://$TLS_DOMAIN:$TLS_PORT"
echo ""
echo "📝 日志输出:"
echo "------------------------------------------"

# 使用 nohup 后台运行
nohup ./customer-service-backend > server.log 2>&1 &
SERVER_PID=$!

echo "✓ 服务器已启动 (PID: $SERVER_PID)"
echo "  查看实时日志: tail -f server.log"
echo "  停止服务器: kill $SERVER_PID"
echo ""

# 保存 PID 到文件
echo $SERVER_PID > server.pid
echo "✓ PID 已保存到 server.pid"

# 等待几秒钟，检查服务器是否正常启动
sleep 3

if ps -p $SERVER_PID > /dev/null; then
    echo ""
    echo "=========================================="
    echo "  ✅ 服务器启动成功！"
    echo "=========================================="
    echo ""
    tail -n 20 server.log
else
    echo ""
    echo "=========================================="
    echo "  ❌ 服务器启动失败！"
    echo "=========================================="
    echo ""
    tail -n 50 server.log
    exit 1
fi
