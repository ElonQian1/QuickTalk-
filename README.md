# 多店铺客服聊天系统

> Rust 后端 + React 前端 + WebSocket SDK 的多店铺客服 / 实时聊天系统。

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

### 1. 环境要求 (Windows)
| 组件 | 必须 | 说明 |
|------|------|------|
| Rust (rustup) | ✅ | https://rustup.rs 安装稳定版 |
| Visual C++ Build Tools (MSVC) | ✅ | 提供 `link.exe`，否则后端无法链接 |
| Node.js (>=16) | ✅ | 前端 & 脚本 |
| cargo-watch | 推荐 | 后端热重载 (脚本会自动安装) |

为什么需要 MSVC? 本项目依赖 `tokio / axum / sqlx / bcrypt / jsonwebtoken / tracing` 等 crates，其中包含需要编译本地代码和链接系统库的 build scripts。如果缺少 `link.exe`，会出现 `error: linker 'link.exe' not found`，后端无法启动。某些“看似类似”的简化 demo（少依赖或使用已有 exe）可能在没有 MSVC 的情况下侥幸运行，但并不代表完整功能可以省略构建链。

快速自检命令：
```powershell
where link.exe        # 若无输出 => 必须安装 VS Build Tools
rustup show           # 查看当前 active toolchain (建议: stable-x86_64-pc-windows-msvc)
rustc -Vv | Select-String host
```

安装 VS Build Tools：
1. 打开 https://visualstudio.microsoft.com/zh-hans/visual-cpp-build-tools/
2. 选择 “使用 C++ 的桌面开发” 工作负载，勾选：MSVC、Windows 10/11 SDK、C++ CMake tools。
3. 安装完成后重启终端。

切换 / 安装 MSVC Toolchain：
```powershell
rustup toolchain install stable-x86_64-pc-windows-msvc
rustup default stable-x86_64-pc-windows-msvc
rustup show
```

（可选）如果路径包含中文导致 GNU toolchain 之前构建不稳定，建议把仓库迁移到：`C:\dev\customer-service-system`。

### 2. 一键开发启动
根目录脚本（`package.json`）已提供并行启动：
```powershell
# 安装依赖 (首次)
npm run setup   # = 安装前端 + cargo-watch

# 启动后端 + 前端
npm run dev

# 启动后端 + 前端 + SDK
npm run dev:all
```

### 3. 单独开发
```powershell
# 后端热重载
npm run dev:backend

# 仅运行后端一次
npm run backend:only

# 前端
npm run dev:frontend

# SDK 构建 / 监听
npm run dev:sdk
```

### 4. 后端首次验证 (推荐手动做一次)
```powershell
cd backend
cargo clean
cargo build
cargo run
curl http://localhost:8080/health
```
预期返回 JSON：`{"status":"ok", ...}`。

### 5. 构建
```powershell
# 前端 + SDK
npm run build

# 全部 (含后端 release)
npm run build:full
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

## 常见问题 (FAQ)

### Q1: 朋友的“类似项目”为什么能直接跑，这里却要安装 VS Build Tools？
可能的差异：
- 之前机器上已经装过 VS Build Tools，后来被清理或当前用户环境变量不同。
- 朋友项目依赖更少（未引入 `sqlx` + `bcrypt` + `jsonwebtoken` 等组合）。
- 使用了之前编译好的旧 exe，没有重新触发繁重编译。
- 当时走的是 GNU toolchain 且缓存命中；现在切到 MSVC 没有链接器。
- 中文路径 + GNU 没立即爆，但改依赖组合后引发问题。

### Q2: 我不想装 VS Build Tools，可以强行用 GNU toolchain 吗？
临时可尝试：
```powershell
rustup toolchain install stable-x86_64-pc-windows-gnu
rustup default stable-x86_64-pc-windows-gnu
cargo clean
cargo build
```
但风险：
- 某些加密/TLS 依赖在 GNU + 中文路径组合下构建更脆弱。
- 社区主要在 MSVC 下测试 Windows 兼容性。
=> 长期仍建议回到 MSVC。

### Q3: `/api/shops` 返回结构不对 / 有 mock 字段？
当前 `main.rs` 内含临时 mock 路由（`mock_get_shops`, `mock_get_customers`），真实数据完成后将移除。参见“后续清理计划”。

### Q4: 端口 8080 没监听怎么办？
排查清单：
1. `cargo run` 看日志是否 panic / linker 错误。
2. `Test-NetConnection -ComputerName localhost -Port 8080` (PowerShell)。
3. 检查是否被防火墙拦截（首启时允许访问）。
4. 确认没有后台残留僵尸进程（任务管理器 / `netstat -ano | findstr :8080`）。

## 故障自检命令合集
```powershell
where link.exe
rustup show
rustc -Vv | Select-String host
Test-NetConnection -ComputerName localhost -Port 8080
netstat -ano | findstr :8080
```

## 后续清理计划 / TODO
- [ ] 去除 `main.rs` 中 mock 路由，替换为真实 DB 查询（确保 `sqlx migrate` 成功）。
- [ ] 增加统一错误响应格式（trace_id, code, message）。
- [ ] 添加简单身份中间件（解析 JWT，注入用户信息）。
- [ ] WebSocket 鉴权与会话关联。
- [ ] 将 mock 功能改为 feature flag：`--features mock`。

## 许可
MIT

---
> 文档补充日期：2025-10-08