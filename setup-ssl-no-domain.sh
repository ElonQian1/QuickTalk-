#!/bin/bash
# 无域名服务器 - 自签名证书生成脚本

set -e

echo "🔐 无域名服务器HTTPS配置助手"
echo "=================================="

# 配置变量
SERVER_IP=${1:-"获取中..."}
CERT_DIR="/etc/ssl/customer-service"
DAYS=3650  # 10年有效期

# 自动获取服务器公网IP
get_server_ip() {
    # 尝试多种方式获取IP
    SERVER_IP=$(curl -s ipinfo.io/ip 2>/dev/null || curl -s ifconfig.me 2>/dev/null || curl -s ipecho.net/plain 2>/dev/null || echo "无法获取")
    echo "🌐 检测到服务器IP: $SERVER_IP"
}

# 生成自签名证书 (支持IP访问)
generate_self_signed_cert() {
    local server_ip=$1
    
    echo "📋 生成自签名SSL证书 (支持IP访问)..."
    
    # 创建证书目录
    sudo mkdir -p $CERT_DIR
    
    # 生成私钥
    echo "🔑 生成私钥..."
    sudo openssl genrsa -out $CERT_DIR/server.key 4096
    
    # 创建证书配置文件 (支持IP SAN)
    cat > /tmp/cert.conf << EOF
[req]
default_bits = 4096
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=CN
ST=State
L=City
O=Organization
OU=Department
CN=$server_ip

[v3_req]
basicConstraints = CA:FALSE
keyUsage = keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
IP.1 = $server_ip
IP.2 = 127.0.0.1
DNS.1 = localhost
EOF

    # 生成证书
    echo "📜 生成证书 (有效期${DAYS}天)..."
    sudo openssl req -new -x509 -key $CERT_DIR/server.key \
        -out $CERT_DIR/server.crt \
        -days $DAYS \
        -config /tmp/cert.conf \
        -extensions v3_req
    
    # 清理临时文件
    rm /tmp/cert.conf
    
    # 设置权限
    sudo chmod 600 $CERT_DIR/server.key
    sudo chmod 644 $CERT_DIR/server.crt
    sudo chown -R $(whoami):$(whoami) $CERT_DIR
    
    echo "✅ 自签名证书生成完成!"
    echo "📁 证书位置:"
    echo "   证书: $CERT_DIR/server.crt"
    echo "   私钥: $CERT_DIR/server.key"
}

# 生成.env配置
generate_env_config() {
    local server_ip=$1
    
    cat > .env.production << EOF
# 无域名服务器生产配置
# 生成时间: $(date)
# 服务器IP: $server_ip

# 基础配置
DATABASE_URL=sqlite:customer_service.db
JWT_SECRET=CHANGE-THIS-TO-A-SECURE-RANDOM-STRING-IN-PRODUCTION
SERVER_HOST=0.0.0.0
SERVER_PORT=80

# HTTPS配置 (自签名证书)
TLS_ENABLED=true
TLS_CERT_PATH=$CERT_DIR/server.crt
TLS_KEY_PATH=$CERT_DIR/server.key
TLS_PORT=443
TLS_DOMAIN=$server_ip
TLS_REDIRECT_HTTP=true
TLS_AUTO_GENERATE=false

# 日志配置
RUST_LOG=info
RUST_BACKTRACE=1
EOF

    echo "📝 配置文件已生成: .env.production"
}

# 显示使用说明
show_usage_instructions() {
    local server_ip=$1
    
    echo ""
    echo "🚀 部署说明:"
    echo "=================================="
    echo "1. 复制配置文件:"
    echo "   cp .env.production .env"
    echo ""
    echo "2. 启动应用:"
    echo "   sudo ./customer-service-backend"
    echo ""
    echo "3. 访问地址:"
    echo "   https://$server_ip"
    echo "   (浏览器会显示安全警告，点击'高级'→'继续访问')"
    echo ""
    echo "⚠️  客户端配置:"
    echo "   - 浏览器: 手动信任证书"
    echo "   - 移动端: 下载并安装证书"
    echo "   - API调用: 跳过SSL验证或导入证书"
    echo ""
    echo "🔧 证书信任方法:"
    echo "   Chrome: 访问 chrome://settings/certificates"
    echo "   Firefox: 访问 about:preferences#privacy"
    echo "   系统级: 将 server.crt 添加到系统证书存储"
}

# 生成证书下载脚本
generate_cert_download() {
    local server_ip=$1
    
    cat > download-cert.sh << EOF
#!/bin/bash
# 客户端证书下载脚本

echo "📥 下载服务器证书..."
scp user@$server_ip:$CERT_DIR/server.crt ./server-$server_ip.crt

echo "📋 Windows客户端安装方法:"
echo "1. 双击 server-$server_ip.crt"
echo "2. 点击'安装证书'"
echo "3. 选择'本地计算机'"
echo "4. 选择'将所有的证书都放入下列存储' → '受信任的根证书颁发机构'"

echo "📋 Linux客户端安装方法:"
echo "sudo cp server-$server_ip.crt /usr/local/share/ca-certificates/"
echo "sudo update-ca-certificates"

echo "📋 macOS客户端安装方法:"
echo "双击证书文件，在钥匙串中设置为'始终信任'"
EOF

    chmod +x download-cert.sh
    echo "📥 证书下载脚本已生成: download-cert.sh"
}

# 主程序
main() {
    echo "🔍 获取服务器信息..."
    get_server_ip
    
    if [[ "$SERVER_IP" == "无法获取" ]]; then
        echo "⚠️  无法自动获取服务器IP"
        read -p "请手动输入服务器公网IP: " SERVER_IP
    fi
    
    echo ""
    echo "🎯 将为IP地址 $SERVER_IP 生成自签名证书"
    read -p "继续? (y/N): " confirm
    
    if [[ $confirm == [yY] ]]; then
        generate_self_signed_cert $SERVER_IP
        generate_env_config $SERVER_IP
        generate_cert_download $SERVER_IP
        show_usage_instructions $SERVER_IP
    else
        echo "⏸️  操作已取消"
        exit 1
    fi
}

main "$@"