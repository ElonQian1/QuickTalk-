#!/bin/bash
# 生产环境SSL证书配置脚本
# 支持 Let's Encrypt 自动申请和手动证书部署

set -e

echo "🔐 生产环境SSL证书配置助手"
echo "=================================="

# 配置变量
DOMAIN=""
EMAIL=""
CERT_METHOD=""
APP_DIR="/opt/customer-service"
CERT_DIR="/etc/ssl/customer-service"

# 函数：显示帮助
show_help() {
    echo "使用方法:"
    echo "  $0 letsencrypt <domain> <email>     # 使用Let's Encrypt申请免费证书"
    echo "  $0 manual <domain>                  # 手动配置现有证书"
    echo "  $0 check <domain>                   # 检查证书状态"
    echo ""
    echo "示例:"
    echo "  $0 letsencrypt example.com admin@example.com"
    echo "  $0 manual example.com"
    echo "  $0 check example.com"
}

# 函数：Let's Encrypt证书申请
setup_letsencrypt() {
    local domain=$1
    local email=$2
    
    echo "🚀 为域名 $domain 申请Let's Encrypt证书..."
    
    # 检查certbot是否安装
    if ! command -v certbot &> /dev/null; then
        echo "📦 安装Certbot..."
        sudo apt update
        sudo apt install -y certbot
    fi
    
    # 申请证书 (standalone模式)
    echo "📋 申请SSL证书..."
    sudo certbot certonly --standalone \
        --email $email \
        --agree-tos \
        --no-eff-email \
        -d $domain
    
    # 创建应用证书目录
    sudo mkdir -p $CERT_DIR
    
    # 复制证书到应用目录 (便于应用访问)
    sudo cp /etc/letsencrypt/live/$domain/fullchain.pem $CERT_DIR/server.crt
    sudo cp /etc/letsencrypt/live/$domain/privkey.pem $CERT_DIR/server.key
    
    # 设置权限
    sudo chown -R $(whoami):$(whoami) $CERT_DIR
    sudo chmod 600 $CERT_DIR/server.key
    sudo chmod 644 $CERT_DIR/server.crt
    
    # 生成.env配置
    generate_env_config $domain
    
    # 设置自动续期
    setup_auto_renewal $domain
    
    echo "✅ Let's Encrypt证书配置完成!"
}

# 函数：手动证书配置
setup_manual() {
    local domain=$1
    
    echo "📁 手动配置证书 for $domain..."
    
    # 创建证书目录
    sudo mkdir -p $CERT_DIR
    
    echo "📋 请将你的证书文件放置在以下位置:"
    echo "  证书文件: $CERT_DIR/server.crt"
    echo "  私钥文件: $CERT_DIR/server.key"
    echo ""
    echo "💡 如果你有.pem格式证书:"
    echo "  cp your-cert.pem $CERT_DIR/server.crt"
    echo "  cp your-key.pem $CERT_DIR/server.key"
    echo ""
    
    read -p "证书文件已放置完成? (y/N): " confirm
    if [[ $confirm == [yY] ]]; then
        # 验证证书文件
        if [[ -f "$CERT_DIR/server.crt" ]] && [[ -f "$CERT_DIR/server.key" ]]; then
            # 设置权限
            sudo chown -R $(whoami):$(whoami) $CERT_DIR
            sudo chmod 600 $CERT_DIR/server.key
            sudo chmod 644 $CERT_DIR/server.crt
            
            # 生成配置
            generate_env_config $domain
            
            echo "✅ 手动证书配置完成!"
        else
            echo "❌ 证书文件不存在，请检查路径"
            exit 1
        fi
    else
        echo "⏸️  配置已取消"
        exit 1
    fi
}

# 函数：生成.env配置
generate_env_config() {
    local domain=$1
    
    cat > .env.production << EOF
# 生产环境配置 - 自动生成
# 生成时间: $(date)

# 基础配置
DATABASE_URL=sqlite:customer_service.db
JWT_SECRET=CHANGE-THIS-TO-A-SECURE-RANDOM-STRING-IN-PRODUCTION
SERVER_HOST=0.0.0.0
SERVER_PORT=80

# HTTPS配置
TLS_ENABLED=true
TLS_CERT_PATH=$CERT_DIR/server.crt
TLS_KEY_PATH=$CERT_DIR/server.key
TLS_PORT=443
TLS_DOMAIN=$domain
TLS_REDIRECT_HTTP=true
TLS_AUTO_GENERATE=false

# 日志配置
RUST_LOG=info
RUST_BACKTRACE=1
EOF

    echo "📝 生产环境配置已生成: .env.production"
    echo "💡 使用方式: cp .env.production .env"
}

# 函数：设置自动续期
setup_auto_renewal() {
    local domain=$1
    
    echo "🔄 设置Let's Encrypt自动续期..."
    
    # 创建续期脚本
    cat > /tmp/cert-renewal.sh << EOF
#!/bin/bash
# Let's Encrypt证书自动续期脚本

# 续期证书
certbot renew --quiet

# 复制新证书到应用目录
if [[ -f "/etc/letsencrypt/live/$domain/fullchain.pem" ]]; then
    cp /etc/letsencrypt/live/$domain/fullchain.pem $CERT_DIR/server.crt
    cp /etc/letsencrypt/live/$domain/privkey.pem $CERT_DIR/server.key
    
    # 重启应用 (如果使用systemd)
    # systemctl restart customer-service
    
    echo "证书已更新: \$(date)" >> /var/log/cert-renewal.log
fi
EOF

    sudo mv /tmp/cert-renewal.sh /usr/local/bin/cert-renewal.sh
    sudo chmod +x /usr/local/bin/cert-renewal.sh
    
    # 添加到crontab
    (crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/cert-renewal.sh") | crontab -
    
    echo "✅ 自动续期已配置 (每天凌晨3点检查)"
}

# 函数：检查证书状态
check_certificate() {
    local domain=$1
    
    echo "🔍 检查域名 $domain 的证书状态..."
    
    # 检查Let's Encrypt证书
    if [[ -f "/etc/letsencrypt/live/$domain/fullchain.pem" ]]; then
        echo "📋 Let's Encrypt证书信息:"
        sudo certbot certificates -d $domain
        
        echo ""
        echo "📅 证书到期时间:"
        openssl x509 -in /etc/letsencrypt/live/$domain/fullchain.pem -noout -dates
    fi
    
    # 检查应用证书
    if [[ -f "$CERT_DIR/server.crt" ]]; then
        echo ""
        echo "📋 应用证书信息:"
        openssl x509 -in $CERT_DIR/server.crt -noout -text | grep -A 2 "Validity"
    fi
    
    # 在线验证
    echo ""
    echo "🌐 在线证书验证:"
    echo "访问 https://www.ssllabs.com/ssltest/analyze.html?d=$domain"
}

# 主程序
main() {
    case "$1" in
        "letsencrypt")
            if [[ -z "$2" ]] || [[ -z "$3" ]]; then
                echo "❌ 缺少参数"
                show_help
                exit 1
            fi
            setup_letsencrypt "$2" "$3"
            ;;
        "manual")
            if [[ -z "$2" ]]; then
                echo "❌ 缺少域名参数"
                show_help
                exit 1
            fi
            setup_manual "$2"
            ;;
        "check")
            if [[ -z "$2" ]]; then
                echo "❌ 缺少域名参数"
                show_help
                exit 1
            fi
            check_certificate "$2"
            ;;
        *)
            show_help
            ;;
    esac
}

# 检查是否为root权限
if [[ $EUID -ne 0 ]] && [[ "$1" == "letsencrypt" ]]; then
    echo "⚠️  Let's Encrypt模式需要sudo权限"
    echo "💡 请使用: sudo $0 $@"
    exit 1
fi

main "$@"