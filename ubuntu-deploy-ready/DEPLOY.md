# Ubuntu HTTPS 部署包 - 快速部署指南

## 🎯 部署信息

- **编译日期**: 2025年10月15日
- **二进制大小**: 8.4MB
- **架构**: x86_64-unknown-linux-musl (静态链接)
- **HTTPS支持**: Rustls (纯Rust TLS)
- **数据库**: SQLite + Sea-ORM 自动迁移
- **目标路径**: `/root/ubuntu-deploy-ready/`

## 📦 部署包内容

```
ubuntu-deploy-ready/
├── customer-service-backend    # Linux可执行文件 (8.4MB)
├── static/                     # React前端静态文件
├── certs/                      # SSL证书文件
├── .env                        # HTTPS生产配置
├── .env.http                   # HTTP测试配置
├── start.sh                    # 智能启动脚本
├── customer-service.service    # systemd服务配置
└── README.md                   # 详细文档
```

## 🚀 快速部署 (3步完成)

### 步骤 1: 上传文件
```bash
# 从Windows上传到Ubuntu服务器
scp -r ubuntu-deploy-ready root@43.139.82.12:/root/
```

### 步骤 2: 启动服务
```bash
# SSH登录到服务器
ssh root@43.139.82.12

# 进入目录
cd /root/ubuntu-deploy-ready

# 添加执行权限并启动
chmod +x start.sh customer-service-backend
./start.sh
```

### 步骤 3: 验证访问
- **HTTPS**: https://43.139.82.12:8443
- **HTTP**: http://43.139.82.12:8080
- **域名**: https://elontalk.duckdns.org:8443

## ⚙️ 配置选项

### HTTPS 模式 (推荐)
使用 `.env` 文件（已配置HTTPS）：
```bash
./start.sh
```

### HTTP 模式 (快速测试)
如果证书有问题，可以先用HTTP测试：
```bash
cp .env.http .env
./start.sh
```

## 🔧 systemd 服务配置

### 安装为系统服务
```bash
# 复制服务文件
cp customer-service.service /etc/systemd/system/

# 重新加载systemd
systemctl daemon-reload

# 启用开机自启
systemctl enable customer-service

# 启动服务
systemctl start customer-service

# 查看状态
systemctl status customer-service

# 查看日志
journalctl -u customer-service -f
```

### 服务管理命令
```bash
systemctl start customer-service      # 启动
systemctl stop customer-service       # 停止
systemctl restart customer-service    # 重启
systemctl status customer-service     # 状态
```

## 🔍 故障排查

### 1. 端口被占用
```bash
# 检查端口
ss -tlnp | grep :8080
ss -tlnp | grep :8443

# 停止服务
systemctl stop customer-service
```

### 2. 证书问题
```bash
# 检查证书文件
ls -la certs/
openssl x509 -in certs/server.crt -text -noout

# 临时使用HTTP模式
cp .env.http .env
./start.sh
```

### 3. 数据库权限
```bash
# 修复权限
chmod 644 customer_service.db
chmod 755 /root/ubuntu-deploy-ready
```

### 4. 查看详细日志
```bash
# 直接运行查看错误
./customer-service-backend

# 或查看systemd日志
journalctl -u customer-service -n 100 --no-pager
```

## 🐛 已修复的问题

### ✅ 仪表盘统计查询错误
- **问题**: `no such column: uc.shop_id`
- **修复**: 将CTE查询改为IN子查询
- **影响**: 仪表盘统计数据现在可以正常加载

### ✅ 登录token警告
- **问题**: 登录时显示不必要的token警告
- **修复**: 为公开端点跳过token检查
- **影响**: 减少控制台噪音，提升用户体验

## 📊 性能指标

- **二进制大小**: 8.4MB (静态链接)
- **内存占用**: ~10-20MB (空闲)
- **启动时间**: <2秒
- **并发支持**: 数千WebSocket连接
- **数据库**: SQLite (嵌入式，零配置)

## 🔐 安全特性

- ✅ Rustls TLS 1.3 加密
- ✅ JWT 令牌认证
- ✅ bcrypt 密码哈希
- ✅ CORS 跨域保护
- ✅ SQL 注入防护
- ✅ 内存安全的Rust实现

## 📡 服务访问

### HTTP 访问
- http://43.139.82.12:8080
- http://elontalk.duckdns.org:8080

### HTTPS 访问 (推荐)
- https://43.139.82.12:8443
- https://elontalk.duckdns.org:8443

### API 端点
- 管理后台: `/`
- REST API: `/api/*`
- WebSocket: `/ws/*`

## 🔄 更新部署

### 更新二进制文件
```bash
# 停止服务
systemctl stop customer-service

# 替换二进制文件
cp new-customer-service-backend customer-service-backend
chmod +x customer-service-backend

# 重启服务
systemctl start customer-service
```

### 更新前端
```bash
# 停止服务
systemctl stop customer-service

# 替换静态文件
rm -rf static/
cp -r new-static/ static/

# 重启服务
systemctl start customer-service
```

## 📞 技术支持

- **仓库**: ElonQian1/QuickTalk-
- **邮箱**: siwmm@163.com
- **服务器**: 43.139.82.12

---

**部署版本**: v1.3  
**最后更新**: 2025年10月15日  
**状态**: ✅ 生产就绪