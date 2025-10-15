# 🚀 Ubuntu HTTPS部署完整指令

## 📋 部署前检查

### 系统要求
- Ubuntu 24.04 LTS x86_64
- 管理员权限 (root用户)
- 网络连接正常
- 域名解析正确 (elontalk.duckdns.org -> 43.139.82.12)

### 必需的网络配置
- 开放端口 8080 (HTTP)
- 开放端口 8443 (HTTPS)
- 确保防火墙配置正确

## 🎯 一键部署命令

### 1. 上传部署包 (在Windows执行)
```powershell
# 上传整个部署文件夹到Ubuntu服务器
scp -r ubuntu-deploy-ready root@43.139.82.12:/root/
```

### 2. SSH登录到Ubuntu服务器
```bash
ssh root@43.139.82.12
```

### 3. 进入部署目录
```bash
cd /root/ubuntu-deploy-ready
```

### 4. 设置执行权限
```bash
chmod +x customer-service-backend start.sh setup-https.sh
```

### 5. 配置HTTPS (二选一)

#### 方案A: 自动HTTPS配置 (推荐)
```bash
./setup-https.sh
```
这个脚本会引导您完成SSL证书配置：
- 检查现有证书
- 配置Let's Encrypt证书
- 生成自签名证书
- 设置自动续期

#### 方案B: 手动选择配置模式
```bash
# 使用HTTPS模式 (需要有效证书)
cp .env.https .env

# 或使用HTTP模式 (如果证书有问题)
cp .env.http .env
```

### 6. 启动服务
```bash
./start.sh
```

### 7. 验证部署
- **HTTPS**: https://43.139.82.12:8443
- **HTTP**: http://43.139.82.12:8080  
- **域名**: https://elontalk.duckdns.org:8443

## 🔧 高级配置

### systemd服务配置 (可选)
```bash
# 复制服务文件
cp customer-service.service /etc/systemd/system/

# 重新加载systemd
systemctl daemon-reload

# 启用自动启动
systemctl enable customer-service

# 启动服务
systemctl start customer-service

# 查看状态
systemctl status customer-service
```

### 防火墙配置
```bash
# 开放必需端口
ufw allow 8080/tcp
ufw allow 8443/tcp
ufw allow 22/tcp
ufw --force enable

# 查看状态
ufw status
```

### 证书管理

#### 检查证书有效性
```bash
openssl x509 -in certs/server.crt -text -noout
openssl x509 -in certs/server.crt -noout -dates
```

#### Let's Encrypt证书续期
```bash
certbot renew --dry-run  # 测试续期
certbot renew            # 执行续期
```

## 🔍 故障排除

### 1. 检查服务状态
```bash
# 查看进程
ps aux | grep customer-service

# 查看端口占用
netstat -tlnp | grep -E ':(8080|8443)'

# 查看日志
journalctl -u customer-service -f
```

### 2. 检查网络连接
```bash
# 测试端口连通性
curl -k http://localhost:8080
curl -k https://localhost:8443

# 检查外网访问
curl -k http://43.139.82.12:8080
curl -k https://43.139.82.12:8443
```

### 3. 数据库问题
```bash
# 检查数据库文件
ls -la customer_service.db

# 检查数据库权限
chmod 644 customer_service.db
```

### 4. 证书问题
```bash
# 检查证书文件
ls -la certs/

# 检查证书权限
chmod 644 certs/server.crt
chmod 600 certs/server.key

# 验证证书和私钥匹配
openssl x509 -in certs/server.crt -noout -modulus | openssl md5
openssl rsa -in certs/server.key -noout -modulus | openssl md5
```

## 📊 性能监控

### 系统资源监控
```bash
# 内存使用
free -h

# CPU使用
top -p $(pgrep customer-service)

# 磁盘使用
df -h
```

### 应用日志
```bash
# 实时日志
tail -f /var/log/syslog | grep customer-service

# 服务日志
journalctl -u customer-service --since "1 hour ago"
```

## 🔄 更新流程

### 更新应用
```bash
# 停止服务
systemctl stop customer-service

# 备份数据库
cp customer_service.db customer_service.db.backup

# 更新二进制文件
cp new-customer-service-backend customer-service-backend
chmod +x customer-service-backend

# 重启服务
systemctl start customer-service
```

### 回滚流程
```bash
# 停止服务
systemctl stop customer-service

# 恢复备份
cp customer_service.db.backup customer_service.db
cp customer-service-backend.backup customer-service-backend

# 重启服务
systemctl start customer-service
```

## 🎯 成功指标

### 部署成功标志
- ✅ 服务正常启动
- ✅ 网页可以正常访问
- ✅ 数据库自动创建并迁移
- ✅ WebSocket连接正常
- ✅ HTTPS证书验证通过

### 访问地址确认
- **管理后台**: https://43.139.82.12:8443
- **API接口**: https://43.139.82.12:8443/api/
- **WebSocket**: wss://43.139.82.12:8443/ws/

---

## 📞 技术支持

- **服务器IP**: 43.139.82.12
- **域名**: elontalk.duckdns.org  
- **管理员**: siwmm@163.com
- **部署路径**: /root/ubuntu-deploy-ready/

**部署时间**: 2025年10月15日  
**版本**: v1.0-https  
**架构**: Ubuntu 24.04 + Rust + React