#!/bin/bash

# SSL 证书自动获取脚本 (Let's Encrypt + DuckDNS)
# 用于为 ELonTalk 客服系统自动配置 HTTPS

echo "==========================================="
echo "  SSL 证书自动配置 - Let's Encrypt"
echo "==========================================="

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    echo "❌ 此脚本需要 root 权限，请使用 sudo 运行"
    exit 1
fi

# 获取用户输入
read -p "🌐 请输入您的 DuckDNS 子域名 (例如: myapp): " SUBDOMAIN_INPUT
read -p "🔑 请输入您的 DuckDNS Token: " DUCKDNS_TOKEN

if [ -z "$SUBDOMAIN_INPUT" ] || [ -z "$DUCKDNS_TOKEN" ]; then
    echo "❌ 域名和 Token 不能为空"
    exit 1
fi

# 处理域名输入 - 提取子域名部分
if [[ "$SUBDOMAIN_INPUT" == http://* ]] || [[ "$SUBDOMAIN_INPUT" == https://* ]]; then
    # 如果输入了完整URL，提取域名部分
    SUBDOMAIN_INPUT=$(echo "$SUBDOMAIN_INPUT" | sed 's|https\?://||' | cut -d'/' -f1)
fi

if [[ "$SUBDOMAIN_INPUT" == *.duckdns.org ]]; then
    # 如果输入了完整域名，提取子域名部分
    SUBDOMAIN=$(echo "$SUBDOMAIN_INPUT" | sed 's|\.duckdns\.org$||')
else
    # 如果只输入了子域名，直接使用
    SUBDOMAIN="$SUBDOMAIN_INPUT"
fi

DOMAIN="${SUBDOMAIN}.duckdns.org"

echo ""
echo "📋 配置信息:"
echo "   - 域名: $DOMAIN"
echo "   - Token: ${DUCKDNS_TOKEN:0:8}..."
echo ""

# 安装 certbot
echo "📦 安装 certbot..."

# 检测包管理器并安装 certbot
if command -v apt-get &> /dev/null; then
    # Debian/Ubuntu 系统
    apt-get update
    apt-get install -y certbot
elif command -v yum &> /dev/null; then
    # CentOS/RHEL/OpenCloudOS 老版本
    yum update -y
    yum install -y epel-release
    yum install -y certbot
elif command -v dnf &> /dev/null; then
    # Fedora/CentOS 8+/OpenCloudOS 新版本
    dnf update -y
    dnf install -y epel-release
    dnf install -y certbot
elif command -v zypper &> /dev/null; then
    # openSUSE
    zypper refresh
    zypper install -y certbot
elif command -v pacman &> /dev/null; then
    # Arch Linux
    pacman -Sy --noconfirm certbot
else
    echo "❌ 无法检测到支持的包管理器"
    echo "请手动安装 certbot:"
    echo "  - CentOS/RHEL: yum install epel-release && yum install certbot"
    echo "  - Ubuntu/Debian: apt-get install certbot" 
    echo "  - Fedora: dnf install certbot"
    exit 1
fi

# 验证 certbot 安装
if ! command -v certbot &> /dev/null; then
    echo "❌ certbot 安装失败"
    exit 1
fi

echo "✅ certbot 安装成功"

# 创建证书目录
mkdir -p ./certs

# 创建 DNS 验证脚本
cat > /tmp/dns_update.sh << EOF
#!/bin/bash
echo "🔄 更新 DuckDNS DNS 记录..."
curl -s "https://www.duckdns.org/update?domains=$SUBDOMAIN&token=$DUCKDNS_TOKEN&txt=\$CERTBOT_VALIDATION"
sleep 30
EOF

chmod +x /tmp/dns_update.sh

# 创建清理脚本
cat > /tmp/dns_cleanup.sh << EOF
#!/bin/bash
echo "🧹 清理 DuckDNS DNS 记录..."
curl -s "https://www.duckdns.org/update?domains=$SUBDOMAIN&token=$DUCKDNS_TOKEN&txt=removed&clear=true"
EOF

chmod +x /tmp/dns_cleanup.sh

# 获取证书
echo "🔒 获取 SSL 证书..."
certbot certonly \
    --manual \
    --preferred-challenges=dns \
    --email admin@$DOMAIN \
    --server https://acme-v02.api.letsencrypt.org/directory \
    --agree-tos \
    --manual-auth-hook /tmp/dns_update.sh \
    --manual-cleanup-hook /tmp/dns_cleanup.sh \
    -d $DOMAIN

if [ $? -eq 0 ]; then
    echo "✅ SSL 证书获取成功!"
    
    # 复制证书文件
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ./certs/server.crt
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ./certs/server.key
    
    # 设置权限
    chmod 644 ./certs/server.crt
    chmod 600 ./certs/server.key
    
    echo "📁 证书文件已复制到 ./certs/ 目录"
    echo "🎉 现在您可以使用 ./start-https.sh 启动 HTTPS 服务器"
    
    # 设置自动续期
    echo "⏰ 设置自动续期..."
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $(pwd)/certs/server.crt && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $(pwd)/certs/server.key") | crontab -
    
    echo "✅ 已设置自动续期 (每天中午12点检查)"
else
    echo "❌ SSL 证书获取失败"
    echo "请检查:"
    echo "  1. DuckDNS Token 是否正确"
    echo "  2. 域名解析是否正常"
    echo "  3. 网络连接是否稳定"
    exit 1
fi

# 清理临时文件
rm -f /tmp/dns_update.sh /tmp/dns_cleanup.sh

echo ""
echo "🎊 SSL 证书配置完成!"
echo "💡 下一步: 运行 ./start-https.sh 启动 HTTPS 服务器"