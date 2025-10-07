# 开发环境部署指南

## 环境要求

### 后端 (Rust)
- Rust 1.70+
- Cargo
- SQLite3

### 前端 (React)
- Node.js 16+
- npm 或 yarn

### WebSocket SDK
- TypeScript 4.0+
- 支持现代浏览器

## 快速启动

### 方法一：使用启动脚本

**Windows:**
```bash
双击运行 start.bat
```

**Linux/macOS:**
```bash
chmod +x start.sh
./start.sh
```

### 方法二：手动启动

1. **启动后端服务**
```bash
cd backend
cargo run
```
后端将在 http://localhost:8080 启动

2. **启动前端服务**
```bash
cd frontend
npm install
npm start
```
前端将在 http://localhost:3000 启动

## 数据库初始化

数据库将在首次启动时自动创建和初始化。

如需手动初始化：
```bash
cd backend
# 数据库文件会在项目根目录下自动创建为 customer_service.db
```

## 测试账户

**管理员账户:**
- 用户名: admin
- 密码: admin123

**测试店主账户:**
- 用户名: shop_owner_1
- 密码: password123

## 开发配置

### 后端配置
编辑 `backend/.env` 文件：
```env
DATABASE_URL=sqlite:customer_service.db
JWT_SECRET=your-super-secret-jwt-key
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
```

### 前端配置
React 应用会自动代理 API 请求到后端服务器。

### WebSocket SDK 配置
编辑 SDK 配置：
```javascript
const sdk = createCustomerServiceSDK({
  serverUrl: 'ws://localhost:8080',
  apiKey: 'your-shop-api-key',
  customerId: 'unique-customer-id'
});
```

## API 接口

### 认证接口
- `POST /api/auth/login` - 登录
- `POST /api/auth/register` - 注册

### 店铺管理
- `GET /api/shops` - 获取店铺列表
- `POST /api/shops` - 创建店铺

### 客户管理
- `GET /api/shops/:shopId/customers` - 获取客户列表

### 消息管理
- `GET /api/sessions/:sessionId/messages` - 获取消息历史
- `POST /api/sessions/:sessionId/messages` - 发送消息

### WebSocket 接口
- `/ws/staff/:userId` - 客服人员 WebSocket 连接
- `/ws/customer/:shopId/:customerId` - 客户 WebSocket 连接

## 部署到生产环境

### 后端部署
```bash
cd backend
cargo build --release
./target/release/customer-service-backend
```

### 前端构建
```bash
cd frontend
npm run build
# 将 build 目录部署到 Web 服务器
```

### WebSocket SDK 构建
```bash
cd websocket-sdk
npm run build
# 将 dist 目录发布到 npm 或 CDN
```

## 故障排除

### 常见问题

1. **端口冲突**
   - 后端默认端口 8080
   - 前端默认端口 3000
   - 可在配置文件中修改

2. **数据库连接失败**
   - 检查 SQLite 文件权限
   - 确认数据库文件路径正确

3. **WebSocket 连接失败**
   - 检查防火墙设置
   - 确认 WebSocket 端口开放

4. **前端编译错误**
   - 删除 node_modules 重新安装
   - 检查 Node.js 版本

### 日志查看

**后端日志:**
```bash
RUST_LOG=debug cargo run
```

**前端日志:**
浏览器开发者工具 Console 面板

## 扩展开发

### 添加新功能
1. 后端：在 `handlers` 目录添加新的处理器
2. 前端：在 `pages` 或 `components` 目录添加新组件
3. 数据库：修改 `database_schema.sql` 添加新表

### 自定义样式
修改 `frontend/src/styles/globalStyles.ts` 中的主题配置

### 集成第三方服务
在对应的模块中添加集成代码，如支付、邮件等服务