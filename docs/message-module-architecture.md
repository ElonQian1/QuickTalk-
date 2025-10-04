# Message Module 新架构说明 (前端)

版本: 2025-10-04 初稿

## 目标
1. 去除巨石式 `MessageModule` 内部的状态/发送/渲染耦合
2. 引入事件驱动 (EventBus) + 状态仓库 (StateStore) + 发送适配层 (Sender)
3. 支持临时 ID (temp_id) -> 服务端 ID ACK 替换 & 失败重试
4. 最小侵入保留现有页面脚本加载顺序与外部 API

## 组件概览
| 组件 | 文件 | 职责 | 不做的事情 |
|------|------|------|------------|
| EventBus | `message/core/message-event-bus.js` | 发布/订阅消息域事件 | 业务逻辑 / DOM |
| StateStore | `message/core/message-state-store.js` | 管理当前 shop/conversation/messages/temp 索引 | 网络/DOM |
| Sender | `message/core/message-sender.js` | 排队、发送、ACK、重试 | 渲染/UI |
| Orchestrator | `usecases/message-module.js` | 组合管理器、视图、向后兼容 | 低级状态维护 |
| DevTools | `message/dev/message-dev-tools.js` | 控制台调试 / 便捷注入 | 生产逻辑 |

## 核心事件
| 事件 | 描述 | 触发方 |
|------|------|--------|
| shop.selected | 店铺切换 | StateStore |
| conversation.selected | 对话切换 | StateStore |
| message.appended | 本地追加/加载 | StateStore |
| message.updated | 更新或 ACK 替换 | StateStore |
| message.deleted | 删除 | StateStore |
| messages.bulkLoaded | 批量加载首屏消息 | StateStore |
| send.enqueued | 本地排队成功 | Sender |
| send.dispatched | 正在发送 (attempt++) | Sender |
| send.ack | 服务端确认 (含替换) | Sender or MessageWS path |
| send.failed | 发送失败（含重试信息） | Sender |
| send.requeue | 失败重试重新排队 | Sender |

## ACK / temp_id 流程
1. `enqueueText` 生成 `temp_id`，StateStore 先行 append -> UI 立即显示 pending
2. Sender 尝试 WS (可选) -> fallback REST
3. 成功：收到服务端消息结构，`replaceTemp` 替换，发布 `message.updated` + `send.ack`
4. 失败：发布 `send.failed`，若未超限 -> 延迟重试；超限 -> 标记 failed
5. WebSocket 推送含 `temp_id` 的最终消息时，也会走 `handleServerMessage` 做幂等替换

## 重试策略
指数线性：`retryDelayBase * attempt` (当前简单线性)，最大尝试 `maxRetries` (默认2)。

## 日志命名空间
| 命名空间 | 说明 |
|----------|------|
| messageCore | EventBus / StateStore 内部调试 |
| messageSend | Sender 发送与 ACK |
| messageModule | Orchestrator 适配层 |
| messageDev | 开发工具输出 |

在控制台开启：`QT_CONFIG.setDebug('messageSend', true)` 或全部：`QT_CONFIG.debug.global = true`。

## Dev 工具
`MessageDev.listMessages()` 当前对话消息
`MessageDev.injectFakeMessage('Hello')` 注入一条客户侧假消息
`MessageDev.resendAllFailed()` 重试所有失败

## 事件驱动渲染适配器
文件: `message/ui/message-render-adapter.js`

职责:
- 订阅 StateStore & Sender 事件，实现增量渲染
- 以 temp_id / id 为键进行节点替换，避免全量 innerHTML 重建
- 维护渲染指标（full / appended / updated / deleted）可通过日志查看

订阅事件:
- conversation.selected -> fullRender
- messages.bulkLoaded -> fullRender(批量) + 滚动 (首屏优化)
- message.appended -> replaceOrAppend + 滚动
- message.updated -> replaceOrAppend
- message.deleted -> remove
- send.failed -> replaceOrAppend(失败态按钮)

失败重试:
- 按钮 data-retry=temp_id 点击调用 sender.resendFailed(temp_id)

迁移说明:
1. 保留旧 `MessageRenderer` 作为兼容与复杂 UI 气泡渲染（后续可内聚）
2. 新增适配器不破坏旧接口；逐步将 `MessageModule.renderMessages()` 调用淘汰
3. 若未来需要虚拟列表/懒加载，可在适配器内部替换增量策略

性能收益点:
- 避免大量消息时全量 innerHTML 重绘
- 首次加载使用 messages.bulkLoaded 事件，仅一次 DOM 重建
- 可统计 append/update/delete 频次，指导后续优化（例如批量合并 DOM 插入）

## 布局模式切换
文件: `ui/layout-toggle.js` + 样式: `css/layout-modes.css`

模式:
- horizontal (默认)
- vertical (更宽松的纵向排布，头像区域可容纳状态/未读二级信息)

实现要点:
1. 使用 `body.layout-horizontal` / `body.layout-vertical` 控制分支 CSS。
2. localStorage key: `qt.layout.mode` 持久化用户选择。
3. 按钮插入到 `.top-bar | .toolbar | header`（存在即挂载，未找到则挂到 body）。
4. 无 JS 降级：未加载脚本时仍为默认横向布局。

## 长消息显示策略
问题: 之前在渲染适配器中直接 slice 到 500 字导致上下文丢失。

新策略:
1. 不截断原始文本；DOM 中按需折叠。
2. 判定规则：字符长度 > 360 或换行数 > 6 行时折叠。
3. 折叠时添加类 `bubble collapsible need-fade` 并限制 `max-height`，底部使用渐变遮罩。
4. 追加“展开/收起”按钮（`bubble-toggle`）。
5. 展开后移除 `need-fade` 并解除高度限制；再次点击恢复。
6. 样式位于 `layout-modes.css`，不依赖构建。

可扩展点:
- 后续可接入基于渲染后测量高度的真实 overflow 检测。
- 支持图片 / 文件消息的独立折叠策略（当前仅文本）。

## 消息类型系统
文件: `message/core/message-type-registry.js`

职责:
- 注册与查询消息类型 (text,image,file,audio,...)
- 每个类型包含: icon, className, validate(msg), normalize(msg)
- 渲染适配器依据 `message.message_type` 添加图标与 CSS 类

默认内置: text / image / file / audio。
新增类型示例:
```javascript
MessageTypeRegistry.register('video', {
	icon:'🎬', className:'msg-video', validate:m=> Array.isArray(m.files)&&m.files.some(f=>/^video\//.test(f.type||''))
});
```

## 已读回执 (最小实现)
- 进入对话后调用 `MessageStateStore.markConversationRead(conversationId)`
- 针对 sender_type = customer 且无 read_at 的消息添加 `read_at` 字段
- 对每条已读发布事件: `message.read { conversationId, message }`
后续可扩展：批量事件、服务端同步、已读位置指针。

## Typing 指示
文件: `message/ui/typing-indicator-adapter.js`
- 订阅 `conversation.typing` 事件 (未来 WS 层适配器抛出)
- 显示“客户正在输入...” 4 秒自动消失
扩展建议：
- 合并多方 typing，显示队列
- 节流/防抖 (服务端每 2s 心跳)

## 新事件一览（增量）
| 事件 | 说明 |
|------|------|
| message.read | 本地标记消息已读 (客户->客服) |
| conversation.typing | 某对话内客户正在输入 |

## Sender 扩展
新增 `sender.enqueue(content,{type,extra})` 支持统一入口发送不同类型消息，仍保留 `enqueueText` 兼容。



## 渐进迁移说明
当前仍保留 legacy 路径 (LegacyLoaders / LegacySenders / MessageSendChannel)，后续可完全移除并将 MessageModule 内的 `this.messages` 访问改为基于 `MessageStateStore.getCurrentMessages()`。

## 后续增强建议
1. UI 渲染订阅 bus 精准 diff 渲染
2. 消息类型抽象 (text/image/file/audio)
3. 输入法合并 & 正在输入事件防抖
4. 发送优先级队列/并发限制
5. 读回执 (message.read) 事件流

---
如需更新结构，请同步修改本文档保持一致。
