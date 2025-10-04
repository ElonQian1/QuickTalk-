# Message Module 拆分与小步快跑实施计划

生成时间：2025-10-04

## 1. 目标与约束
- 保持现有功能可用（兼容旧全局调用 & Legacy 降级路径）
- 渐进拆分，任何一步落地后 `message-module.js` 仍是唯一入口，不破坏加载顺序
- 每个新增文件 < 300 行，聚焦单一职责
- 去重：数据获取、WS 分发、消息发送、统计、UI 状态渲染 不出现重复实现
- 暂不做运行验证（以结构健壮性、可维护性为优先）

## 2. 当前模块内混合的职责 (需拆分)
| 职责 | 现状 | 问题 | 目标文件 |
|------|------|------|----------|
| 协调/路由 | 统一处理店铺/对话/消息选择 | 夹杂加载与渲染 | `message-module.js` (保留纯协调) |
| 店铺数据 | 加载 / 统计兜底 / 渲染委托 | 存在 getShopConversationCount 重复 | `shops-manager.js` |
| 对话数据 | 加载 / 预览更新 / 客户编号 | 预览更新分散 | `conversations-manager.js` |
| 消息数据 | 加载 / 乐观发送 / 回流合并 | 与发送通道逻辑交叉 | `messages-manager.js` (剥离纯 CRUD & 状态) |
| 消息发送 | 局部 + sendChannel | 双路径（潜在重复） | `message-send-channel.js` (已存在) |
| WebSocket | 初始化 + 回退处理 | 旧/新并存 | `message-ws-handler.js` (已存在) + `ws-event-router.js` |
| 媒体 | 上传 / 录音 / UI | 分散调用 | `media-handler.js` (已存在) |
| 统计/未读 | 分散调用 API | 可缓存 | `shop-stats-service.js` (规划) |
| 客户编号 | 不同地方生成 | 不统一来源 | `customer-numbering.js` (规划) |
| UI 状态 | Loading / Empty / Error inline | 重复 | `ui-states.js` (规划) |
| 分页 | 未实现或临时 | 滚动丢失风险 | `messages-pagination-loader.js` (规划) |
| 媒体滚动校正 | 未实现 | 图片加载后跳动 | `media-load-scroller.js` (规划) |
| Legacy 降级 | 与新逻辑同层 | 噪声大 | `legacy/` 子目录集中 |

## 3. 目标目录结构 (增量创建)
```
static/js/usecases/
  message-module.js              # 仅协调/入口/兼容层
  core/
    shops-manager.js
    conversations-manager.js
    messages-manager.js
    message-send-channel.js      # (已存在)
  realtime/
    message-ws-handler.js        # (已存在)
    ws-event-router.js           # (已存在)
  features/
    messages-pagination-loader.js
    media-load-scroller.js
    shop-stats-service.js
    customer-numbering.js
  ui/
    message-renderer.js
    ui-states.js
  legacy/
    legacy-loaders.js            # _legacyLoadMessages / _legacyLoadConversationsForShop
    legacy-senders.js            # _legacySendMessage
    legacy-numbering.js
```

## 4. 小步快跑迭代路线 (每步 ≤ 2 文件改动)
| 步骤 | 目的 | 产出 | 风险控制 |
|------|------|------|----------|
| Step 0 | 建立 plan 文档 (已完成) | 本文件 | 无 |
| Step 1 | 抽离 Legacy 聚合 | `legacy/legacy-loaders.js`, `legacy/legacy-senders.js` | 保留原 API 透传 |
| Step 2 | 精简 message-module | 删除内部 legacy 实现, 改为调用 legacy/* | 回退路径仍在 |
| Step 3 | 创建 ui-states.js | 统一 showLoading/showError/showEmpty | 替换时保留旧判断 |
| Step 4 | 抽离 shop-stats-service | 合并对话+未读统计获取 | 暂保留旧函数作为代理 |
| Step 5 | 清理 getShopConversationCount/Unread 重复 | 引用 stats service | 若缺失则 fallback |
| Step 6 | 创建 customer-numbering.js | 统一生成策略 | message-module & conv-manager 改为调用 |
| Step 7 | 抽离 messages-pagination-loader (骨架) | 游标/锁/滚动保持 | 先仅返回数据不接UI |
| Step 8 | 接入分页到 messages-manager | loadMessages 分支支持 before_cursor | 保持原 API |
| Step 9 | media-load-scroller 骨架 | 监听媒体加载 → 批量校正 | 不主动滚动到底部 |
| Step 10 | 删除 messages-manager 内旧发送逻辑 | 统一调用 sendChannel | 保留对外 API 壳 |
| Step 11 | 统一错误 & 日志格式 | error(topic, id, msg) 封装 | 逐文件替换 console.* |
| Step 12 | 虚拟列表预研 (可选) | 评估消息阈值策略 | 延后实现 |

## 5. 拆分顺序 rationale
1. 先隔离 Legacy, 减少主文件视觉噪声 → 更易识别真实依赖
2. 引入 UI 状态统一组件，便于后续分页/加载态的复用
3. 将统计与编号集中后，再做分页，避免多来源数据不一致
4. 分页与媒体滚动校正一起，降低滚动跳动 bug 频率
5. 最后移除旧发送逻辑，确保回流覆盖稳定期再收尾

## 6. 分页设计摘要 (预览)
- 游标：采用最早消息 `id` 或 `created_at` 作为 `before` 参数
- API 期望：`GET /api/conversations/{id}/messages?before=<id>&limit=30`
- 前端缓存：messagesManager 内部 `messages[]` 始终按时间升序
- Prepend 策略：记录容器 `prevScrollHeight`，插入后设置 `scrollTop = container.scrollHeight - prevScrollHeight`
- Exhausted 标志：当返回数量 < 请求 limit 即认为没有更多
- 锁：`_loadingOlder = true` 防并发；300ms 防抖

## 7. 媒体滚动校正摘要
- 收集本次新增媒体元素 (img/video)
- 统一监听 `load` 或 `loadeddata`
- 在最后一个加载完成 (或 500ms 超时) 后计算高度增量并校正 scrollTop
- 与“粘底”逻辑协同：若用户已离底部 > 80px 则不粘底

## 8. 去重与统一策略
| 领域 | 统一点 | 说明 |
|------|--------|------|
| Auth | AuthFetch.safeJsonFetch | 禁止散落 fetch + header 拼接 |
| WS | MessageWSHandler + WsEventRouter | 所有 onmessage 都走 route | 
| 发送 | MessageSendChannel | 禁止直接 websocket.send JSON |
| 状态 | UIStates.* | 统一 Loading/Empty/Error 占位 DOM |
| 统计 | ShopStatsService | conversation_count / unread_count 聚合调用 |
| 客户编号 | CustomerNumbering | 全局一致，可配置策略 |
| 日志 | Logger.* (规划) | topic + action + meta JSON |

## 9. 冗余/风险清单 (初版)
| 项 | 状态 | 风险 | 处理步 |
|----|------|------|---------|
| _legacyLoadMessages / loadMessages | 并存 | 双路径维护成本 | Step 1-2 |
| getShopConversationCount 重复统计 | 并存 | 多次 API | Step 4-5 |
| getShopUnreadCount 重复统计 | 并存 | 不一致风险 | Step 4-5 |
| updateConversationPreview 分散 | 并存 | 预览显示不同步 | 与 Step 4 同期合并 |
| 客户编号多来源 | 并存 | 客户名称混乱 | Step 6 |
| 旧发送逻辑 vs sendChannel | 并存 | 双状态冲突 | Step 10 |
| 零散 Loading/Error DOM | 多处 | 欠一致性 | Step 3 |

## 10. 完成判定指标
- message-module.js < 220 行
- legacy/* 覆盖所有 _legacy* 方法
- managers/core/features/ui 目录结构存在并最少 7 个文件 < 300 行/文件
- 无直接调用 websocket.send 的业务代码（仅 sendChannel 内部）
- UI 状态调用统一使用 UIStates.*
- stats / numbering / pagination 各自独立文件且无循环依赖

## 11. 回滚策略
若某步引入问题：
1. 保留旧函数壳 1-2 个版本周期
2. 新模块暴露与旧 API 同名入口，内部委托新实现
3. 避免一次性删除：采用“提取 → 代理 → 切换 → 清理”四阶段

## 12. 后续可选增强 (非本阶段)
- 内存消息窗口化 (只保留最近 N 条 + 分页加载)
- 域事件本地订阅总线 (解耦 UI from router)
- 本地离线发送队列持久化 (IndexedDB)
- 埋点统计 logger → CSV 导出

---
更新策略：每完成一个 Step 在此文档追加“完成记录”段落。
