#!/bin/bash

# ELonTalk HTTPS 修复脚本
# 修复环境变量配置问题

echo "🔧 修复 HTTPS 配置..."

# 备份原文件
if [[ -f ".env" ]]; then
    cp .env .env.backup
    echo "✅ 已备份原配置文件为 .env.backup"
fi

# 修复环境变量
echo "🔄 更新环境变量配置..."

# 确保使用正确的环境变量名
sed -i 's/TLS_ENABLED=true/TLS_MODE=true/g' .env 2>/dev/null || true
sed -i 's/HTTPS_ENABLED=true//g' .env 2>/dev/null || true
sed -i 's/HTTPS_PORT=8443//g' .env 2>/dev/null || true

# 如果 .env 文件不存在或损坏，创建新的
if [[ ! -f ".env" ]] || ! grep -q "TLS_MODE" .env; then
    echo "📝 创建新的 .env 配置文件..."
    cat > .env << 'EOF'
# ELonTalk 客服系统 - Ubuntu 生产环境配置
DATABASE_URL=sqlite:customer_service.db
JWT_SECRET=ElonTalk-Super-Secure-JWT-Secret-2025-Production-Key-Change-This
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# HTTPS 配置 (强制启用)
TLS_MODE=true
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key
TLS_PORT=8443
TLS_DOMAIN=elontalk.duckdns.org
TLS_REDIRECT_HTTP=true

# 静态文件服务路径
STATIC_FILES_PATH=static

# 日志配置
RUST_LOG=debug,sqlx=info,sea_orm=info
RUST_BACKTRACE=full

# 服务器信息
SERVER_IP=43.139.82.12
ADMIN_EMAIL=siwmm@163.com
EOF
fi

# 设置权限
chmod 600 .env

echo "✅ HTTPS 配置修复完成"
echo
echo "🔍 当前关键配置："
grep -E "TLS_MODE|TLS_CERT_PATH|TLS_KEY_PATH|TLS_PORT" .env

echo
echo "🚀 现在可以重新启动服务："
echo "  ./stop.sh"
echo "  ./quick-start.sh"