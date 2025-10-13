#!/bin/bash

# ELonTalk SSL 修复脚本 - 针对 OpenCloudOS/CentOS
# 修复域名解析和包管理器问题

echo "==========================================="
echo "  SSL 证书配置修复 - OpenCloudOS 专用"
echo "==========================================="

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    echo "❌ 此脚本需要 root 权限，请使用 sudo 运行"
    exit 1
fi

# 重新获取正确的域名信息
echo "🔧 修正域名配置..."
echo ""
echo "💡 根据您之前的输入，正确的信息应该是:"
echo "   - 子域名: elontalk"
echo "   - 完整域名: elontalk.duckdns.org"
echo "   - Token: 400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca"
echo ""

read -p "确认使用以上信息？[y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "❌ 已取消"
    exit 1
fi

SUBDOMAIN="elontalk"
DUCKDNS_TOKEN="400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca"
DOMAIN="${SUBDOMAIN}.duckdns.org"

echo "✅ 使用域名: $DOMAIN"
echo ""

# 安装 certbot (OpenCloudOS 专用)
echo "📦 安装 certbot (OpenCloudOS)..."

# 检查并安装 EPEL
if ! rpm -q epel-release &> /dev/null; then
    echo "正在安装 EPEL 仓库..."
    if command -v dnf &> /dev/null; then
        dnf install -y epel-release
    elif command -v yum &> /dev/null; then
        yum install -y epel-release
    else
        echo "❌ 无法找到包管理器"
        exit 1
    fi
fi

# 安装 certbot
echo "正在安装 certbot..."
if command -v dnf &> /dev/null; then
    dnf install -y certbot
elif command -v yum &> /dev/null; then
    yum install -y certbot
else
    echo "❌ 无法找到包管理器"
    exit 1
fi

# 验证安装
if ! command -v certbot &> /dev/null; then
    echo "❌ certbot 安装失败，尝试备用方法..."
    
    # 尝试 snap 安装
    if command -v snap &> /dev/null; then
        echo "使用 snap 安装 certbot..."
        snap install --classic certbot
        ln -sf /snap/bin/certbot /usr/bin/certbot
    else
        echo "❌ 无法安装 certbot，请手动安装后重试"
        exit 1
    fi
fi

echo "✅ certbot 安装成功"

# 创建证书目录
mkdir -p ./certs

# 验证 DuckDNS 连接
echo "🔍 验证 DuckDNS 连接..."
CURRENT_IP=$(curl -s "https://www.duckdns.org/update?domains=$SUBDOMAIN&token=$DUCKDNS_TOKEN&ip=")
if [[ "$CURRENT_IP" == "OK" ]]; then
    echo "✅ DuckDNS 连接正常"
else
    echo "❌ DuckDNS 连接失败，请检查 Token 是否正确"
    exit 1
fi

# 创建 DNS 验证脚本
cat > /tmp/dns_update.sh << EOF
#!/bin/bash
echo "🔄 更新 DuckDNS DNS 记录 (TXT): \$CERTBOT_VALIDATION"
curl -s "https://www.duckdns.org/update?domains=$SUBDOMAIN&token=$DUCKDNS_TOKEN&txt=\$CERTBOT_VALIDATION"
echo ""
echo "⏳ 等待 DNS 传播..."
sleep 60
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
echo "💡 注意: Let's Encrypt 将验证域名所有权，请耐心等待..."
echo ""

certbot certonly \
    --manual \
    --preferred-challenges=dns \
    --email admin@$DOMAIN \
    --server https://acme-v02.api.letsencrypt.org/directory \
    --agree-tos \
    --no-eff-email \
    --manual-auth-hook /tmp/dns_update.sh \
    --manual-cleanup-hook /tmp/dns_cleanup.sh \
    -d $DOMAIN

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SSL 证书获取成功!"
    
    # 复制证书文件
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ./certs/server.crt
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ./certs/server.key
    
    # 设置权限
    chmod 644 ./certs/server.crt
    chmod 600 ./certs/server.key
    
    echo "📁 证书文件已复制到 ./certs/ 目录"
    echo ""
    echo "🎉 SSL 配置完成！"
    echo "💡 现在可以运行: ./start-https.sh"
    
    # 设置自动续期
    echo "⏰ 设置自动续期..."
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $(pwd)/certs/server.crt && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $(pwd)/certs/server.key") | crontab -
    
    echo "✅ 已设置自动续期 (每天中午12点检查)"
    
else
    echo ""
    echo "❌ SSL 证书获取失败"
    echo ""
    echo "🔍 可能的原因:"
    echo "  1. 网络连接问题"
    echo "  2. DuckDNS Token 错误"
    echo "  3. DNS 传播时间不够"
    echo "  4. Let's Encrypt 服务器繁忙"
    echo ""
    echo "💡 建议:"
    echo "  1. 检查域名解析: nslookup $DOMAIN"
    echo "  2. 验证 DuckDNS: curl 'https://www.duckdns.org/update?domains=$SUBDOMAIN&token=$DUCKDNS_TOKEN'"
    echo "  3. 稍后重试"
    exit 1
fi

# 清理临时文件
rm -f /tmp/dns_update.sh /tmp/dns_cleanup.sh

echo ""
echo "🎊 所有配置完成！"
echo "🚀 下一步: ./start-https.sh 启动 HTTPS 服务器"