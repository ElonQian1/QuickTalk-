# ELonTalk 客服系统 - Ubuntu 部署包

## 📋 部署信息

- **项目**: 多店铺客服系统
- **架构**: Rust 后端 + React 前端 + Sea-ORM + Rustls HTTPS
- **目标系统**: Ubuntu Server 24.04 LTS
- **部署路径**: `/root/ubuntu-deploy-ready/`
- **编译特性**: 静态链接，零依赖部署

## 🚀 快速部署 (3 分钟完成)

### 1. 上传部署包
```bash
# 将整个 ubuntu-deploy-ready 文件夹上传到服务器
scp -r ubuntu-deploy-ready root@43.139.82.12:/root/
```

### 2. 一键启动
```bash
ssh root@43.139.82.12
cd /root/ubuntu-deploy-ready
chmod +x start.sh
./start.sh
```

### 3. 配置系统服务 (可选)
```bash
# 复制服务文件
cp customer-service.service /etc/systemd/system/

# 启用并启动服务
systemctl daemon-reload
systemctl enable customer-service
systemctl start customer-service

# 查看服务状态
systemctl status customer-service
```

## 📁 文件结构

```
ubuntu-deploy-ready/
├── customer-service-backend     # Rust 二进制文件 (8.4MB)
├── static/                      # React 前端静态文件
│   ├── index.html              # 管理后台首页
│   ├── static/js/main.js       # React 应用
│   ├── static/css/main.css     # 样式文件
│   └── manifest.json           # PWA 配置
├── certs/                      # SSL 证书文件
│   ├── server.crt             # SSL 证书
│   └── server.key             # 私钥
├── .env                       # 环境配置文件
├── start.sh                   # 智能启动脚本
├── customer-service.service   # systemd 服务配置
└── README.md                  # 本文件
```

## 🌐 访问地址

### HTTP 访问
- **服务器IP**: http://43.139.82.12:8080
- **域名访问**: http://elontalk.duckdns.org:8080

### HTTPS 访问 (推荐)
- **服务器IP**: https://43.139.82.12:8443
- **域名访问**: https://elontalk.duckdns.org:8443

## ⚙️ 配置说明

### 环境变量 (.env)
```bash
# 数据库配置 (Sea-ORM 自动处理)
DATABASE_URL=sqlite:customer_service.db

# 安全配置
JWT_SECRET=elontalk-prod-secret-2025-change-in-production-env

# 服务器配置
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# HTTPS 配置
HTTPS_ENABLED=true
TLS_MODE=https
TLS_PORT=8443
TLS_DOMAIN=elontalk.duckdns.org
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key
```

### 防火墙配置
启动脚本会自动配置防火墙，开放必要端口：
```bash
ufw allow 22/tcp    # SSH
ufw allow 8080/tcp  # HTTP
ufw allow 8443/tcp  # HTTPS
ufw enable
```

## 🔧 常用命令

### 服务管理
```bash
# 启动服务
./start.sh

# 使用 systemd 管理
systemctl start customer-service
systemctl stop customer-service
systemctl restart customer-service
systemctl status customer-service

# 查看日志
journalctl -u customer-service -f
```

### 数据库管理
```bash
# Sea-ORM 会自动创建和迁移数据库
# 手动查看数据库 (可选)
sqlite3 customer_service.db ".tables"
sqlite3 customer_service.db "SELECT COUNT(*) FROM users;"
```

### 证书更新
```bash
# 替换证书文件后重启服务
cp new_server.crt certs/server.crt
cp new_server.key certs/server.key
systemctl restart customer-service
```

## 🛠 技术特性

### 后端 (Rust)
- **框架**: Axum + Tokio
- **ORM**: Sea-ORM (自动迁移)
- **TLS**: Rustls (纯 Rust 实现)
- **数据库**: SQLite (嵌入式)
- **认证**: JWT + bcrypt
- **WebSocket**: 原生支持

### 前端 (React)
- **框架**: React 18 + TypeScript
- **状态管理**: Zustand
- **样式**: Styled Components
- **构建**: 优化的生产构建

### 部署优势
- ✅ **零依赖**: 静态编译，无需安装额外库
- ✅ **高性能**: Rust 原生性能 + React 优化
- ✅ **安全**: Rustls 内存安全 TLS 实现
- ✅ **简单**: 单一二进制文件部署
- ✅ **现代**: Sea-ORM 现代化数据库操作

## 🔍 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   ss -tlnp | grep :8080
   # 停止占用进程
   systemctl stop customer-service
   ```

2. **证书问题**
   ```bash
   # 检查证书文件
   ls -la certs/
   # 验证证书有效性
   openssl x509 -in certs/server.crt -text -noout
   ```

3. **数据库权限**
   ```bash
   # 修复数据库权限
   chmod 644 customer_service.db
   chmod 755 /root/ubuntu-deploy-ready
   ```

4. **查看详细日志**
   ```bash
   # 直接运行查看错误
   ./customer-service-backend
   # 或查看系统日志
   journalctl -u customer-service -n 50
   ```

## 📊 性能信息

- **二进制大小**: 8.4MB
- **内存占用**: ~10MB (空闲状态)
- **启动时间**: <2 秒
- **并发连接**: 支持数千并发 WebSocket 连接
- **数据库**: SQLite 单文件，支持高并发读写

## 🔐 安全配置

- JWT 令牌认证
- bcrypt 密码哈希
- HTTPS/TLS 1.3 加密
- CORS 跨域保护
- 输入验证和 SQL 注入防护
- 内存安全的 Rust 实现

---

**部署日期**: 2025年10月15日  
**架构版本**: v1.2 (Sea-ORM + Rustls)  
**维护者**: ELonTalk 团队

如有问题，请检查日志文件或联系技术支持。