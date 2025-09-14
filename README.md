# QuickTalk 客服系统

## 📋 项目简介

QuickTalk是一个现代化的实时客服系统，基于Node.js开发，支持WebSocket实时通信，提供完整的客服管理解决方案。

## ✨ 主要功能

- **实时对话**: WebSocket支持的实时消息通信
- **多店铺管理**: 支持多个店铺独立管理客服服务
- **移动端适配**: 完整的移动端支持
- **权限控制**: 细粒度的用户权限管理
- **数据统计**: 丰富的数据分析和报表功能
- **第三方集成**: 简单的集成代码，快速接入现有网站

## 🚀 快速开始

### 环境要求
- Node.js 14.0+
- SQLite 3.0+ (或 MySQL 5.7+)

### 安装步骤

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置环境**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件设置数据库和其他配置
   ```

3. **启动服务**
   ```bash
   # 开发模式
   npm run dev
   
   # 生产模式
   npm start
   ```

4. **访问系统**
   - 主页面: http://localhost:3030
   - 管理后台: http://localhost:3030/admin
   - 移动端管理: http://localhost:3030/mobile-admin

## � 集成说明

### 网站集成

在您的网站中添加以下代码即可集成客服功能：

```html
<!-- 在 </head> 标签前添加 -->
<link rel="stylesheet" href="http://your-domain.com/assets/css/customer-service.css">

<!-- 在 </body> 标签前添加 -->
<script src="http://your-domain.com/integration-code-final-fixed.html"></script>
```

### 自定义配置

可以通过修改集成代码中的配置参数来自定义客服窗口的外观和行为。

## 🔧 系统配置

### 数据库配置

默认使用SQLite数据库，生产环境建议使用MySQL：

```javascript
// 修改 database.js 中的配置
const config = {
  type: 'mysql',  // 或 'sqlite'
  host: 'localhost',
  port: 3306,
  database: 'quicktalk',
  username: 'your_username',
  password: 'your_password'
};
```

### 管理员账号

默认管理员账号：
- 用户名: admin
- 密码: admin123

⚠️ **重要**: 首次部署后请立即修改默认密码！

## � 功能模块

### 客服管理
- 实时对话处理
- 客户信息管理  
- 对话历史记录
- 客服工作量统计

### 店铺管理
- 多店铺支持
- 店铺认证和审核
- 集成代码生成
- 店铺权限控制

### 系统管理
- 用户权限管理
- 系统参数配置
- 数据统计分析
- 日志监控

## � 安全说明

- 所有API接口支持身份验证
- WebSocket连接经过安全验证
- 支持HTTPS/WSS加密传输
- 敏感数据加密存储

## � 更多文档

- [API文档](./docs/API_DOCUMENTATION.md)
- [用户指南](./docs/USER_GUIDE.md)
- [部署指南](./docs/DEPLOYMENT_GUIDE.md)

## 🆘 技术支持

如有问题或需要技术支持，请联系开发团队。

## 📄 许可证

本项目采用 MIT 许可证。

---

**QuickTalk - 让客服更简单，让沟通更高效！**
