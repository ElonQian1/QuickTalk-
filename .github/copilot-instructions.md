# QuickTalk 客服系统 - AI 编码指南

## 🏗️ 项目概述

QuickTalk 是一个模块化的实时客服系统，基于 Node.js + WebSocket + SQLite 架构。系统支持多店铺管理，提供完整的客服解决方案，包括桌面端和移动端支持。

### 技术栈
- **后端**: Node.js 16+, Express, WebSocket (ws), SQLite3
- **前端**: 原生JavaScript (ES6+), CSS3, HTML5
- **数据库**: SQLite (生产) / 内存数据库 (开发测试)
- **实时通信**: WebSocket
- **开发工具**: nodemon (热重载)

## 🔧 核心架构组件

### 服务端架构 (重构后)
- **`server.js`**: 主服务器入口，集成新旧系统和兼容性模块
- **`src/app/modular-app.js`**: 新模块化应用管理器 (当前活跃)
- **`src/modules/ModularApp.js`**: 旧模块化系统 (已被替换，待删除)
- **`src/websocket/WebSocketRouter.js`**: WebSocket路由系统
- **`src/database/`**: 数据库层（database-core.js, shop-repository.js, message-repository.js）
- **`src/client-api/`**: 客户端API路由和处理器 (connection-handler.js, message-handler.js)

### 前端架构 (重构中)
```
static/
├── production/              # 生产环境文件
│   ├── admin/              # 管理后台
│   ├── customer/           # 客户端
│   └── shared/             # 共享组件
├── assets/                 # 静态资源 (重构后)
│   ├── css/               # 样式系统 (分层架构)
│   ├── js/                # JavaScript模块 (模块化重组)
│   ├── images/            # 图片资源
│   └── fonts/             # 字体文件
└── development/            # 开发环境 (演示、测试、文档)
```

## � 快速开始

### 环境要求
- Node.js 16+
- npm 或 yarn
- SQLite3 (生产环境)

### 启动流程 (必须按顺序执行)
```bash
# 1. 安装依赖 (首次运行必须)
npm install

# 2. 选择数据库模式
npm run db:memory    # 开发/测试环境 (推荐)
npm run db:sqlite    # 生产环境

# 3. 启动开发服务器 (推荐)
npm run dev         # 支持热重载，代码修改自动重启

# 4. 生产环境启动
npm start          # 不支持热重载
```

### 重要端点验证
启动后验证以下端点：
- `http://localhost:3030/` - 项目主页
- `http://localhost:3030/admin` - 管理后台
- `http://localhost:3030/customer` - 客服聊天
- `ws://localhost:3030/ws` - WebSocket连接

## 🔄 开发工作流

### ⚠️ 关键开发原则
- **使用开发模式**: 始终使用 `npm run dev` 启动，支持热重载
- **禁止重启服务器**: AI代理开发时不要手动检测或重启服务器
- **多终端运行**: 使用独立终端运行不同服务，避免阻塞
- **日志获取**: 无法获取后端日志时，请用户提供日志内容

### 数据库切换机制
- **`database-sqlite.js`**: 持久化数据库 (生产)
- **`database-memory.js`**: 内存数据库 (开发测试)
- 通过npm scripts自动修改 `server.js` 中的require路径

### WebSocket通信标准
```javascript
// 连接端点
ws://localhost:3030/ws

// 消息格式
{
  type: 'message|join|leave|typing',
  content: 'text',
  userId: 'uuid',
  timestamp: Date.now()
}
```

## 🧪 测试和调试

### 重要测试文件
```bash
# 数据库相关
node debug-database.js           # 数据库状态检查
node setup-test-data.js         # 初始化测试数据

# WebSocket测试
node test-complete-websocket.js # 完整WebSocket功能测试
node test-message-flow.js       # 消息流测试

# 客户端API测试
node test-client-api.js         # 客户端API测试
```

### 团队协作验证
```bash
npm test                        # 运行所有测试
git diff --name-only           # 检查修改范围
git log --oneline -5           # 查看提交历史
```

## 🔥 代码统一性原则 (重要!)

### 避免重复代码和多版本共存
- **禁止创建新旧两套代码**: AI代理开发时必须检测现有功能，发现重复逻辑应立即合并
- **单一代码路径**: 项目必须始终保持只有一套代码，不允许多个版本功能同时存在
- **重构而非增加**: 发现类似功能时，应重构现有代码而不是创建新实现
- **主动检测重复**: 开发前必须搜索现有代码，确认功能是否已存在
- **删除过时代码**: 实现新功能后，必须删除被替换的旧代码和文件

### 代码一致性检查清单
在开发任何功能前，AI代理必须执行：
1. **搜索现有实现**: 使用 `grep_search` 和 `semantic_search` 查找相似功能
2. **分析代码重复**: 检查是否存在相同或类似逻辑实现
3. **评估合并可能**: 判断是否可重构现有代码而非新建
4. **清理过时代码**: 完成新功能后，删除所有被替换的旧实现
5. **验证单一路径**: 确保功能只有一个入口点和实现路径

## 🤝 多人团队Git协作规范

### 模块化开发原则
- **独立模块边界**: 每个功能模块应有清晰边界，避免跨模块依赖冲突
- **接口约定优先**: 模块间通过明确接口约定通信，减少合并冲突
- **最小化文件修改**: 每次提交只修改必要文件，避免大范围变更
- **向后兼容**: 新功能应保持与现有模块的向后兼容性

### Git协作最佳实践
- **功能分支开发**: 每个新功能在独立分支开发，完成后合并到主分支
- **小粒度提交**: 每个commit应该是完整的、可工作的功能单元
- **清晰的提交信息**: 使用 `feat:`, `fix:`, `refactor:`, `docs:` 等前缀
- **代码审查友好**: 保持代码结构清晰，添加必要注释和文档

### 合并冲突预防
- **模块独立性**: 不同开发者负责不同模块，减少同文件冲突
- **配置文件版本化**: 重要配置使用版本号，避免环境差异
- **依赖管理**: 统一使用package.json管理依赖，避免版本冲突
- **数据库迁移**: 使用标准化的数据库迁移脚本，确保多环境一致

## 📁 详细文件结构

### 根目录关键文件
```
QuickTalk-/
├── server.js                 # 主服务器入口
├── package.json              # 依赖和scripts配置
├── database-sqlite.js        # SQLite数据库实现
├── database-memory.js        # 内存数据库(测试用)
├── auth-routes.js           # 认证路由
├── docs/                    # 项目文档
│   ├── MODULAR_ARCHITECTURE.md
│   ├── FILE_ORGANIZATION_STANDARDS.md
│   └── 最终交付版本结构.md
└── .github/
    └── copilot-instructions.md  # 本文件
```

### 核心模块结构 (重构后)
```
src/
├── app/
│   └── modular-app.js       # 新模块化应用主控制器 (当前活跃)
├── modules/
│   └── ModularApp.js        # 旧模块化系统 (已被替换，待删除)
├── database/
│   ├── database-core.js     # 数据库核心抽象
│   ├── shop-repository.js   # 店铺数据仓库
│   └── message-repository.js # 消息数据仓库
├── client-api/
│   ├── client-api-router.js # 客户端API路由
│   ├── connection-handler.js # 连接处理器
│   ├── message-handler.js   # 消息处理器
│   └── ClientApiHandler.js  # API处理器
├── websocket/
│   └── WebSocketRouter.js   # WebSocket路由系统
└── security/                # 安全模块
```

### 前端文件结构 (重构进行中)
```
static/
├── production/              # 生产环境 (客户交付)
│   ├── admin/              # 管理后台
│   ├── customer/           # 客户端
│   └── shared/             # 共享组件
├── assets/                 # 静态资源 (重构后)
│   ├── css/               # 分层样式系统
│   ├── js/                # 模块化JavaScript
│   │   ├── core/          # 核心模块
│   │   ├── modules/       # 业务模块 (按功能分组)
│   │   ├── components/    # UI组件
│   │   └── pages/         # 页面脚本
│   ├── images/            # 图片资源
│   └── fonts/             # 字体文件
└── development/            # 开发环境 (演示、测试、文档)
```

## 🚫 严格开发约束

- **禁止手动重启服务器**: 使用nodemon热重载功能
- **禁止检测服务器状态**: AI代理不应尝试检查服务器是否运行
- **禁止重复代码**: 严禁创建功能相同或相似的多个实现
- **禁止版本共存**: 不允许新旧两套代码同时存在于项目中
- **强制代码统一**: 发现重复逻辑必须立即合并，保持单一代码路径
- **清理义务**: 实现新功能后必须删除所有被替换的旧代码和文件
- **模块化约束**: 新功能必须遵循现有模块结构，不得破坏模块边界
- **Git协作约束**: 避免修改核心配置文件，优先扩展而非替换现有功能
- **接口稳定性**: 修改公共接口时必须保持向后兼容或提供迁移路径

## 🎯 团队协作验证清单

开发完成后，AI代理应验证：
1. **功能完整性**: 新功能正常工作且不影响现有功能
2. **模块独立性**: 修改范围控制在相关模块内
3. **接口兼容性**: 公共接口保持向后兼容
4. **文档同步**: 重要变更更新相关文档
5. **测试覆盖**: 新功能有相应的测试用例

## 💡 重要提醒

- **优先重构**: 发现重复或过时代码时，优先重构而非新建
- **信任指令**: 优先使用本指令中的信息，仅在信息不完整或错误时才搜索
- **保持整洁**: 始终保持代码库整洁，及时清理无用代码和文件
- **模块优先**: 新功能应添加到相应模块，而非直接修改主服务器文件