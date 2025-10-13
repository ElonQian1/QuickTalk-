# ELonTalk 客服系统 - Ubuntu 部署包

这是 ELonTalk 多店铺客服系统的完整 Ubuntu 部署包，包含所有必要的文件和脚本。

## 🎯 系统特性

- 💬 **多店铺客服系统**: 支持多个店铺独立管理客服对话
- 🔄 **实时通讯**: WebSocket 实时消息推送
- 🖼️ **富媒体支持**: 图片、语音消息发送与预览
- 📊 **数据统计**: 实时客服工作量和响应时间统计
- 🔐 **安全认证**: JWT 身份验证和权限管理
- 🌐 **跨平台**: 支持 Windows 开发，Ubuntu 生产部署
- 📱 **响应式界面**: 适配桌面和移动设备

## 📋 系统要求

### 最低要求
- **操作系统**: Ubuntu 16.04+ (或其他 Linux 发行版)
- **内存**: 512MB RAM
- **存储**: 100MB 可用空间
- **网络**: 开放端口 8080 (HTTP) 或 8443 (HTTPS)

### 推荐配置
- **操作系统**: Ubuntu 20.04 LTS 或更新版本
- **内存**: 1GB RAM 或更多
- **存储**: 1GB 可用空间
- **网络**: 固定 IP 地址或域名

## 🚀 快速部署

### 1. 上传部署包
将整个 `ubuntu-deploy-package` 目录上传到您的 Ubuntu 服务器。

### 2. 基础部署 (HTTP)
```bash
# 进入部署目录
cd ubuntu-deploy-package

# 设置执行权限
chmod +x start.sh
chmod +x customer-service-backend

# 启动服务 (HTTP 模式)
./start.sh
```

服务启动后，访问: `http://您的服务器IP:8080`

### 3. HTTPS 部署 (推荐)

#### 方法一: 自动获取 SSL 证书 (Let's Encrypt + DuckDNS)
```bash
# 设置执行权限
chmod +x setup-ssl.sh

# 运行 SSL 配置脚本 (需要 root 权限)
sudo ./setup-ssl.sh

# 启动 HTTPS 服务
chmod +x start-https.sh
./start-https.sh
```

#### 方法二: 使用现有 SSL 证书
```bash
# 创建证书目录
mkdir -p certs

# 复制您的 SSL 证书文件
cp /path/to/your/certificate.crt certs/server.crt
cp /path/to/your/private.key certs/server.key

# 设置权限
chmod 644 certs/server.crt
chmod 600 certs/server.key

# 启动 HTTPS 服务
./start-https.sh
```

## 📁 文件结构

```
ubuntu-deploy-package/
├── customer-service-backend    # 主程序 (Rust 编译后的二进制文件)
├── start.sh                   # HTTP 启动脚本
├── start-https.sh             # HTTPS 启动脚本
├── setup-ssl.sh               # SSL 证书自动配置脚本
├── .env.example               # 环境变量配置示例
├── database_schema.sql        # 数据库架构
└── static/                    # 前端静态文件
    ├── index.html            # 管理后台入口
    ├── sdk/                  # WebSocket SDK
    └── static/               # React 应用文件
```

## ⚙️ 配置说明

### 环境变量配置
复制 `.env.example` 为 `.env` 并根据需要修改:

```bash
cp .env.example .env
nano .env
```

主要配置项:
```env
# 数据库配置
DATABASE_URL=sqlite:./data/customer_service.db

# JWT 安全密钥 (生产环境请更改)
JWT_SECRET=your-super-secure-jwt-secret-key-change-in-production

# 服务器配置
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# HTTPS 配置 (可选)
HTTPS_PORT=8443
CERT_FILE=./certs/server.crt
KEY_FILE=./certs/server.key

# 日志级别
RUST_LOG=info
```

### 端口配置
- **HTTP**: 默认端口 8080
- **HTTPS**: 默认端口 8443
- 确保防火墙开放相应端口

### 数据库
- 使用 SQLite，无需额外安装数据库服务
- 数据文件自动创建在 `./data/customer_service.db`
- 架构自动初始化

## 🔐 SSL/HTTPS 配置

### DuckDNS + Let's Encrypt (推荐)
1. 在 [DuckDNS](https://www.duckdns.org) 注册账号
2. 创建子域名，获取 Token
3. 运行 `sudo ./setup-ssl.sh` 自动配置

### 自签名证书 (仅用于测试)
```bash
# 创建自签名证书
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes
chmod 644 certs/server.crt
chmod 600 certs/server.key
```

## 🛠️ 运维管理

### 服务管理
```bash
# 启动服务
./start.sh              # HTTP 模式
./start-https.sh         # HTTPS 模式

# 停止服务
Ctrl + C

# 后台运行
nohup ./start.sh > logs/server.log 2>&1 &

# 查看日志
tail -f logs/server.log
```

### 系统服务配置 (可选)
```bash
# 创建 systemd 服务文件
sudo nano /etc/systemd/system/elontalk.service
```

服务文件内容:
```ini
[Unit]
Description=ELonTalk Customer Service System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/ubuntu-deploy-package
ExecStart=/path/to/ubuntu-deploy-package/customer-service-backend
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启用服务:
```bash
sudo systemctl daemon-reload
sudo systemctl enable elontalk
sudo systemctl start elontalk
sudo systemctl status elontalk
```

### 数据备份
```bash
# 备份数据库
cp data/customer_service.db backup/customer_service_$(date +%Y%m%d_%H%M%S).db

# 备份配置
tar -czf backup/config_$(date +%Y%m%d_%H%M%S).tar.gz .env certs/
```

## 🌐 使用指南

### 管理员访问
1. 启动服务后访问: `http://您的服务器IP:8080`
2. 注册管理员账号
3. 创建店铺和分配客服人员

### WebSocket SDK 集成
在您的网站中集成客服系统:

```html
<!-- 基础集成 -->
<script src="http://您的服务器IP:8080/sdk/index.js"></script>
<script>
const customerService = new CustomerServiceSDK({
    shopId: 'your-shop-id',
    customerId: 'unique-customer-id',
    customerName: '客户姓名',
    serverUrl: 'ws://您的服务器IP:8080'
});
</script>

<!-- 高级功能 -->
<script src="http://您的服务器IP:8080/sdk/advanced-sdk.js"></script>
```

## 🔧 故障排除

### 常见问题

**1. 服务无法启动**
- 检查端口是否被占用: `netstat -tulpn | grep :8080`
- 检查权限: `chmod +x customer-service-backend`
- 查看错误日志

**2. 无法访问管理后台**
- 确认防火墙开放端口: `sudo ufw allow 8080`
- 检查服务是否运行: `ps aux | grep customer-service`

**3. SSL 证书问题**
- 验证证书文件存在且权限正确
- 检查域名解析是否正确
- 重新运行 `./setup-ssl.sh`

**4. 数据库问题**
- 检查 `data/` 目录权限
- 确认数据库文件没有被锁定
- 重置数据库: 删除 `data/customer_service.db` 重新启动

### 性能调优

**1. 系统级优化**
```bash
# 增加文件描述符限制
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# 优化网络参数
echo "net.core.somaxconn = 65535" >> /etc/sysctl.conf
sysctl -p
```

**2. 应用级优化**
- 使用 SSD 存储提升数据库性能
- 配置反向代理 (Nginx) 处理静态文件
- 启用 gzip 压缩

## 📞 技术支持

- **项目文档**: 查看 GitHub 仓库
- **问题反馈**: 提交 GitHub Issues
- **社区支持**: 参与项目讨论

## 📄 许可证

本项目采用开源许可证，详见项目根目录的 LICENSE 文件。

---

**部署版本**: Ubuntu Linux (x86_64-musl)  
**编译日期**: 2025年10月13日  
**包含组件**: Rust 后端 + React 前端 + WebSocket SDK  
**支持功能**: HTTP/HTTPS + SSL自动配置 + 零依赖部署