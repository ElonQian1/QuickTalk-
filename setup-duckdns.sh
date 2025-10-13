#!/bin/bash

# DuckDNS自动设置脚本
# 使用方法: ./setup-duckdns.sh yourdomain yourtoken

DOMAIN="$1"
TOKEN="$2"

if [ -z "$DOMAIN" ] || [ -z "$TOKEN" ]; then
    echo "使用方法: $0 <域名> <token>"
    echo "例如: $0 myapp a7c4d0ed-114f-4ca4-b3ab-9c90c4a5cef1"
    exit 1
fi

echo "设置DuckDNS域名: $DOMAIN.duckdns.org"

# 更新IP到DuckDNS
curl "https://www.duckdns.org/update?domains=$DOMAIN&token=$TOKEN&ip="

# 创建自动更新脚本
cat > /etc/cron.d/duckdns << EOF
# 每5分钟更新一次DuckDNS (适用于动态IP)
*/5 * * * * root curl "https://www.duckdns.org/update?domains=$DOMAIN&token=$TOKEN&ip=" >/dev/null 2>&1
EOF

echo "DuckDNS设置完成!"
echo "域名: $DOMAIN.duckdns.org"
echo "已设置自动更新任务"

# 验证解析
echo "验证DNS解析..."
nslookup $DOMAIN.duckdns.org