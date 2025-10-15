#!/bin/bash

# HTTPS自动配置脚本
# 用于自动检测和配置SSL证书

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  ELonTalk HTTPS 自动配置工具        ${NC}"
echo -e "${BLUE}======================================${NC}"

# 检查证书文件
check_certificates() {
    echo -e "\n${BLUE}1. 检查SSL证书...${NC}"
    
    if [ -f "certs/server.crt" ] && [ -f "certs/server.key" ]; then
        echo -e "  ✅ 证书文件存在"
        
        # 检查证书有效性
        if openssl x509 -in certs/server.crt -noout -checkend 86400 >/dev/null 2>&1; then
            echo -e "  ✅ 证书有效期 > 24小时"
            
            # 显示证书信息
            subject=$(openssl x509 -in certs/server.crt -noout -subject | sed 's/subject=//')
            expiry=$(openssl x509 -in certs/server.crt -noout -enddate | sed 's/notAfter=//')
            echo -e "  📋 证书主题: ${subject}"
            echo -e "  📅 过期时间: ${expiry}"
            
            return 0
        else
            echo -e "  ⚠️  证书即将过期或已过期"
            return 1
        fi
    else
        echo -e "  ❌ 证书文件缺失"
        return 1
    fi
}

# 配置Let's Encrypt证书
setup_letsencrypt() {
    echo -e "\n${BLUE}2. 配置Let's Encrypt证书...${NC}"
    
    # 检查certbot是否安装
    if ! command -v certbot &> /dev/null; then
        echo -e "  📦 安装Certbot..."
        apt update
        apt install -y certbot
    fi
    
    # 停止现有服务
    echo -e "  🛑 停止现有服务..."
    systemctl stop customer-service 2>/dev/null || true
    
    # 获取证书
    echo -e "  🔒 获取SSL证书..."
    if certbot certonly --standalone -d elontalk.duckdns.org --non-interactive --agree-tos --email siwmm@163.com; then
        echo -e "  ✅ 证书获取成功"
        
        # 备份现有证书
        if [ -f "certs/server.crt" ]; then
            cp certs/server.crt certs/server.crt.backup.$(date +%Y%m%d_%H%M%S)
        fi
        if [ -f "certs/server.key" ]; then
            cp certs/server.key certs/server.key.backup.$(date +%Y%m%d_%H%M%S)
        fi
        
        # 复制新证书
        cp /etc/letsencrypt/live/elontalk.duckdns.org/fullchain.pem certs/server.crt
        cp /etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem certs/server.key
        
        # 设置权限
        chown root:root certs/server.crt certs/server.key
        chmod 644 certs/server.crt
        chmod 600 certs/server.key
        
        echo -e "  ✅ 证书配置完成"
        return 0
    else
        echo -e "  ❌ 证书获取失败"
        return 1
    fi
}

# 生成自签名证书
generate_self_signed() {
    echo -e "\n${BLUE}3. 生成自签名证书...${NC}"
    echo -e "  ⚠️  ${YELLOW}警告: 自签名证书会在浏览器中显示安全警告${NC}"
    
    # 备份现有证书
    if [ -f "certs/server.crt" ]; then
        cp certs/server.crt certs/server.crt.backup.$(date +%Y%m%d_%H%M%S)
    fi
    if [ -f "certs/server.key" ]; then
        cp certs/server.key certs/server.key.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    # 生成自签名证书
    openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt \
        -days 365 -nodes \
        -subj "/C=CN/ST=Beijing/L=Beijing/O=ELonTalk/CN=elontalk.duckdns.org"
    
    # 设置权限
    chmod 644 certs/server.crt
    chmod 600 certs/server.key
    
    echo -e "  ✅ 自签名证书生成完成"
}

# 配置HTTPS环境
configure_https_env() {
    echo -e "\n${BLUE}4. 配置HTTPS环境...${NC}"
    
    # 使用HTTPS配置
    if [ -f ".env.https" ]; then
        cp .env.https .env
        echo -e "  ✅ 已切换到HTTPS配置"
    else
        echo -e "  ⚠️  .env.https文件不存在，使用默认配置"
    fi
}

# 设置自动续期
setup_auto_renewal() {
    echo -e "\n${BLUE}5. 设置自动续期...${NC}"
    
    # 创建续期脚本
    cat > /usr/local/bin/renew-elontalk-cert.sh << 'EOF'
#!/bin/bash
certbot renew --quiet
if [ $? -eq 0 ]; then
    cd /root/ubuntu-deploy-ready
    cp /etc/letsencrypt/live/elontalk.duckdns.org/fullchain.pem certs/server.crt
    cp /etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem certs/server.key
    chown root:root certs/server.crt certs/server.key
    chmod 644 certs/server.crt
    chmod 600 certs/server.key
    systemctl restart customer-service
fi
EOF
    
    chmod +x /usr/local/bin/renew-elontalk-cert.sh
    
    # 添加cron任务
    (crontab -l 2>/dev/null; echo "0 2 1 * * /usr/local/bin/renew-elontalk-cert.sh") | crontab -
    
    echo -e "  ✅ 自动续期已配置"
}

# 主流程
main() {
    echo -e "\n${YELLOW}请选择SSL证书配置方式:${NC}"
    echo -e "1. 检查现有证书"
    echo -e "2. 配置Let's Encrypt证书 (推荐)"
    echo -e "3. 生成自签名证书 (仅测试)"
    echo -e "4. 跳过证书配置"
    
    read -p "请输入选择 (1-4): " choice
    
    case $choice in
        1)
            if check_certificates; then
                echo -e "\n${GREEN}✅ 证书检查通过，可以启动HTTPS服务${NC}"
                configure_https_env
            else
                echo -e "\n${RED}❌ 证书检查失败，请选择其他选项${NC}"
                exit 1
            fi
            ;;
        2)
            if setup_letsencrypt; then
                configure_https_env
                setup_auto_renewal
                echo -e "\n${GREEN}✅ Let's Encrypt证书配置完成${NC}"
            else
                echo -e "\n${RED}❌ Let's Encrypt配置失败${NC}"
                exit 1
            fi
            ;;
        3)
            generate_self_signed
            configure_https_env
            echo -e "\n${GREEN}✅ 自签名证书配置完成${NC}"
            echo -e "${YELLOW}⚠️  请注意：浏览器会显示安全警告${NC}"
            ;;
        4)
            echo -e "\n${YELLOW}跳过证书配置，使用HTTP模式${NC}"
            if [ -f ".env.http" ]; then
                cp .env.http .env
                echo -e "  ✅ 已切换到HTTP配置"
            fi
            ;;
        *)
            echo -e "\n${RED}❌ 无效选择${NC}"
            exit 1
            ;;
    esac
    
    # 防火墙配置
    echo -e "\n${BLUE}6. 配置防火墙...${NC}"
    ufw allow 8080/tcp
    ufw allow 8443/tcp
    ufw --force enable
    echo -e "  ✅ 防火墙配置完成"
    
    echo -e "\n${GREEN}🎉 HTTPS配置完成！${NC}"
    echo -e "\n${BLUE}访问地址:${NC}"
    echo -e "  • HTTPS: https://43.139.82.12:8443"
    echo -e "  • HTTP:  http://43.139.82.12:8080"
    echo -e "  • 域名:  https://elontalk.duckdns.org:8443"
    
    echo -e "\n${BLUE}下一步:${NC}"
    echo -e "  运行: ./start.sh"
}

# 执行主流程
main