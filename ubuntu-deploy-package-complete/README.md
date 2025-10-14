# ELonTalk 客服系统 - Ubuntu 部署包

> **版本**: v2.0  
> **更新时间**: 2025-10-14  
> **目标系统**: Ubuntu 20.04/22.04/24.04 LTS  
> **架构**: x86_64  

## 📦 部署包内容

```
ubuntu-deploy-package-complete/
├── customer-service-backend     # Rust 后端可执行文件 (HTTPS支持)
├── .env                        # 环境配置文件
├── quick-start.sh              # 一键启动脚本 ⭐
├── start-https.sh              # 完整启动脚本 (详细日志)
├── stop.sh                     # 停止服务脚本
├── certs/                      # SSL 证书目录
│   ├── server.crt             # SSL 证书
│   └── server.key             # 私钥
├── static/                     # 前端静态文件
│   ├── index.html
│   ├── static/
│   └── ...
├── logs/                       # 日志目录 (自动创建)
├── scripts/                    # 工具脚本
│   ├── generate-cert.sh        # 生成SSL证书
│   ├── install-service.sh      # 安装系统服务
│   └── analyze-logs.sh         # 日志分析工具
└── README.md                   # 本文件
```

## 🚀 快速部署 (3分钟)

### 步骤 1: 上传文件
```bash
# 将整个文件夹上传到 Ubuntu 服务器
# 例如使用 scp：
scp -r ubuntu-deploy-package-complete/ root@43.139.82.12:/root/elontalk/
```

### 步骤 2: 设置权限
```bash
cd /root/elontalk/ubuntu-deploy-package-complete/
chmod +x *.sh
chmod +x scripts/*.sh
chmod +x customer-service-backend
chmod 600 .env
```

### 步骤 3: 修复 HTTPS 配置 (重要!)
```bash
./fix-https.sh
```

### 步骤 4: 一键启动 ⭐
```bash
./quick-start.sh
```

## ✅ 启动成功标志

启动成功后你会看到：
```
✅ 服务启动成功
✅ 端口 8080 监听正常
✅ 端口 8443 监听正常
✅ HTTP 健康检查通过
✅ HTTPS 健康检查通过

🌐 服务访问地址：
   HTTP:  http://43.139.82.12:8080
   HTTPS: https://43.139.82.12:8443
   域名:  https://elontalk.duckdns.org:8443
```

## 🔧 详细部署选项

### 选项 A: 手动启动 (推荐用于调试)
```bash
# 1. 设置权限
chmod +x customer-service-backend
chmod 600 .env

# 2. 手动启动
./customer-service-backend
```

### 选项 B: 完整启动脚本
```bash
# 包含详细日志和错误诊断
./start-https.sh
```

### 选项 C: 系统服务安装
```bash
# 安装为 systemd 服务 (需要 root 权限)
sudo ./scripts/install-service.sh

# 管理服务
systemctl start elontalk
systemctl status elontalk
systemctl enable elontalk  # 开机自启
```

## 🔐 HTTPS 配置

### 使用现有证书
证书文件已包含在 `certs/` 目录中：
- `server.crt`: SSL 证书
- `server.key`: 私钥

### 生成新证书
```bash
# 生成自签名证书
./scripts/generate-cert.sh
```

### Let's Encrypt 证书 (生产推荐)
```bash
# 安装 certbot
sudo apt update
sudo apt install certbot

# 获取证书
sudo certbot certonly --standalone -d elontalk.duckdns.org

# 复制证书
sudo cp /etc/letsencrypt/live/elontalk.duckdns.org/fullchain.pem certs/server.crt
sudo cp /etc/letsencrypt/live/elontalk.duckdns.org/privkey.pem certs/server.key
sudo chown $(whoami) certs/*
```

## 📊 监控和日志

### 实时日志查看
```bash
# 查看所有日志
tail -f logs/*.log

# 查看特定日志
tail -f logs/startup.log      # 启动日志
tail -f logs/error.log        # 错误日志
tail -f logs/https-debug.log  # HTTPS 调试日志
```

### 日志分析工具
```bash
# 生成详细分析报告
./scripts/analyze-logs.sh
```

### 进程监控
```bash
# 查看进程状态
ps aux | grep customer-service-backend

# 查看端口占用
netstat -tlnp | grep -E ":(8080|8443)"

# 查看资源使用
top -p $(pgrep customer-service-backend)
```

## 🛠️ 故障排除

### 问题 1: HTTPS 未启动
**症状**: 只启动 HTTP (8080)，HTTPS (8443) 未监听
```bash
# 修复环境变量配置
./fix-https.sh

# 重启服务
./stop.sh && ./quick-start.sh
```

### 问题 2: 端口被占用
```bash
# 查看端口占用
lsof -i:8080
lsof -i:8443

# 结束占用进程
./stop.sh
```

### 问题 2: 权限问题
```bash
# 设置正确权限
chmod +x customer-service-backend
chmod 600 .env
chmod 644 customer_service.db
```

### 问题 3: 证书问题
```bash
# 检查证书有效性
openssl x509 -in certs/server.crt -text -noout

# 重新生成证书
./scripts/generate-cert.sh
```

### 问题 4: 防火墙问题
```bash
# 开放端口
sudo ufw allow 8080/tcp
sudo ufw allow 8443/tcp
sudo ufw reload
```

### 问题 5: 数据库问题
```bash
# 检查数据库文件
ls -la customer_service.db

# 创建数据库文件 (如果不存在)
touch customer_service.db
chmod 644 customer_service.db
```

## 🔄 服务管理

### 启动服务
```bash
./quick-start.sh           # 一键启动
./start-https.sh           # 详细启动
```

### 停止服务
```bash
./stop.sh                  # 停止所有进程
```

### 重启服务
```bash
./stop.sh && ./quick-start.sh
```

### 查看状态
```bash
# 检查进程
pgrep -f customer-service-backend

# 检查端口
netstat -tlnp | grep -E ":(8080|8443)"

# 健康检查
curl -k https://localhost:8443/health
```

## 🌐 访问地址

### 本地访问
- **HTTP**: http://localhost:8080
- **HTTPS**: https://localhost:8443

### 服务器访问
- **HTTP**: http://43.139.82.12:8080
- **HTTPS**: https://43.139.82.12:8443

### 域名访问
- **HTTP**: http://elontalk.duckdns.org:8080
- **HTTPS**: https://elontalk.duckdns.org:8443

## ⚙️ 环境配置

### 重要配置项 (.env 文件)
```env
# HTTPS 配置
TLS_ENABLED=true
TLS_PORT=8443
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key

# 域名配置
TLS_DOMAIN=elontalk.duckdns.org

# 日志配置
RUST_LOG=debug
RUST_BACKTRACE=full
```

### 修改配置
```bash
# 编辑环境配置
nano .env

# 重启服务使配置生效
./stop.sh && ./quick-start.sh
```

## 📈 性能优化

### 系统要求
- **CPU**: 1 核心 (推荐 2 核心)
- **内存**: 512MB (推荐 1GB)
- **磁盘**: 100MB (推荐 1GB)
- **网络**: 10Mbps

### 优化建议
1. **数据库优化**: 定期清理日志数据
2. **内存优化**: 设置合适的连接池大小
3. **网络优化**: 启用 gzip 压缩
4. **安全优化**: 定期更新 SSL 证书

## 🔒 安全建议

### 文件权限
```bash
chmod 600 .env                    # 环境配置文件
chmod 600 certs/server.key        # 私钥文件
chmod 644 certs/server.crt        # 证书文件
chmod +x customer-service-backend # 可执行文件
```

### 防火墙配置
```bash
# 只开放必要端口
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 8080/tcp  # HTTP
sudo ufw allow 8443/tcp  # HTTPS
```

### 定期维护
- 每月更新系统: `sudo apt update && sudo apt upgrade`
- 每季度检查证书有效期
- 定期备份数据库文件

## 📞 技术支持

### 问题反馈
- **GitHub**: https://github.com/ElonQian1/QuickTalk
- **邮箱**: siwmm@163.com

### 常用命令
```bash
# 查看版本信息
./customer-service-backend --version

# 查看帮助信息
./customer-service-backend --help

# 生成分析报告
./scripts/analyze-logs.sh

# 重新生成证书
./scripts/generate-cert.sh
```

---

## 🎉 部署完成

恭喜！ELonTalk 客服系统已成功部署到 Ubuntu 服务器。

**下一步操作**:
1. 在浏览器中访问 https://elontalk.duckdns.org:8443
2. 注册管理员账户
3. 创建店铺并配置客服
4. 集成 WebSocket SDK 到您的网站

**记住**:
- 服务器重启后需要手动启动服务 (除非安装了系统服务)
- 定期检查日志文件以确保服务正常运行
- 生产环境建议使用 Let's Encrypt 证书

祝您使用愉快！ 🚀