#!/bin/bash
# 前台调试运行脚本
# 用于测试和调试

set -e

echo "=========================================="
echo "  前台调试模式启动"
echo "=========================================="

# 加载环境变量
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ 环境变量已加载"
else
    echo "⚠️  警告: .env 文件不存在"
fi

# 显示配置
echo ""
echo "当前配置:"
echo "  TLS_MODE: ${TLS_MODE:-未设置}"
echo "  TLS_PORT: ${TLS_PORT:-未设置}"
echo "  TLS_DOMAIN: ${TLS_DOMAIN:-未设置}"
echo "  ACME_ENABLED: ${ACME_ENABLED:-未设置}"
echo "  DATABASE_URL: ${DATABASE_URL:-未设置}"
echo ""

# 启动服务
echo "🚀 启动服务（前台模式）..."
echo "按 Ctrl+C 停止服务"
echo "=========================================="
./customer-service-backend
