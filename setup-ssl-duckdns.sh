#!/bin/bash

# 为DuckDNS域名申请Let's Encrypt证书
# 使用方法: ./setup-ssl-duckdns.sh yourdomain.duckdns.org

DOMAIN="$1"
EMAIL="admin@example.com"  # 修改为你的邮箱

if [ -z "$DOMAIN" ]; then
    echo "使用方法: $0 <完整域名>"
    echo "例如: $0 myapp.duckdns.org"
    exit 1
fi

echo "为域名 $DOMAIN 申请SSL证书..."

# 安装certbot
if ! command -v certbot &> /dev/null; then
    echo "安装certbot..."
    if [ -f /etc/debian_version ]; then
        sudo apt update
        sudo apt install -y certbot
    elif [ -f /etc/redhat-release ]; then
        sudo yum install -y certbot
    else
        echo "请手动安装certbot"
        exit 1
    fi
fi

# 创建证书目录
sudo mkdir -p /etc/ssl/customer-service
sudo mkdir -p /var/www/html

# 方法1: Standalone验证 (需要停止应用占用80端口)
echo "使用Standalone方式申请证书..."
sudo certbot certonly \
    --standalone \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

if [ $? -eq 0 ]; then
    echo "证书申请成功!"
    
    # 复制证书到应用目录
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" /etc/ssl/customer-service/server.crt
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" /etc/ssl/customer-service/server.key
    
    # 设置权限
    sudo chown root:root /etc/ssl/customer-service/server.crt
    sudo chown root:ssl-cert /etc/ssl/customer-service/server.key
    sudo chmod 644 /etc/ssl/customer-service/server.crt
    sudo chmod 640 /etc/ssl/customer-service/server.key
    
    # 生成环境配置文件
    cat > .env.production << EOF
# 基本配置
DATABASE_URL=sqlite:customer_service.db
JWT_SECRET=your-super-secret-jwt-key
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# HTTPS配置
HTTPS_ENABLED=true
HTTPS_PORT=8443
TLS_CERT_PATH=/etc/ssl/customer-service/server.crt
TLS_KEY_PATH=/etc/ssl/customer-service/server.key
TLS_DOMAIN=$DOMAIN
REDIRECT_HTTP=true
EOF

    echo "配置文件已生成: .env.production"
    echo "证书位置: /etc/ssl/customer-service/"
    
    # 设置自动续期
    (crontab -l 2>/dev/null; echo "0 3 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx 2>/dev/null || true") | crontab -
    
    echo "SSL证书设置完成!"
    echo "域名: https://$DOMAIN"
    
else
    echo "证书申请失败，请检查:"
    echo "1. 域名解析是否正确"
    echo "2. 防火墙是否开放80端口"
    echo "3. 80端口是否被占用"
fi