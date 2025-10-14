# ELonTalk 部署检查清单

## 📋 部署前检查

### 服务器要求
- [ ] Ubuntu 20.04/22.04/24.04 LTS
- [ ] x86_64 架构
- [ ] 至少 512MB 内存
- [ ] 至少 100MB 磁盘空间
- [ ] Root 或 sudo 权限

### 网络要求
- [ ] 端口 8080 可用 (HTTP)
- [ ] 端口 8443 可用 (HTTPS)
- [ ] 端口 22 可用 (SSH)
- [ ] 外网访问权限

## 📂 文件检查

### 必需文件
- [ ] customer-service-backend (可执行文件)
- [ ] .env (环境配置)
- [ ] certs/server.crt (SSL证书)
- [ ] certs/server.key (私钥)
- [ ] static/ 目录 (前端文件)

### 脚本文件
- [ ] quick-start.sh (快速启动)
- [ ] start-https.sh (详细启动)
- [ ] stop.sh (停止服务)
- [ ] scripts/generate-cert.sh (证书生成)
- [ ] scripts/install-service.sh (服务安装)
- [ ] scripts/analyze-logs.sh (日志分析)

## 🔧 部署步骤

### 1. 文件上传
- [ ] 上传整个部署包到服务器
- [ ] 进入部署目录
- [ ] 验证文件完整性

### 2. 权限设置
```bash
chmod +x *.sh
chmod +x scripts/*.sh
chmod +x customer-service-backend
chmod 600 .env
```
- [ ] 执行权限设置完成

### 3. 环境配置
- [ ] 检查 .env 文件配置
- [ ] 确认域名配置正确
- [ ] 确认证书路径正确

### 4. 首次启动
```bash
./quick-start.sh
```
- [ ] 启动脚本执行成功
- [ ] 无错误信息输出
- [ ] 进程正常运行

## ✅ 启动后验证

### 进程检查
```bash
ps aux | grep customer-service-backend
```
- [ ] 进程正在运行
- [ ] 进程状态正常

### 端口检查
```bash
netstat -tlnp | grep -E ":(8080|8443)"
```
- [ ] 端口 8080 正在监听
- [ ] 端口 8443 正在监听

### 服务测试
```bash
curl -s http://localhost:8080/health
curl -k -s https://localhost:8443/health
```
- [ ] HTTP 服务响应正常
- [ ] HTTPS 服务响应正常

### 外网访问测试
- [ ] HTTP: http://[服务器IP]:8080
- [ ] HTTPS: https://[服务器IP]:8443
- [ ] 域名: https://elontalk.duckdns.org:8443

## 🔍 问题排查

### 常见问题检查
- [ ] 防火墙是否开放端口
- [ ] 证书文件是否存在且有效
- [ ] 数据库文件权限是否正确
- [ ] 环境变量是否配置正确

### 日志检查
```bash
ls -la logs/
tail -20 logs/startup.log
tail -20 logs/error.log
```
- [ ] 日志目录已创建
- [ ] 启动日志正常
- [ ] 无严重错误信息

### 资源使用检查
```bash
df -h
free -h
top -p $(pgrep customer-service-backend)
```
- [ ] 磁盘空间充足
- [ ] 内存使用正常
- [ ] CPU 使用正常

## 🔒 安全检查

### 文件权限
- [ ] .env 文件权限为 600
- [ ] 私钥文件权限为 600
- [ ] 证书文件权限为 644
- [ ] 可执行文件有执行权限

### 防火墙配置
```bash
ufw status
```
- [ ] 防火墙已启用
- [ ] SSH 端口已开放
- [ ] HTTP/HTTPS 端口已开放
- [ ] 其他端口已关闭

### 证书有效性
```bash
openssl x509 -in certs/server.crt -text -noout
```
- [ ] 证书格式正确
- [ ] 证书未过期
- [ ] 域名匹配正确

## 🎯 功能验证

### Web 界面访问
- [ ] 管理界面可以正常打开
- [ ] 静态资源加载正常
- [ ] 登录功能正常

### API 功能测试
- [ ] 用户注册 API
- [ ] 用户登录 API
- [ ] 店铺管理 API
- [ ] 消息发送 API

### WebSocket 功能
- [ ] WebSocket 连接正常
- [ ] 实时消息收发正常
- [ ] 连接状态管理正常

## 📈 性能验证

### 响应时间测试
```bash
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8080/health
```
- [ ] HTTP 响应时间 < 100ms
- [ ] HTTPS 响应时间 < 200ms

### 并发测试
- [ ] 多用户同时访问正常
- [ ] WebSocket 并发连接正常
- [ ] 系统资源使用合理

## 🔄 维护准备

### 备份计划
- [ ] 数据库文件备份
- [ ] 配置文件备份
- [ ] 证书文件备份

### 监控设置
- [ ] 日志轮转配置
- [ ] 磁盘空间监控
- [ ] 进程状态监控

### 更新计划
- [ ] 系统更新计划
- [ ] 应用更新流程
- [ ] 证书更新提醒

## ✨ 部署完成确认

### 最终检查
- [ ] 所有功能正常运行
- [ ] 外网访问正常
- [ ] 日志记录正常
- [ ] 安全配置正确

### 文档整理
- [ ] 部署日志记录
- [ ] 配置信息备份
- [ ] 问题解决记录
- [ ] 联系方式确认

---

## 📞 支持信息

**技术支持**: siwmm@163.com  
**项目地址**: https://github.com/ElonQian1/QuickTalk  
**服务器**: 43.139.82.12  
**域名**: elontalk.duckdns.org  

---

**检查完成时间**: _______________  
**部署人员**: _______________  
**备注**: _______________