# 动态IP环境配置指南

## 问题描述
当服务器IP地址动态变化时，前端硬编码的API地址会导致连接失败。

## 解决方案

### 1. 前端自动检测配置
已修改 `frontend/src/config/api.ts`，实现以下功能：

```typescript
const getApiBase = (): string => {
  // 优先使用环境变量
  if (process.env.REACT_APP_API_BASE) {
    return process.env.REACT_APP_API_BASE;
  }
  
  // 在浏览器环境中，自动使用当前域名和端口
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    // 如果是标准HTTP/HTTPS端口，直接使用当前地址
    if (window.location.port === '8080' || window.location.port === '8443') {
      return `${protocol}//${hostname}:${window.location.port}`;
    }
    // 否则默认使用8080端口
    return `${protocol}//${hostname}:8080`;
  }
  
  // 服务端渲染或其他环境的后备地址
  return 'http://localhost:8080';
};
```

### 2. 工作原理

#### 场景1: 直接访问服务器
- 访问地址: `http://43.139.82.12:8080`
- API地址自动设置为: `http://43.139.82.12:8080`

#### 场景2: 使用域名访问
- 访问地址: `http://elontalk.duckdns.org:8080`
- API地址自动设置为: `http://elontalk.duckdns.org:8080`

#### 场景3: IP地址变更
- 新IP: `http://123.456.789.10:8080`
- API地址自动适配: `http://123.456.789.10:8080`

#### 场景4: 使用环境变量覆盖
```bash
# 在启动前设置环境变量
export REACT_APP_API_BASE=http://your-custom-api-server.com:8080
```

### 3. 部署更新

#### 方法1: 本地更新后重新部署
```bash
# Windows环境
./update-frontend.bat

# 然后将 ubuntu-deploy-ready 目录重新上传到服务器
```

#### 方法2: 服务器端更新（如果已有新文件）
```bash
# 在服务器上运行
./update-frontend.sh
```

### 4. 验证配置

#### 浏览器控制台检查
```javascript
// 打开浏览器开发者工具，运行以下代码
console.log('当前API基础地址:', window.location.origin);

// 检查实际API调用
fetch('/api/dashboard/stats')
  .then(response => response.json())
  .then(data => console.log('API连接正常:', data))
  .catch(error => console.error('API连接失败:', error));
```

#### 网络面板检查
1. 打开开发者工具
2. 切换到 Network 标签页
3. 刷新页面
4. 查看API请求的URL是否正确

### 5. 常见问题排查

#### 问题: 仍然连接到localhost
**原因**: 浏览器缓存了旧的JavaScript文件
**解决**: 强制刷新页面 (Ctrl+F5 或 Ctrl+Shift+R)

#### 问题: CORS错误
**原因**: 后端CORS配置不包含新的域名/IP
**解决**: 检查后端CORS配置是否允许当前访问地址

#### 问题: 混合内容错误 (Mixed Content)
**原因**: HTTPS页面调用HTTP API
**解决**: 确保协议一致，或使用HTTPS访问

### 6. 高级配置

#### 环境变量配置文件
创建 `.env` 文件（仅开发环境）:
```env
REACT_APP_API_BASE=http://your-server-ip:8080
```

#### DuckDNS动态域名
如果使用DuckDNS等动态域名服务:
```bash
# 更新域名解析
curl "https://www.duckdns.org/update?domains=elontalk&token=your-token&ip="
```

### 7. 监控和维护

#### 定期检查
- API连接状态
- IP地址变更
- 域名解析状态

#### 自动化脚本
可以创建定时任务监控IP变更并自动更新配置。

## 总结

通过前端自动检测配置，系统现在可以：
✅ 自动适配当前访问地址
✅ 支持IP地址动态变更
✅ 支持域名和直接IP访问
✅ 支持环境变量覆盖

无需手动修改配置文件，系统会自动适配当前的网络环境。