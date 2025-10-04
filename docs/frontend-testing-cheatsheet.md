# 前端最小自检与测试速查
> 版本: 2025-10-04

## 1. 目的
提供快速验证当前前端未读聚合、红点展示、布局切换与消息发送链路是否正常的最小步骤。

## 2. 预备
启动后端：`cargo run` (根目录下 backend)。确保浏览器打开移动端管理页面或消息页。

## 3. 基础检查
| 步骤 | 目标 | 期望结果 |
|------|------|----------|
| A1 | 全局配置是否加载 | 控制台执行 `typeof QT_CONFIG` → `object` |
| A2 | 日志工具可用 | `QT_LOG.info('check','ok')` 输出 `[check] ok` |
| A3 | 聚合器加载 | `unreadBadgeAggregator.getTotals()` 返回对象 `{ total, perShop, ... }` |

## 4. 未读聚合路径测试
1. 启用调试： `QT_LOG.setDebug('unreadAggregator', true); QT_LOG.setDebug('navBadge', true);`
2. 模拟一条来自客户的新消息（真实客户端或测试工具）。
3. 观察控制台：出现 `unread:update` 事件日志，`total` 递增。
4. 导航“消息”红点数字同步变化。

## 5. API 覆盖测试
1. 暂时关闭 DOM fallback： `QT_CONFIG.features.forceUnreadFallback = false;`
2. 强制刷新： `unreadBadgeAggregator.refresh('manual');`
3. 如果 API 尚未返回未读字段，`total` 可能为 0（这是预期，表示没有伪造值）。
4. 打开 fallback： `QT_CONFIG.features.forceUnreadFallback = true; unreadBadgeAggregator.refresh('manual');` → 可能基于 DOM 估算。

## 6. DOM Fallback 真实启用确认
执行：
```js
QT_CONFIG.features.forceUnreadFallback = true;
unreadBadgeAggregator.refresh('manual');
unreadBadgeAggregator.getTotals();
```
如果没有 API 未读字段，`perShop` 应出现基于 `.shop-card` 扫描的数字（可能为 0）。

## 7. 店铺红点与总红点一致性
1. 修改某店铺 DOM（模拟未读），例如：
```js
const c=document.querySelector('.shop-card[data-shop-id] .unread-count'); if(c){c.textContent='5';}
```
2. 运行：
```js
QT_CONFIG.features.forceUnreadFallback = true;
unreadBadgeAggregator.refresh('manual');
```
3. 导航红点应显示 ≥5，且 `getTotals().perShop` 对应店铺为 5。

## 8. 布局验证
| 区域 | 检查 | 代码 | 期望 |
|------|------|------|------|
| 店铺页面 | 单列 | `getComputedStyle(document.querySelector('#shopsPage .shop-grid')).flexDirection` | `column` 或 `undefined` (flex 默认) |
| 消息列表 | 条目纵向 | `getComputedStyle(document.querySelector('#messagesPage .conversation-item')).flexDirection` | `column` |

## 9. 发送消息管道（客服 → 客户）
1. 在管理端页面控制台执行：`debugMessageSending && debugMessageSending();`
2. 发送消息：输入框正常发送。
3. 访客页面/模拟器应收到 `domain.event.message_appended`。
4. 若失败：检查 Network `POST /api/conversations/{id}/messages` 状态码与响应 JSON。

## 10. 快速清理 / 关闭调试
```js
QT_CONFIG.debug.global = false;
['shopCard','navBadge','unreadAggregator','badgeIntegration','unreadFix'].forEach(ns=>QT_LOG.setDebug(ns,false));
```

## 11. 常见问题速查
| 现象 | 可能原因 | 建议排查 |
|------|----------|----------|
| 导航红点一直是 0 | API 未提供 unread 字段且 fallback 关闭 | 打开 fallback 或实现 API 字段 |
| 红点数字不下降 | 未实现“已读”后端接口 / 缺少进入对话清零逻辑 | 查看 `badgeCleared` 事件是否触发 |
| 事件不触发 | WebSocket 监听未挂载 / 事件名不一致 | 检查 `ws:domain.event.message_appended` 分发 |
| DOM fallback 值异常 | 页面中无 `.unread-count` 元素或被懒加载 | 确保卡片渲染完成后再刷新聚合 |

## 12. 建议后续
- 编写 Jest/Playwright 级别 UI 自动化（后续可引入，但当前项目禁止 Node.js 运行时 —— 如需测试需在 Rust 或浏览器内注入脚本方案）。
- 对 WS 事件调度中心抽象。

---
文件维护者: 前端重构专项  
可在 PR 中引用本测试速查表完成回归。