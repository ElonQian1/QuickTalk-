# 🔐 生产环境SSL证书配置指南

## 🚀 快速开始

### 方案1: Let's Encrypt 免费证书 (推荐)

```bash
# 1. 上传脚本到服务器
scp setup-ssl-cert.sh user@your-server:/opt/
chmod +x /opt/setup-ssl-cert.sh

# 2. 申请证书 (需要域名已解析到服务器)
sudo /opt/setup-ssl-cert.sh letsencrypt your-domain.com admin@your-domain.com

# 3. 自动生成 .env.production 配置文件
cp .env.production .env

# 4. 部署应用
./customer-service-backend
```

### 方案2: 手动配置现有证书

```bash
# 1. 准备证书文件 (从云服务商下载)
# 2. 配置证书
sudo /opt/setup-ssl-cert.sh manual your-domain.com

# 3. 按提示放置证书文件
cp your-certificate.pem /etc/ssl/customer-service/server.crt
cp your-private-key.pem /etc/ssl/customer-service/server.key

# 4. 启动应用
./customer-service-backend
```

## 📋 主要证书来源对比

| 方案 | 成本 | 自动续期 | 企业认可度 | 部署难度 |
|------|------|---------|-----------|----------|
| **Let's Encrypt** | 免费 | ✅ 自动 | ⭐⭐⭐⭐ | 简单 |
| **阿里云SSL** | ¥200-2000/年 | ✅ 自动 | ⭐⭐⭐⭐⭐ | 简单 |
| **DigiCert** | $200-500/年 | ❌ 手动 | ⭐⭐⭐⭐⭐ | 中等 |
| **Cloudflare** | 免费-$20/月 | ✅ 自动 | ⭐⭐⭐⭐ | 简单 |

## 🔧 证书配置详解

### Let's Encrypt 详细步骤

```bash
# 服务器准备
sudo apt update
sudo apt install certbot nginx

# 域名验证方式1: Standalone (需要停止80端口服务)
sudo systemctl stop nginx
sudo certbot certonly --standalone -d your-domain.com

# 域名验证方式2: Webroot (不停机)
sudo certbot certonly --webroot -w /var/www/html -d your-domain.com

# 证书位置
ls -la /etc/letsencrypt/live/your-domain.com/
# fullchain.pem  # 完整证书链
# privkey.pem    # 私钥
# cert.pem       # 服务器证书
# chain.pem      # 中间证书
```

### 云服务商证书 (以阿里云为例)

```bash
# 1. 登录阿里云控制台
# 2. 进入 "SSL证书服务"
# 3. 购买证书 (免费DV证书可选)
# 4. 填写域名信息
# 5. 域名验证 (DNS/文件验证)
# 6. 下载证书文件

# 下载的文件通常包含:
# domain.pem     # 证书文件
# domain.key     # 私钥文件
```

## 🛠️ 配置示例

### Rust应用直接HTTPS模式

```bash
# .env 配置
TLS_ENABLED=true
TLS_CERT_PATH=/etc/ssl/customer-service/server.crt
TLS_KEY_PATH=/etc/ssl/customer-service/server.key
TLS_PORT=443
TLS_DOMAIN=your-domain.com
TLS_REDIRECT_HTTP=true

# 启动命令
sudo ./customer-service-backend
# (需要sudo因为要绑定443端口)
```

### Nginx反向代理模式 (推荐)

```nginx
# /etc/nginx/sites-available/customer-service
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL配置
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # 反向代理到Rust应用
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Rust应用配置 (HTTP模式)
TLS_ENABLED=false
SERVER_PORT=8080

# 启动 (无需sudo)
./customer-service-backend
```

## 🔄 证书自动续期

### Let's Encrypt 自动续期

```bash
# 测试续期
sudo certbot renew --dry-run

# 自动续期脚本
sudo crontab -e
# 添加以下行 (每天凌晨2点检查)
0 2 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx
```

### 云服务商证书续期

大多数云服务商提供自动续期服务：
- **阿里云**: 支持自动续期，提前30天通知
- **腾讯云**: 支持自动续期，可设置自动部署
- **AWS ACM**: 完全自动管理

## 🚨 安全最佳实践

### 1. 文件权限设置
```bash
# 证书文件权限
sudo chmod 644 /path/to/certificate.crt
sudo chmod 600 /path/to/private.key
sudo chown root:root /path/to/certificate.crt
sudo chown root:ssl-cert /path/to/private.key
```

### 2. 防火墙配置
```bash
# 开放HTTPS端口
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp  # 用于重定向和证书验证
```

### 3. 证书监控
```bash
# 证书到期监控脚本
#!/bin/bash
DOMAIN="your-domain.com"
DAYS_WARN=30

EXPIRE_DATE=$(openssl x509 -in /etc/ssl/customer-service/server.crt -noout -enddate | cut -d= -f2)
EXPIRE_TIMESTAMP=$(date -d "$EXPIRE_DATE" +%s)
CURRENT_TIMESTAMP=$(date +%s)
DAYS_LEFT=$(( ($EXPIRE_TIMESTAMP - $CURRENT_TIMESTAMP) / 86400 ))

if [ $DAYS_LEFT -lt $DAYS_WARN ]; then
    echo "警告: $DOMAIN 证书将在 $DAYS_LEFT 天后过期!"
    # 发送邮件或企业微信通知
fi
```

## 🎯 推荐的生产部署方案

### 小规模部署 (1-1000用户)
```
Internet → Rust应用 (内置HTTPS:443)
```
- 使用Let's Encrypt免费证书
- 直接配置到Rust应用
- 简单、成本低

### 中大规模部署 (1000+用户)
```
Internet → Nginx (HTTPS:443) → Rust应用 (HTTP:8080)
```
- 使用Let's Encrypt或商业证书
- Nginx处理SSL卸载和静态文件
- 性能优化、负载均衡

---

**总结**: 对于你的项目，我推荐使用 **Let's Encrypt + Nginx反向代理** 的方案，既免费又稳定，非常适合生产环境！