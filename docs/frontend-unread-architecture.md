# 前端未读数聚合与红点体系架构说明

> 版本: 2025-10-04  
> 适用分支: ruilong  
> 目标：统一未读消息数的获取、缓存与展示，移除零散 DOM 扫描和临时补丁脚本的副作用。

## 1. 背景与问题
旧实现中存在：
- 多处脚本分别扫描 DOM 统计未读（`badge-integration.js`, 临时 `unread-badge-fix.js`）产生重复逻辑与性能浪费。
- 导航红点、店铺红点、消息页红点之间没有单一数据源，可能出现显示不一致。
- 临时 fallback（强制显示 1~3 条）导致数据可信度下降。

## 2. 新结构概览
```
qt-config.js (全局配置/日志中心)
│
└─ unread-badge-aggregator.js (统一聚合器)
      ├─ 来源优先级: WS 增量 > API 拉取 > DOM Fallback
      ├─ 输出事件: document: 'unread:update' { total, perShop, reason, timestamp }
      └─ 配置依赖: QT_CONFIG.intervals.unreadPoll, QT_CONFIG.features.forceUnreadFallback

nav-badge-manager.js  ← 监听 'unread:update' 更新底部消息红点
badge-integration.js  ← 使用 aggregator.getTotals() 替代直接扫描
shop-card-manager.js  ← 负责店铺级红点组件（单店铺维度）
```

## 3. 关键文件职责
| 文件 | 角色 | 说明 |
|------|------|------|
| `js/core/qt-config.js` | 配置/日志中心 | 命名空间调试 & 特性开关；统一 `QT_LOG` |
| `js/ui/unread-badge-aggregator.js` | 未读聚合核心 | 拉取/增量/回退合并；派发事件 |
| `js/ui/nav-badge-manager.js` | 底部导航红点 | 订阅 `unread:update` 设置 messages 红点 |
| `js/ui/badge-integration.js` | 协调旧逻辑 | 兼容旧 DataSyncManager，迁移到聚合器 |
| `js/ui/shop-card-manager.js` | 店铺红点组件 | 管理 per-shop 徽章，供聚合器 DOM fallback 使用 |
| `js/fixes/unread-badge-fix.js` | 临时补丁(可禁用) | 仅在 `forceUnreadFallback` = true 时启用 |

## 4. 数据流详细
1. WebSocket 收到 `domain.event.message_appended` → 浏览器转发或转换为 `document` 自定义事件（当前直接监听派送的 `ws:domain.event.message_appended`）。
2. `unread-badge-aggregator` 判断是否计入（过滤客服自己发送的消息）。
3. 聚合器内存更新 `perShop` → 重新计算 `total` → 触发 `unread:update` 事件。
4. `nav-badge-manager` / `badge-integration` / 其它需要模块监听该事件执行 UI 更新。
5. 周期轮询（默认 15s）尝试 API 拉取：若 API 返回含 `unread_count` 字段则覆盖内存状态。
6. 若 API 暂不提供数据且允许 fallback：执行 DOM 扫描（需手动开启 `QT_CONFIG.features.forceUnreadFallback = true`）。

## 5. 配置与开关
```js
QT_CONFIG = {
  debug: { global:false, namespaces:{ shopCard:false, navBadge:false, unreadAggregator:false, badgeIntegration:false, unreadFix:false } },
  features: { forceUnreadFallback:false },
  intervals: { unreadPoll:15000, shopCardAutoUpdate:30000 }
}
```
常用控制：
```js
QT_LOG.setDebug('unreadAggregator', true);
QT_CONFIG.features.forceUnreadFallback = true; // 开启 DOM 猜测兜底
QT_CONFIG.intervals.unreadPoll = 10000;        // 调整轮询间隔
```

## 6. 事件规范
| 事件 | Detail 示例 | 触发时机 |
|------|-------------|----------|
| `unread:update` | `{ total:5, perShop:{"1":3,"2":2}, reason:'ws-increment', timestamp: 173... }` | 聚合器刷新或增量更新 |
| `shopBadgeClick` | `{ shopId, unreadCount }` | 用户点击店铺红点 |
| `badgeCleared` | `{ conversationId, shopId, clearedBy }` | 对话点击清除红点 |

## 7. 回退与兼容策略
- 旧脚本调用 `shopCardManager.updateAllBadges()` 保持有效。
- 直接依赖 DOM 扫描统计未读的脚本可逐步移除（优先 `unread-badge-fix.js`）。
- DOM fallback 仅在明确启用 `forceUnreadFallback` 时运行，防止伪数据。

## 8. 性能考量
| 点 | 优化措施 |
|----|----------|
| 重复扫描 | 仅 fallback 时扫描，且依赖显式开关 |
| 更新频率 | WS 增量即时；轮询可配置；DOM 避免默认启用 |
| 监听风暴 | `unread:update` 合并为单一高层事件 |

## 9. 常见调试脚本片段
```js
// 查看当前聚合总览
unreadBadgeAggregator.getTotals();

// 强制刷新来源链路
unreadBadgeAggregator.refresh('manual');

// 启用全局调试
QT_CONFIG.debug.global = true;

// 单独启用聚合器调试
QT_LOG.setDebug('unreadAggregator', true);
```

## 10. 推荐迁移步骤（如果还在淘汰旧逻辑）
1. 确认后端 API 返回 `unread_count` 字段。  
2. 保持 WebSocket 事件结构稳定。  
3. 移除页面里的 `<script src=".../fixes/unread-badge-fix.js">`。  
4. 清理遗留针对 `.unread-count` 的临时 hack。  
5. 为后续统计/分析扩展 `unread:update` 事件订阅。  

## 11. 后续可选增强
- 会话维度未读缓存（按 conversationId）
- 读事件（进入对话自动告诉后端已读）→ 减少本地猜测
- 事件节流/批处理（合并 50ms 内多次 WS 增量）
- UI Dev 面板：展示 `perShop`、来源（api/ws/dom）标记。

---
如需进一步拓展请标记 TODO：`docs/frontend-unread-architecture.md` 可继续迭代。
