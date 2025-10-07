# QuickTalk React 前端重构指南

## 🚀 快速开始

### 1. 安装前端依赖
```powershell
cd frontend-react
npm install
```

### 2. 启动开发服务器
```powershell
# 后端 (Rust)
cd backend
cargo run

# 前端 (React) - 新终端
cd frontend-react
npm run dev
```

### 3. 访问应用
- **React 开发服务器**: http://localhost:5173 (热重载)
- **Rust 后端服务**: http://localhost:3030
- **生产构建**: `npm run build` 后由 Rust 提供服务

## 🏗️ 架构说明

### 前端架构 (React + TypeScript + Vite)
```
frontend-react/
├── src/
│   ├── components/          # 可复用组件
│   │   ├── common/         # 通用组件
│   │   ├── chat/           # 聊天相关组件
│   │   └── admin/          # 管理相关组件
│   ├── pages/              # 页面组件
│   │   ├── CustomerService.tsx
│   │   ├── AdminDashboard.tsx
│   │   └── MobileAdmin.tsx
│   ├── services/           # API 服务
│   ├── types/              # TypeScript 类型定义
│   ├── hooks/              # 自定义 Hooks
│   └── utils/              # 工具函数
└── dist/                   # 构建输出
```

### 后端架构 (DDD + Rust)
```
backend/src/
├── domain/                 # 领域层
│   ├── conversation/       # 对话聚合
│   ├── shop/               # 商店聚合
│   └── shared/             # 共享类型
├── application/            # 应用层 (用例)
│   ├── send_message.rs
│   └── create_conversation.rs
├── db/                     # 基础设施层
│   └── conversation_repository_sqlx.rs
└── api/                    # 接口层
    ├── conversations.rs    # 传统 API
    └── ddd_conversations.rs # DDD API
```

## 🔄 迁移步骤

### 第一阶段: 核心功能迁移
- [x] 创建 React 项目结构
- [x] 实现 DDD 后端架构
- [x] 创建 API 服务层
- [ ] 实现核心聊天组件
- [ ] 添加 WebSocket 支持

### 第二阶段: 管理功能
- [ ] 管理后台迁移
- [ ] 移动端适配
- [ ] 用户权限控制

### 第三阶段: 高级功能
- [ ] 实时通知
- [ ] 文件上传
- [ ] 数据统计

## 🛠️ 开发规范

### API 调用方式
```typescript
// 使用新的 DDD API
import { conversationApi } from '@/services/api'

// 发送消息
await conversationApi.sendMessage({
  conversationId: '123',
  content: '你好',
  type: 'text'
})
```

### 组件开发模式
```typescript
// 使用 TypeScript + React hooks
import React from 'react'
import { Conversation } from '@/types'

interface Props {
  conversation: Conversation
  onSendMessage: (content: string) => void
}

const ChatComponent: React.FC<Props> = ({ conversation, onSendMessage }) => {
  // 组件逻辑
  return <div>...</div>
}
```

## 🔧 配置说明

### Vite 代理配置
- API 请求 (`/api/*`) 代理到 `http://localhost:3030`
- WebSocket (`/ws`) 代理到 `ws://localhost:3030`

### 环境变量
```env
VITE_API_BASE_URL=http://localhost:3030
VITE_WS_URL=ws://localhost:3030/ws
```

## 📋 待办事项

- [ ] 完成核心组件实现
- [ ] 添加 WebSocket 客户端
- [ ] 实现状态管理 (React Query)
- [ ] 添加错误边界和加载状态
- [ ] 响应式设计优化
- [ ] 单元测试覆盖
- [ ] 性能优化和代码分割

## 🚨 注意事项

1. **禁止使用 Node.js 后端** - 仅使用 Rust 后端
2. **保持 API 兼容性** - 逐步迁移，确保旧功能正常
3. **移动端优先** - 确保所有组件响应式设计
4. **类型安全** - 充分利用 TypeScript 类型检查
5. **性能考虑** - 使用 React.memo 和 useMemo 优化渲染

---
*更新时间: 2025年10月7日*