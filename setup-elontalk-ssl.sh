#!/bin/bash

# ELonTalk SSL证书申请脚本
# 为 elontalk.duckdns.org 申请 Let's Encrypt 免费SSL证书

DOMAIN="elontalk.duckdns.org"
EMAIL="admin@elontalk.duckdns.org"  # 可以修改为你的真实邮箱

echo "🔐 为 $DOMAIN 申请SSL证书..."

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 sudo 运行此脚本"
    echo "用法: sudo ./setup-elontalk-ssl.sh"
    exit 1
fi

# 检查域名解析
echo "🔍 检查域名解析..."
RESOLVED_IP=$(nslookup $DOMAIN | grep -A1 "非权威应答:" | grep "Address:" | tail -1 | awk '{print $2}')
if [ -z "$RESOLVED_IP" ]; then
    echo "❌ 域名解析失败，请确保 $DOMAIN 正确解析"
    exit 1
fi
echo "✅ 域名解析正常: $DOMAIN -> $RESOLVED_IP"

# 安装certbot (根据不同系统)
if ! command -v certbot &> /dev/null; then
    echo "📦 安装 certbot..."
    if [ -f /etc/debian_version ]; then
        apt update
        apt install -y certbot
    elif [ -f /etc/redhat-release ]; then
        yum install -y certbot
    elif command -v pacman &> /dev/null; then
        pacman -S --noconfirm certbot
    else
        echo "❌ 无法自动安装certbot，请手动安装"
        exit 1
    fi
fi

# 创建证书存储目录
mkdir -p /etc/ssl/elontalk
mkdir -p /var/log/elontalk

# 检查80端口是否被占用
if netstat -tuln | grep -q ":80 "; then
    echo "⚠️  端口80被占用，尝试使用webroot模式..."
    
    # 创建webroot目录
    mkdir -p /var/www/html/.well-known/acme-challenge
    
    # 使用webroot模式申请证书
    certbot certonly \
        --webroot \
        -w /var/www/html \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        -d "$DOMAIN"
else
    echo "🚀 使用standalone模式申请证书..."
    
    # 使用standalone模式申请证书
    certbot certonly \
        --standalone \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        -d "$DOMAIN"
fi

# 检查证书申请结果
if [ $? -eq 0 ] && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "🎉 SSL证书申请成功!"
    
    # 复制证书到应用目录
    cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" /etc/ssl/elontalk/server.crt
    cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" /etc/ssl/elontalk/server.key
    
    # 设置正确的权限
    chown root:root /etc/ssl/elontalk/server.crt
    chown root:ssl-cert /etc/ssl/elontalk/server.key 2>/dev/null || chown root:root /etc/ssl/elontalk/server.key
    chmod 644 /etc/ssl/elontalk/server.crt
    chmod 640 /etc/ssl/elontalk/server.key
    
    # 显示证书信息
    echo "📋 证书信息:"
    openssl x509 -in /etc/ssl/elontalk/server.crt -noout -dates
    
    # 创建续期脚本
    cat > /etc/cron.d/elontalk-ssl-renew << 'EOF'
# ELonTalk SSL证书自动续期 (每天凌晨3点检查)
0 3 * * * root /usr/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx 2>/dev/null || systemctl restart customer-service-backend 2>/dev/null || true"
EOF
    
    echo "✅ 证书文件位置:"
    echo "   证书: /etc/ssl/elontalk/server.crt"
    echo "   私钥: /etc/ssl/elontalk/server.key"
    echo "✅ 已设置自动续期任务"
    
    # 创建测试脚本
    cat > /usr/local/bin/test-elontalk-ssl << 'EOF'
#!/bin/bash
echo "🔍 测试 ELonTalk SSL证书..."
openssl s_client -connect elontalk.duckdns.org:443 -servername elontalk.duckdns.org < /dev/null 2>/dev/null | openssl x509 -noout -dates
EOF
    chmod +x /usr/local/bin/test-elontalk-ssl
    
    echo ""
    echo "🎊 SSL证书设置完成!"
    echo "🌐 HTTPS访问地址: https://$DOMAIN"
    echo "🔧 下一步: 配置应用使用HTTPS"
    
else
    echo "❌ SSL证书申请失败!"
    echo "可能的原因:"
    echo "1. 域名解析未生效"
    echo "2. 防火墙阻止了80端口"
    echo "3. 服务器无法访问Let's Encrypt服务器"
    echo ""
    echo "🔧 故障排除建议:"
    echo "- 检查防火墙: ufw status"
    echo "- 检查端口占用: netstat -tuln | grep :80"
    echo "- 手动测试域名: curl -I http://$DOMAIN"
    exit 1
fi