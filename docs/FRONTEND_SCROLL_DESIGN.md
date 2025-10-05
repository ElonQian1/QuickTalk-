# 前端滚动统一设计 (ScrollCoordinator)

版本: v0.1  (增量重构阶段)  
作者: 自动化重构助手  
更新时间: 2025-10-04

## 1. 设计目标
统一消息区域滚动行为, 解决以下问题:
- 多处重复 scrollToBottom 逻辑 & 条件判断
- 新消息到达时粘底与用户查看历史之间的冲突
- 图片/视频加载高度变化导致的列表跳动
- 未读消息提示缺失或不一致
- 向上分页加载时滚动定位错位

## 2. 适用范围
适用于客服消息主列表 (DOM: `#chatMessages`). 其他列表(店铺/对话/员工)后续可扩展复用, 当前实现聚焦聊天窗口。

## 3. 核心概念
| 概念 | 说明 |
|------|------|
| 粘底 (Stick) | 用户当前靠近底部(阈值内)时, 新消息自动滚动到最新 |
| 用户离开 (UserScrolledAway) | 用户上滚检视历史, 新消息不打断位置 |
| 未读计数 | 离开底部后到达的新消息数累积 + 徽章显示 |
| 锚点差值 (Prepend Anchor) | 向上分页插入旧消息后保持当前第一条可视消息不跳动 |
| 媒体高度补偿 | 媒体加载后高度增加需对 scrollTop 做差值调整 |

## 4. API 契约
```js
ScrollCoordinator.init({
  getContainer: ()=> HTMLElement,  // 必须, 返回消息容器
  autoStick: true,                 // 是否在靠近底部时自动滚动
  stickThreshold: 80,              // 离底部多少像素视为粘底
  unreadBadgeSelector: '#unreadMessagesBadge', // 未读徽章 DOM 选择器
  mediaMutationDebounce: 120       // 媒体高度变化节流(ms)
});

ScrollCoordinator.notifyNewMessage();  // 新消息追加后调用
ScrollCoordinator.scrollToEnd(smooth?); // 滚动到底部 (可平滑)
ScrollCoordinator.forceToEnd();         // 立即无动画到最底
const anchor = ScrollCoordinator.capturePrependAnchor();
// ... 插入历史消息 DOM ...
ScrollCoordinator.restorePrependAnchor(anchor);
ScrollCoordinator.getUnread();
ScrollCoordinator.resetUnread();
```

## 5. 运行流程
### 5.1 初始化阶段
1. 获取容器, 绑定 scroll 事件 -> 监听用户是否离开底部
2. 记录初始 scrollHeight (用于媒体补偿差值基准)
3. 若 autoStick = true, 首次强制滚动到底部
4. 启动 MutationObserver 观察媒体加载导致的 DOM 结构变化

### 5.2 新消息处理
```
if (未离开底部) -> 粘底滚动 -> 清空未读
else -> 未读计数+1 -> 徽章显示/闪烁
```

### 5.3 向上分页
- 分页前: `anchor = capturePrependAnchor()` (记录当前 scrollHeight 与 scrollTop)
- 插入历史消息 DOM 后: `restorePrependAnchor(anchor)` (用新旧 scrollHeight 差值补回 scrollTop)

### 5.4 媒体高度补偿
1. MutationObserver 捕捉到节点新增/属性变化
2. 若用户处于“上滚”状态(userScrolledAway=true) -> 延迟触发一次差值调整
3. 计算 `delta = newScrollHeight - oldScrollHeight` -> `scrollTop += delta`
4. 更新 lastScrollHeight

### 5.5 用户滚动行为判定
- 滚动事件中: `距底部距离 <= stickThreshold` → 取消未读并标记未离开
- 其它情况 → 标记已离开, 保持当前视图稳定

## 6. DOM 结构与样式要求
| 元素 | 要求 | 说明 |
|------|------|------|
| #chatMessages | overflow-y: auto; 独立滚动容器 | 必须固定高度(或 flex 约束) |
| #unreadMessagesBadge | position 固定在底部或悬浮 | 默认 display:none; 加类 pulse-new-message 做简易动画 |

未读徽章建议样式 (示例):
```css
#unreadMessagesBadge {
  display:none; min-width:20px; height:20px; line-height:20px;
  font-size:12px; background:#ff5132; color:#fff; border-radius:12px;
  justify-content:center; align-items:center; padding:0 6px;
  position:absolute; right:8px; bottom:72px; z-index:10;
}
#unreadMessagesBadge.pulse-new-message { animation: badge-pulse 1.2s ease; }
@keyframes badge-pulse { 0%{ transform:scale(.8); opacity:.5;} 40%{ transform:scale(1); opacity:1;} 100%{ transform:scale(1); opacity:1;} }
```

## 7. 失败与回退策略
| 场景 | 降级行为 |
|------|----------|
| ScrollCoordinator 未加载 | Orchestrator 直接 DOM scrollToBottom |
| MutationObserver 不支持 | 媒体补偿跳过 (不抛错) |
| 未读徽章缺失 | 仅内部计数, 不显示 UI |
| 平滑滚动被浏览器拒绝 | 改为同步赋值 scrollTop |

## 8. 性能考虑
- 媒体补偿使用节流 (默认 120ms), 避免频繁重排
- 未读徽章更新只在计数变化时写 DOM
- 不在新消息时做全列表测量, 仅读 scrollHeight/scrollTop/ clientHeight

## 9. 与其他模块的集成点
| 模块 | 交互方式 | 说明 |
|------|----------|------|
| MessageModule | 调用 notifyNewMessage / scrollToEnd | 所有新消息追加路径集中于此封装 `_notifyNewMessageForScroll()` |
| MessagesManager | 在成功插入本地状态后让外层调用 Orchestrator 渲染, 渲染后再通知滚动 | 避免重复滚动判定 |
| MessageSender | 发送队列 enqueued -> 单条渲染 -> 通知滚动 | ACK 更新后可选择不再次滚动 |
| MessageRenderer | 不直接操纵滚动 | 渲染完成后由 Orchestrator 触发滚动通知 |
| MediaScrollIntegration | 未来可将媒体加载监听合并进 Coordinator | 当前各自并行不会冲突 |

## 10. 常见调用序列示例
### 10.1 收到新消息 (服务端推送)
```
WS -> MessageWSEventsHandler -> messagesManager.append -> stateStore.update
 -> Orchestrator.renderMessage(message) -> Orchestrator._notifyNewMessageForScroll()
 -> ScrollCoordinator.notifyNewMessage() -> 根据状态决定粘底或+未读
```

### 10.2 用户向上滚分页
```
User scroll up -> 触发分页按钮/自动阈值
anchor = capturePrependAnchor()
load older messages -> DOM prepend
restorePrependAnchor(anchor)
```

## 11. 扩展路线 (计划)
| 版本 | 增强 | 描述 |
|------|------|------|
| v0.2 | 扩展多实例 | 支持不同容器同时管理 |
| v0.3 | 监听可见区域首末 messageId | 给阅读进度条使用 |
| v0.4 | 虚拟滚动接入接口 | 替换底层 DOM 构造减少节点数 |

## 12. 质量验证清单 (无需立即运行, 逻辑自检)
- 新消息在底部: 未读=0, 自动滚到底
- 新消息离开底部: 未读+1, 不跳动
- 多图加载: 用户上滚时不跳 (scrollTop 差值补偿)
- 分页插入上方: 视觉第一条消息保持不变
- 卸载/重复 init 不抛异常 (当前幂等: 后续可加 destroy)

## 13. 已知限制
- 仅处理一个容器实例
- 未读依据“是否离开底部”而非首条可见 messageId, 精度足够当前需求
- 媒体高度补偿可能在极端大量图片同时加载时产生轻微抖动 (可后续缓存资源高度)

## 14. 集成注意事项
- 确保在 `MessageRenderer` 或消息 DOM 插入后调用 `notifyNewMessage()`
- 不要在业务模块直接操作 `scrollTop` (除非极端回退需求)
- 如果容器在首次 init 时还未挂载, 允许稍后二次调用 `init()` 自动拾取

---

如需修改或新增能力 (多实例 / 精准视窗追踪), 请在本文件最下方新增“变更申请”段落而不是直接改动历史段。
