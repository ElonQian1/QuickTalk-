#! /usr/bin/env markdown

# QuickTalk 客服系统（纯 Rust 版）

## 🧭 架构概览
系统采用 **Rust + Axum + SQLx + SQLite** 单体架构：单进程负责 HTTP / WebSocket / 领域逻辑 / 数据持久化 / 静态资源分发。前端为纯静态文件，无任何打包或 Node.js 依赖。

> 约束：禁止添加 Node.js / npm / 前端构建链路。唯一启动：`cargo run`。

## 🧱 技术分层
| 层 | 技术 | 说明 |
|----|------|------|
| Interface | Axum | REST / WebSocket / DTO 绑定 |
| Application | 用例编排 | 调用仓库 / 聚合，事务与事件派发 |
| Domain | 纯业务模型 | 聚合 / 实体 / 值对象 / 领域事件 |
| Infrastructure | SQLx + SQLite | Repository 实现 & 读模型 & 迁移 |
| Delivery | 静态文件 | 原生 HTML/CSS/JS |
| Event Channel | tokio broadcast + EventLog | 实时广播 + 持久化重放 (Replay) |

## 📂 目录结构
```
backend/
  src/
    domain/        # 聚合 & 领域事件
    application/   # 用例 / 序列化 / 事件总线扩展
    db/            # SQLx 仓库实现 & event_log 持久化
    api/           # Handler（薄适配层）
    bootstrap/     # AppState / 路由装配
    web/           # 静态资源服务
  migrations/      # 迁移脚本
static/            # 前端静态文件
```

## 🚀 启动
```bash
cd backend
cargo run
```
访问：
- UI: http://localhost:3030/
- Admin: http://localhost:3030/admin
- WS: ws://localhost:3030/ws
- Health: http://localhost:3030/api/health

## 🗃️ 数据库迁移
| 迁移 | 说明 |
|------|------|
| 202509240001_init_schema | 初始结构 |
| 202509240002_seed_data | 种子数据 |
| 202509240003_add_messages_deleted_at | 消息软删除字段 |
| 202509240004_add_message_indexes | 查询性能索引 |
| 202509240005_create_event_log | 事件日志（Replay 支撑） |

## 💬 事件模型 (Envelope v1 + Replay)
统一 Envelope：新增 `event_id`、`emitted_at` 支持断线补偿与去重；保持向后兼容。

示例：
```json
{
  "version": "v1",
  "type": "domain.event.message_appended",
  "event_id": "5b7f0d4d-8d4a-4c23-9e08-b6c9f7f1e2a1",
  "emitted_at": "2025-09-24T08:12:45.123456Z",
  "data": { "conversation_id": "conv_1", "message_id": "msg_9", "message": { /* ... */ } }
}
```

字段：version | type | event_id | emitted_at | data

核心事件：message_appended / message_updated / message_deleted / conversation_opened|closed|reopened

客户端准则：
1. 去重：LRU Set 保存最近 N 个 event_id。
2. 排序：同会话按 (message.timestamp, emitted_at)。
3. 容错：未知字段忽略，未知 type 记录日志后跳过。

### 🔁 Replay API
端点：`GET /api/events/replay?since_event_id=<last>&limit=200`

参数：since_event_id(可选) | limit(默认100, 最大500)

推荐流程：
1. 初次：直连 WS，可并行一次 Replay（无 since）做状态热身。
2. 断线：带 last event_id 调用 Replay -> 补差 -> 恢复/保持 WS。
3. 统一处理：Replay 返回 Envelope 与实时一致，公用解析函数。

响应示例：
```json
{
  "events": [ { "version": "v1", "type": "domain.event.message_appended", "event_id": "111...", "emitted_at": "2025-09-24T08:12:45.123456Z", "data": { /* ... */ } } ],
  "next_since": "111..."
}
```

边界：
- since_event_id 不存在：从更晚可用事件继续。
- 无新增：events 空数组，next_since=原值或最新。
- limit 超出：截断至 500。

规划中：类型过滤、时间窗口、压缩(gzip/br)、稳定游标分页。

版本策略：
- 向后兼容新增：继续 v1。
- 破坏性调整：双写 v1+v2，过渡后淘汰 v1。

## 🧪 测试策略
- 领域：内存仓库 + 不变式测试。
- 用例：Mock EventBus 断言事件收集。
- 基础设施：SQLx 集成（临时 DB）。
- 事件系统：广播与 Replay 一致性测试。

运行：`cargo test`

## ♻️ 软删除
`messages.deleted_at IS NOT NULL` => 视为删除；读仓库自动过滤；事件 `message_deleted` 含 soft 标记；可扩展硬删除清理任务。

## 🔐 安全（阶段规划）
计划：认证 / 授权 (RBAC+属性扩展) / 审计日志。当前依赖部署环境隔离最小化攻击面。

## 🧭 DDD 摘要
- 聚合：Conversation（状态流转）+ 消息追加不变式。
- 用例：Send / Update / Delete Message + Conversation 状态更新。
- Repository：读写分离 + 软删除过滤。
- 事件流：领域事件 -> 序列化 -> EventLog 持久化 -> 广播 -> Replay 补偿。

## 🧩 嵌入集成
查看 `static/integration-code-*.html`，按需选择 WebSocket / Polling 方案。

## 🩺 诊断指南
- 丢事件：调用 Replay 校验持久化。
- 顺序错乱：确认排序键 (timestamp, emitted_at)。
- 重复渲染：检查去重 Set 容量与过期策略。

## 📄 License
MIT

---
QuickTalk 纯 Rust：一致性 / 可维护性 / 可观察性优先。事件体系 = 实时 + 持久化 + 重放，为后续审计与回放奠定基础。
