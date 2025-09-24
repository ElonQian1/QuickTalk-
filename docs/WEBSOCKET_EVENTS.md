# WebSocket 事件示例与客户端处理指引

本文件补充事件广播 Envelope v1 新增元数据 (event_id / emitted_at) 后的使用方式，帮助前端在无框架、纯原生 JS 环境中实现去重、排序与健壮处理。

## Envelope 统一外层结构
```json
{
  "version": "v1",
  "type": "domain.event.message_appended",
  "event_id": "5b7f0d4d-8d4a-4c23-9e08-b6c9f7f1e2a1",
  "emitted_at": "2025-09-24T08:12:45.123456Z",
  "data": { }
}
```
字段说明参见 `docs/README.md` 的事件模型章节。

## 核心消息事件序列示例
以下为同一会话内，一条消息的生命周期：追加 → 更新 → 软删除。
```jsonc
{
  "version":"v1",
  "type":"domain.event.message_appended",
  "event_id":"9e5e0e22-4d1f-4c52-a2c1-908e5d7a1c11",
  "emitted_at":"2025-09-24T08:20:10.100000Z",
  "data":{
    "conversation_id":"conv_123",
    "message_id":"msg_456",
    "message":{
      "id":"msg_456",
      "sender_type":"customer",
      "content":"Hello",
      "message_type":"text",
      "timestamp":"2025-09-24T08:20:10.050000Z"
    }
  }
}
{
  "version":"v1",
  "type":"domain.event.message_updated",
  "event_id":"92f6bb3d-9dba-4b4a-8a10-14d9e6f5c7aa",
  "emitted_at":"2025-09-24T08:20:12.300000Z",
  "data":{
    "conversation_id":"conv_123",
    "message_id":"msg_456",
    "message":{
      "id":"msg_456",
      "sender_type":"customer",
      "content":"Hello!! (edited)",
      "message_type":"text",
      "timestamp":"2025-09-24T08:20:10.050000Z",
      "edited":true
    }
  }
}
{
  "version":"v1",
  "type":"domain.event.message_deleted",
  "event_id":"1cf9b49d-3e75-4aeb-9c5d-5a19e4f0f777",
  "emitted_at":"2025-09-24T08:20:13.500000Z",
  "data":{
    "conversation_id":"conv_123",
    "message_id":"msg_456",
    "soft":true
  }
}
```

## 去重策略
- 维护一个最近 N (建议 500~1000) 个 `event_id` 的 Set；超出长度淘汰最早插入。
- 若收到重复的 event_id，直接忽略。

简易实现：
```js
const recentIds = new Set();
const idQueue = [];
function seen(id) {
  if (recentIds.has(id)) return true;
  recentIds.add(id); idQueue.push(id);
  if (idQueue.length > 800) { const old = idQueue.shift(); recentIds.delete(old); }
  return false;
}
```

## 排序策略
- 主排序：使用业务消息时间 `message.timestamp`
- 次排序：`emitted_at` 仅在同一 `message.timestamp` 下保证稳定性
- 删除事件不包含 message 载荷，可直接根据 message_id 标记本地状态（如 is_deleted=true）

## 前端最小整合示例（原生 JS）
```html
<script>
const ws = new WebSocket('ws://localhost:3030/ws');
const recentIds = new Set(); const idQueue = [];
const messages = new Map(); // key = message_id -> { ... }
function remember(id){ if(recentIds.has(id)) return false; recentIds.add(id); idQueue.push(id); if(idQueue.length>800){ const old=idQueue.shift(); recentIds.delete(old);} return true; }
function render(){ /* 根据 messages.values() 重新排序渲染 */ }
ws.onmessage = evt => {
  let ev; try { ev = JSON.parse(evt.data); } catch(e){ console.warn('invalid json', e); return; }
  if(ev.version !== 'v1' || !ev.type || !ev.event_id) return; // 粗过滤
  if(!remember(ev.event_id)) return; // 去重
  const t = ev.type;
  const d = ev.data || {};
  if(t === 'domain.event.message_appended' || t === 'domain.event.message_updated') {
    if(!d.message) return;
    messages.set(d.message_id, { ...d.message, deleted:false });
  } else if(t === 'domain.event.message_deleted') {
    const m = messages.get(d.message_id);
    if(m) m.deleted = true; else messages.set(d.message_id, { id:d.message_id, deleted:true });
  } else {
    // 其它事件类型暂忽略，可记录日志
  }
  render();
};
</script>
```

## 错误与鲁棒性建议
| 情况 | 处理 | 说明 |
|------|------|------|
| JSON 解析失败 | 丢弃 | 不影响连接其他消息 |
| 未知字段 | 忽略 | 允许后端演进 |
| 未知 type | 记录 console.debug | 不抛异常 |
| event_id 缺失 | 丢弃 | 不参与后续逻辑 |
| emitted_at 缺失 | treat as now() | 仅排序辅助 |

## 未来演进占位
- 当引入持久化 EventLog 后，客户端可在重连时通过 HTTP 拉取自上次 event_id 之后的补偿事件。
- 若发布 v2：保持 v1 并行输出一个过渡期，并在文档标注 EOL 时间窗口。

---
该文件仅文档说明，不包含运行逻辑。
