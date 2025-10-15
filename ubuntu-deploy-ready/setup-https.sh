#!/bin/bash

# ELonTalk 客服系统 - HTTPS/SSL 证书配置脚本
# 支持: Let's Encrypt 自动证书 + 自签名证书备用方案
# 域名: elontalk.duckdns.org

set -e

echo "🔒 HTTPS/SSL 证书配置"
echo "===================="

# 检查权限
if [[ $EUID -ne 0 ]]; then
   echo "❌ 错误: 请以root用户运行此脚本"
   exit 1
fi

# 设置变量
DOMAIN="elontalk.duckdns.org"
EMAIL="siwmm@163.com"
CERT_DIR="/root/ubuntu-deploy-ready/certs"
DEPLOY_DIR="/root/ubuntu-deploy-ready"

# 创建证书目录
mkdir -p "$CERT_DIR"
cd "$DEPLOY_DIR"

echo "🌐 域名: $DOMAIN"
echo "📧 邮箱: $EMAIL"
echo "📂 证书目录: $CERT_DIR"
echo ""

# 选择证书类型
echo "选择证书配置方式:"
echo "1) Let's Encrypt 自动证书 (推荐，免费，90天自动续期)"
echo "2) 自签名证书 (仅用于测试，浏览器会显示不安全)"
echo "3) 使用现有证书 (跳过生成)"
echo ""
read -p "请选择 [1-3]: " cert_choice

case $cert_choice in
    1)
        echo ""
        echo "🔄 安装 Certbot (Let's Encrypt 客户端)..."
        apt update
        apt install -y snapd
        snap install core; snap refresh core
        snap install --classic certbot
        ln -sf /snap/bin/certbot /usr/bin/certbot

        echo ""
        echo "📋 重要提醒:"
        echo "1. 确保域名 $DOMAIN 已正确解析到此服务器"
        echo "2. 确保防火墙已开放 80 和 443 端口"
        echo "3. 停止当前服务以释放端口"
        echo ""
        
        # 停止服务释放端口
        systemctl stop customer-service 2>/dev/null || true
        
        # 检查端口
        if netstat -tlnp | grep -q ":80 "; then
            echo "⚠️  端口 80 被占用，尝试释放..."
            pkill -f ":80" || true
            sleep 2
        fi
        
        # 申请证书
        echo "🔐 申请 Let's Encrypt 证书..."
        certbot certonly --standalone \
            --email "$EMAIL" \
            --agree-tos \
            --no-eff-email \
            --domains "$DOMAIN"
        
        # 复制证书到项目目录
        echo "📋 复制证书到项目目录..."
        cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/server.crt"
        cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERT_DIR/server.key"
        
        # 设置权限
        chown root:root "$CERT_DIR"/*
        chmod 644 "$CERT_DIR/server.crt"
        chmod 600 "$CERT_DIR/server.key"
        
        echo "✅ Let's Encrypt 证书配置完成"
        echo ""
        echo "📝 证书续期:"
        echo "Let's Encrypt 证书每90天过期，可设置自动续期:"
        echo "echo '0 12 * * * /usr/bin/certbot renew --quiet' | crontab -"
        ;;
        
    2)
        echo ""
        echo "🔐 生成自签名证书..."
        
        # 生成私钥
        openssl genrsa -out "$CERT_DIR/server.key" 2048
        
        # 生成证书
        openssl req -new -x509 -key "$CERT_DIR/server.key" \
            -out "$CERT_DIR/server.crt" -days 365 \
            -subj "/C=CN/ST=Shanghai/L=Shanghai/O=ELonTalk/OU=IT Department/CN=$DOMAIN"
        
        # 设置权限
        chmod 644 "$CERT_DIR/server.crt"
        chmod 600 "$CERT_DIR/server.key"
        
        echo "✅ 自签名证书生成完成"
        echo ""
        echo "⚠️  重要提醒:"
        echo "自签名证书会在浏览器中显示不安全警告"
        echo "生产环境建议使用 Let's Encrypt 证书"
        ;;
        
    3)
        echo ""
        echo "📋 使用现有证书..."
        if [[ -f "$CERT_DIR/server.crt" && -f "$CERT_DIR/server.key" ]]; then
            echo "✅ 发现现有证书文件"
        else
            echo "❌ 错误: 未找到证书文件"
            echo "请确保以下文件存在:"
            echo "  $CERT_DIR/server.crt"
            echo "  $CERT_DIR/server.key"
            exit 1
        fi
        ;;
        
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

# 验证证书
echo ""
echo "🔍 验证证书..."
if openssl x509 -in "$CERT_DIR/server.crt" -text -noout > /dev/null 2>&1; then
    echo "✅ 证书文件有效"
    
    # 显示证书信息
    echo ""
    echo "📋 证书信息:"
    openssl x509 -in "$CERT_DIR/server.crt" -noout \
        -subject -issuer -dates
else
    echo "❌ 证书文件无效"
    exit 1
fi

# 测试私钥
if openssl rsa -in "$CERT_DIR/server.key" -check -noout > /dev/null 2>&1; then
    echo "✅ 私钥文件有效"
else
    echo "❌ 私钥文件无效"
    exit 1
fi

# 配置防火墙
echo ""
echo "🔥 配置防火墙 HTTPS 端口..."
ufw allow 443/tcp
ufw allow 8443/tcp
ufw reload

echo ""
echo "🎉 HTTPS 配置完成！"
echo "================="
echo ""
echo "📂 证书位置:"
echo "  证书文件: $CERT_DIR/server.crt"
echo "  私钥文件: $CERT_DIR/server.key"
echo ""
echo "🔧 下一步:"
echo "1. 启动服务: systemctl start customer-service"
echo "2. 检查状态: systemctl status customer-service"
echo "3. 测试访问: curl -k https://$DOMAIN:8443"
echo ""
echo "🌐 访问地址:"
echo "  https://$DOMAIN:8443"
echo "  https://43.139.82.12:8443"