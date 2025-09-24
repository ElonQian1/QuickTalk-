# 事件观测与演进增强计划 (草案)

本文件描述在保持单体 + 纯 Rust 架构前提下，对事件系统（Envelope v1）可观察性、可追溯与重放能力的演进规划。

状态更新 (2025-09-24):
- [x] P1 已完成：EventLog 表、批量持久化、`/api/events/replay` 端点与测试。
- [ ] 后续阶段 (P2+ ) 仍为规划。

## 现状 (Baseline)
- 事件来源：领域事件 (DomainEvent)
- 序列化：`application/events/serialization.rs` 统一转换为 Envelope v1
- 广播通道：`tokio::sync::broadcast` (内存，N=订阅者数)
- 无持久化事件日志；重启后无法回放历史
- 监控指标缺失：无法统计速率/延迟/失败

## 目标
| 能力 | 目标说明 | 优先级 |
|------|----------|--------|
| EventLog 持久化 | 将每个 Envelope 持久化为不可变记录 | 高 |
| Replay API | 支持按时间范围 / event_id 游标增量拉取 | 高 |
| 基础指标 | qps / 延迟 (序列化->广播耗时) | 中 |
| 死信检测 | 序列化失败 / 下游处理异常计数 | 中 |
| 事件筛选 | 多租户（shop_id）过滤广播 | 中 |
| 压缩/归档 | 过老事件分段压缩 (可选) | 低 |

## 设计草图
### 1. EventLog 表结构 (SQLite)
```sql
CREATE TABLE event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  emitted_at TEXT NOT NULL, -- RFC3339
  payload_json TEXT NOT NULL
);
CREATE INDEX idx_event_log_emitted_at ON event_log(emitted_at);
CREATE INDEX idx_event_log_type ON event_log(event_type);
```

### 2. 写入路径扩展
Current: DomainEvent -> serialize_event -> JSON -> broadcast
Planned: DomainEvent -> serialize_event -> (tx pipeline)
```
+-----------------+      +------------------+      +------------------+
| DomainEvent(s)  | ---> | Serialization(v1)| ---> | Persist (EventLog)|
+-----------------+      +------------------+      +------------------+
                                                           |
                                                           v
                                                   +---------------+
                                                   | Broadcast (WS)|
                                                   +---------------+
```
- 持久化失败策略：记录错误 & 跳过（不阻塞实时广播） or 可选配置为“严格模式”失败即中断
- 使用单事务批量写入多个事件（未来引入聚合批处理时）

### 3. Replay API
- Endpoint: `GET /api/events/replay?since_event_id=...&limit=...`
- 若 `since_event_id` 缺失则按 `emitted_at` 起点
- 响应：`[{ event_id, type, emitted_at, data }]` 与实时结构一致（不含 version? 保留 version=v1 以保持一致）
- 安全：受管理端或内部 token 保护

### 4. 多租户过滤 (shop 范围)
- 当前事件 data 内含 conversation_id/message_id，需要额外查询 shop_id 代价较高
- 方案 A：序列化时附加 `shop_id`（在富事件总线查询阶段注入）
- 方案 B：独立分发层按话题拆分频道 `ws://.../ws?shop_id=xxx`
- 先采用方案 A（附加字段，客户端自行过滤）；保持 Envelope 兼容：新增字段不改 version

### 5. 指标与追踪
- 轻量计数器：事件产出计数 / 持久化失败计数 / 序列化耗时直方图
- 暂不引入外部依赖 (如 Prometheus)，保留内存结构 + 调试 API `/api/metrics/events` 返回 JSON
- 结构示例：
```json
{
  "produced_total": 10234,
  "persist_errors": 2,
  "serialize_avg_us": 180,
  "broadcast_subscribers": 3
}
```

### 6. 死信与补偿
- 序列化正常但持久化失败：记录一条 `event_log_error`（内存），管理员接口可拉取
- 补偿：支持执行一次“从最近 N 秒广播通道缓存重刷到 EventLog” 的管理脚本（未来需要环形缓冲）

### 7. 重放策略
| 场景 | 方式 |
|------|------|
| 客户端短暂断线 | 记录最后 event_id -> 调用 Replay API 拉增量 |
| 服务重启 | 客户端重连时先 Replay 再订阅实时 |
| 历史分析 | 导出 EventLog JSON 供离线处理 |

### 8. 数据生命周期
- 可配置保留窗口（例如 30 天），定期归档/压缩后删除
- 归档格式：NDJSON，每行一个 Envelope

### 9. 安全与合规
- EventLog 不额外存储敏感信息，完全复用实时广播 JSON
- 若未来加入敏感字段，需在持久化前脱敏

### 10. 分阶段实施建议 (P1 完成标记)
| 阶段 | 内容 | 交付 | 验证 |
|------|------|------|------|
| P1 | EventLog 表 + 持久化写入 + Replay API | (已完成) schema+migration+API | 单元+集成测试 |
| P2 | shop_id 注入 + 过滤 | 字段扩展 | WS 订阅过滤测试 |
| P3 | 指标 API | /api/metrics/events | 速率断言测试 |
| P4 | 生命周期/归档 | 清理任务脚本 | 归档文件存在 |
| P5 | 补偿/死信 | 内存缓冲 + 管理端接口 | 故障注入测试 |

## 不采纳的方案 (暂缓)
- 引入消息队列 (Kafka / NATS)：超出现阶段复杂度与约束（单体要求）
- 分布式追踪系统：当前服务简单，先用日志 + 轻指标
- GraphQL 订阅层：超出现有纯 REST + WS 简洁边界

## 兼容性
- 所有增强均通过“新增字段”或“新增 API” 实现； Envelope version 保持 v1 不变直至结构性破坏出现。

---
### 11. Replay API 使用示例

请求：
```
GET /api/events/replay?since_event_id=<last_id>&limit=200
```
响应示例（data 省略非关键字段）：
```json
{
  "success": true,
  "message": "Events replayed",
  "data": [
    {
      "event_id": "e2",
      "type": "domain.event.message_appended",
      "emitted_at": "2025-09-24T08:31:10.123456Z",
      "envelope": { "version":"v1","type":"domain.event.message_appended", "event_id":"e2", "emitted_at":"2025-09-24T08:31:10.123456Z", "data": { "conversation_id":"...","message_id":"...","message":{...} } }
    }
  ]
}
```

客户端增量逻辑：
1. 记录最后一个实时或重放事件的 `event_id`。
2. 重连时先调用 replay 获取增量，再订阅 WS。
3. 对返回 `data[].envelope` 直接复用现有事件处理路径。

---
P1 已交付；本文件后续仅跟踪未完成阶段进展。
