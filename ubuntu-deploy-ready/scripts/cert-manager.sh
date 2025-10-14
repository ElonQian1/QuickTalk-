#!/bin/bash
# SSL证书管理脚本 - 支持Let's Encrypt + DuckDNS
# 版本: 2.0

set -e

# 配置
DOMAIN="elontalk.duckdns.org"
DUCKDNS_TOKEN="400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca"
EMAIL="siwmm@163.com"
CERT_DIR="/root/ubuntu-deploy-ready/certs"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[证书]${NC} $1"; }
print_success() { echo -e "${GREEN}[成功]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[警告]${NC} $1"; }
print_error() { echo -e "${RED}[错误]${NC} $1"; }

# 创建证书目录
mkdir -p "$CERT_DIR"

case "${1:-auto}" in
    "auto")
        print_info "自动证书管理模式"
        
        # 更新DuckDNS
        print_info "更新DuckDNS解析..."
        response=$(curl -s "https://www.duckdns.org/update?domains=elontalk&token=${DUCKDNS_TOKEN}")
        if [ "$response" = "OK" ]; then
            print_success "DuckDNS更新成功"
            sleep 30  # 等待DNS传播
        else
            print_warning "DuckDNS更新失败: $response"
        fi
        
        # 安装certbot
        if ! command -v certbot >/dev/null 2>&1; then
            print_info "安装Certbot..."
            apt update && apt install -y certbot
        fi
        
        # 停止占用端口80的服务
        systemctl stop nginx 2>/dev/null || true
        systemctl stop apache2 2>/dev/null || true
        pkill -f customer-service-backend || true
        
        # 申请证书
        print_info "申请Let's Encrypt证书..."
        if certbot certonly --standalone --non-interactive --agree-tos \
           --email "$EMAIL" --domains "$DOMAIN" >/dev/null 2>&1; then
            
            # 复制证书
            cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${CERT_DIR}/server.crt"
            cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "${CERT_DIR}/server.key"
            chmod 644 "${CERT_DIR}/server.crt"
            chmod 600 "${CERT_DIR}/server.key"
            
            print_success "Let's Encrypt证书申请成功"
        else
            print_warning "Let's Encrypt申请失败，生成自签名证书"
            
            openssl req -x509 -newkey rsa:4096 \
                -keyout "${CERT_DIR}/server.key" \
                -out "${CERT_DIR}/server.crt" \
                -days 365 -nodes \
                -subj "/C=CN/ST=Beijing/L=Beijing/O=ELonTalk/CN=${DOMAIN}" \
                >/dev/null 2>&1
            
            chmod 644 "${CERT_DIR}/server.crt"
            chmod 600 "${CERT_DIR}/server.key"
            
            print_success "自签名证书生成完成"
        fi
        ;;
        
    "letsencrypt")
        print_info "Let's Encrypt模式"
        # ... (Let's Encrypt 逻辑)
        ;;
        
    "selfsigned")
        print_info "自签名证书模式"
        
        openssl req -x509 -newkey rsa:4096 \
            -keyout "${CERT_DIR}/server.key" \
            -out "${CERT_DIR}/server.crt" \
            -days 365 -nodes \
            -subj "/C=CN/ST=Beijing/L=Beijing/O=ELonTalk/CN=${DOMAIN}" \
            >/dev/null 2>&1
        
        chmod 644 "${CERT_DIR}/server.crt"
        chmod 600 "${CERT_DIR}/server.key"
        
        print_success "自签名证书生成完成"
        ;;
        
    "renew")
        print_info "续期证书..."
        if certbot renew --quiet; then
            # 复制新证书
            cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${CERT_DIR}/server.crt"
            cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "${CERT_DIR}/server.key"
            print_success "证书续期成功"
        else
            print_error "证书续期失败"
        fi
        ;;
        
    "check")
        print_info "检查证书状态..."
        if [ -f "${CERT_DIR}/server.crt" ]; then
            expiry=$(openssl x509 -in "${CERT_DIR}/server.crt" -noout -enddate | cut -d= -f2)
            print_success "证书有效期至: $expiry"
        else
            print_error "证书文件不存在"
        fi
        ;;
        
    *)
        echo "SSL证书管理工具"
        echo "用法: $0 [auto|letsencrypt|selfsigned|renew|check]"
        echo ""
        echo "  auto        - 自动模式(默认)"
        echo "  letsencrypt - 仅Let's Encrypt"
        echo "  selfsigned  - 仅自签名证书"
        echo "  renew       - 续期证书"
        echo "  check       - 检查证书"
        ;;
esac