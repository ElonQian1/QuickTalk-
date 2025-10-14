# ELonTalk 客服系统 Ubuntu HTTPS 部署指南# ELonTalk 客服系统 - Ubuntu 部署包



## 📦 部署包内容## 📦 部署包内容



``````

ubuntu-deploy-ready/ubuntu-deploy-ready/

├── customer-service-backend      # Rust后端可执行文件 (8.4MB)├── customer-service-backend    # Linux 静态二进制文件 (支持HTTPS)

├── .env                         # 环境配置文件├── .env                       # 环境配置文件

├── customer_service.db          # SQLite数据库文件(自动创建)├── static/                    # 前端静态文件

├── static/                      # React前端静态文件 (2.19MB)│   ├── index.html            # 管理后台首页

│   ├── index.html│   ├── static/js/main.js     # React 应用

│   ├── static/js/│   ├── favicon.svg           # 图标

│   └── static/css/│   └── manifest.json         # PWA 配置

├── certs/                       # SSL证书目录├── certs/                     # SSL 证书目录

├── logs/                        # 日志目录│   ├── server.crt            # SSL 证书

└── scripts/                     # 部署脚本│   └── server.key            # 私钥

    ├── deploy-https.sh          # 主部署脚本├── logs/                      # 日志目录 (运行时创建)

    ├── quick-fix.sh             # 快速修复脚本└── scripts/                   # 部署脚本

    ├── diagnose.sh              # 系统诊断脚本    ├── install.sh            # 一键安装脚本 (不使用/opt路径)

    └── cert-manager.sh          # SSL证书管理    ├── start.sh              # 启动脚本

```    ├── fix-database.sh       # 数据库权限修复脚本

    ├── cert-manager.sh       # SSL证书申请和管理脚本 ⭐

## 🚀 快速部署    └── elontalk.service      # systemd 服务配置

```

### 1. 上传到服务器

## 🚀 快速部署

将整个 `ubuntu-deploy-ready` 文件夹上传到Ubuntu服务器的 `/root/` 目录：

### 1. 上传文件

```bash将整个 `ubuntu-deploy-ready` 文件夹上传到 `/root/` 目录下。

# 方式1: 使用SCP

scp -r ubuntu-deploy-ready/ root@43.139.82.12:/root/### 2. 申请 SSL 证书 (HTTPS 必需)

```bash

# 方式2: 使用SFTP工具上传到 /root/ubuntu-deploy-ready/cd /root/ubuntu-deploy-ready

```chmod +x scripts/cert-manager.sh

./scripts/cert-manager.sh auto

### 2. 执行一键部署```



```bash### 3. 修复数据库权限 (重要!)

# SSH连接到服务器```bash

ssh root@43.139.82.12chmod +x scripts/fix-database.sh

./scripts/fix-database.sh

# 进入部署目录```

cd /root/ubuntu-deploy-ready

### 4. 启动服务

# 执行一键HTTPS部署```bash

chmod +x scripts/*.sh# 方式1: 直接启动 (推荐用于测试)

./scripts/deploy-https.shchmod +x customer-service-backend

```./customer-service-backend



### 3. 访问系统# 方式2: 使用启动脚本

chmod +x scripts/start.sh

部署成功后：./scripts/start.sh start

- **HTTPS访问**: https://elontalk.duckdns.org:8443```

- **HTTP访问**: http://43.139.82.12:8080

## 🔧 配置说明

## 🛠️ 管理命令

### 环境变量 (.env)

```bash```bash

# 查看服务状态# 数据库配置

./scripts/deploy-https.sh statusDATABASE_URL=sqlite:customer_service.db



# 查看实时日志# JWT 密钥 (生产环境请修改)

./scripts/deploy-https.sh logsJWT_SECRET=elontalk-prod-secret-2025-change-in-production



# 停止服务# HTTP 服务器配置

./scripts/deploy-https.sh stopSERVER_HOST=0.0.0.0

SERVER_PORT=8080

# 启动服务

./scripts/deploy-https.sh start# HTTPS/TLS 配置

TLS_MODE=auto              # auto/http/https

# 快速修复问题TLS_PORT=8443

./scripts/quick-fix.shTLS_DOMAIN=elontalk.duckdns.org

TLS_CERT_PATH=certs/server.crt

# 系统诊断TLS_KEY_PATH=certs/server.key

./scripts/diagnose.shREDIRECT_HTTP=true



# SSL证书管理# 服务器信息

./scripts/cert-manager.shSERVER_NAME=ELonTalk客服系统

```ADMIN_EMAIL=siwmm@163.com



## 🔧 故障排除# 日志配置

RUST_LOG=info

### 问题1: API 500错误LOG_LEVEL=info

```

```bash

# 执行诊断### TLS 模式说明

./scripts/diagnose.sh- `auto`: 自动检测证书文件，有证书则启用HTTPS，否则使用HTTP

- `http`: 强制使用HTTP模式

# 查看详细日志- `https`: 强制使用HTTPS模式 (需要有效证书)

tail -f logs/service.log

## 🌐 访问地址

# 快速修复

./scripts/quick-fix.sh部署完成后，可通过以下地址访问：

```

- **HTTP**: `http://YOUR_SERVER_IP:8080`

### 问题2: HTTPS连接失败- **HTTPS**: `https://YOUR_SERVER_IP:8443` (需要有效证书)

- **管理后台**: 访问根路径即可进入管理界面

```bash

# 重新申请SSL证书## 🔐 HTTPS 配置

./scripts/cert-manager.sh auto

### 自动申请 Let's Encrypt 证书 (推荐)

# 或强制使用自签名证书您的项目已配置好域名信息，可以自动申请免费SSL证书：

./scripts/cert-manager.sh selfsigned

``````bash

cd /root/ubuntu-deploy-ready

### 问题3: 权限问题chmod +x scripts/cert-manager.sh



```bash# 自动申请证书 (推荐)

# 修复所有权限./scripts/cert-manager.sh auto

cd /root/ubuntu-deploy-ready

chmod +x customer-service-backend# 验证证书

chmod +x scripts/*.sh./scripts/cert-manager.sh verify

chmod 644 customer_service.db```

chmod 644 .env

```**您的域名配置：**

- 域名：`elontalk.duckdns.org`

### 问题4: 端口被占用- DuckDNS Token：`400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca`

- 服务器IP：`43.139.82.12`

```bash- 管理员邮箱：`siwmm@163.com`

# 清理端口占用

./scripts/quick-fix.sh### 证书管理命令

```bash

# 或手动清理# 查看证书管理帮助

sudo fuser -k 8080/tcp./scripts/cert-manager.sh help

sudo fuser -k 8443/tcp

```# 申请 Let's Encrypt 证书

./scripts/cert-manager.sh letsencrypt

## 📋 配置说明

# 生成自签名证书 (测试用)

### 环境变量 (.env)./scripts/cert-manager.sh selfsigned



```bash# 手动更新证书

# 数据库配置./scripts/cert-manager.sh renew

DATABASE_URL=sqlite:customer_service.db

# 更新 DuckDNS 域名解析

# HTTPS配置./scripts/cert-manager.sh duckdns

TLS_MODE=auto```

HTTPS_ENABLED=true

TLS_CERT_PATH=certs/server.crt### 使用现有证书

TLS_KEY_PATH=certs/server.key如果您已有SSL证书，请将证书文件放入 `certs/` 目录：

```bash

# 服务器配置cp your-cert.crt /root/ubuntu-deploy-ready/certs/server.crt

SERVER_HOST=0.0.0.0cp your-key.key /root/ubuntu-deploy-ready/certs/server.key

HTTP_PORT=8080chmod 644 /root/ubuntu-deploy-ready/certs/server.crt

HTTPS_PORT=8443chmod 600 /root/ubuntu-deploy-ready/certs/server.key

```

# DuckDNS配置

DUCKDNS_DOMAIN=elontalk.duckdns.org### 使用 Let's Encrypt

DUCKDNS_TOKEN=400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca```bash

SERVER_IP=43.139.82.12# 安装 certbot

apt update

# JWT配置apt install certbot

JWT_SECRET=elontalk-super-secret-jwt-key-2024

JWT_EXPIRATION=24h# 获取证书 (需要域名指向服务器)

certbot certonly --standalone -d yourdomain.com

# 邮箱配置

ADMIN_EMAIL=siwmm@163.com# 复制证书到部署目录

```cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /root/ubuntu-deploy-ready/certs/server.crt

cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /root/ubuntu-deploy-ready/certs/server.key

### 端口配置chmod 644 /root/ubuntu-deploy-ready/certs/server.crt

chmod 600 /root/ubuntu-deploy-ready/certs/server.key

- **8080**: HTTP端口

- **8443**: HTTPS端口# 重启服务

- **80**: Let's Encrypt证书验证端口(临时)cd /root/ubuntu-deploy-ready

./scripts/start.sh restart

确保防火墙已开放这些端口：```



```bash## 🛠️ 管理命令

# Ubuntu UFW防火墙配置

sudo ufw allow 22/tcp    # SSH### 系统服务管理

sudo ufw allow 80/tcp    # HTTP```bash

sudo ufw allow 8080/tcp  # HTTP服务sudo systemctl start elontalk      # 启动服务

sudo ufw allow 8443/tcp  # HTTPS服务sudo systemctl stop elontalk       # 停止服务

sudo ufw enablesudo systemctl restart elontalk    # 重启服务

```sudo systemctl status elontalk     # 查看状态

sudo systemctl enable elontalk     # 开机自启

## 🔐 SSL证书sudo systemctl disable elontalk    # 取消开机自启

```

### 自动模式 (推荐)

### 脚本管理

脚本会自动尝试申请Let's Encrypt免费证书，失败时自动生成自签名证书。```bash

cd /root/ubuntu-deploy-ready

### 手动申请Let's Encrypt./scripts/start.sh start                # 启动 (智能模式)

./scripts/start.sh start-http           # 强制HTTP启动

```bash./scripts/start.sh start-https          # 强制HTTPS启动

./scripts/cert-manager.sh letsencrypt./scripts/start.sh stop                 # 停止

```./scripts/start.sh restart              # 重启

./scripts/start.sh status               # 状态查看

### 生成自签名证书```



```bash### 数据库问题修复

./scripts/cert-manager.sh selfsigned```bash

```# 如果遇到数据库权限问题，运行修复脚本

cd /root/ubuntu-deploy-ready

**注意**: 自签名证书会在浏览器中显示安全警告，但功能正常。chmod +x scripts/fix-database.sh

./scripts/fix-database.sh

## 📊 监控和日志```



### 查看系统状态### 日志查看

```bash

```bash# 查看应用日志

# 完整系统诊断tail -f /root/ubuntu-deploy-ready/logs/service.log

./scripts/diagnose.sh

# 查看错误日志

# 服务状态tail -f /root/ubuntu-deploy-ready/logs/error.log

./scripts/deploy-https.sh status

# 实时监控启动过程

# 实时日志cd /root/ubuntu-deploy-ready

tail -f logs/service.log./customer-service-backend

``````



### 日志文件位置## 🔍 故障排除



- **服务日志**: `logs/service.log`### 常见问题

- **PID文件**: `logs/service.pid`

- **SSL证书**: `certs/server.crt`, `certs/server.key`1. **端口被占用**

   ```bash

## 🔄 更新部署   sudo netstat -tulpn | grep :8080

   sudo lsof -i :8080

### 更新应用程序   ```



1. 上传新的 `customer-service-backend` 文件2. **权限问题**

2. 停止服务: `./scripts/deploy-https.sh stop`   ```bash

3. 替换文件并设置权限: `chmod +x customer-service-backend`   # 运行数据库修复脚本

4. 启动服务: `./scripts/deploy-https.sh start`   cd /root/ubuntu-deploy-ready

   ./scripts/fix-database.sh

### 更新前端   

   # 手动设置权限

1. 上传新的 `static/` 目录内容   chmod 755 /root/ubuntu-deploy-ready

2. 无需重启服务，静态文件会自动更新   chmod 644 /root/ubuntu-deploy-ready/customer_service.db

   chmod +x /root/ubuntu-deploy-ready/customer-service-backend

## 📞 技术支持   ```



### 常见问题3. **Sea-ORM 数据库问题**

   ```bash

1. **500 Internal Server Error**: 通常是数据库权限问题，运行 `./scripts/quick-fix.sh`   # 检查数据库文件是否可访问

2. **连接超时**: 检查防火墙和端口配置   cd /root/ubuntu-deploy-ready

3. **SSL警告**: 使用自签名证书时正常，可忽略或申请Let's Encrypt证书   ls -la customer_service.db

   

### 联系方式   # 检查环境变量

   cat .env | grep DATABASE_URL

- **项目**: ELonTalk 多店铺客服系统   

- **邮箱**: siwmm@163.com   # 测试数据库连接

- **架构**: Rust + React + WebSocket + HTTPS   sqlite3 customer_service.db ".tables"

   ```

---

3. **防火墙问题**

**最后更新**: 2025年10月14日     ```bash

**版本**: v2.0     sudo ufw status

**适用系统**: Ubuntu Server 24.04 LTS   sudo ufw allow 8080/tcp
   sudo ufw allow 8443/tcp
   ```

4. **证书问题**
   ```bash
   # 检查证书文件
   ls -la /root/ubuntu-deploy-ready/certs/
   
   # 验证证书
   openssl x509 -in /root/ubuntu-deploy-ready/certs/server.crt -text -noout
   ```

### 重新部署
```bash
# 停止服务
cd /root/ubuntu-deploy-ready
./scripts/start.sh stop

# 备份数据库
cp customer_service.db customer_service.db.backup

# 重新上传文件并重新部署
# ... 上传新文件 ...

# 恢复数据库并启动
cp customer_service.db.backup customer_service.db
./scripts/fix-database.sh
./scripts/start.sh start
```

## 📊 系统要求

- **操作系统**: Ubuntu 16.04+ (推荐 Ubuntu 20.04/22.04/24.04)
- **内存**: 最小 512MB，推荐 1GB+
- **磁盘**: 最小 100MB 可用空间
- **网络**: 开放 8080 (HTTP) 和 8443 (HTTPS) 端口
- **权限**: 以 root 用户运行 (部署在 /root/ubuntu-deploy-ready/)
- **数据库**: 内置 SQLite + Sea-ORM (自动迁移)

## 🔄 更新升级

1. 备份配置和数据库：
   ```bash
   cd /root/ubuntu-deploy-ready
   cp .env .env.backup
   cp customer_service.db customer_service.db.backup
   ```

2. 停止服务：
   ```bash
   ./scripts/start.sh stop
   ```

3. 替换二进制文件：
   ```bash
   # 上传新的 customer-service-backend 文件
   chmod +x customer-service-backend
   ```

4. 启动服务：
   ```bash
   ./scripts/start.sh start
   ```

## 📧 支持联系

- **项目地址**: https://github.com/ElonQian1/QuickTalk-
- **管理员邮箱**: siwmm@163.com
- **服务器IP**: 43.139.82.12

---

**部署包版本**: 1.0  
**编译时间**: 2025年10月14日  
**架构**: x86_64-unknown-linux-musl (静态链接，零依赖)  
**功能**: 完整HTTPS支持，智能模式切换