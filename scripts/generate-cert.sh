# 生成开发环境自签名证书
# 用于 HTTPS 测试

echo "🔐 生成开发环境自签名证书..."

# 检查 OpenSSL 是否可用
if ! command -v openssl &> /dev/null; then
    echo "❌ OpenSSL 未安装。请先安装 OpenSSL。"
    echo "Windows: 下载 https://slproweb.com/products/Win32OpenSSL.html"
    echo "或使用 Chocolatey: choco install openssl"
    exit 1
fi

# 证书配置
DOMAIN=${1:-localhost}
CERT_FILE="cert.pem"
KEY_FILE="key.pem"
DAYS=365

echo "📋 证书配置:"
echo "  域名: $DOMAIN"
echo "  证书文件: $CERT_FILE"
echo "  私钥文件: $KEY_FILE" 
echo "  有效期: $DAYS 天"
echo ""

# 生成私钥和证书
openssl req -x509 -newkey rsa:4096 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -days $DAYS \
    -nodes \
    -subj "/C=CN/ST=State/L=City/O=Development/OU=IT Department/CN=$DOMAIN"

if [ $? -eq 0 ]; then
    echo "✅ 证书生成成功!"
    echo ""
    echo "📁 文件位置:"
    echo "  证书: $(pwd)/$CERT_FILE"
    echo "  私钥: $(pwd)/$KEY_FILE"
    echo ""
    echo "🔧 使用方法:"
    echo "1. 复制 .env.example 为 .env"
    echo "2. 在 .env 中设置:"
    echo "   TLS_ENABLED=true"
    echo "   TLS_CERT_PATH=$CERT_FILE"
    echo "   TLS_KEY_PATH=$KEY_FILE"
    echo ""
    echo "3. 使用 HTTPS 功能编译运行:"
    echo "   cargo run --features https"
    echo ""
    echo "⚠️  注意: 自签名证书会显示安全警告，这在开发环境中是正常的。"
    echo "   在浏览器中点击 '高级' -> '继续访问' 即可。"
else
    echo "❌ 证书生成失败!"
    exit 1
fi