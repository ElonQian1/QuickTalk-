#!/bin/bash

# ELonTalk SSL 证书生成脚本
# 功能：生成自签名 SSL 证书用于 HTTPS

DOMAIN="elontalk.duckdns.org"
CERT_DIR="certs"
COUNTRY="CN"
STATE="Beijing"
CITY="Beijing"
ORG="ELonTalk"
ORG_UNIT="IT Department"

echo "🔐 生成 SSL 证书..."

# 创建证书目录
mkdir -p "$CERT_DIR"

# 生成私钥
echo "生成私钥..."
openssl genrsa -out "$CERT_DIR/server.key" 2048

# 生成证书签名请求
echo "生成证书签名请求..."
openssl req -new -key "$CERT_DIR/server.key" -out "$CERT_DIR/server.csr" -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/OU=$ORG_UNIT/CN=$DOMAIN"

# 生成自签名证书
echo "生成自签名证书..."
openssl x509 -req -days 365 -in "$CERT_DIR/server.csr" -signkey "$CERT_DIR/server.key" -out "$CERT_DIR/server.crt"

# 设置权限
chmod 600 "$CERT_DIR/server.key"
chmod 644 "$CERT_DIR/server.crt"

# 清理临时文件
rm -f "$CERT_DIR/server.csr"

echo "✅ SSL 证书生成完成"
echo "证书文件: $CERT_DIR/server.crt"
echo "私钥文件: $CERT_DIR/server.key"
echo "有效期: 365 天"
echo

# 显示证书信息
echo "证书详细信息："
openssl x509 -in "$CERT_DIR/server.crt" -text -noout | head -20

echo
echo "⚠️  注意："
echo "1. 这是自签名证书，浏览器会显示安全警告"
echo "2. 生产环境建议使用 Let's Encrypt 证书"
echo "3. 证书有效期为 365 天，到期前需要更新"