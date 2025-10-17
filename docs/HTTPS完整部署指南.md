# ELonTalk 客服系统 - 完整生产部署指南 v2.0

## 🎯 部署架构

- **部署路径**: `/root/ubuntu-deploy-ready/` (固定，管理员权限)
- **数据库**: Sea-ORM 自动迁移 SQLite
- **证书管理**: ACME 自动申请/续期 (Let's Encrypt) ✅
- **服务器映射**: 本地 `E:\duihua\customer-service-system\ubuntu-deploy-ready` ↔ Ubuntu `/root/ubuntu-deploy-ready/`

## ⚠️ 重要提示：智能更新部署

**问题**: 每次编译/上传都会重置服务器配置和证书  
**解决**: 使用智能部署脚本，自动备份和恢复关键文件

### 🔧 部署流程
```bash
# 1. 上传整个 ubuntu-deploy-ready 文件夹到服务器
scp -r ubuntu-deploy-ready/ root@43.139.82.12:/root/

# 2. 使用智能部署脚本（推荐）
cd /root/ubuntu-deploy-ready
chmod +x 智能更新部署.sh
./智能更新部署.sh

# 3. 或使用原始启动脚本
./start.sh
```

**智能部署功能**:
- ✅ 自动备份现有证书和数据库
- ✅ 更新后端程序和前端文件  
- ✅ 智能合并配置文件
- ✅ 保留生产环境 ACME 设置
- ✅ 恢复数据完整性

## 📋 服务器信息

- **duckDns域名token**: 400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca
- **域名**: https://elontalk.duckdns.org:8443 🔒
- **系统**: Ubuntu Server 24.04 LTS 64bit
- **服务器IP**: 43.139.82.12
- **管理员邮箱**: siwmm@163.com
- **部署路径**: /root/ubuntu-deploy-ready

## 🎯 访问地址

- **生产 HTTPS**: https://elontalk.duckdns.org:8443 🔒（浏览器信任）
- **备用 HTTP**: http://43.139.82.12:8080
- **管理后台**: 同上地址，自动加载 React 前端

## 🔐 ACME 自动证书管理（完整实现） ✅

系统已完整集成 ACME 自动证书申请和续期功能，支持 Let's Encrypt 生产环境，**已通过真机验证**。

### ✅ 已验证功能
- **自动申请**: 首次启动自动申请 SSL 证书 ✅
- **DNS-01 验证**: 通过 DuckDNS 自动设置 TXT 记录 ✅  
- **自动续期**: 证书到期前自动续签 ✅
- **智能回退**: 证书申请失败时使用自签名证书 ✅

### 🔧 生产环境配置 (.env)

```bash
# ELonTalk 客服系统 - Ubuntu 生产环境配置

# ========== 数据库配置 ==========
DATABASE_URL=sqlite:/root/ubuntu-deploy-ready/customer_service.db

# ========== JWT 安全配置 ==========
JWT_SECRET=your-super-secret-jwt-key-please-change-in-production-env-2025

# ========== 服务器配置 ==========
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# ========== HTTPS/TLS 配置（强制启用）==========
TLS_MODE=https
TLS_PORT=8443
TLS_DOMAIN=elontalk.duckdns.org
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key

# ========== ACME 自动证书配置 ==========
ACME_ENABLED=true
ACME_DIRECTORY_URL=https://acme-v02.api.letsencrypt.org/directory  # 生产环境
ACME_EMAIL=siwmm@163.com
ACME_DOMAINS=elontalk.duckdns.org
ACME_CHALLENGE=dns-01
RENEW_BEFORE_DAYS=30

# DuckDNS 配置（DNS-01 验证必需）
DUCKDNS_DOMAIN=elontalk
DUCKDNS_TOKEN=400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca

# ========== 日志配置 ==========
RUST_LOG=info,customer_service_backend=debug
RUST_BACKTRACE=1
TZ=Asia/Shanghai
```

### 🚨 环境切换指南

**测试环境** (Staging - 浏览器显示"不安全"):
```bash
ACME_DIRECTORY_URL=https://acme-staging-v02.api.letsencrypt.org/directory
```

**生产环境** (Production - 浏览器信任):
```bash
ACME_DIRECTORY_URL=https://acme-v02.api.letsencrypt.org/directory
```

### 📋 证书管理命令

```bash
# 检查证书有效期
openssl x509 -in certs/server.crt -noout -dates

# 验证证书域名
openssl x509 -in certs/server.crt -noout -subject

# 测试 HTTPS 连接
curl -I https://elontalk.duckdns.org:8443

# 强制重新申请证书
rm -f certs/server.* && ./start.sh
```

## 💾 数据库管理

### 📂 数据库文件位置
- **本地开发**: `E:\duihua\customer-service-system\服务器数据库\customer_service.db`
- **Ubuntu 服务器**: `/root/ubuntu-deploy-ready/customer_service.db`

### 🔄 数据库同步
```bash
# 从服务器下载最新数据库
scp root@43.139.82.12:/root/ubuntu-deploy-ready/customer_service.db ./服务器数据库/

# 上传本地数据库到服务器
scp ./服务器数据库/customer_service.db root@43.139.82.12:/root/ubuntu-deploy-ready/

# 智能部署会自动备份和恢复数据库
```

## 🏗️ 文件结构

### Ubuntu 服务器结构
```
/root/ubuntu-deploy-ready/
├── customer-service-backend      # Rust 二进制文件 (11.1MB)
├── .env                         # 生产环境配置
├── customer_service.db          # SQLite 数据库
├── certs/                       # SSL 证书
│   ├── server.crt              # Let's Encrypt 证书
│   └── server.key              # 私钥
├── static/                      # React 前端文件
│   ├── index.html
│   ├── static/js/main.*.js
│   └── ...
├── start.sh                     # 启动脚本
├── 智能更新部署.sh              # 智能部署脚本 ⭐
└── *.service                    # systemd 服务文件
```

### 本地开发结构
```
E:\duihua\customer-service-system\
├── backend/                     # Rust 后端源码
├── frontend/                    # React 前端源码
├── ubuntu-deploy-ready/         # 部署包 📦
├── 服务器数据库/                # 真实数据库文件
│   ├── customer_service.db     # 与服务器同步
│   ├── server.crt              # 生产证书备份
│   └── server.key              # 私钥备份
└── docs/                        # 文档
```

## 🚀 部署工作流

### 1. 开发阶段
```bash
# 修改代码后重新编译
cd backend && cargo zigbuild --release --target x86_64-unknown-linux-musl --features https

# 构建前端
cd frontend && npm run build

# 更新部署包
copy backend/target/.../customer-service-backend ubuntu-deploy-ready/
copy frontend/build/* ubuntu-deploy-ready/static/
```

### 2. 部署阶段
```bash
# 上传部署包
scp -r ubuntu-deploy-ready/ root@43.139.82.12:/root/

# 智能部署（推荐）
ssh root@43.139.82.12
cd /root/ubuntu-deploy-ready
./智能更新部署.sh
```

### 3. 验证阶段
```bash
# 检查服务状态
systemctl status customer-service

# 查看日志
journalctl -f -u customer-service

# 测试访问
curl -I https://elontalk.duckdns.org:8443
```

## 📊 部署状态总览

| 组件 | 状态 | 说明 |
|------|------|------|
| 🔧 **Rust 后端** | ✅ | 交叉编译，HTTPS 支持 |
| 🌐 **React 前端** | ✅ | 生产构建，SPA 路由 |
| 🔐 **SSL 证书** | ✅ | Let's Encrypt 自动管理 |
| 💾 **数据库** | ✅ | Sea-ORM 自动迁移 |
| 📦 **智能部署** | ✅ | 配置保护，无缝更新 |
| 🛡️ **防火墙** | ✅ | 8080/8443 端口开放 |

## 💡 经验教训与最佳实践

### ✅ 成功要点
1. **智能部署脚本**: 解决配置覆盖问题
2. **ACME 生产环境**: 确保浏览器信任证书
3. **数据库同步**: 本地与服务器数据一致性
4. **模块化架构**: handlers/services 清晰分层
5. **零依赖部署**: 单一二进制文件部署

### ⚠️ 避免问题
1. **不要直接覆盖配置**: 使用智能部署脚本
2. **不要使用 Staging 证书**: 生产环境切换 ACME_DIRECTORY_URL
3. **不要忽略数据库备份**: 每次部署前备份
4. **不要手动管理证书**: 让 ACME 自动处理
5. **不要忘记防火墙配置**: 确保端口开放

## 🔄 故障排除指南

### 问题: 浏览器显示"不安全"
**原因**: 使用了 Staging 环境证书  
**解决**: 检查 `.env` 中 `ACME_DIRECTORY_URL` 是否指向生产环境

### 问题: 每次部署都重新申请证书
**原因**: 部署包覆盖了现有证书  
**解决**: 使用 `智能更新部署.sh` 脚本

### 问题: DNS 验证失败
**原因**: DuckDNS Token 错误或网络问题  
**解决**: 验证 Token 和域名配置

### 问题: 数据库权限错误
**原因**: 文件权限不正确  
**解决**: `chmod 644 customer_service.db`

## 📞 支持信息

- **部署日期**: 2025年10月17日
- **ACME 状态**: ✅ 生产环境，自动管理
- **最后更新**: 智能部署脚本集成
- **技术支持**: siwmm@163.com

---

**🎉 部署完成**: 系统现已支持完整的 HTTPS 自动化部署！  
**🔒 安全访问**: https://elontalk.duckdns.org:8443  
**📱 管理后台**: 同上地址，React SPA 应用