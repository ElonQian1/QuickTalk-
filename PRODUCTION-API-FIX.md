# 🚨 生产环境API连接问题 - 解决指南

## 问题描述
**开发环境**: ✅ 正常工作  
**生产服务器**: ❌ `GET http://localhost:8080/health net::ERR_CONNECTION_REFUSED`

## 根本原因
前端在生产服务器上仍然尝试连接 `localhost:8080`，而不是实际的服务器地址。

## 🎯 解决方案

### 步骤1: 服务器500错误排查 (最新问题)

如果你看到以下错误：
```
POST http://43.139.82.12:8080/api/auth/login 500 (Internal Server Error)
```

说明前端连接正常，但后端有问题。执行以下步骤：

```bash
# 1. 运行诊断脚本
cd ubuntu-deploy-ready
chmod +x diagnose.sh
./diagnose.sh

# 2. 如果发现问题，重启服务
chmod +x restart.sh
./restart.sh

# 3. 查看详细日志
tail -f backend.log
```

### 步骤2: 更新服务器上的文件 (如果是API连接问题)

**如果仍然看到 `localhost` 连接错误，需要更新文件**

```bash
# 在服务器上停止当前服务
pkill -f customer-service-backend

# 备份当前部署
cp -r ubuntu-deploy-ready ubuntu-deploy-ready.backup

# 上传新的 ubuntu-deploy-ready 目录（替换整个目录）
# 然后重启服务
cd ubuntu-deploy-ready
./start.sh  # 或你使用的启动脚本
```

### 步骤2: 验证前端配置

访问服务器后，打开浏览器开发者工具：

```javascript
// 在控制台运行以下代码检查API地址
console.log('当前页面地址:', window.location.href);
console.log('检测到的API地址:', window.location.protocol + '//' + window.location.hostname + ':8080');

// 测试API连接
fetch('/api/dashboard/stats')
  .then(response => {
    console.log('API连接状态:', response.status);
    return response.text();
  })
  .catch(error => console.error('API连接错误:', error));
```

### 步骤3: 强制刷新浏览器缓存

在浏览器中按以下组合键：
- **Chrome/Edge**: `Ctrl + Shift + R`
- **Firefox**: `Ctrl + F5`
- **Safari**: `Cmd + Option + R`

## 🔍 故障排查

### 检查1: 500内部服务器错误 (当前问题)

如果API返回500错误，按以下步骤排查：

```bash
# 使用自动诊断脚本
cd ubuntu-deploy-ready
./diagnose.sh

# 手动检查进程状态
ps aux | grep customer-service-backend

# 检查端口监听
netstat -tlnp | grep 8080

# 查看错误日志
tail -50 backend.log

# 测试API响应
curl -v http://localhost:8080/api/dashboard/stats
```

### 检查2: 数据库相关问题

500错误通常与数据库有关：

```bash
# 检查数据库文件
ls -la customer_service.db

# 检查数据库权限
chmod 666 customer_service.db

# 重新初始化数据库 (如果需要)
rm customer_service.db
./restart.sh  # 会自动重新创建数据库
```

### 检查3: 确认服务器后端正在运行

```bash
# 检查端口监听
netstat -tlnp | grep 8080
# 应该看到: tcp 0.0.0.0:8080 LISTEN

# 检查进程
ps aux | grep customer-service-backend
```

### 检查4: 测试本地API

```bash
# 在服务器上测试API
curl http://localhost:8080/api/dashboard/stats
# 正常应该返回401 Unauthorized
# 如果返回500，说明后端有问题

curl -I http://localhost:8080/health
# 应该返回200 OK
```

### 检查3: 验证静态文件

```bash
# 检查前端文件是否更新
ls -la ubuntu-deploy-ready/static/static/js/
# 应该看到 main.c17a3d65.js 文件

# 检查文件内容是否包含动态检测代码
grep -o "window\.location\.hostname" ubuntu-deploy-ready/static/static/js/main.*.js
```

### 检查4: 网络访问测试

**从外部访问测试**:
```
http://你的服务器IP:8080
```

**API测试**:
```
http://你的服务器IP:8080/api/dashboard/stats
```

## 🛠️ 高级故障排查

### 如果仍然连接localhost

可能原因:
1. **浏览器缓存**: 强制刷新未生效
2. **CDN缓存**: 如果使用了CDN
3. **部署未更新**: 静态文件没有正确更新

**解决方法**:

```bash
# 1. 清除浏览器所有缓存
# 2. 检查部署文件时间戳
stat ubuntu-deploy-ready/static/static/js/main.*.js

# 3. 手动设置API地址（临时方法）
# 在浏览器控制台运行:
localStorage.setItem('FORCE_API_BASE', 'http://你的服务器IP:8080');
# 然后刷新页面
```

### 添加调试信息

如果需要更详细的调试，可以在浏览器控制台检查：

```javascript
// 检查API配置加载
console.log('环境变量 API_BASE:', process.env.REACT_APP_API_BASE);
console.log('当前窗口信息:', {
  protocol: window.location.protocol,
  hostname: window.location.hostname,
  port: window.location.port,
  href: window.location.href
});

// 检查axios实例配置
import { api } from './config/api';
console.log('Axios基础URL:', api.defaults.baseURL);
```

## 🎯 预防措施

### 1. 环境变量配置

在生产环境中，可以设置环境变量来固定API地址：

```bash
# 在服务器上设置
export REACT_APP_API_BASE=http://你的服务器IP:8080
```

### 2. 域名配置

如果有固定域名，推荐配置域名而不是IP：

```bash
export REACT_APP_API_BASE=http://yourdomain.com:8080
```

### 3. 反向代理

考虑使用Nginx等反向代理，这样前端和后端可以使用相同端口：

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        root /path/to/ubuntu-deploy-ready/static;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:8080;
    }
}
```

## ✅ 验证成功

### 阶段1: API连接正常 (已完成)
✅ **浏览器地址栏**: `http://你的服务器IP:8080`  
✅ **开发者工具Network面板**: API请求指向 `http://你的服务器IP:8080/api/*`  
✅ **控制台**: 没有 `ERR_CONNECTION_REFUSED` 错误  

### 阶段2: 后端服务正常 (需要解决500错误)
⚠️ **当前状态**: API连接成功但返回500内部错误  
🎯 **目标**: API返回正常响应（401未授权是正常的）  

完全成功后，你应该看到：
1. **登录尝试**: 返回401或具体的登录错误信息，而不是500
2. **注册功能**: 正常工作或返回具体业务错误
3. **Health检查**: `curl http://localhost:8080/health` 返回200
4. **Dashboard**: `curl http://localhost:8080/api/dashboard/stats` 返回401

---

**关键要点**: 确保上传最新构建的前端文件，并强制刷新浏览器缓存！