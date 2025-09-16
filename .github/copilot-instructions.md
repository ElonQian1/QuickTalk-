# QuickTalk 客服系统 - AI 编码指南

## 🏗️ 架构概览

这是一个模块化的实时客服系统，采用 Node.js + WebSocket + SQLite/内存数据库的架构。

### 核心组件
- **`server.js`**: 主服务器，集成模块化系统和兼容性模块
- **`src/modules/ModularApp.js`**: 旧版模块化架构（已被替换）
- **`src/app/modular-app.js`**: 新模块化应用管理器（当前活跃）
- **`src/websocket/WebSocketRouter.js`**: WebSocket 路由系统
- **`src/database/`**: 数据库层（database-core.js, shop-repository.js, message-repository.js）
- **`src/client-api/`**: 客户端API路由和处理器
- **`static/`**: 前端静态文件（分为桌面端/移动端）

## 🔄 开发工作流

### 多终端运行模式 (重要!)
**始终使用独立终端运行不同服务，避免阻塞:**

```bash
# 终端 1: 启动后端服务器（开发模式，支持热加载）
npm run dev  # 使用 nodemon，自动重载

# 终端 2: 运行测试脚本
node test-*.js

# 终端 3: 数据库相关操作
node debug-database.js
node setup-test-data.js
```

### ⚠️ 开发模式重要原则
- **不要重启服务器**: 使用 `npm run dev` 开发模式，支持热加载
- **不要检测服务器状态**: AI代理开发时不需要检查服务器是否启动
- **不要自动重启服务**: 代码修改时让 nodemon 自动处理重载
- **日志获取**: 如果无法获取后端/前台日志，请用户复制日志内容提供给AI代理

### 数据库切换
```bash
# 切换到内存数据库（开发/测试）
npm run db:memory

# 切换到 SQLite 数据库（生产）
npm run db:sqlite
```

## 🔧 项目特定模式

### 双数据库系统
- **`database-sqlite.js`**: 持久化 SQLite 数据库
- **`database-memory.js`**: 内存数据库（测试用）
- 通过 npm scripts 动态切换，自动修改 `server.js` 中的 require 路径

### WebSocket 通信模式
```javascript
// 客户端连接模式
ws://localhost:3030/ws

// 消息格式标准
{
  type: 'message|join|leave|typing',
  content: 'text',
  userId: 'uuid',
  timestamp: Date.now()
}
```

### 模块化初始化顺序
1. 数据库层 (`database-sqlite` 或 `database-memory`)
2. 仓库层 (`ShopRepository`, `MessageAdapter`)
3. 安全层 (`SecurityManager`)
4. WebSocket 路由 (`WebSocketRouter`)
5. Express 路由集成

## 🧪 测试和调试

### 重要测试文件
- **`test-complete-websocket.js`**: 完整 WebSocket 功能测试
- **`test-message-flow.js`**: 消息流测试
- **`debug-database.js`**: 数据库状态检查
- **`setup-test-data.js`**: 初始化测试数据

### 调试工具
```bash
# 检查数据库结构
node check-database-structure.js

# 调试用户-店铺关系
node debug-user-shops.js

# 测试客户端API
node test-client-api.js
```

## 🔗 集成模式

### 嵌入式客服代码
使用 `integration-code-*.html` 文件生成第三方网站嵌入代码:
- **Smart Polling**: `integration-code-smart-polling.html`
- **WebSocket**: `integration-code-websocket.html`
- **Final Fixed**: `integration-code-final-fixed.html`

### API 端点
```javascript
// 客户端 API
GET  /api/messages/:conversationId  // 获取消息历史
POST /api/send                      // 发送消息
POST /api/connect                   // 建立连接

// 管理端 API
GET  /admin                         // 管理后台
POST /api/admin/login              // 管理员登录
```

## 📱 移动端支持

项目包含专门的移动端模块 (`src/mobile/`), 使用响应式设计适配手机端访问。

## ⚠️ 重要约定

- **开发模式优先**: 使用 `npm run dev` 启动，支持热加载，无需手动重启
- **不要重启服务器**: AI代理开发过程中禁止检测或重启服务器
- **日志处理**: 无法获取后端日志时，请用户复制日志内容提供
- **数据库选择**: 开发用内存库，生产用 SQLite
- **WebSocket 优先**: 实时功能依赖 WebSocket，HTTP API 仅作补充
- **模块化开发**: 新功能添加到 `src/modules/` 而非主 `server.js`

## 🔥 代码统一性原则 (重要!)

### 避免重复代码和多版本共存
- **禁止创建新旧两套代码**: AI代理开发时必须检测现有功能，如发现重复逻辑应立即合并
- **单一代码路径**: 项目必须始终保持只有一套代码，不允许多个版本的功能同时存在
- **重构而非增加**: 发现类似功能时，应重构现有代码而不是创建新的实现
- **主动检测重复**: 开发前必须搜索现有代码，确认功能是否已存在
- **删除过时代码**: 实现新功能后，必须删除被替换的旧代码和文件

### 代码一致性检查清单
在开发任何功能前，AI代理必须执行以下检查：
1. **搜索现有实现**: 使用 `grep_search` 和 `semantic_search` 查找相似功能
2. **分析代码重复**: 检查是否存在相同或类似的逻辑实现
3. **评估合并可能**: 判断是否可以重构现有代码而非新建
4. **清理过时代码**: 完成新功能后，删除所有被替换的旧实现
5. **验证单一路径**: 确保功能只有一个入口点和实现路径

## 🤝 多人团队Git协作规范

### 模块化开发原则
- **独立模块边界**: 每个功能模块应有清晰的边界，避免跨模块依赖冲突
- **接口约定优先**: 模块间通过明确的接口约定通信，减少合并冲突
- **最小化文件修改**: 每次提交只修改必要的文件，避免大范围变更
- **向后兼容**: 新功能应保持与现有模块的向后兼容性

### Git协作最佳实践
- **功能分支开发**: 每个新功能在独立分支开发，完成后合并到主分支
- **小粒度提交**: 每个commit应该是一个完整的、可工作的功能单元
- **清晰的提交信息**: 使用 `feat:`, `fix:`, `refactor:`, `docs:` 等前缀
- **代码审查友好**: 保持代码结构清晰，添加必要的注释和文档

### 合并冲突预防
- **模块独立性**: 不同开发者负责不同模块，减少同文件冲突
- **配置文件版本化**: 重要配置使用版本号，避免环境差异
- **依赖管理**: 统一使用package.json管理依赖，避免版本冲突
- **数据库迁移**: 使用标准化的数据库迁移脚本，确保多环境一致

## 📁 详细文件结构

### 根目录关键文件
```
QuickTalk-/
├── server.js                 # 主服务器入口，集成新旧系统
├── package.json              # 依赖和scripts定义
├── database-sqlite.js        # SQLite数据库实现
├── database-memory.js        # 内存数据库（测试用）
├── auth-routes.js           # 认证路由
└── .github/
    └── copilot-instructions.md  # 本文件
```

### 核心模块结构
```
src/
├── app/
│   └── modular-app.js       # 新模块化应用主控制器（当前活跃）
├── modules/
│   └── ModularApp.js        # 旧模块化系统（已被替换）
├── database/
│   ├── database-core.js     # 数据库核心抽象
│   ├── shop-repository.js   # 店铺数据仓库
│   └── message-repository.js # 消息数据仓库
├── client-api/
│   ├── client-api-router.js # 客户端API路由
│   ├── connection-handler.js # 连接处理器
│   └── message-handler.js   # 消息处理器
└── websocket/
    └── WebSocketRouter.js   # WebSocket路由系统
```

## 🏗️ 构建和验证步骤

### 环境要求
- Node.js 16+ 
- npm 或 yarn
- SQLite3 (生产环境)

### 完整启动流程
```bash
# 1. 安装依赖（首次运行必须）
npm install

# 2. 选择数据库模式
npm run db:memory    # 开发/测试环境
npm run db:sqlite    # 生产环境

# 3. 启动开发服务器（推荐）
npm run dev         # 支持热重载，代码修改自动重启

# 4. 生产环境启动
npm start          # 不支持热重载
```

### 重要端点验证
启动后验证以下端点可正常访问：
- `http://localhost:3030/` - 项目主页
- `http://localhost:3030/admin` - 管理后台
- `http://localhost:3030/customer` - 客服聊天
- `ws://localhost:3030/ws` - WebSocket连接

### 测试和调试命令
```bash
# 数据库结构检查
node debug-database.js

# 完整WebSocket功能测试
node test-complete-websocket.js

# 消息流测试
node test-message-flow.js

# 设置测试数据
node setup-test-data.js

# 团队协作验证
npm test                    # 运行所有测试，确保不破坏现有功能
npm run lint               # 代码风格检查（如果配置）
git diff --name-only       # 检查修改的文件范围
git log --oneline -5       # 查看最近的提交历史
```

### 团队协作验证清单
开发完成后，AI代理应验证：
1. **功能完整性**: 新功能正常工作且不影响现有功能
2. **模块独立性**: 修改范围控制在相关模块内
3. **接口兼容性**: 公共接口保持向后兼容
4. **文档同步**: 重要变更更新相关文档
5. **测试覆盖**: 新功能有相应的测试用例

## 🚫 开发约束
- **禁止手动重启服务器**: 使用nodemon的热重载功能
- **禁止检测服务器状态**: AI代理不应尝试检查服务器是否运行
- **多终端原则**: 不同功能使用独立终端，避免阻塞
- **禁止重复代码**: 严禁创建功能相同或相似的多个实现
- **禁止版本共存**: 不允许新旧两套代码同时存在于项目中
- **强制代码统一**: 发现重复逻辑必须立即合并，保持单一代码路径
- **清理义务**: 实现新功能后必须删除所有被替换的旧代码和文件
- **模块化约束**: 新功能必须遵循现有模块结构，不得破坏模块边界
- **Git协作约束**: 避免修改核心配置文件，优先扩展而非替换现有功能
- **接口稳定性**: 修改公共接口时必须保持向后兼容或提供迁移路径