# 🚀 ELonTalk 客服系统 - Ubuntu 部署包

## 📋 包信息

- **项目名称**: ELonTalk 客服系统
- **版本**: v1.0.0
- **编译日期**: 2025年10月13日
- **目标平台**: Ubuntu Server 24.04 LTS (x86_64)
- **架构**: 静态链接，零依赖部署
- **功能**: 完整HTTPS支持，智能协议切换

## 📁 文件结构

```
ubuntu-deploy-ready/
├── customer-service-backend    # 🔧 主程序 (7MB Linux二进制)
├── .env.example               # ⚙️ 配置文件模板
├── database_schema.sql        # 🗃️ 数据库架构文件
├── README.md                  # 📖 本文档
├── start.sh                   # 🤖 智能启动脚本 (推荐)
├── start-http.sh              # 🌐 HTTP模式启动脚本
├── start-https.sh             # 🔒 HTTPS模式启动脚本
├── static/                    # 📱 前端静态文件
│   ├── index.html            #     管理后台首页
│   ├── static/               #     React应用资源
│   └── ...                   #     其他前端文件
└── certs/                     # 🔐 证书目录
    └── README.md             #     证书配置说明
```

## 🚀 快速开始 (5分钟部署)

### 1️⃣ 上传文件

将整个 `ubuntu-deploy-ready` 文件夹上传到您的Ubuntu服务器。

#### 选择部署目录 (任选其一)

**选项A: 标准系统目录** `/opt/customer-service` (推荐)
```bash
# 需要sudo权限
sudo mkdir -p /opt/customer-service
sudo chown $USER:$USER /opt/customer-service
mv ubuntu-deploy-ready/* /opt/customer-service/
cd /opt/customer-service
```

**选项B: 用户主目录** `/home/用户名/customer-service` (简单)
```bash
# 无需sudo权限
mkdir -p ~/customer-service
mv ubuntu-deploy-ready/* ~/customer-service/
cd ~/customer-service
```

**选项C: 自定义目录** (完全自由)
```bash
# 替换 /your/custom/path 为您想要的路径
sudo mkdir -p /your/custom/path/customer-service
sudo chown $USER:$USER /your/custom/path/customer-service
mv ubuntu-deploy-ready/* /your/custom/path/customer-service/
cd /your/custom/path/customer-service
```

### 2️⃣ 配置环境

```bash
# 复制配置文件
cp .env.example .env

# 编辑配置 (重要: 修改JWT_SECRET和域名配置)
nano .env
```

### 3️⃣ 启动服务

```bash
# 方法1: 智能模式启动 (推荐)
chmod +x start.sh
./start.sh

# 方法2: 强制HTTP模式
chmod +x start-http.sh
./start-http.sh

# 方法3: 强制HTTPS模式 (需要先配置证书)
chmod +x start-https.sh
./start-https.sh
```

### 4️⃣ 访问系统

- **HTTP模式**: `http://您的服务器IP:8080`
- **HTTPS模式**: `https://您的域名:8443`
- **智能模式**: 自动选择最佳协议

## � 部署目录选择指南

### 🎯 推荐的部署位置

| 位置 | 适用场景 | 优点 | 权限要求 |
|------|----------|------|----------|
| `/opt/customer-service` | 生产服务器 | Linux标准，专业 | sudo |
| `~/customer-service` | 个人服务器 | 简单，无需sudo | 用户 |
| `/var/www/customer-service` | Web服务器 | Web应用标准 | sudo |
| `/usr/local/customer-service` | 系统级应用 | 系统标准位置 | sudo |

### 🔧 修改部署路径

所有脚本都会**自动检测**当前部署路径，无需手动修改！

如果您选择了非标准路径，只需要修改系统服务配置：

```bash
# 运行自动配置检测脚本
chmod +x check-deployment.sh
./check-deployment.sh

# 脚本会自动生成适合您路径的服务配置文件
```

## �🔧 配置说明

### 基础配置 (.env文件)

```bash
# 数据库配置
DATABASE_URL=sqlite:customer_service.db

# 安全配置 (必须修改!)
JWT_SECRET=your-production-secret-key-here

# 服务器配置
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# TLS配置
TLS_MODE=auto                    # auto|https|http
TLS_PORT=8443
TLS_DOMAIN=elontalk.duckdns.org
```

### TLS_MODE 选项说明

| 模式 | 说明 | 使用场景 |
|------|------|----------|
| `auto` | 智能模式 (推荐) | 有证书时HTTPS，无证书时HTTP |
| `https` | 强制HTTPS | 生产环境，需要有效证书 |
| `http` | 强制HTTP | 开发环境或内网部署 |

## 🔒 HTTPS 配置

### 选项1: Let's Encrypt (推荐)

```bash
# 安装certbot
sudo apt update && sudo apt install certbot

# 获取免费SSL证书
sudo certbot certonly --standalone -d 您的域名

# 更新.env文件
TLS_CERT_PATH=/etc/letsencrypt/live/您的域名/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/您的域名/privkey.pem
```

### 选项2: 自签名证书 (测试用)

```bash
# 生成自签名证书
cd certs
openssl req -x509 -newkey rsa:4096 \
  -keyout server.key \
  -out server.crt \
  -days 365 \
  -nodes \
  -subj "/C=US/ST=State/L=City/O=Org/CN=您的域名"

# 更新.env文件
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key
```

## 🛠️ 系统服务配置

### 创建系统服务

```bash
sudo tee /etc/systemd/system/customer-service.service << 'EOF'
[Unit]
Description=ELonTalk Customer Service System
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/customer-service
ExecStart=/opt/customer-service/customer-service-backend
EnvironmentFile=/opt/customer-service/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 启用并启动服务
sudo systemctl daemon-reload
sudo systemctl enable customer-service
sudo systemctl start customer-service
```

### 查看服务状态

```bash
# 查看服务状态
sudo systemctl status customer-service

# 查看实时日志
sudo journalctl -u customer-service -f

# 重启服务
sudo systemctl restart customer-service
```

## 🔥 防火墙配置

```bash
# 开放必要端口
sudo ufw allow 8080/tcp   # HTTP
sudo ufw allow 8443/tcp   # HTTPS
sudo ufw reload
```

## 📊 功能特性

### ✅ 已包含功能
- 🔐 完整的HTTPS/TLS支持 (Rustls)
- 🤖 智能协议切换 (HTTP/HTTPS)
- 🔄 HTTP到HTTPS自动重定向
- 📱 完整的React前端应用
- 🗃️ 内置SQLite数据库
- 🔌 WebSocket实时通信
- 🛡️ JWT身份验证
- 📈 统计分析功能
- 🎯 零依赖静态编译

### 🌐 SDK集成支持
- 📦 WebSocket SDK已包含
- 🔗 自动服务器检测
- 🔄 协议自适应 (ws/wss)
- 📱 响应式界面设计

## 🐛 故障排除

### 常见问题

**Q: 服务启动失败**
```bash
# 检查日志
sudo journalctl -u customer-service -n 50

# 检查配置文件
cat .env

# 检查文件权限
ls -la customer-service-backend
chmod +x customer-service-backend
```

**Q: HTTPS证书问题**
```bash
# 检查证书文件
ls -la certs/
# 或
ls -la /etc/letsencrypt/live/您的域名/

# 测试证书有效性
openssl x509 -in certs/server.crt -text -noout
```

**Q: 端口被占用**
```bash
# 检查端口占用
sudo netstat -tlnp | grep :8080
sudo netstat -tlnp | grep :8443

# 修改.env中的端口配置
```

**Q: 数据库权限问题**
```bash
# 确保目录权限
chown -R $USER:$USER /opt/customer-service/
chmod 755 /opt/customer-service/
```

## 📞 技术支持

- **项目仓库**: QuickTalk-
- **问题报告**: GitHub Issues
- **文档**: 项目Wiki

## 🔄 更新升级

```bash
# 停止服务
sudo systemctl stop customer-service

# 备份数据库
cp customer_service.db customer_service.db.backup

# 替换新的二进制文件
cp new-customer-service-backend customer-service-backend
chmod +x customer-service-backend

# 启动服务
sudo systemctl start customer-service
```

---

**部署完成！** 🎉

访问您的客服系统：
- **管理后台**: `https://您的域名:8443`
- **API文档**: `https://您的域名:8443/api/config`

祝您使用愉快！ 😊