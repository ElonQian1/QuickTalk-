# ELonTalk 客服系统 - Ubuntu 部署指南

**编译时间**: 2025年10月15日  
**目标系统**: Ubuntu 24.04 LTS  
**架构**: x86_64  
**协议**: HTTPS (强制)  
**部署路径**: /root/ubuntu-deploy-ready/

---

## 📦 部署包内容

```
ubuntu-deploy-package/
├── customer-service-backend     # Rust 后端二进制文件 (8.4MB, 静态链接)
├── .env                        # 环境配置文件
├── deploy.sh                   # 一键部署脚本
├── start.sh                    # 启动脚本
├── customer-service.service    # systemd 服务配置
├── certs/                      # SSL 证书目录
│   ├── server.crt             # SSL 证书
│   └── server.key             # SSL 私钥
└── static/                     # 前端静态文件
    ├── index.html             # 管理后台首页
    ├── favicon.svg            # 图标
    ├── manifest.json          # PWA 配置
    └── static/                # React 应用资源
        └── js/
            └── main.*.js      # 前端主应用
```

---

## 🚀 快速部署步骤

### 1. 上传部署包

将整个 `ubuntu-deploy-package` 文件夹上传到 Ubuntu 服务器：

```bash
# 在本地 Windows 终端使用 scp 或 WinSCP 上传
# 目标路径: root@43.139.82.12:/root/

# 或使用 SFTP 工具上传到 /root/ 目录
```

### 2. 重命名并进入目录

```bash
# SSH 登录到服务器
ssh root@43.139.82.12

# 重命名文件夹（如果需要）
mv ubuntu-deploy-package ubuntu-deploy-ready

# 进入目录
cd /root/ubuntu-deploy-ready
```

### 3. 执行一键部署

```bash
# 赋予脚本执行权限
chmod +x deploy.sh

# 执行部署脚本
bash deploy.sh
```

**部署脚本会自动完成：**
- ✅ 系统更新和必要工具安装
- ✅ 文件权限配置
- ✅ 防火墙规则设置（开放 22, 8080, 8443 端口）
- ✅ 数据库初始化
- ✅ systemd 服务配置和启动
- ✅ 服务健康检查

---

## 🔧 手动部署（可选）

如果需要手动控制部署过程：

### 1. 设置权限

```bash
cd /root/ubuntu-deploy-ready
chmod +x customer-service-backend
chmod +x start.sh
chmod 644 .env
chmod 600 certs/server.key
chmod 644 certs/server.crt
chmod -R 755 static/
```

### 2. 配置防火墙

```bash
ufw allow 22/tcp    # SSH
ufw allow 8080/tcp  # HTTP (自动重定向)
ufw allow 8443/tcp  # HTTPS
ufw enable
```

### 3. 配置服务

```bash
cp customer-service.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable customer-service
systemctl start customer-service
```

### 4. 验证部署

```bash
# 检查服务状态
systemctl status customer-service

# 查看实时日志
journalctl -u customer-service -f

# 测试连接
curl -k https://localhost:8443
```

---

## 🌐 访问地址

部署成功后，可以通过以下地址访问：

### HTTPS 访问（推荐）
- **管理后台**: https://elontalk.duckdns.org:8443
- **API 接口**: https://elontalk.duckdns.org:8443/api/
- **WebSocket**: wss://elontalk.duckdns.org:8443/ws/

### HTTP 访问（自动重定向）
- http://43.139.82.12:8080 → 自动跳转到 HTTPS

---

## 🔐 HTTPS 证书说明

### 当前证书配置
- **证书位置**: `/root/ubuntu-deploy-ready/certs/`
- **证书类型**: 自签名证书（开发/测试用）
- **域名**: elontalk.duckdns.org

### 更换正式证书（推荐）

使用 Let's Encrypt 免费 SSL 证书：

```bash
# 安装 Certbot
apt install -y certbot

# 获取证书（HTTP-01 验证）
certbot certonly --standalone -d elontalk.duckdns.org

# 证书生成位置
# /etc/letsencrypt/live/elontalk.duckdns.org/fullchain.pem
# /etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem

# 复制到项目目录
cp /etc/letsencrypt/live/elontalk.duckdns.org/fullchain.pem certs/server.crt
cp /etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem certs/server.key

# 重启服务
systemctl restart customer-service
```

---

## 📊 数据库说明

### Sea-ORM 自动迁移
本项目使用 Sea-ORM，数据库会在程序首次启动时自动初始化和迁移。

```bash
# 数据库文件位置
/root/ubuntu-deploy-ready/customer_service.db

# 查看数据库
sqlite3 customer_service.db

# 数据库表结构
sqlite> .tables
# customers  messages  sessions  shop_staffs  shops  users
```

### 禁用自动迁移（可选）
如果需要手动控制数据库迁移，编辑 `.env` 文件：

```bash
DISABLE_MIGRATION=true
```

---

## 🛠️ 管理命令

### 服务管理

```bash
# 启动服务
systemctl start customer-service

# 停止服务
systemctl stop customer-service

# 重启服务
systemctl restart customer-service

# 查看状态
systemctl status customer-service

# 开机自启
systemctl enable customer-service
```

### 日志查看

```bash
# 查看实时日志
journalctl -u customer-service -f

# 查看最近 50 条日志
journalctl -u customer-service -n 50

# 查看今天的日志
journalctl -u customer-service --since today
```

### 进程管理

```bash
# 查看进程
ps aux | grep customer-service-backend

# 查看端口占用
netstat -tlnp | grep ':8443'
lsof -i :8443
```

---

## 🔍 故障排查

### 服务无法启动

```bash
# 1. 检查日志
journalctl -u customer-service -n 50 --no-pager

# 2. 检查配置文件
cat .env

# 3. 检查权限
ls -la customer-service-backend
ls -la certs/

# 4. 测试手动启动
./customer-service-backend
```

### 端口被占用

```bash
# 查找占用进程
lsof -i :8443
lsof -i :8080

# 终止进程
kill -9 <PID>

# 或使用部署脚本自动处理
```

### 证书问题

```bash
# 检查证书文件
ls -la certs/server.crt certs/server.key

# 验证证书内容
openssl x509 -in certs/server.crt -text -noout

# 重新生成自签名证书
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout certs/server.key \
  -out certs/server.crt \
  -days 365 \
  -subj "/CN=elontalk.duckdns.org"
```

### 数据库问题

```bash
# 检查数据库权限
ls -la customer_service.db

# 重置数据库（⚠️ 会删除所有数据）
rm customer_service.db
touch customer_service.db
chmod 644 customer_service.db
systemctl restart customer-service
```

---

## 📝 配置文件说明

### .env 环境配置

```bash
# 数据库配置
DATABASE_URL=sqlite:/root/ubuntu-deploy-ready/customer_service.db

# JWT 密钥（生产环境请修改）
JWT_SECRET=your-super-secret-jwt-key-please-change-in-production-env-2025

# 服务器配置
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# HTTPS 配置
TLS_MODE=https           # 强制 HTTPS
TLS_PORT=8443           # HTTPS 端口
ENABLE_HTTP_REDIRECT=true  # HTTP 自动重定向

# 证书路径
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key

# 日志级别
RUST_LOG=info,customer_service_backend=debug
```

### systemd 服务配置

位置: `/etc/systemd/system/customer-service.service`

```ini
[Unit]
Description=ELonTalk Customer Service System
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/ubuntu-deploy-ready
ExecStart=/root/ubuntu-deploy-ready/customer-service-backend
Restart=always
RestartSec=10
Environment="RUST_LOG=info"

[Install]
WantedBy=multi-user.target
```

---

## ⚙️ 性能优化建议

### 1. 启用日志轮转

```bash
# 创建日志轮转配置
cat > /etc/systemd/journald.conf.d/customer-service.conf << EOF
[Journal]
SystemMaxUse=100M
SystemMaxFileSize=10M
MaxRetentionSec=7day
EOF

# 重启 journald
systemctl restart systemd-journald
```

### 2. 优化数据库性能

```bash
# 定期执行 VACUUM
sqlite3 customer_service.db "VACUUM;"

# 添加到 crontab
(crontab -l 2>/dev/null; echo "0 3 * * 0 sqlite3 /root/ubuntu-deploy-ready/customer_service.db 'VACUUM;'") | crontab -
```

### 3. 监控资源使用

```bash
# 查看内存占用
ps aux | grep customer-service-backend

# 查看连接数
netstat -an | grep ':8443' | wc -l
```

---

## 🔄 更新部署

当需要更新应用时：

```bash
# 1. 备份数据库
cp customer_service.db customer_service.db.backup

# 2. 停止服务
systemctl stop customer-service

# 3. 替换二进制文件
# 上传新的 customer-service-backend 文件

# 4. 启动服务
systemctl start customer-service

# 5. 检查状态
systemctl status customer-service
journalctl -u customer-service -f
```

---

## 📞 技术支持

- **域名**: elontalk.duckdns.org
- **服务器 IP**: 43.139.82.12
- **管理员邮箱**: siwmm@163.com
- **DuckDNS Token**: 400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca

---

## ✅ 部署检查清单

部署完成后，请确认以下项目：

- [ ] 服务状态正常: `systemctl status customer-service`
- [ ] HTTPS 可访问: `curl -k https://localhost:8443`
- [ ] HTTP 重定向工作: `curl -I http://localhost:8080`
- [ ] 防火墙规则生效: `ufw status`
- [ ] 日志正常输出: `journalctl -u customer-service -n 20`
- [ ] 数据库文件存在: `ls -la customer_service.db`
- [ ] 证书文件有效: `ls -la certs/`
- [ ] 开机自启配置: `systemctl is-enabled customer-service`

---

**🎉 恭喜！部署完成。祝您使用愉快！**
