#!/bin/bash

# DuckDNS + Let's Encrypt SSL证书申请脚本
# 通用版本 - 请修改域名和邮箱

# ===== 配置区域 - 请修改以下信息 =====
DOMAIN="elontalk.duckdns.org"  # 你的DuckDNS域名
EMAIL="admin@elontalk.duckdns.org"       # 修改为你的真实邮箱
# =====================================

echo "🔐 为 $DOMAIN 申请Let's Encrypt免费SSL证书..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ 请使用 sudo 运行此脚本${NC}"
    echo "用法: sudo ./setup-duckdns-ssl.sh"
    exit 1
fi

echo -e "${BLUE}📋 配置信息:${NC}"
echo "   域名: $DOMAIN"
echo "   邮箱: $EMAIL"
echo ""

# 检查域名配置
if [ "$DOMAIN" = "你的域名.duckdns.org" ] || [ "$EMAIL" = "your-email@example.com" ]; then
    echo -e "${RED}❌ 请先修改脚本中的域名和邮箱配置！${NC}"
    echo "编辑此脚本，修改以下变量："
    echo "DOMAIN=\"你的实际域名.duckdns.org\""
    echo "EMAIL=\"你的实际邮箱@example.com\""
    exit 1
fi

# 检查域名解析
echo -e "${BLUE}🔍 检查域名解析...${NC}"
RESOLVED_IP=$(nslookup $DOMAIN | grep -A1 "Name:" | grep "Address:" | tail -1 | awk '{print $2}')
if [ -z "$RESOLVED_IP" ]; then
    # 尝试另一种方式
    RESOLVED_IP=$(dig +short $DOMAIN)
fi

if [ -z "$RESOLVED_IP" ]; then
    echo -e "${RED}❌ 域名解析失败！${NC}"
    echo "请确保:"
    echo "1. DuckDNS域名配置正确"
    echo "2. 域名已解析到此服务器IP"
    echo "3. DNS解析已生效 (可能需要等待几分钟)"
    exit 1
fi

echo -e "${GREEN}✅ 域名解析正常: $DOMAIN -> $RESOLVED_IP${NC}"

# 获取当前服务器IP
SERVER_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip || curl -s ipecho.net/plain)
if [ "$RESOLVED_IP" != "$SERVER_IP" ]; then
    echo -e "${YELLOW}⚠️  警告: 域名解析IP ($RESOLVED_IP) 与服务器IP ($SERVER_IP) 不匹配${NC}"
    echo "如果这不是预期的，请检查DuckDNS配置"
    read -p "是否继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 安装certbot
if ! command -v certbot &> /dev/null; then
    echo -e "${BLUE}📦 安装 certbot...${NC}"
    if [ -f /etc/debian_version ]; then
        apt update
        apt install -y certbot
    elif [ -f /etc/redhat-release ]; then
        yum install -y certbot || dnf install -y certbot
    elif command -v pacman &> /dev/null; then
        pacman -S --noconfirm certbot
    else
        echo -e "${RED}❌ 无法自动安装certbot，请手动安装${NC}"
        echo "Ubuntu/Debian: sudo apt install certbot"
        echo "CentOS/RHEL: sudo yum install certbot"
        exit 1
    fi
fi

# 创建项目证书目录
CERT_DIR="$(pwd)/certs"
mkdir -p "$CERT_DIR"

# 停止可能占用80端口的服务
echo -e "${BLUE}🛑 检查并停止占用80端口的服务...${NC}"
if netstat -tuln | grep -q ":80 "; then
    echo "发现80端口被占用，尝试停止相关服务..."
    # 尝试停止常见的web服务器
    systemctl stop nginx 2>/dev/null || true
    systemctl stop apache2 2>/dev/null || true
    systemctl stop httpd 2>/dev/null || true
    
    # 再次检查
    if netstat -tuln | grep -q ":80 "; then
        echo -e "${YELLOW}⚠️  端口80仍被占用，将使用webroot模式${NC}"
        USE_WEBROOT=true
    else
        USE_WEBROOT=false
    fi
else
    USE_WEBROOT=false
fi

# 申请证书
if [ "$USE_WEBROOT" = true ]; then
    echo -e "${BLUE}🌐 使用webroot模式申请证书...${NC}"
    
    # 创建webroot目录
    WEBROOT_DIR="/tmp/certbot-webroot"
    mkdir -p "$WEBROOT_DIR/.well-known/acme-challenge"
    
    # 启动临时HTTP服务器
    cd "$WEBROOT_DIR"
    python3 -m http.server 80 &
    HTTP_PID=$!
    sleep 2
    
    # 申请证书
    certbot certonly \
        --webroot \
        -w "$WEBROOT_DIR" \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        -d "$DOMAIN"
    
    CERT_RESULT=$?
    
    # 停止临时服务器
    kill $HTTP_PID 2>/dev/null || true
    
else
    echo -e "${BLUE}🚀 使用standalone模式申请证书...${NC}"
    
    # 使用standalone模式申请证书
    certbot certonly \
        --standalone \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        -d "$DOMAIN"
    
    CERT_RESULT=$?
fi

# 检查证书申请结果
if [ $CERT_RESULT -eq 0 ] && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "${GREEN}🎉 SSL证书申请成功！${NC}"
    
    # 复制证书到项目目录
    cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/server.crt"
    cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERT_DIR/server.key"
    
    # 设置权限（让普通用户也能读取）
    chmod 644 "$CERT_DIR/server.crt"
    chmod 644 "$CERT_DIR/server.key"
    
    echo -e "${GREEN}📋 证书信息:${NC}"
    openssl x509 -in "$CERT_DIR/server.crt" -noout -dates
    
    # 创建续期脚本
    cat > "/etc/cron.d/duckdns-ssl-renew" << EOF
# DuckDNS SSL证书自动续期 (每天凌晨3点检查)
0 3 * * * root /usr/bin/certbot renew --quiet --deploy-hook "cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $CERT_DIR/server.crt && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $CERT_DIR/server.key && chmod 644 $CERT_DIR/server.crt && chmod 644 $CERT_DIR/server.key"
EOF
    
    echo -e "${GREEN}✅ 证书文件位置:${NC}"
    echo "   证书: $CERT_DIR/server.crt"
    echo "   私钥: $CERT_DIR/server.key"
    echo -e "${GREEN}✅ 已设置自动续期任务${NC}"
    
    # 创建环境配置文件
    cat > "$(pwd)/.env.production.ssl" << EOF
# 生产环境 SSL 配置文件
# 使用 Let's Encrypt 证书

# 基本配置
DATABASE_URL=sqlite:customer_service.db
JWT_SECRET=production-super-secret-jwt-key-2024
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# HTTPS 配置 - 启用SSL
TLS_ENABLED=true
TLS_PORT=8443
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key
TLS_DOMAIN=$DOMAIN
TLS_REDIRECT_HTTP=true

# 生产配置
RUST_LOG=info
CORS_ALLOWED_ORIGINS=https://$DOMAIN
EOF
    
    echo ""
    echo -e "${GREEN}🎊 SSL证书设置完成！${NC}"
    echo -e "${BLUE}🌐 HTTPS访问地址: https://$DOMAIN:8443${NC}"
    echo ""
    echo -e "${YELLOW}🔧 下一步操作:${NC}"
    echo "1. 复制生产配置: cp .env.production.ssl .env"
    echo "2. 启动HTTPS服务器: cd backend && cargo run --release"
    echo "3. 测试访问: https://$DOMAIN:8443"
    
else
    echo -e "${RED}❌ SSL证书申请失败！${NC}"
    echo ""
    echo -e "${YELLOW}可能的原因:${NC}"
    echo "1. 域名解析未完全生效"
    echo "2. 防火墙阻止了80端口访问"
    echo "3. 服务器无法连接Let's Encrypt服务器"
    echo "4. DuckDNS配置有误"
    echo ""
    echo -e "${BLUE}🔧 故障排除建议:${NC}"
    echo "- 检查防火墙: sudo ufw status"
    echo "- 检查端口: netstat -tuln | grep :80"
    echo "- 测试域名访问: curl -I http://$DOMAIN"
    echo "- 等待DNS生效: nslookup $DOMAIN"
    exit 1
fi