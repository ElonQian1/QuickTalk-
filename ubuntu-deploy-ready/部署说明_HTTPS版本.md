# ELonTalk 客服系统 - Ubuntu HTTPS 部署说明

## 📦 部署包信息

- **编译时间**: 2025年10月15日 23:04
- **后端版本**: v0.1.0
- **目标系统**: Ubuntu 24.04 LTS (x86_64)
- **编译方式**: Rust + Zig 交叉编译 (Windows -> Linux)
- **TLS实现**: Rustls (纯Rust，无OpenSSL依赖)
- **数据库**: SQLite + Sea-ORM 自动迁移
- **二进制大小**: 8.04 MB (静态链接，零依赖)

## 🎯 服务器信息

- **域名**: elontalk.duckdns.org
- **服务器IP**: 43.139.82.12
- **部署路径**: /root/ubuntu-deploy-ready/
- **HTTP端口**: 8080
- **HTTPS端口**: 8443
- **管理员邮箱**: siwmm@163.com

## 📁 部署包内容清单

```
ubuntu-deploy-ready/
├── customer-service-backend     # ✨ 新编译的Linux二进制文件 (8.04 MB)
├── .env                         # 环境配置文件 (HTTPS强制模式)
├── .env.example                 # 配置示例
├── customer-service.service     # systemd 服务配置
├── deploy.sh                    # 全自动部署脚本
├── start.sh                     # 智能启动脚本 (支持HTTPS)
├── setup-https.sh               # HTTPS证书设置脚本
├── check_users.sh               # 用户检查脚本
├── create_test_user.sh          # 测试用户创建脚本
├── deploy-check.sh              # 部署检查脚本
├── certs/                       # SSL证书目录
│   ├── server.crt              # 服务器证书
│   ├── server.key              # 私钥文件
│   ├── server.crt.backup       # 证书备份
│   ├── server.key.backup       # 私钥备份
│   └── dev-server.crt          # 开发证书
├── static/                      # 前端静态文件 (React build)
│   ├── index.html
│   ├── asset-manifest.json
│   ├── manifest.json
│   ├── robots.txt
│   ├── static/
│   │   ├── css/                # 样式文件
│   │   ├── js/                 # JavaScript文件
│   │   └── media/              # 媒体资源
│   ├── sdk/                    # WebSocket SDK
│   └── embed/                  # 嵌入式组件
└── 文档/
    ├── README.md               # 项目说明
    ├── QUICKSTART.md           # 快速开始指南
    ├── 部署清单.md
    ├── 部署总结.md
    ├── 部署检查报告.md
    ├── 代码审查报告.md
    ├── 最终部署检查.md
    ├── 上传指南.md
    └── 部署说明_HTTPS版本.md  # 本文件
```

## 🚀 部署步骤

### 1️⃣ 上传部署包到服务器

```bash
# 使用 SCP 上传整个目录（从 Windows）
scp -r E:\duihua\customer-service-system\ubuntu-deploy-ready root@43.139.82.12:/root/

# 或使用 SFTP、FileZilla 等工具上传
# 目标路径: /root/ubuntu-deploy-ready/
```

### 2️⃣ 连接服务器

```bash
ssh root@43.139.82.12
```

### 3️⃣ 进入部署目录

```bash
cd /root/ubuntu-deploy-ready
```

### 4️⃣ 运行全自动部署脚本

```bash
chmod +x deploy.sh
./deploy.sh
```

部署脚本会自动完成：
- ✅ 系统更新
- ✅ 安装必要工具
- ✅ 文件权限设置
- ✅ 数据库初始化
- ✅ 防火墙配置 (22, 8080, 8443)
- ✅ systemd 服务安装
- ✅ 服务启动

### 5️⃣ 检查服务状态

```bash
# 查看服务状态
systemctl status customer-service

# 查看实时日志
journalctl -u customer-service -f

# 查看最近日志
journalctl -u customer-service -n 50
```

## 🔒 HTTPS 配置说明

### 当前证书配置

**证书类型**: 自签名证书（已包含在 certs/ 目录）

**证书信息**:
- 主体: CN=elontalk.duckdns.org
- 有效期: 10年
- 位置: /root/ubuntu-deploy-ready/certs/

### 环境变量配置 (.env)

```bash
# HTTPS 强制模式
TLS_MODE=https                    # 强制 HTTPS
TLS_PORT=8443                     # HTTPS 端口
ENABLE_HTTP_REDIRECT=true         # HTTP 重定向到 HTTPS

# 证书路径（相对路径）
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key
```

### 升级到受信任证书

如需升级到受信任的 SSL 证书（推荐用于生产环境）：

```bash
# 使用 setup-https.sh 脚本自动申请 Let's Encrypt 证书
chmod +x setup-https.sh
./setup-https.sh
```

脚本会自动：
1. 安装 certbot
2. 配置 DuckDNS Token
3. 申请 Let's Encrypt 证书
4. 更新 .env 配置
5. 重启服务

## 🌐 访问地址

部署成功后，可通过以下方式访问：

### HTTPS 访问（推荐）
- **域名**: https://elontalk.duckdns.org:8443
- **IP**: https://43.139.82.12:8443

### HTTP 访问（会自动重定向到 HTTPS）
- **域名**: http://elontalk.duckdns.org:8080
- **IP**: http://43.139.82.12:8080

## 🔧 常用管理命令

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

# 启用开机自启
systemctl enable customer-service

# 禁用开机自启
systemctl disable customer-service
```

### 日志管理
```bash
# 查看实时日志
journalctl -u customer-service -f

# 查看最近50条日志
journalctl -u customer-service -n 50

# 查看今天的日志
journalctl -u customer-service --since today

# 查看错误日志
journalctl -u customer-service -p err
```

### 数据库管理
```bash
# 备份数据库
cp customer_service.db customer_service_backup_$(date +%Y%m%d).db

# 查看数据库大小
ls -lh customer_service.db

# 检查数据库完整性
sqlite3 customer_service.db "PRAGMA integrity_check;"
```

### 防火墙管理
```bash
# 查看防火墙状态
ufw status verbose

# 查看开放端口
ufw status numbered

# 允许新端口（如果需要）
ufw allow 端口号/tcp

# 删除规则
ufw delete 规则号
```

## 📊 系统要求

- **操作系统**: Ubuntu 24.04 LTS (推荐) 或 Ubuntu 22.04 LTS
- **架构**: x86_64 (amd64)
- **内存**: 最低 512MB，推荐 1GB+
- **磁盘**: 最低 100MB，推荐 1GB+（含数据库增长空间）
- **网络**: 开放 22, 8080, 8443 端口

## 🔍 故障排查

### 1. 服务启动失败

```bash
# 查看详细错误信息
journalctl -u customer-service -n 100 --no-pager

# 检查端口占用
netstat -tulpn | grep -E '8080|8443'

# 检查文件权限
ls -la /root/ubuntu-deploy-ready/
```

### 2. 数据库权限错误

```bash
# 修复数据库权限
cd /root/ubuntu-deploy-ready
chmod 755 .
chmod 644 customer_service.db
```

### 3. 证书错误

```bash
# 验证证书文件
openssl x509 -in certs/server.crt -text -noout

# 检查证书权限
ls -la certs/
chmod 644 certs/server.crt
chmod 600 certs/server.key
```

### 4. 防火墙问题

```bash
# 检查防火墙状态
ufw status verbose

# 重新配置防火墙
ufw --force reset
ufw allow 22/tcp
ufw allow 8080/tcp
ufw allow 8443/tcp
ufw --force enable
```

### 5. 浏览器证书警告

**原因**: 使用自签名证书

**解决方案**:
- 临时方案: 点击"高级" -> "继续访问"（不安全）
- 永久方案: 使用 `setup-https.sh` 申请 Let's Encrypt 证书

## 📝 重要提醒

1. ⚠️ **首次访问**: 由于使用自签名证书，浏览器会显示安全警告，这是正常的
2. 🔒 **生产环境**: 强烈建议使用 Let's Encrypt 证书替换自签名证书
3. 💾 **数据备份**: 定期备份 `customer_service.db` 数据库文件
4. 🔐 **密钥安全**: 保护好 `certs/server.key` 私钥文件，设置权限为 600
5. 🌐 **域名配置**: 确保 DuckDNS 域名正确解析到服务器 IP
6. 🔥 **防火墙**: 确认云服务商安全组也开放了 8080 和 8443 端口
7. 📊 **数据库**: Sea-ORM 会在首次启动时自动创建表结构，无需手动迁移

## 🏗️ 架构特点

- **静态链接**: 二进制文件无外部依赖，直接运行
- **Rustls TLS**: 纯 Rust TLS 实现，无 OpenSSL 依赖
- **Sea-ORM**: 现代化 ORM，自动数据库迁移
- **零配置**: 开箱即用，自动检测和初始化
- **高性能**: Tokio 异步运行时，支持高并发
- **内存安全**: Rust 保证内存安全和线程安全

## 📞 支持信息

- **项目地址**: https://github.com/ElonQian1/QuickTalk-
- **文档**: 查看 `QUICKSTART.md` 和 `README.md`
- **问题反馈**: 通过 GitHub Issues

---

**部署包创建时间**: 2025年10月15日 23:04  
**文档版本**: v1.0  
**适用系统**: Ubuntu 24.04 LTS
