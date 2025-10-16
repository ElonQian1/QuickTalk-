# ELonTalk 客服系统 - 生产环境部署总结

我的项目都部署在 /root/ubuntu-deploy-ready/
不要 帮我采用任何/opt的路径
我就已经是管理员身份登录到Ubuntu服务器了
 我的项目 采用 Sea-ORM 架构  自动部署数据库


## 📋 服务器信息

- **duckDns域名token**: 400bfeb6-b2fe-40e8-8cb6-7d38a2b943ca
- **域名**: http://elontalk.duckdns.org
- **系统**: Ubuntu Server 24.04 LTS 64bit
- **服务器IP**: 43.139.82.12
- **管理员邮箱**: siwmm@163.com
- **部署路径**: /root/ubuntu-deploy-ready (自定义目录)

## 🎯 最终访问地址

- **HTTP访问**: http://43.139.82.12:8080
- **域名访问**: http://elontalk.duckdns.org:8080 (需要DNS配置)
- **HTTPS访问**: https://elontalk.duckdns.org:8443 (需要SSL证书)

## ❌ 部署过程中遇到的主要问题

### 1. 数据库权限问题
**问题**: `Error: error returned from database: (code: 14) unable to open database file`

**原因**: 以root用户运行但SQLite数据库文件权限不正确

**解决方案**:
```bash
chmod 755 /root/ubuntu-deploy-ready
touch customer_service.db  
chmod 644 customer_service.db
```

### 2. 防火墙配置问题
**问题**: 外网无法访问服务，防火墙状态为 `inactive`

**解决方案**:
```bash
ufw allow 22/tcp    # SSH
ufw allow 8080/tcp  # HTTP
ufw allow 8443/tcp  # HTTPS
ufw --force enable
```

### 3. 静态文件404问题 ⭐ **核心问题**
**问题**: 前端管理界面无法加载，所有静态资源返回404

**根本原因**: Rust后端的静态文件路由配置问题
- 根路径 `/` 只返回API信息，没有返回前端页面
- 静态文件路径映射不正确（"套娃"路径问题）

**修复过程**:

#### 3.1 添加根路径处理
```rust
// 修改前: 
.route("/", get(|| async { "Customer Service System API" }))

// 修改后:
.route("/", get(handlers::static_files::serve_index))
```

#### 3.2 修复静态文件路径映射
**问题**: 前端请求 `/static/js/main.js`，但实际文件位置是 `static/static/js/main.js`

**解决**: 修改 `serve_static_file` 函数，优先查找嵌套路径:
```rust
// 首先尝试: static/static/js/main.js
let nested_path = static_dir.join("static").join(&file_path);
// 回退尝试: static/js/main.js  
let full_path = static_dir.join(&file_path);
```

#### 3.3 添加完整的静态文件支持
```rust
.route("/favicon.svg", get(handlers::static_files::serve_favicon_svg))
.route("/manifest.json", get(handlers::static_files::serve_manifest))
.fallback(handlers::static_files::serve_spa_fallback)
```

## ✅ 最终解决方案

### 架构设计
- **单一Rust服务器**: 同时提供前端界面、API服务、WebSocket通信
- **零依赖部署**: 静态编译的Linux二进制文件，无需额外Web服务器
- **智能HTTPS**: 支持HTTP/HTTPS智能切换

### 文件结构
```
/root/ubuntu-deploy-ready/
├── customer-service-backend    # Rust二进制文件 (7MB)
├── .env                       # 配置文件
├── static/                    # 前端静态文件
│   ├── index.html            # 管理后台首页
│   ├── static/js/main.js     # React应用
│   ├── favicon.svg           # 图标
│   └── manifest.json         # PWA配置
├── start.sh                  # 智能启动脚本
└── customer-service.service  # 系统服务配置
```

### 服务访问映射
| 路径 | 功能 | 实际文件 |
|------|------|----------|
| `/` | 客服管理后台 | `static/index.html` |
| `/api/*` | REST API | Rust处理器 |
| `/ws/*` | WebSocket | Rust处理器 |
| `/static/js/*` | 前端资源 | `static/static/js/*` |

## 🔧 当前配置

### 环境变量 (.env)
```bash
DATABASE_URL=sqlite:customer_service.db
JWT_SECRET=elontalk-prod-secret-2025-change-in-production
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
TLS_MODE=auto
TLS_PORT=8443
TLS_DOMAIN=elontalk.duckdns.org
```

### 网络配置
- **HTTP端口**: 8080 ✅ 已开放
- **HTTPS端口**: 8443 ✅ 已开放
- **SSH端口**: 22 ✅ 已开放

## 💡 经验教训

1. **不要使用额外的Web服务器**: Rust后端足以提供完整的Web服务
2. **注意静态文件路径**: 前端构建时的嵌套目录结构需要后端正确映射
3. **root用户部署**: 可行但需要注意文件权限
4. **防火墙必须启用**: Ubuntu默认防火墙未激活
5. **模块化架构的优势**: 清晰的handlers/services分层便于问题定位

## 🚀 下一步计划

1. **配置HTTPS**: 使用Let's Encrypt获取免费SSL证书
2. **系统服务**: 配置systemd自动启动
3. **域名解析**: 确保elontalk.duckdns.org正确指向服务器IP
4. **监控告警**: 配置服务状态监控

---

**部署日期**: 2025年10月13日  
**状态**: ✅ HTTP服务正常运行  
**访问**: http://43.139.82.12:8080
服务器 ip :43.139.82.12:8080
管理员 邮箱：siwmm@163.com

项目不一定放子opt 项目下

## 🔐 ACME 自动证书签发/续期（内置模块）

为简化生产配置，已集成 ACME 骨架模块，支持在 HTTPS 启动前自动确认证书是否存在、是否需要续期；当检测到启用 ACME 但证书缺失时，目前会给出清晰错误提示（后续将逐步实现全自动签发）。

环境变量（.env）

```
# 开关与目录
ACME_ENABLED=true
ACME_DIRECTORY_URL=https://acme-v02.api.letsencrypt.org/directory   # 正式环境；开发建议使用 staging 目录
ACME_EMAIL=your-admin@email.com
ACME_DOMAINS=elontalk.duckdns.org
ACME_CHALLENGE=dns-01   # 推荐 dns-01，避免 80/443 端口限制

# DuckDNS（dns-01 首选）
DUCKDNS_DOMAIN=elontalk
DUCKDNS_TOKEN=your-duckdns-token

# 证书路径（与 TLS_* 保持一致）
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key

# 提前续期天数（可选，默认30）
RENEW_BEFORE_DAYS=30
```

注意事项
- 首次接入建议使用 Let’s Encrypt Staging 目录，避免触发配额限制：
	- ACME_DIRECTORY_URL=https://acme-staging-v02.api.letsencrypt.org/directory
- 当前为“骨架实现”，若 ACME_ENABLED=true 且未检测到证书，将报错并提示从文档获取证书或配置 DuckDNS 凭据。
- 一旦颁发成功，证书将写入 TLS_CERT_PATH/TLS_KEY_PATH，并由 HTTPS 服务直接加载。