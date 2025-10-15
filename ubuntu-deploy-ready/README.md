# ELonTalk 客服系统 - Ubuntu 部署指南

## 📋 系统信息

- **服务器**: Ubuntu 24.04 LTS
- **域名**: elontalk.duckdns.org  
- **IP地址**: 43.139.82.12
- **部署路径**: `/root/ubuntu-deploy-ready/`
- **架构**: Sea-ORM + Rust + React + HTTPS

## 🎯 部署目标

✅ **HTTPS强制模式** - 所有HTTP请求自动重定向到HTTPS  
✅ **零依赖部署** - 静态链接的Linux二进制文件  
✅ **自动数据库迁移** - 使用Sea-ORM自动创建和管理数据库  
✅ **完整功能** - 客服聊天、管理后台、WebSocket SDK  

## 📦 部署包内容

```
ubuntu-deploy-ready/
├── customer-service-backend     # Rust二进制文件 (HTTPS版本, ~8MB)
├── .env                        # 环境配置 (HTTPS强制模式)
├── customer-service.service    # systemd服务配置
├── deploy.sh                   # 全自动部署脚本 ⭐
├── start.sh                    # 手动启动脚本
├── setup-https.sh              # HTTPS证书配置脚本
├── deploy-check.sh             # 部署前检查脚本
├── certs/                      # SSL证书目录
│   ├── server.crt             # SSL证书
│   └── server.key             # SSL私钥
└── static/                     # 前端和SDK文件
    ├── index.html             # React管理界面
    ├── static/                # 前端资源
    ├── sdk/                   # WebSocket SDK
    └── embed/                 # 嵌入式组件
```

## 🚀 快速部署 (推荐)

### 1. 上传文件到服务器

```bash
# 将整个 ubuntu-deploy-ready 文件夹上传到 /root/
scp -r ubuntu-deploy-ready root@43.139.82.12:/root/
```

### 2. 连接服务器

```bash
ssh root@43.139.82.12
cd /root/ubuntu-deploy-ready
```

### 3. 一键部署

```bash
# 检查部署环境
bash deploy-check.sh

# 全自动部署 (推荐)
bash deploy.sh
```

**完成！** 系统将自动：
- 安装必要依赖
- 配置防火墙 
- 设置系统服务
- 启动HTTPS服务
- 验证部署状态

## 🔧 手动部署步骤

如果需要手动控制部署过程：

### 1. 配置HTTPS证书

```bash
# 配置SSL证书 (Let's Encrypt 或自签名)
bash setup-https.sh
```

### 2. 手动启动服务

```bash
# 启动服务
bash start.sh
```

## 🌐 访问地址

部署完成后，可通过以下地址访问：

- **HTTPS主站**: https://elontalk.duckdns.org:8443
- **HTTPS IP**: https://43.139.82.12:8443  
- **HTTP重定向**: http://43.139.82.12:8080 → HTTPS

### 功能页面

- **管理后台**: https://elontalk.duckdns.org:8443
- **API文档**: https://elontalk.duckdns.org:8443/api
- **WebSocket测试**: https://elontalk.duckdns.org:8443/test-embed.html
- **SDK演示**: https://elontalk.duckdns.org:8443/sdk/

## 🔍 部署验证

### 检查服务状态

```bash
# 服务状态
systemctl status customer-service

# 查看日志
journalctl -u customer-service -f

# 检查端口
netstat -tlnp | grep -E ':8080|:8443'

# 测试连接
curl -k https://elontalk.duckdns.org:8443
```

### 预期输出

✅ **服务正常启动**:
```
● customer-service.service - ELonTalk Customer Service System (HTTPS)
   Loaded: loaded (/etc/systemd/system/customer-service.service; enabled)
   Active: active (running)
```

✅ **端口监听**:
```
tcp6       0      0 :::8080                 :::*                    LISTEN      
tcp6       0      0 :::8443                 :::*                    LISTEN      
```

✅ **HTTPS响应**:
```json
{
  "status": "ok",
  "service": "ELonTalk Customer Service",
  "version": "1.0.0",
  "https": true
}
```

## 🛠️ 管理命令

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

# 启用自启动
systemctl enable customer-service

# 禁用自启动
systemctl disable customer-service
```

### 日志管理

```bash
# 实时日志
journalctl -u customer-service -f

# 最近日志
journalctl -u customer-service -n 50

# 错误日志
journalctl -u customer-service -p err
```

### 数据库管理

```bash
# 数据库文件位置
ls -la /root/ubuntu-deploy-ready/customer_service.db

# 备份数据库
cp customer_service.db customer_service_$(date +%Y%m%d_%H%M%S).db

# 查看数据库大小
du -h customer_service.db
```

## 🔒 安全配置

### 防火墙规则

```bash
# 查看防火墙状态
ufw status

# 必要端口已开放:
# 22/tcp  (SSH)
# 8080/tcp (HTTP重定向)  
# 8443/tcp (HTTPS)
```

### SSL证书

- **位置**: `/root/ubuntu-deploy-ready/certs/`
- **类型**: Let's Encrypt (推荐) 或自签名
- **续期**: Let's Encrypt 90天自动续期

```bash
# 检查证书信息
openssl x509 -in certs/server.crt -text -noout

# 检查证书有效期
openssl x509 -in certs/server.crt -noout -dates
```

## ⚠️ 故障排除

### 常见问题

**1. 服务启动失败**
```bash
# 查看详细错误
journalctl -u customer-service -n 50

# 检查文件权限
ls -la customer-service-backend

# 手动测试
./customer-service-backend
```

**2. 端口被占用**
```bash
# 查看端口占用
netstat -tlnp | grep -E ':8080|:8443'

# 杀死占用进程
pkill -f customer-service
```

**3. SSL证书问题**
```bash
# 重新配置证书
bash setup-https.sh

# 检查证书文件
ls -la certs/
```

**4. 无法访问网站**
```bash
# 检查防火墙
ufw status

# 检查域名解析
nslookup elontalk.duckdns.org

# 测试本地连接
curl -k https://localhost:8443
```

### 重置部署

如果需要完全重新部署：

```bash
# 停止服务
systemctl stop customer-service
systemctl disable customer-service

# 清理文件
rm -f /etc/systemd/system/customer-service.service
systemctl daemon-reload

# 重新部署
bash deploy.sh
```

## 📞 技术支持

- **项目仓库**: GitHub - QuickTalk
- **管理邮箱**: siwmm@163.com
- **服务器信息**: Ubuntu 24.04 LTS, 43.139.82.12

## 📝 更新日志

- **2025-10-15**: 创建HTTPS强制部署包
- **架构**: Sea-ORM + Rust交叉编译 + React前端
- **特性**: 零依赖部署、自动HTTPS重定向、WebSocket SDK

---

🎉 **部署完成！ELonTalk 客服系统已就绪**