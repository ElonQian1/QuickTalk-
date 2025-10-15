# Ubuntu 服务器 SSL 证书配置指南

## 🔍 当前证书状态

**问题**: 现有证书为 `localhost` 签发，无法在生产服务器使用

**解决方案**: 
1. 临时使用HTTP模式进行测试
2. 生产环境申请域名证书

## 🚀 快速启动 (HTTP模式)

### 方法1: 使用HTTP配置文件
```bash
cd /root/ubuntu-deploy-ready
cp .env.http .env
./start.sh
```

### 方法2: 环境变量覆盖
```bash
cd /root/ubuntu-deploy-ready
HTTPS_ENABLED=false ./customer-service-backend
```

## 🔒 HTTPS证书获取 (生产环境)

### 使用 Let's Encrypt (推荐)
```bash
# 安装 certbot
apt update
apt install certbot

# 获取域名证书 (需要域名指向服务器)
certbot certonly --standalone -d elontalk.duckdns.org

# 证书位置
# /etc/letsencrypt/live/elontalk.duckdns.org/fullchain.pem
# /etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem
```

### 复制证书到项目目录
```bash
cd /root/ubuntu-deploy-ready
cp /etc/letsencrypt/live/elontalk.duckdns.org/fullchain.pem certs/server.crt
cp /etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem certs/server.key
chmod 644 certs/server.crt
chmod 600 certs/server.key
```

### 更新环境配置
```bash
# 编辑 .env 文件
HTTPS_ENABLED=true
TLS_DOMAIN=elontalk.duckdns.org
```

## 🔧 自签名证书 (测试环境)

如果需要为服务器IP生成自签名证书：

```bash
# 生成服务器IP证书
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj "/C=CN/ST=Beijing/L=Beijing/O=ELonTalk/CN=43.139.82.12" -addext "subjectAltName=IP:43.139.82.12,DNS:elontalk.duckdns.org,DNS:localhost"

chmod 644 certs/server.crt
chmod 600 certs/server.key
```

## 📋 证书验证

```bash
# 检查证书信息
openssl x509 -in certs/server.crt -text -noout

# 验证证书和私钥匹配
openssl x509 -noout -modulus -in certs/server.crt | openssl md5
openssl rsa -noout -modulus -in certs/server.key | openssl md5
```

## 🌐 访问地址

### HTTP模式
- http://43.139.82.12:8080
- http://elontalk.duckdns.org:8080

### HTTPS模式 (有效证书后)
- https://43.139.82.12:8443
- https://elontalk.duckdns.org:8443

---
**建议**: 先使用HTTP模式测试功能，确认无误后再配置HTTPS证书