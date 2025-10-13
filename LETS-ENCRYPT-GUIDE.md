# Let's Encrypt 真实证书申请指南

## 概述
Let's Encrypt 是一个免费、自动化、开放的证书颁发机构（CA），为您的域名 `elontalk.duckdns.org` 提供免费的SSL/TLS证书。

## 前提条件

### 1. 域名验证
✅ **已完成**: 您的域名 `elontalk.duckdns.org` 已经解析到服务器IP
✅ **已完成**: DuckDNS token: `400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca`

### 2. 服务器要求
- Ubuntu服务器（您的生产环境）
- 可以通过80端口（HTTP）和443端口（HTTPS）访问
- Rust应用程序已部署并能在Ubuntu上运行

## 申请方法选择

### 方法一：使用 Certbot（推荐）

#### 1. 安装 Certbot
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot

# 或者使用snap（更新版本）
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

#### 2. 获取证书（Standalone模式）
```bash
# 停止您的Rust应用（临时）
sudo systemctl stop customer-service-backend

# 获取证书
sudo certbot certonly --standalone \
  --preferred-challenges http \
  -d elontalk.duckdns.org \
  --email your-email@example.com \
  --agree-tos \
  --non-interactive

# 重新启动您的应用
sudo systemctl start customer-service-backend
```

#### 3. 证书位置
证书将保存在：
- **证书文件**: `/etc/letsencrypt/live/elontalk.duckdns.org/fullchain.pem`
- **私钥文件**: `/etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem`

### 方法二：使用 DNS Challenge（适合自动化）

#### 1. DNS Challenge 脚本
```bash
# 使用DNS-01 challenge（适合DuckDNS）
sudo certbot certonly --manual \
  --preferred-challenges dns \
  -d elontalk.duckdns.org \
  --email your-email@example.com \
  --agree-tos
```

#### 2. 自动化DuckDNS DNS更新
创建脚本 `/usr/local/bin/duckdns-certbot.sh`：
```bash
#!/bin/bash
TOKEN="400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca"
DOMAIN="elontalk"
TXT_VALUE="$CERTBOT_VALIDATION"

# 设置DNS TXT记录
curl "https://www.duckdns.org/update?domains=$DOMAIN&token=$TOKEN&txt=$TXT_VALUE"

# 等待DNS传播
sleep 60
```

## 生产环境配置

### 1. 更新Rust应用配置
更新生产环境的 `.env` 文件：
```bash
# 生产环境 HTTPS 配置
TLS_ENABLED=true
TLS_PORT=443
TLS_CERT_PATH=/etc/letsencrypt/live/elontalk.duckdns.org/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem
TLS_DOMAIN=elontalk.duckdns.org
TLS_REDIRECT_HTTP=true
SERVER_PORT=80
```

### 2. 设置证书权限
```bash
# 创建ssl-cert组并添加应用用户
sudo groupadd ssl-cert
sudo usermod -a -G ssl-cert $USER

# 设置证书文件权限
sudo chown root:ssl-cert /etc/letsencrypt/live/elontalk.duckdns.org/*
sudo chmod 640 /etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem
```

### 3. 自动续期设置
```bash
# 添加cron任务自动续期
sudo crontab -e

# 添加以下行（每天凌晨2点检查续期）
0 2 * * * /usr/bin/certbot renew --quiet && systemctl reload customer-service-backend
```

## 防火墙配置

### Ubuntu UFW 配置
```bash
# 开放HTTP和HTTPS端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 验证证书

### 1. 在线验证工具
- [SSL Labs Test](https://www.ssllabs.com/ssltest/)
- 输入: `https://elontalk.duckdns.org`

### 2. 命令行验证
```bash
# 检查证书详情
openssl s_client -connect elontalk.duckdns.org:443 -servername elontalk.duckdns.org

# 验证证书有效期
sudo certbot certificates
```

## 故障排除

### 常见问题

1. **端口80被占用**
   ```bash
   sudo netstat -tlnp | grep :80
   sudo systemctl stop apache2  # 如果有Apache
   sudo systemctl stop nginx    # 如果有Nginx
   ```

2. **DNS传播延迟**
   ```bash
   # 检查DNS解析
   nslookup elontalk.duckdns.org
   dig elontalk.duckdns.org
   ```

3. **权限问题**
   ```bash
   # 检查证书文件权限
   sudo ls -la /etc/letsencrypt/live/elontalk.duckdns.org/
   ```

## 完整的部署脚本

创建 `deploy-https.sh`：
```bash
#!/bin/bash
set -e

echo "🔒 部署 Let's Encrypt HTTPS 证书"

# 1. 安装 Certbot
if ! command -v certbot &> /dev/null; then
    echo "📦 安装 Certbot..."
    sudo apt update
    sudo apt install -y certbot
fi

# 2. 停止服务
echo "⏸️  停止 Rust 服务..."
sudo systemctl stop customer-service-backend || true

# 3. 获取证书
echo "🔐 获取 SSL 证书..."
sudo certbot certonly --standalone \
    --preferred-challenges http \
    -d elontalk.duckdns.org \
    --email admin@elontalk.duckdns.org \
    --agree-tos \
    --non-interactive

# 4. 设置权限
echo "🔧 设置证书权限..."
sudo groupadd ssl-cert 2>/dev/null || true
sudo usermod -a -G ssl-cert $(whoami)
sudo chown root:ssl-cert /etc/letsencrypt/live/elontalk.duckdns.org/*
sudo chmod 640 /etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem

# 5. 更新配置
echo "⚙️  更新应用配置..."
cat > .env << EOF
DATABASE_URL=sqlite:customer_service.db
JWT_SECRET=elontalk-production-jwt-secret-$(date +%s)
SERVER_HOST=0.0.0.0
SERVER_PORT=80
TLS_ENABLED=true
TLS_PORT=443
TLS_CERT_PATH=/etc/letsencrypt/live/elontalk.duckdns.org/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem
TLS_DOMAIN=elontalk.duckdns.org
TLS_REDIRECT_HTTP=true
RUST_LOG=info
EOF

# 6. 启动服务
echo "🚀 启动 HTTPS 服务..."
sudo systemctl start customer-service-backend
sudo systemctl enable customer-service-backend

# 7. 设置自动续期
echo "🔄 设置自动续期..."
(sudo crontab -l 2>/dev/null; echo "0 2 * * * /usr/bin/certbot renew --quiet && systemctl reload customer-service-backend") | sudo crontab -

echo "✅ HTTPS 部署完成！"
echo "🌐 访问: https://elontalk.duckdns.org"
```

## 使用步骤总结

1. **开发环境测试** ✅ （您正在进行）
2. **部署到生产服务器**
3. **运行部署脚本**: `bash deploy-https.sh`
4. **验证HTTPS**: 访问 `https://elontalk.duckdns.org`
5. **配置自动续期** ✅ （脚本已包含）

证书将自动每90天续期，无需手动操作！