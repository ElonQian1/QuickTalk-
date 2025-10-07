# 客服系统开发环境配置

## 🚀 快速启动

### 前端 + SDK 开发（推荐）

```bash
# 在项目根目录运行
npm run dev
```

这个命令会同时启动：
- ✅ 前端开发服务器（React，端口3000）
- ✅ WebSocket SDK 监控编译

### 完整开发环境（需要修复后端编译问题）

```bash
# 完整启动前后端+SDK
npm run dev:full
```

## 📁 项目结构

```
customer-service-system/
├── package.json          # 根项目配置
├── frontend/             # React前端
├── backend/              # Rust后端
└── websocket-sdk/        # TypeScript SDK
```

## 🛠 开发脚本说明

| 命令 | 功能 | 状态 |
|------|------|------|
| `npm run dev` | 启动前端+SDK | ✅ 可用 |
| `npm run dev:full` | 启动前后端+SDK | ⚠️ 需要修复后端 |
| `npm run frontend:only` | 仅启动前端 | ✅ 可用 |
| `npm run backend:only` | 仅启动后端 | ⚠️ 编译问题 |
| `npm run install:all` | 安装所有依赖 | ✅ 可用 |

## 🔧 当前状态

### ✅ 已配置完成
- [x] 根目录统一开发脚本
- [x] 前端热重载（React，端口3000）
- [x] WebSocket SDK 自动编译
- [x] 并行执行工具（concurrently）

### ⚠️ 需要解决
- [ ] 后端Rust编译环境问题
- [ ] 后端热重载配置（cargo-watch已安装）

## 🐛 后端编译问题

当前后端遇到MinGW工具链编译问题，建议解决方案：

### 方案1：安装Visual Studio Build Tools
1. 下载安装 Visual Studio Build Tools
2. 选择 C++ 构建工具
3. 切换Rust工具链：`rustup default stable-x86_64-pc-windows-msvc`

### 方案2：使用Docker（推荐）
```bash
# 在backend目录创建Dockerfile
cd backend
# 使用Rust官方镜像编译和运行
```

### 方案3：WSL环境
在Windows Subsystem for Linux中开发Rust后端

## 🌐 访问地址

- **前端开发服务器**: http://localhost:3000
- **后端API服务器**: http://localhost:8080 (待修复)

## 📦 依赖管理

```bash
# 安装所有项目依赖
npm run install:all

# 分别安装
cd frontend && npm install
cd websocket-sdk && npm install
```

## 🔄 热重载说明

- **前端**: 自动热重载，保存即更新
- **SDK**: 自动编译，监控TypeScript变更
- **后端**: 配置了cargo-watch，修复编译问题后可用

## 💡 开发建议

1. 先使用 `npm run dev` 开发前端功能
2. 后端可以先用现有的build产物或mock数据
3. 解决编译问题后再使用 `npm run dev:full`

## 🚨 常见问题

### Q: 前端代理错误？
A: 正常，后端服务未启动导致。不影响前端开发。

### Q: SDK编译错误？
A: 已修复NodeJS.Timeout类型问题。

### Q: 如何单独启动某个服务？
A: 使用对应的脚本：
```bash
npm run frontend:only
npm run backend:only  # 需要先修复编译问题
```