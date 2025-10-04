# 消息状态与未读系统验证指南

## 目的
验证新版发送通道状态机、未读高水位策略、收敛机制、会话本地读回执骨架及事件常量化是否按预期工作，并提供排障手册。

## 组成模块
- core/events.js (事件常量 + emit)
- usecases/message-send-channel.js (状态机: pending -> sending -> sent/failed)
- css/message-status.css (不同阶段样式 + 旋转指示)
- usecases/conversation-activity-tracker.js (本地已读触发)
- usecases/conversation-read-receipts.js (读回执骨架 + server_ack 占位事件)
- ui/unread-highwater.js (本地/服务端高水位 + 收敛)
- ui/nav-badge-manager.js (导航红点更新 + 读回执清零)

## 事件参考 (来自 Events)
| 语义 | 枚举 | 用途 |
|------|------|------|
| 新消息加入 | message.appended | UI 渲染、未读增量 |
| 消息状态变更 | message.state.changed | 气泡装饰更新 |
| 发送排队 | send.queued | 调试/统计 |
| 发送发出 | send.dispatch | 调试/统计 |
| ACK 超时 | send.ack.timeout | 标记失败/重试入口 |
| 发送失败 | send.failed | UI 标红 |
| 发送完成 | send.finalized | 去除 pending/sending 装饰 |
| 本地会话已读 | conversation.read.local | 清零导航未读 |
| 服务器已读ACK(占位) | conversation.read.server_ack | 未来服务端确认挂钩 |
| 未读更新(服务端汇总) | unread:update | 统一聚合入口 |
| 未读高水位 | unread:highwater | 防闪烁/延迟补偿 |

## 验证步骤
### 1. 发送状态生命周期
1. 打开移动端管理界面，进入任意对话。
2. 输入文本并发送。
3. 观察 DOM：
   - 初始气泡 class 包含 `pending` (文本后缀“排队中”).
   - 很快转为 `sending` (显示旋转指示 + “发送中”).
   - 正常情况下服务器回流后移除 `pending` / `sending` 并无状态后缀（或进入下一条）。
4. 人为制造失败：断开网络或拦截 `/api/conversations/:id/messages`。
   - 气泡进入 `failed` (红边 + “发送失败” + 重试按钮)。
   - 点击“重试”后重新经历 pending -> sending。 

### 2. ACK 超时
1. 暂时修改后端（或用代理）让消息写入延迟 > ackTimeoutMs (默认 8000ms)。
2. 观察 8s 后气泡进入 `failed` 状态，并在调试台看到 `send.ack.timeout` 日志 (若启用 QT_LOG)。

### 3. 未读本地增量与高水位
1. 在浏览器 A 打开管理端，停留在店铺列表，不进入具体对话。
2. 浏览器 B (或客户端) 向某对话发送多条消息。
3. A 端：
   - `unread:update` 可能延迟；`unread:localIncrement` (domain-event) 先行抬升 highwater。
   - 导航红点应迅速显示接近真实未读值，不闪烁。
4. 当服务端聚合追平 local (> CONVERGENCE_MS) 后，本地 highwater 收敛（查看 `window.__UNREAD_HIGHWATER__.get()` local 归零）。

### 4. 读回执骨架
1. 进入对话 => 触发 `conversation.read.local` (使用 DevTools 监听)。
2. 导航红点若 >0 立即清零（绕过防闪烁一次）。
3. 监听 `conversation.read.server_ack`（占位）事件触发（当前 local:true）。

### 5. 收敛策略
1. 设置 `window.QT_CONFIG.highWaterConvergenceMs = 2000`.
2. 制造本地增量：快速发送多条客户消息 (远端聚合稍慢)。
3. 2s 后查看 `__UNREAD_HIGHWATER__.get()`，`local` 应被清零，`high`=server。

### 6. 重试与多次失败
1. 断网发送 => 失败 => 重试 => 断网保持 => 重复直到超过最大重试 (队列内 attempt >= maxRetries)。
2. 确认失败终态 `failed` 不再自动重排队，仅手动重试继续。

## DOM 检查速览
| 状态 | 选择器示例 | 说明 |
|------|------------|------|
| 排队 | `.chat-message.pending` | 刚入通道尚未出站 |
| 发送 | `.chat-message.sending` | 请求已发出等待ACK |
| 失败 | `.chat-message.failed` | ACK 超时/网络/重试耗尽 |
| 成功 | `.chat-message:not(.pending):not(.sending):not(.failed)` | 回流匹配完成 |

## 调试工具
```js
window.__UNREAD_HIGHWATER__.get(); // 查看 local/server/high
window.__UNREAD_HIGHWATER__.resetLocal(); // 强制归零本地影子
window.__QT_BADGE_DEBUG.history.slice(-10); // 最近红点事件
window.MessageSendChannelInstance.getQueueSnapshot(); // 队列状态
```

## 常见问题排查
| 现象 | 可能原因 | 排查步骤 |
|------|----------|----------|
| 红点瞬间出现又消失 | 未读被 server=0 覆盖 | 检查 unread:update reason 是否被拦截；查看 highwater 事件 |
| 气泡一直 pending | _process 未调度或发送函数异常 | 查看 console 有无 WS_NOT_READY / fetch 错误 |
| 失败不出现重试按钮 | CSS 未加载或 DOM 结构差异 | 确认引入 message-status.css；查找 .msg-retry-btn 是否渲染 |
| 高水位不收敛 | 服务器 total 未 >= local 或收敛时间过短 | 调整 QT_CONFIG.highWaterConvergenceMs 并观察 state.server/local |

## 未来扩展占位
- 服务端真实 read API 集成
- 富媒体上传进度事件 (send.upload.progress)
- 去重指纹增强 (基于服务端 message uuid)
- 多端同步本地 highwater 重播

---
更新日期: 2025-10-04
