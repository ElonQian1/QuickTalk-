# REAL_FIRST_RUN 首次真实旅程指南

> 目的：帮助人工手动从“只有系统预置超级管理员”到“首个可对外演示的基本工作环境”，并验证关键链路无阻塞。
>
> 场景：全新或被 reset 的数据库（`shops=0 / conversations=0 / messages=0 / customers=0 / employees=0`）。

---
## 0. 前置 / 环境确认
1. 启动：`cargo run` （目录 `backend/`）
2. 访问健康检查：`GET /api/health` 应返回 success
3. 检查状态摘要：`GET /api/system/state-summary`
   - 期望：`shops=0` 且 `admins>=1` 且 `first_run=true`
4. 若无超级管理员：
   - 调用 `POST /api/admin/recover-super-admin` （还原默认顶级账户）

---
## 1. 登录与基础安全
1. 打开 `http://localhost:3030/mobile/login` 登录默认超级管理员
2. 登录后跳转 dashboard，若 `shops=0` 显示“First Run 引导卡” ✅
3. Debug 面板（`Ctrl+Shift+D`）可打开，确认 counts 初始为 0

验收要点：
- 登录后页面顶部在线状态显示“已连接”（WebSocket 建立）
- 本地存储存在 session token 或相关身份信息

---
## 2. 创建首个店铺
1. 点击引导卡“立即创建店铺”或进入“店铺”区域
2. 填写：名称、可选域名（留空也可）
3. 提交后期望：
   - 店铺列表出现该店铺
   - `GET /api/system/state-summary` 中 `shops=1`

验收要点：
- 失败情况：域名冲突 / 字段校验应有清晰提示
- 成功后可在 UI 中看到店铺激活相关操作（若有）

---
## 3. 生成嵌入代码（可选）
1. 使用 `POST /api/integrations/generate`（若 UI 尚未完成，可手动调用）
2. 得到脚本示例，理论上可插入外部站点实现嵌入式客服

验收要点：
- 返回包含 `embed/service.js` 的引用或 WebSocket endpoint

---
## 4. 员工 / 角色（可选阶段）
1. （超级管理员）尝试邀请一个员工账号（若 UI 支持）
2. 未实现或暂不需要可跳过；`employees` 表仍为 0 不影响核心体验

---
## 5. 客户对话首启
1. 通过模拟客户入口方式（未来：嵌入脚本 / 简单测试页）触发一个对话
   - 若缺少用户端入口，可临时：`POST /api/conversations` 创建一个测试会话
2. 使用 `POST /api/conversations/:id/messages` 发送首条消息（发送方可区分 admin/customer）
3. WebSocket 面板应实时出现该消息

验收要点：
- WebSocket 收到 `new_message` 事件（或现有事件名称）
- `state-summary` 中 `conversations=1 / messages=1`

---
## 6. 双向消息流
1. 作为管理员在 dashboard 回复
2. 客户端（若存在）应收到；没有客户端则仅验证 API 写入 + WebSocket 事件发送
3. `messages` 计数递增

验收要点：
- 重复发送 3~5 条，确认无乱序 / 重复 / 丢失
- Debug 面板 counts 与列表渲染一致

---
## 7. 权限 / 403 验证
1. 在非超级管理员（未来普通管理员）身份下执行仅超级管理员允许的操作
2. 触发 403 时应出现统一 toast：
   - 文案含 “权限不足 (403)”
   - 有“恢复超级管理员”按钮（跳转恢复页）

---
## 8. 恢复 / 清理（可回到初始状态）
1. 使用 `POST /api/system/clean-test-data` 或 `POST /api/system/reset-database`
2. 再次调用 `state-summary`，应回到 first_run 状态

---
## 9. 关键风险点检查
| 维度 | 项目 | 验收结果 | 备注 |
|------|------|----------|------|
| 身份 | 超级管理员存在 | ✅ / ❌ | 403 恢复路径可用 |
| 店铺 | 首店创建成功 | ✅ / ❌ | | 
| 对话 | 首个对话建立 | ✅ / ❌ | | 
| 消息 | 双向消息流 | ✅ / ❌ | WebSocket 稳定 |
| UI 引导 | First Run 卡片 | ✅ / ❌ | 正确隐藏逻辑 |
| 权限提示 | 403 Toast | ✅ / ❌ | 按钮正常 |
| 数据清理 | reset / clean | ✅ / ❌ | 状态复原 |

---
## 10. 后续增强建议（Backlog）
- 引导卡：创建店铺后自动淡出（监听成功事件）
- 集成代码面板 UI 化
- 客户模拟器 / 访客对话触发器（独立轻量页面）
- WebSocket 重连策略与提示 UI
- 领域层进一步聚合 / UseCase 替换直接 SQL 片段
- 事件追踪统一结构化输出 (debug panel 可订阅)

---
## 附录：常用 API 速览
| 功能 | 方法 | Endpoint |
|------|------|----------|
| 状态摘要 | GET | /api/system/state-summary |
| 登录 | POST | /api/admin/login |
| 创建店铺 | POST | /api/shops |
| 列出对话 | GET | /api/conversations |
| 发送消息 | POST | /api/conversations/:id/messages |
| 重置数据库 | POST | /api/system/reset-database |
| 清理测试数据 | POST | /api/system/clean-test-data |
| 恢复超级管理员 | POST | /api/admin/recover-super-admin |

---
**版本**: v1 (首稿)  
**更新时间**: 自动生成于首次实现空态引导与权限统一提示后。
