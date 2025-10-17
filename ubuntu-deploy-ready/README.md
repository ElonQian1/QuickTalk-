# Ubuntu 部署包

## 📦 包含内容

```
ubuntu-deploy-ready/
├── customer-service-backend    # 后端可执行文件 (10.7MB, HTTPS支持)
├── .env                        # 生产环境配置
├── .env.production             # 生产环境备份
├── .env.staging                # 预发布环境配置
├── customer-service.service    # systemd 服务文件
├── deploy.sh                   # 自动部署脚本
├── start-foreground.sh         # 前台调试脚本
├── certs/                      # SSL证书目录
│   ├── server.crt             # SSL证书
│   └── server.key             # 私钥
└── static/                     # 前端静态文件
    ├── index.html
    └── ...
```

## 🚀 快速部署（推荐）

### 1. 上传整个文件夹到服务器

```bash
# 在Ubuntu服务器上
cd /root
# 假设你已通过 FTP/SFTP 上传到 /root/ubuntu-deploy-ready
```

### 2. 执行自动部署

```bash
cd /root/ubuntu-deploy-ready
chmod +x deploy.sh
./deploy.sh
```

部署脚本会自动：
- ✅ 设置可执行权限
- ✅ 停止旧服务
- ✅ 安装 systemd 服务
- ✅ 启动新服务

## 🔍 手动部署（调试用）

### 前台运行测试

```bash
cd /root/ubuntu-deploy-ready
chmod +x start-foreground.sh
./start-foreground.sh
```

前台模式可以直接看到所有日志输出，适合调试。

### 使用 systemd 服务

```bash
# 安装服务
cp customer-service.service /etc/systemd/system/
systemctl daemon-reload

# 启动服务
systemctl start customer-service.service

# 设置开机自启
systemctl enable customer-service.service

# 查看状态
systemctl status customer-service.service

# 查看日志
journalctl -u customer-service.service -f
```

## 🌐 访问地址

- **HTTPS**: https://elontalk.duckdns.org:8443
- **管理后台**: https://elontalk.duckdns.org:8443

## 🔐 HTTPS 配置

### 当前配置
- ✅ **TLS模式**: 强制HTTPS
- ✅ **端口**: 8443
- ✅ **域名**: elontalk.duckdns.org
- ✅ **ACME**: 自动证书签发（Let's Encrypt）
- ✅ **DNS提供商**: DuckDNS

### 证书自动续期
系统会自动检测证书过期时间，在到期前30天自动续期。

### 手动触发证书更新
如需手动更新证书：
```bash
systemctl restart customer-service.service
```

## 📊 日志查看

```bash
# 实时日志
journalctl -u customer-service.service -f

# 最近100行
journalctl -u customer-service.service -n 100

# 今天的日志
journalctl -u customer-service.service --since today
```

## 🛠️ 常用命令

```bash
# 重启服务
systemctl restart customer-service.service

# 停止服务
systemctl stop customer-service.service

# 查看状态
systemctl status customer-service.service

# 查看详细错误
journalctl -u customer-service.service -xe
```

## 🔧 故障排查

### 服务启动失败

```bash
# 1. 查看详细日志
journalctl -u customer-service.service -xe

# 2. 检查权限
ls -la /root/ubuntu-deploy-ready/customer-service-backend

# 3. 检查环境变量
cat /root/ubuntu-deploy-ready/.env

# 4. 前台运行调试
cd /root/ubuntu-deploy-ready
./start-foreground.sh
```

### 数据库问题

```bash
# 检查数据库文件
ls -lh customer_service.db

# 数据库会自动创建，无需手动操作
```

### 证书问题

```bash
# 检查证书文件
ls -lh certs/

# 确保证书可读
chmod 644 certs/server.crt
chmod 600 certs/server.key
```

## 📋 环境变量说明

关键配置（在 `.env` 文件中）：

```bash
# 数据库
DATABASE_URL=sqlite:/root/ubuntu-deploy-ready/customer_service.db

# HTTPS
TLS_MODE=https
TLS_PORT=8443
TLS_DOMAIN=elontalk.duckdns.org

# ACME 证书
ACME_ENABLED=true
ACME_EMAIL=siwmm@163.com
ACME_DOMAINS=elontalk.duckdns.org

# DuckDNS
DUCKDNS_DOMAIN=elontalk
DUCKDNS_TOKEN=400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca
```

## 🎯 技术特性

- ✅ **零依赖**: 静态链接，无需安装任何运行时
- ✅ **纯Rust TLS**: 使用 Rustls，避免 OpenSSL 依赖
- ✅ **自动证书**: Let's Encrypt 自动签发和续期
- ✅ **ORM自动迁移**: Sea-ORM 自动管理数据库结构
- ✅ **WebSocket**: 实时双向通信
- ✅ **完整前端**: React SPA 单页应用

## 📝 更新部署

```bash
# 1. 停止服务
systemctl stop customer-service.service

# 2. 备份数据库
cp customer_service.db customer_service.db.backup

# 3. 替换新文件
# (上传新的 customer-service-backend)

# 4. 重新部署
./deploy.sh
```

## 🆘 需要帮助？

- 查看日志: `journalctl -u customer-service.service -f`
- 前台调试: `./start-foreground.sh`
- 检查状态: `systemctl status customer-service.service`
