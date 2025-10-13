#!/bin/bash

# ==============================================
# ELonTalk 自签名证书生成工具 v2.0
# ==============================================

echo "🔐 ELonTalk SSL证书生成工具"
echo "=============================================="
echo "⏰ 生成时间: $(date '+%Y-%m-%d %H:%M:%S')"

# 创建证书目录
mkdir -p certs
cd certs

# 检查是否已有证书
if [ -f "server.crt" ] && [ -f "server.key" ]; then
    echo ""
    echo "⚠️  检测到现有证书文件"
    
    # 显示现有证书信息
    if command -v openssl >/dev/null 2>&1; then
        echo "📋 现有证书信息:"
        cert_subject=$(openssl x509 -in server.crt -noout -subject 2>/dev/null | sed 's/subject=//' || echo "无法读取")
        cert_issuer=$(openssl x509 -in server.crt -noout -issuer 2>/dev/null | sed 's/issuer=//' || echo "无法读取") 
        cert_dates=$(openssl x509 -in server.crt -noout -dates 2>/dev/null || echo "无法读取")
        
        echo "   主体: $cert_subject"
        echo "   颁发者: $cert_issuer" 
        echo "   $cert_dates"
    fi
    
    echo ""
    read -p "是否覆盖现有证书? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 取消操作"
        exit 0
    fi
    echo "🗑️  备份现有证书..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    mv server.crt "server.crt.backup.$timestamp"
    mv server.key "server.key.backup.$timestamp"
    echo "✅ 备份完成"
fi

# 检查openssl是否可用
if ! command -v openssl >/dev/null 2>&1; then
    echo "❌ 错误: 未找到 openssl 命令"
    echo "💡 请安装 openssl:"
    echo "   Ubuntu/Debian: sudo apt-get install openssl"
    echo "   CentOS/RHEL: sudo yum install openssl"
    exit 1
fi

echo ""
echo "📝 请输入证书信息 (按Enter使用默认值):"

# 获取服务器IP
server_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "")

# 获取用户输入
read -p "域名 (默认: localhost): " domain
domain=${domain:-localhost}

read -p "国家代码 (默认: CN): " country
country=${country:-CN}

read -p "省份 (默认: Beijing): " state  
state=${state:-Beijing}

read -p "城市 (默认: Beijing): " city
city=${city:-Beijing}

read -p "组织名 (默认: ELonTalk): " organization
organization=${organization:-ELonTalk}

read -p "部门 (默认: IT Department): " unit
unit=${unit:-"IT Department"}

read -p "邮箱 (默认: admin@elontalk.com): " email
email=${email:-admin@elontalk.com}

read -p "证书有效期天数 (默认: 365): " days
days=${days:-365}

echo ""
echo "🔧 生成证书配置..."

# 创建证书配置文件
cat > server.conf << EOF
[req]
default_bits = 2048
prompt = no
distinguished_name = dn
req_extensions = v3_req
x509_extensions = v3_ca

[dn]
C=$country
ST=$state
L=$city
O=$organization
OU=$unit
CN=$domain
emailAddress=$email

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[v3_ca]
basicConstraints = critical, CA:FALSE
keyUsage = critical, nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = $domain
DNS.2 = localhost
DNS.3 = *.localhost
DNS.4 = *.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# 添加服务器IP和域名变体
alt_count=5
if [ -n "$server_ip" ]; then
    echo "IP.$((alt_count-2)) = $server_ip" >> server.conf
fi

if [ "$domain" != "localhost" ]; then
    echo "DNS.$alt_count = *.$domain" >> server.conf
    ((alt_count++))
    echo "DNS.$alt_count = $domain.local" >> server.conf
fi

echo ""
echo "🔐 生成私钥 (2048位 RSA)..."
if openssl genrsa -out server.key 2048; then
    echo "✅ 私钥生成成功"
else
    echo "❌ 私钥生成失败"
    exit 1
fi

echo ""
echo "🔐 生成自签名证书 (有效期: $days 天)..."
if openssl req -new -x509 -key server.key -out server.crt -days "$days" -config server.conf; then
    echo "✅ 证书生成成功"
else
    echo "❌ 证书生成失败"
    exit 1
fi

# 设置文件权限
echo ""
echo "🔐 设置文件权限..."
chmod 600 server.key
chmod 644 server.crt
chmod 644 server.conf

echo "✅ 权限设置完成"

# 验证证书
echo ""
echo "🔍 验证证书..."
if openssl x509 -in server.crt -text -noout >/dev/null 2>&1; then
    echo "✅ 证书格式验证通过"
    
    # 显示证书详细信息
    echo ""
    echo "📋 证书详细信息:"
    echo "=============================================="
    
    # 基本信息
    cert_subject=$(openssl x509 -in server.crt -noout -subject | sed 's/subject=//')
    cert_issuer=$(openssl x509 -in server.crt -noout -issuer | sed 's/issuer=//')
    cert_serial=$(openssl x509 -in server.crt -noout -serial | sed 's/serial=//')
    
    echo "📜 主体: $cert_subject"
    echo "🏢 颁发者: $cert_issuer"
    echo "🔢 序列号: $cert_serial"
    
    # 有效期
    echo ""
    echo "⏰ 有效期:"
    openssl x509 -in server.crt -noout -dates | sed 's/not/   /'
    
    # SAN信息
    echo ""
    echo "🌐 替代名称 (SAN):"
    openssl x509 -in server.crt -text -noout | grep -A 10 "Subject Alternative Name" | grep -E "(DNS|IP)" | sed 's/^[ ]*/   /' || echo "   无"
    
    # 密钥信息
    echo ""
    echo "🔑 密钥信息:"
    key_size=$(openssl rsa -in server.key -text -noout 2>/dev/null | grep "Private-Key" | grep -o '[0-9]*' || echo "未知")
    echo "   算法: RSA"
    echo "   长度: ${key_size} 位"
    
    # 指纹
    echo ""
    echo "🔍 证书指纹:"
    sha1_fp=$(openssl x509 -in server.crt -noout -fingerprint -sha1 | sed 's/SHA1 Fingerprint=/   SHA1: /')
    sha256_fp=$(openssl x509 -in server.crt -noout -fingerprint -sha256 | sed 's/SHA256 Fingerprint=/   SHA256: /')
    echo "$sha1_fp"
    echo "$sha256_fp"
    
else
    echo "❌ 证书格式验证失败"
    exit 1
fi

# 清理配置文件 (可选保留用于调试)
echo ""
read -p "是否保留配置文件 server.conf? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    rm -f server.conf
    echo "🗑️  已删除配置文件"
else
    echo "📄 配置文件已保留"
fi

echo ""
echo "🎉 证书生成完成！"
echo "=============================================="
echo "📁 文件位置:"
current_dir=$(pwd)
echo "   证书文件: $current_dir/server.crt"
echo "   私钥文件: $current_dir/server.key"
[ -f "server.conf" ] && echo "   配置文件: $current_dir/server.conf"

echo ""
echo "🚀 使用说明:"
echo "   1. 证书已生成并设置正确权限"
echo "   2. 返回部署目录: cd .."
echo "   3. 启动HTTPS服务: ./start.sh 或 ./start-https.sh"
echo "   4. 访问地址: https://$domain:8443"
[ -n "$server_ip" ] && echo "   5. 远程访问: https://$server_ip:8443"

echo ""
echo "⚠️  重要提醒:"
echo "   - 这是自签名证书，浏览器会显示安全警告"
echo "   - 生产环境建议使用权威CA颁发的证书"
echo "   - 运行 ./setup-ssl.sh 配置 Let's Encrypt 免费证书"
echo "   - 请妥善保管私钥文件 server.key"

echo ""
echo "🔗 下一步操作:"
echo "   测试HTTPS: ./start-https.sh"
echo "   配置Let's Encrypt: ./setup-ssl.sh"
echo "   系统服务安装: sudo ./install-service.sh"