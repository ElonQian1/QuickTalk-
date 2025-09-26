# QuickTalk 测试指南 (临时草案 v0.1)

> 目标：建立一套可持续演进的测试层次与约定；当前聚焦消息发送/更新/删除及事件持久化与封装验证。

## 测试金字塔（当前与规划）
| 层级 | 说明 | 当前状态 | 后续扩展建议 |
|------|------|----------|--------------|
| 领域单元 (Domain) | 纯业务：实体/聚合不变式、VO 校验 | 尚未建立（聚合逐步抽取中） | 新建 `domain` 模块后添加 `tests/domain_*.rs` |
| 用例 (Application) | 用例编排：Repository mock / InMemory 实现 | SendMessage / Update / Delete 用例尚未单测 | 引入 InMemoryRepo & EventCollector |
| 基础设施 (Infra) | SQLx 查询正确性（最小路径） | 依赖集成测试间接覆盖 | 针对复杂查询建立专门测试 |
| API (Interface) | HTTP 路由、状态码、输入校验、序列化 | 已有：`api_send_message.rs` | 覆盖 edge cases（空 JSON、非法枚举、超长 content） |
| 实时事件 (Event) | 事件持久化形状、广播机制 | 已有：`event_broadcast_message_appended.rs` / `event_message_update_delete.rs` | 补：WebSocket 端到端广播、顺序保证 |
| 端到端 (E2E 手动) | 人工真实体验（本项目强调） | 通过 dashboard + customer-sim 页面 | 记录标准手动脚本 |

## 统一测试辅助 (tests/common)
`tests/common/mod.rs` 暴露以下函数减少重复：
- `test_app_with_schema()`：构建内存 SQLite + 最小表集合 + 完整 Axum Router
- `apply_min_schema()`：仅应用 schema（供未来自定义场景）
- `seed_conversation(id, shop, cust)`：插入会话
- `seed_message(id, conv, sender, content)`：插入消息
- `latest_event()`：从 `event_log` 读取最新事件载荷 JSON
- `json_request(app, req)`：发送请求并解析 JSON 响应

后续可加入：
- `assert_event_type!(value, expected)` 宏
- InMemory EventBus (脱离数据库验证用例逻辑)

## 当前事件封装约定 (Envelope v1)
字段：
```
{
  "version": "v1",
  "type": "domain.event.message_appended" | ...,
  "event_id": <UUID>,
  "emitted_at": <RFC3339>,
  "data": {
    "conversation_id": String,
    "message_id": String,
    "message": { ...富载荷 } | null,
    ...事件特定字段
  }
}
```
约束：
- `message_appended` / `message_updated` 必须包含 `data.message` 对象
- `message_deleted` 必须 `data.message == null` 且包含 `soft: true|false`

## 命名与结构规范
- 文件命名：`api_<resource>_<action>.rs` / `event_<aggregate>_<scenario>.rs`
- 单文件可含多相关用例，超 150 行建议拆分
- 避免在测试中直接写重复 SQL -> 使用 helper；确实需要时在注释中说明原因（例如特定约束测试）

## 编写新测试的流程示例
1. 选择层级：例如 API 层
2. 通过 `test_app_with_schema()` 获取 `(app, pool)`
3. 使用 `seed_*` 函数准备数据
4. 构造请求（Axum `Request::builder()`）并发送
5. 断言：HTTP 状态码 -> JSON 字段 -> 事件（如需要）
6. 若事件顺序相关：后续将提供 `list_events()` 帮助多行断言

## 失败调试技巧
- 在测试内部 `println!(...)` 输出会在失败时显示
- 临时调试：查询所有事件 `SELECT id,event_type,payload_json FROM event_log`（可添加一个 `debug_dump_events(pool)` 帮助函数）
- 注意：内存 SQLite 每个连接一个 DB，当前使用一个 `SqlitePool` 保证同一测试内共享；不要在测试中创建第二个独立 Pool。

## 待办与演进路线
- [ ] 引入领域聚合后补领域层单测
- [ ] InMemory Repository + EventCollector，用例层测试
- [ ] WebSocket 端到端事件广播测试（连接后发送消息，捕获 JSON 帧）
- [ ] 边界：超长 content / 空 JSON / 非法 UTF-8 (若可能)
- [ ] 增加 `assert_json_contains!` 宏减少样板
- [ ] 统一错误响应结构断言（例如 `error.code` `error.message`）

## WebSocket E2E 测试现状
已新增：
- `tests/ws_message_appended.rs`（新增消息实时广播）
- `tests/ws_message_update_delete.rs`（更新 / 删除事件实时广播）
 - `tests/ws_multi_connection_broadcast.rs`（多连接广播一致性）
 - `tests/ws_ping_pong.rs`（Ping/Pong 心跳往返）

流程：
1. 使用 `test_app_with_schema()` + `spawn_test_server()` 启动临时服务器（绑定 127.0.0.1:0 随机端口）。
2. `connect_ws()` 获取欢迎消息（断言 `system.welcome`）。
3. 通过 HTTP API 发送新消息。
4. 使用 `next_json()` 读取下一条 WebSocket 事件并断言 envelope：`type == domain.event.message_appended` 且 `data.message.content` 匹配。

后续可扩展：
- 顺序一致性：发送多条消息后收集事件时间戳与序号（未来可在 envelope 加自增序列或测试内排序校验）。
- 压力测试（可选）：快速循环发送 50 条消息验证无 panic 与全部事件被消费。
- WebSocket 端发送 `Send` 指令与 HTTP 发送差异对比（身份、字段）。
- 事件重放或断线重连补偿（若后续实现 replay 通道）。

## 运行
```
cd backend
cargo test -- --nocapture
```

## 贡献检查清单 (测试相关)
- 是否复用 helper 而非重复 schema/seed 代码
- 是否只验证与测试目标直接相关的字段
- 事件测试是否遵循 Envelope 约定
- 是否添加了足够的失败 case（至少 1 个）
- 命名是否表达业务语义

---
若你新增了测试助手，请在本文件相应章节补充，保持文档与实现同步。
