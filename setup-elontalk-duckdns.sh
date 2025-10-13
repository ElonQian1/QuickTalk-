#!/bin/bash

# ELonTalk DuckDNS 自动更新脚本
# 域名: elontalk.duckdns.org
# Token: 400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca

DOMAIN="elontalk"
TOKEN="400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca"

echo "更新 ELonTalk DuckDNS 域名: $DOMAIN.duckdns.org"

# 更新IP到DuckDNS
RESPONSE=$(curl -s "https://www.duckdns.org/update?domains=$DOMAIN&token=$TOKEN&ip=")

if [ "$RESPONSE" = "OK" ]; then
    echo "✅ DuckDNS 更新成功!"
    echo "域名: $DOMAIN.duckdns.org"
    echo "时间: $(date)"
else
    echo "❌ DuckDNS 更新失败: $RESPONSE"
    exit 1
fi

# 检查DNS解析
echo "验证DNS解析..."
RESOLVED_IP=$(nslookup $DOMAIN.duckdns.org | grep -A1 "非权威应答:" | grep "Address:" | tail -1 | awk '{print $2}')
if [ -n "$RESOLVED_IP" ]; then
    echo "✅ DNS解析成功: $DOMAIN.duckdns.org -> $RESOLVED_IP"
else
    echo "⚠️  DNS解析可能需要几分钟生效"
fi

# 创建自动更新的cron任务
CRON_JOB="*/5 * * * * /usr/bin/curl -s \"https://www.duckdns.org/update?domains=$DOMAIN&token=$TOKEN&ip=\" >/dev/null 2>&1"

# 检查是否已经存在这个cron任务
if ! crontab -l 2>/dev/null | grep -q "elontalk.duckdns.org"; then
    # 添加到crontab
    (crontab -l 2>/dev/null; echo "# ELonTalk DuckDNS auto-update"; echo "$CRON_JOB") | crontab -
    echo "✅ 已设置自动更新任务 (每5分钟)"
else
    echo "ℹ️  自动更新任务已存在"
fi

echo ""
echo "🎉 ELonTalk DuckDNS 设置完成!"
echo "域名: https://elontalk.duckdns.org"
echo "下一步: 申请SSL证书"