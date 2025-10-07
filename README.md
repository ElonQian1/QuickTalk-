# 多店铺客服聊天系统

类似微信界面的移动端客服后台系统，支持多店铺实时聊天功能。

## 系统架构

- **后端**: Rust + WebSocket + SQLite
- **前端**: React + 移动端适配
- **SDK**: JavaScript WebSocket SDK

## 功能特性

- 📱 移动端优先的界面设计
- 🏪 多店铺管理
- 💬 实时聊天功能
- 🔔 未读消息提醒
- 📊 消息状态管理

## 项目结构

```
customer-service-system/
├── backend/           # Rust 后端服务
├── frontend/          # React 前端应用
├── websocket-sdk/     # WebSocket SDK
└── README.md
```

## 快速开始

### 后端开发
```bash
cd backend
cargo run
```

### 前端开发
```bash
cd frontend
npm install
npm start
```

### SDK 使用
```javascript
import { ChatSDK } from './websocket-sdk';

const sdk = new ChatSDK('ws://localhost:8080');
sdk.connect();
```

## 系统流程

1. 独立站前端集成 WebSocket SDK
2. 客户通过 SDK 连接到服务器
3. 店主通过移动端 APP 管理客户对话
4. 实时消息推送和状态同步