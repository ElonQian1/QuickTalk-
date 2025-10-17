## Ubuntu 部署检查清单

### ✅ 已准备的文件

#### 1. 后端二进制文件
- `customer-service-backend` (10.7 MB)
- 编译目标: x86_64-unknown-linux-musl
- 功能: 支持 HTTPS + ACME 自动证书

#### 2. 前端静态文件
- 目录: `static/`
- 已编译的 React 生产构建

#### 3. 配置文件
- `.env` - 当前环境配置（已设置为生产环境）
- `.env.production` - 生产环境模板
- `.env.staging` - 预发布环境模板

#### 4. 证书文件夹
- `certs/` - 存放 SSL 证书（程序会自动获取）

#### 5. 启动脚本
- `quick-start.sh` - 快速启动脚本
- `start-foreground.sh` - 前台运行脚本
- `deploy.sh` - 完整部署脚本

#### 6. 数据库
- `database_schema.sql` - 数据库结构参考
- Sea-ORM 会在首次运行时自动创建数据库

---

### 🚀 部署步骤

#### 在 Ubuntu 服务器上执行：

```bash
# 1. 进入部署目录
cd /root/ubuntu-deploy-ready

# 2. 设置执行权限
chmod +x *.sh
chmod +x customer-service-backend

# 3. 快速启动（推荐）
./quick-start.sh
```

---

### 🔐 HTTPS 配置说明

程序会自动：
1. 通过 DuckDNS 更新 DNS TXT 记录
2. 向 Let's Encrypt 申请证书
3. 证书保存到 `certs/` 目录
4. 在到期前 30 天自动续期

**首次启动可能需要 2-5 分钟获取证书**

---

### 📋 环境变量说明

关键配置（在 `.env` 文件中）：

```bash
# HTTPS 配置
TLS_MODE=https                          # 强制 HTTPS
TLS_PORT=8443                           # HTTPS 端口
TLS_DOMAIN=elontalk.duckdns.org        # 域名

# ACME 证书
ACME_ENABLED=true                       # 启用自动证书
ACME_DIRECTORY_URL=https://acme-v02.api.letsencrypt.org/directory
ACME_EMAIL=siwmm@163.com               # 管理员邮箱
ACME_DOMAINS=elontalk.duckdns.org      # 证书域名
ACME_CHALLENGE=dns-01                   # DNS 验证

# DuckDNS（DNS-01 验证必需）
DUCKDNS_DOMAIN=elontalk
DUCKDNS_TOKEN=400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca

# 数据库
DATABASE_URL=sqlite:/root/ubuntu-deploy-ready/customer_service.db
```

---

### 🌐 访问地址

- **HTTPS**: https://elontalk.duckdns.org:8443
- **API**: https://elontalk.duckdns.org:8443/api
- **WebSocket**: wss://elontalk.duckdns.org:8443/ws

---

### 🔍 故障排查

#### 检查服务状态
```bash
ps aux | grep customer-service-backend
```

#### 查看日志
```bash
# 程序会输出到标准输出
# 如果使用 systemd，查看日志：
journalctl -u customer-service -f
```

#### 检查证书
```bash
ls -lh certs/
openssl x509 -in certs/server.crt -text -noout
```

#### 测试 HTTPS
```bash
curl -I https://elontalk.duckdns.org:8443/api/health
```

---

### ⚠️ 注意事项

1. **端口开放**: 确保防火墙允许 8443 端口
   ```bash
   ufw allow 8443/tcp
   ```

2. **DuckDNS 配置**: 确保域名已正确设置并可解析
   ```bash
   nslookup elontalk.duckdns.org
   ```

3. **Let's Encrypt 限制**: 
   - 每个域名每周最多 50 个证书
   - 失败过多会被临时封禁

4. **Sea-ORM 数据库**: 首次运行会自动创建表结构

---

### 📦 文件清单

```
/root/ubuntu-deploy-ready/
├── customer-service-backend    # 后端二进制
├── .env                        # 环境配置
├── .env.production            # 生产环境模板
├── quick-start.sh             # 快速启动脚本
├── database_schema.sql        # 数据库结构参考
├── certs/                     # SSL 证书目录（自动生成）
└── static/                    # 前端静态文件
    ├── index.html
    ├── static/
    │   ├── css/
    │   └── js/
    └── ...
```

---

**编译时间**: 2025-10-17 16:32
**编译系统**: Windows 11
**目标系统**: Ubuntu 24.04 LTS (x86_64)
**架构**: Sea-ORM + Axum + Rustls
