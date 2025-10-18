# ELonTalk 客服系统 - Ubuntu 部署指南

## 📋 部署信息

- **部署路径**: `/root/ubuntu-deploy-ready/`
- **服务器IP**: `43.139.82.12`
- **域名**: `elontalk.duckdns.org`
- **HTTPS端口**: `8443`
- **HTTP端口**: `8080`

## 🚀 快速部署

### 1. 上传文件到服务器

在 Windows 本地执行：
```powershell
scp -r ubuntu-deploy-ready root@43.139.82.12:/root/
```

### 2. SSH 登录服务器

```bash
ssh root@43.139.82.12
```

### 3. 进入项目目录

```bash
cd /root/ubuntu-deploy-ready
```

### 4. 启动生产服务

```bash
chmod +x start-production.sh
./start-production.sh
```

## 📦 部署包内容

```
ubuntu-deploy-ready/
├── customer-service-backend     # 后端可执行文件（11.1 MB，静态链接）
├── .env.production              # 生产环境配置（HTTPS + ACME）
├── .env.staging                 # 测试环境配置
├── database_schema.sql          # 数据库架构（仅参考，使用 Sea-ORM 自动迁移）
├── start-production.sh          # 生产环境启动脚本
├── deploy.sh                    # systemd 服务部署脚本
├── customer-service.service     # systemd 服务配置
├── static/                      # 前端静态文件
│   ├── index.html
│   ├── static/
│   └── ...
└── certs/                       # HTTPS 证书目录
    ├── server.crt
    └── server.key
```

## 🔐 HTTPS 证书说明

### 自动申请（推荐）

生产环境已配置 ACME 自动证书申请：
- 首次启动会自动从 Let's Encrypt 申请证书
- 使用 DNS-01 验证（通过 DuckDNS）
- 证书自动续期（提前 30 天）

### 证书位置

- 证书文件: `certs/server.crt`
- 私钥文件: `certs/server.key`

## ⚙️ 环境配置

### 生产环境 (.env.production)

- **数据库**: SQLite (Sea-ORM 自动迁移)
- **TLS 模式**: HTTPS
- **ACME**: 启用（Let's Encrypt Production）
- **域名**: elontalk.duckdns.org
- **端口**: 8443 (HTTPS), 8080 (HTTP)

## 📊 服务管理

### 使用脚本启动（推荐）

```bash
./start-production.sh
```

### 使用 systemd 服务

```bash
# 部署服务
./deploy.sh

# 启动服务
systemctl start customer-service.service

# 查看状态
systemctl status customer-service.service

# 查看日志
journalctl -u customer-service.service -f

# 停止服务
systemctl stop customer-service.service

# 重启服务
systemctl restart customer-service.service
```

## 🔍 故障排查

### 查看运行日志

```bash
tail -f logs/app.log
```

### 查看证书申请日志

```bash
grep -i "acme\|certificate" logs/app.log
```

### 检查端口占用

```bash
netstat -tlnp | grep -E '8080|8443'
```

### 测试 HTTPS 连接

```bash
curl -k https://elontalk.duckdns.org:8443/
```

## 🆕 更新部署

### 1. 上传新版本

```powershell
scp -r ubuntu-deploy-ready root@43.139.82.12:/root/
```

### 2. 备份数据库（重要！）

```bash
cd /root/ubuntu-deploy-ready
cp customer_service.db customer_service.db.backup.$(date +%Y%m%d_%H%M%S)
```

### 3. 重启服务

```bash
./start-production.sh
```

## 📝 注意事项

1. **数据库迁移**: 使用 Sea-ORM 自动迁移，无需手动执行 SQL
2. **证书管理**: ACME 自动处理，无需手动操作
3. **配置保护**: 更新时会自动备份现有 .env 文件
4. **日志目录**: 确保 `logs/` 目录存在且可写

## 🔗 访问地址

- **HTTPS**: https://elontalk.duckdns.org:8443
- **HTTP**: http://43.139.82.12:8080

## 📧 支持

- **管理员**: siwmm@163.com
- **DuckDNS Token**: 400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca
