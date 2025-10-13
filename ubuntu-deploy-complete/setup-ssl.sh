#!/bin/bash

# ==============================================
# ELonTalk Let's Encrypt SSL配置助手 v2.0
# ==============================================

echo "🌟 ELonTalk Let's Encrypt SSL配置助手"
echo "=============================================="
echo "⏰ 配置时间: $(date '+%Y-%m-%d %H:%M:%S')"

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 此脚本需要root权限运行"
    echo "💡 请使用: sudo ./setup-ssl.sh"
    exit 1
fi

# 检查系统
if ! command -v apt-get &> /dev/null && ! command -v yum &> /dev/null; then
    echo "❌ 此脚本仅支持Ubuntu/Debian和CentOS/RHEL系统"
    exit 1
fi

echo ""
echo "📝 请输入域名信息:"
read -p "主域名 (如: yourdomain.com): " main_domain
if [ -z "$main_domain" ]; then
    echo "❌ 域名不能为空"
    exit 1
fi

read -p "子域名 (如: chat.yourdomain.com, 可选): " sub_domain
read -p "邮箱地址: " email
if [ -z "$email" ]; then
    echo "❌ 邮箱不能为空"  
    exit 1
fi

# 验证邮箱格式
if ! echo "$email" | grep -qE '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'; then
    echo "❌ 邮箱格式不正确"
    exit 1
fi

echo ""
echo "🔍 系统环境检查..."

# 检查域名解析
echo "📡 检查域名解析..."
server_ip=$(curl -s --max-time 10 ifconfig.me 2>/dev/null)
if [ -z "$server_ip" ]; then
    echo "⚠️  无法获取服务器公网IP，将跳过DNS检查"
else
    echo "   服务器IP: $server_ip"
    
    domain_ip=$(dig +short "$main_domain" 2>/dev/null | tail -n1)
    if [ -z "$domain_ip" ]; then
        echo "⚠️  无法解析域名 $main_domain"
    elif [ "$server_ip" != "$domain_ip" ]; then
        echo "⚠️  警告: 域名 $main_domain 未解析到当前服务器"
        echo "   域名解析IP: $domain_ip"
        echo "   当前服务器IP: $server_ip"
        echo ""
        read -p "继续操作可能导致证书申请失败，是否继续? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ 取消操作"
            echo "💡 请确保域名正确解析到服务器后重试"
            exit 0
        fi
    else
        echo "✅ 域名解析正确"
    fi
fi

# 检查端口80是否可用
echo "🔌 检查端口80..."
if command -v netstat >/dev/null 2>&1; then
    port80_check=$(netstat -ln 2>/dev/null | grep ":80 ")
elif command -v ss >/dev/null 2>&1; then
    port80_check=$(ss -ln 2>/dev/null | grep ":80 ")
else
    port80_check=""
fi

if [ -n "$port80_check" ]; then
    echo "⚠️  端口80被占用:"
    echo "$port80_check"
    echo ""
    read -p "需要临时停止占用端口80的服务，是否继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 取消操作"
        exit 0
    fi
else
    echo "✅ 端口80可用"
fi

# 安装 certbot
echo ""
echo "📦 安装 Certbot..."

if command -v apt-get >/dev/null 2>&1; then
    # Ubuntu/Debian
    echo "🐧 检测到 Ubuntu/Debian 系统"
    apt-get update
    apt-get install -y certbot
elif command -v yum >/dev/null 2>&1; then
    # CentOS/RHEL
    echo "🎩 检测到 CentOS/RHEL 系统"
    
    # 检查是否为CentOS 8+ 或 RHEL 8+
    if command -v dnf >/dev/null 2>&1; then
        dnf install -y epel-release
        dnf install -y certbot
    else
        yum install -y epel-release
        yum install -y certbot
    fi
else
    echo "❌ 不支持的系统"
    exit 1
fi

# 验证certbot安装
if ! command -v certbot >/dev/null 2>&1; then
    echo "❌ Certbot 安装失败"
    exit 1
fi

certbot_version=$(certbot --version 2>&1 | head -n1)
echo "✅ Certbot 安装成功: $certbot_version"

# 获取部署目录
deploy_path="$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")/$(basename "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"
echo "📁 部署目录: $deploy_path"

# 临时停止服务
echo ""
echo "⏹️  临时停止服务..."

# 停止ELonTalk服务
pkill -f customer-service-backend 2>/dev/null || true
systemctl stop customer-service 2>/dev/null || true

# 停止可能占用80端口的服务
services_to_stop=("nginx" "apache2" "httpd" "lighttpd")
stopped_services=()

for service in "${services_to_stop[@]}"; do
    if systemctl is-active --quiet "$service" 2>/dev/null; then
        echo "⏸️  停止 $service..."
        systemctl stop "$service"
        stopped_services+=("$service")
    fi
done

sleep 3

# 再次检查端口80
if command -v netstat >/dev/null 2>&1; then
    port80_still_used=$(netstat -ln 2>/dev/null | grep ":80 ")
elif command -v ss >/dev/null 2>&1; then
    port80_still_used=$(ss -ln 2>/dev/null | grep ":80 ")
fi

if [ -n "$port80_still_used" ]; then
    echo "⚠️  端口80仍被占用，尝试强制释放..."
    # 找到占用进程并停止
    pid=$(lsof -ti:80 2>/dev/null | head -n1)
    if [ -n "$pid" ]; then
        kill -TERM "$pid" 2>/dev/null || true
        sleep 2
        kill -KILL "$pid" 2>/dev/null || true
    fi
fi

# 构建域名参数
domain_params="-d $main_domain"
if [ -n "$sub_domain" ]; then
    domain_params="$domain_params -d $sub_domain"
fi

echo ""
echo "🔐 申请 Let's Encrypt 证书..."
echo "   域名: $main_domain"
[ -n "$sub_domain" ] && echo "   子域名: $sub_domain"
echo "   邮箱: $email"

# 申请证书
certbot certonly \
    --standalone \
    --email "$email" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    $domain_params

cert_result=$?

# 恢复服务
echo ""
echo "🔄 恢复服务..."
for service in "${stopped_services[@]}"; do
    echo "▶️  启动 $service..."
    systemctl start "$service" || echo "⚠️  $service 启动失败"
done

if [ $cert_result -eq 0 ]; then
    echo ""
    echo "🎉 证书申请成功！"
    
    # 复制证书到项目目录
    cert_path="/etc/letsencrypt/live/$main_domain"
    
    echo "📋 复制证书文件..."
    
    # 确保目标目录存在
    mkdir -p "$deploy_path/certs"
    
    # 复制证书文件
    cp "$cert_path/fullchain.pem" "$deploy_path/certs/server.crt"
    cp "$cert_path/privkey.pem" "$deploy_path/certs/server.key"
    
    # 设置权限
    chown "$(logname):$(logname)" "$deploy_path/certs/server.crt" "$deploy_path/certs/server.key" 2>/dev/null || true
    chmod 644 "$deploy_path/certs/server.crt"
    chmod 600 "$deploy_path/certs/server.key"
    
    echo "✅ 证书文件复制完成"
    
    # 配置环境变量
    echo "⚙️  更新配置文件..."
    env_file="$deploy_path/.env"
    
    if [ -f "$env_file" ]; then
        # 更新现有配置
        sed -i "s/^TLS_DOMAIN=.*/TLS_DOMAIN=$main_domain/" "$env_file"
        if ! grep -q "TLS_DOMAIN" "$env_file"; then
            echo "TLS_DOMAIN=$main_domain" >> "$env_file"
        fi
        
        # 确保其他TLS配置存在
        grep -q "^TLS_CERT_PATH=" "$env_file" || echo "TLS_CERT_PATH=certs/server.crt" >> "$env_file"
        grep -q "^TLS_KEY_PATH=" "$env_file" || echo "TLS_KEY_PATH=certs/server.key" >> "$env_file"  
        grep -q "^TLS_PORT=" "$env_file" || echo "TLS_PORT=8443" >> "$env_file"
    else
        # 创建新配置
        cat > "$env_file" << EOF
# ELonTalk SSL Configuration
TLS_DOMAIN=$main_domain
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key
TLS_PORT=8443
TLS_MODE=auto

# Server Configuration  
SERVER_PORT=8080
DATABASE_URL=sqlite:customer_service.db
RUST_LOG=info
EOF
    fi
    
    echo "✅ 配置文件更新完成"
    
    # 创建自动续期脚本
    echo "🔄 设置自动续期..."
    
    renewal_script="$deploy_path/renew-cert.sh"
    cat > "$renewal_script" << EOF
#!/bin/bash

# ELonTalk Let's Encrypt 证书自动续期脚本
# 自动生成于: $(date '+%Y-%m-%d %H:%M:%S')

echo "🔄 检查 Let's Encrypt 证书续期... (\$(date))"

# 尝试续期所有证书
certbot renew --quiet --pre-hook "systemctl stop customer-service nginx apache2 httpd 2>/dev/null || true" --post-hook "systemctl start customer-service 2>/dev/null || true"

if [ \$? -eq 0 ]; then
    echo "✅ 证书续期检查完成"
    
    # 更新项目证书文件
    DOMAIN="$main_domain"
    DEPLOY_PATH="$deploy_path"
    
    if [ -n "\$DOMAIN" ] && [ -d "/etc/letsencrypt/live/\$DOMAIN" ]; then
        echo "📋 更新项目证书文件..."
        cp "/etc/letsencrypt/live/\$DOMAIN/fullchain.pem" "\$DEPLOY_PATH/certs/server.crt"
        cp "/etc/letsencrypt/live/\$DOMAIN/privkey.pem" "\$DEPLOY_PATH/certs/server.key"
        
        # 设置权限
        chmod 644 "\$DEPLOY_PATH/certs/server.crt"
        chmod 600 "\$DEPLOY_PATH/certs/server.key"
        
        echo "✅ 证书文件更新完成"
        
        # 重启服务以加载新证书
        echo "🔄 重启服务..."
        cd "\$DEPLOY_PATH"
        ./restart.sh > /dev/null 2>&1 || echo "⚠️  服务重启失败"
    fi
else
    echo "❌ 证书续期失败"
    exit 1
fi
EOF
    
    chmod +x "$renewal_script"
    echo "✅ 续期脚本创建完成: $renewal_script"
    
    # 添加到crontab (每月检查两次)
    cron_entry="0 2 1,15 * * $renewal_script >> $deploy_path/ssl-renew.log 2>&1"
    
    # 检查cron条目是否已存在
    if ! crontab -l 2>/dev/null | grep -q "$renewal_script"; then
        (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
        echo "✅ 自动续期任务已添加到crontab"
    else
        echo "ℹ️  自动续期任务已存在"
    fi
    
    # 显示证书信息
    echo ""
    echo "📋 证书信息:"
    openssl x509 -in "$deploy_path/certs/server.crt" -noout -dates 2>/dev/null | sed 's/not/   /'
    
    echo ""
    echo "🎉 Let's Encrypt SSL配置完成！"
    echo "=============================================="
    echo "📊 配置摘要:"
    echo "   主域名: $main_domain"
    [ -n "$sub_domain" ] && echo "   子域名: $sub_domain"
    echo "   邮箱: $email"
    echo "   证书路径: $deploy_path/certs/"
    echo "   配置文件: $env_file"
    echo "   续期脚本: $renewal_script"
    
    echo ""
    echo "🔄 自动续期:"
    echo "   Cron任务: 每月1日和15日检查"
    echo "   日志文件: $deploy_path/ssl-renew.log"
    echo "   手动续期: $renewal_script"
    
    echo ""
    echo "🚀 启动服务:"
    read -p "现在启动HTTPS服务? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo "🚀 启动HTTPS服务..."
        cd "$deploy_path"
        ./start.sh &
        
        sleep 5
        
        echo ""
        echo "🔗 访问地址:"
        echo "   HTTPS: https://$main_domain:8443"
        [ -n "$sub_domain" ] && echo "   子域名: https://$sub_domain:8443"
        echo "   HTTP (重定向): http://$main_domain:8080"
    fi
    
else
    echo ""
    echo "❌ 证书申请失败 (错误代码: $cert_result)"
    echo ""
    echo "💡 常见问题排查:"
    echo "   1. 检查域名是否正确解析到此服务器"
    echo "   2. 确认防火墙开放了80和443端口"
    echo "   3. 检查是否有其他服务占用80端口"
    echo "   4. 验证邮箱地址是否有效"
    echo ""
    echo "📋 查看详细错误:"
    echo "   sudo journalctl -u certbot --no-pager"
    echo "   sudo certbot certificates"
    
    exit 1
fi