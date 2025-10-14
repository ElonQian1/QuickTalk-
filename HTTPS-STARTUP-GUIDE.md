# HTTPS 启动完整指南

## 🔒 概述

此指南提供了启动客服系统 HTTPS 功能的完整解决方案。我们已经修复了之前的端口冲突问题（程序默认模式从 "auto" 改为 "http"），现在可以安全地启动 HTTPS 模式。

## ✅ 问题解决状态

### 已修复的问题
- ✅ **端口冲突根本原因**: 修复了 `server/mod.rs` 中的默认 TLS_MODE 从 "auto" 改为 "http"
- ✅ **SSL证书**: 现有有效的 SSL 证书文件 (`certs/server.crt`, `certs/server.key`)
- ✅ **专用启动脚本**: 创建了带端口检查和证书验证的专用 HTTPS 启动脚本

### 当前状态
- 🟢 **后端代码**: 完全支持 HTTPS 模式
- 🟢 **SSL证书**: 有效证书已存在
- 🟢 **启动脚本**: 完整的自动化启动解决方案

## 🚀 启动 HTTPS 的方法

### 方法1: 使用专用启动脚本（推荐）

#### Windows 系统:
```powershell
cd e:\duihua\customer-service-system
.\start-https.bat
```

#### Linux 系统:
```bash
cd /path/to/customer-service-system
chmod +x start-https.sh
./start-https.sh
```

**脚本功能**:
- 自动检查端口 8443 和 8080 是否被占用
- 验证 SSL 证书有效性
- 设置正确的环境变量
- 编译后端（如果需要）
- 启动 HTTPS 服务器

### 方法2: 手动启动

#### 1. 设置环境变量
```powershell
# Windows PowerShell
$env:TLS_MODE="https"
$env:HTTPS_PORT="8443"
$env:TLS_CERT_PATH="certs\server.crt"
$env:TLS_KEY_PATH="certs\server.key"
$env:ENABLE_HTTP_REDIRECT="true"
```

```bash
# Linux Bash
export TLS_MODE="https"
export HTTPS_PORT="8443"
export TLS_CERT_PATH="certs/server.crt"
export TLS_KEY_PATH="certs/server.key"
export ENABLE_HTTP_REDIRECT="true"
```

#### 2. 编译后端（包含 HTTPS 功能）
```bash
cd backend
cargo build --release --features https
```

#### 3. 启动服务器
```bash
cd backend
./target/release/customer-service-backend
```

## 📋 启动脚本选项

### 常用选项
```bash
# 基本启动
./start-https.sh

# 使用自定义端口
./start-https.sh --port 9443

# 强制重新编译
./start-https.sh --force-build

# 仅验证证书
./start-https.sh --verify-cert

# 仅生成新证书
./start-https.sh --generate-cert

# 显示帮助
./start-https.sh --help
```

## 🌐 访问地址

启动成功后，可以通过以下地址访问：

- **HTTPS**: https://localhost:8443
- **HTTP 重定向**: http://localhost:8080 (自动跳转到 HTTPS)

## 🔧 故障排除

### 1. 端口被占用
**症状**: 显示 "Address already in use (os error 98)" 或 "端口 8443 已被占用"

**解决方案**:
```bash
# Linux: 查看并结束占用进程
sudo netstat -tlnp | grep :8443
sudo kill -9 <PID>

# Windows: 查看并结束占用进程
netstat -ano | findstr :8443
taskkill /PID <PID> /F
```

**自动解决**: 使用启动脚本会自动检测并询问是否结束占用进程

### 2. SSL 证书问题
**症状**: "SSL certificate validation failed" 或 "证书验证失败"

**解决方案**:
```bash
# 验证现有证书
./start-https.sh --verify-cert

# 生成新证书
./start-https.sh --generate-cert
```

### 3. 编译错误
**症状**: "compilation failed" 或 "依赖缺失"

**解决方案**:
```bash
# 清理并重新编译
cd backend
cargo clean
cargo build --release --features https
```

### 4. 浏览器安全警告
**症状**: 浏览器显示 "此连接不安全" 或 "证书无效"

**原因**: 使用自签名证书

**解决方案**: 
- 在浏览器中点击 "高级" -> "继续访问"
- 或者使用真实的 SSL 证书

## 🔒 证书管理

### 现有证书信息
- **证书文件**: `certs/server.crt`
- **密钥文件**: `certs/server.key`
- **证书类型**: 自签名证书
- **有效期**: 365 天（从生成日期开始）

### 生成新证书
如需生成新的自签名证书：
```bash
# 使用启动脚本生成
./start-https.sh --generate-cert

# 手动生成
openssl genrsa -out certs/server.key 2048
openssl req -new -x509 -key certs/server.key -out certs/server.crt -days 365 \
    -subj "/C=CN/ST=State/L=City/O=Organization/OU=OrgUnit/CN=localhost"
```

### 使用真实证书
对于生产环境，建议使用 Let's Encrypt 或其他 CA 签发的证书：
1. 将证书文件复制到 `certs/server.crt`
2. 将私钥文件复制到 `certs/server.key`
3. 确保文件权限正确（私钥仅所有者可读）

## 🌟 最佳实践

### 1. 安全配置
- 定期更新 SSL 证书
- 使用强密码和密钥长度
- 启用 HTTP 到 HTTPS 重定向
- 配置防火墙规则

### 2. 性能优化
- 使用 `cargo build --release` 编译优化版本
- 配置适当的并发连接数
- 监控内存和 CPU 使用情况

### 3. 监控和日志
- 检查服务器日志中的 SSL 相关错误
- 监控证书过期时间
- 设置自动续签（对于 Let's Encrypt）

## 🚨 注意事项

### 环境变量优先级
程序按以下优先级读取配置：
1. 命令行环境变量
2. `.env` 文件
3. 默认值

### 端口冲突处理
- 8443: HTTPS 主服务器端口
- 8080: HTTP 重定向服务器端口（可选）

如果端口被占用，启动脚本会提供自动处理选项。

### 证书路径
确保证书路径正确：
- Windows: `certs\server.crt`, `certs\server.key`
- Linux: `certs/server.crt`, `certs/server.key`

## 📞 支持

如果遇到问题：
1. 首先运行 `./start-https.sh --verify-cert` 检查证书
2. 检查端口是否被占用
3. 查看服务器日志输出
4. 确认环境变量设置正确

---

**更新时间**: 2025年10月14日  
**版本**: v1.0  
**状态**: ✅ 生产就绪  
**维护者**: 开发团队