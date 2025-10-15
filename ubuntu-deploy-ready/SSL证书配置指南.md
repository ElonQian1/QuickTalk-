# SSL证书配置指南

## 🔒 HTTPS证书要求

您的Ubuntu系统必须使用HTTPS，因此需要有效的SSL证书。

## 📋 当前证书状态

部署包中包含以下证书文件：
```
certs/
├── server.crt           # 主SSL证书
├── server.key           # 私钥文件
├── server.crt.backup    # 证书备份
├── server.key.backup    # 私钥备份
└── dev-server.crt       # 开发证书
```

## 🚀 推荐证书方案

### 方案1: Let's Encrypt (免费，推荐)

#### 安装Certbot
```bash
# Ubuntu 24.04
sudo apt update
sudo apt install certbot

# 或者使用snap
sudo snap install --classic certbot
```

#### 获取证书
```bash
# 停止现有服务
sudo systemctl stop customer-service

# 获取证书 (需要域名解析到服务器)
sudo certbot certonly --standalone -d elontalk.duckdns.org

# 证书将保存在 /etc/letsencrypt/live/elontalk.duckdns.org/
```

#### 复制证书到部署目录
```bash
cd /root/ubuntu-deploy-ready

# 备份现有证书
cp certs/server.crt certs/server.crt.old
cp certs/server.key certs/server.key.old

# 复制Let's Encrypt证书
sudo cp /etc/letsencrypt/live/elontalk.duckdns.org/fullchain.pem certs/server.crt
sudo cp /etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem certs/server.key

# 设置权限
sudo chown root:root certs/server.crt certs/server.key
sudo chmod 644 certs/server.crt
sudo chmod 600 certs/server.key
```

#### 自动续期
```bash
# 添加续期任务
sudo crontab -e

# 添加以下行 (每月1号凌晨2点检查续期)
0 2 1 * * /usr/bin/certbot renew --quiet && systemctl restart customer-service
```

### 方案2: 使用现有证书

如果您已有SSL证书，请按以下格式替换：

```bash
cd /root/ubuntu-deploy-ready

# 替换证书文件
cp /path/to/your/certificate.crt certs/server.crt
cp /path/to/your/private.key certs/server.key

# 设置正确权限
chmod 644 certs/server.crt
chmod 600 certs/server.key
```

### 方案3: 自签名证书 (仅测试)

⚠️ **警告**: 自签名证书会在浏览器中显示安全警告，不推荐生产使用。

```bash
cd /root/ubuntu-deploy-ready

# 生成自签名证书
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj "/C=CN/ST=Beijing/L=Beijing/O=ELonTalk/CN=elontalk.duckdns.org"

# 设置权限
chmod 644 certs/server.crt
chmod 600 certs/server.key
```

## 🔧 证书验证

### 检查证书文件
```bash
cd /root/ubuntu-deploy-ready

# 检查证书内容
openssl x509 -in certs/server.crt -text -noout

# 检查证书有效期
openssl x509 -in certs/server.crt -noout -dates

# 验证证书和私钥匹配
openssl x509 -in certs/server.crt -noout -modulus | openssl md5
openssl rsa -in certs/server.key -noout -modulus | openssl md5
# 两个MD5值应该相同
```

### 测试HTTPS连接
```bash
# 启动服务后测试
curl -k https://localhost:8443
curl -k https://elontalk.duckdns.org:8443
```

## 🎯 部署后HTTPS配置

### 1. 确认域名解析
```bash
# 检查域名是否指向服务器
nslookup elontalk.duckdns.org
dig elontalk.duckdns.org

# 结果应该显示: 43.139.82.12
```

### 2. 防火墙配置
```bash
# 开放HTTPS端口
sudo ufw allow 8443/tcp
sudo ufw allow 8080/tcp
sudo ufw status
```

### 3. 启动服务
```bash
cd /root/ubuntu-deploy-ready

# 检查配置
cat .env | grep TLS

# 启动服务
./start.sh

# 查看日志
journalctl -u customer-service -f
```

## 🔄 证书更新流程

### Let's Encrypt续期
```bash
# 手动续期
sudo certbot renew

# 更新部署目录中的证书
cd /root/ubuntu-deploy-ready
sudo cp /etc/letsencrypt/live/elontalk.duckdns.org/fullchain.pem certs/server.crt
sudo cp /etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem certs/server.key

# 重启服务
sudo systemctl restart customer-service
```

## 🚨 故障排除

### 证书相关错误
```bash
# 检查证书权限
ls -la certs/

# 检查证书格式
file certs/server.crt certs/server.key

# 检查服务日志
journalctl -u customer-service --no-pager -l
```

### 常见问题

1. **证书过期**
   - 症状：浏览器显示证书过期
   - 解决：更新证书并重启服务

2. **证书域名不匹配**
   - 症状：浏览器显示域名不匹配
   - 解决：确保证书CN或SAN包含正确域名

3. **私钥权限错误**
   - 症状：服务启动失败，权限错误
   - 解决：`chmod 600 certs/server.key`

## 📞 支持信息

- **服务器IP**: 43.139.82.12
- **域名**: elontalk.duckdns.org
- **HTTPS端口**: 8443
- **HTTP端口**: 8080
- **管理员**: siwmm@163.com

---
**更新时间**: 2025年10月15日  
**适用版本**: Ubuntu 24.04 LTS  
**服务路径**: /root/ubuntu-deploy-ready/
