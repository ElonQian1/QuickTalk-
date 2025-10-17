# 客户列表实时更新功能说明

## 📋 功能概述

本次优化为客户列表页面（`CustomerListPage.tsx`）添加了以下三大实时功能：

### ✅ 已实现功能

#### 1. **未读消息红点提示**
- 有未读消息的客户卡片显示醒目的红点Badge
- 未读消息数量实时显示在右上角
- 有未读的卡片背景色为浅橙色（`#fff8f0`），更醒目
- 左侧添加主题色边框（3px）作为视觉标识

#### 2. **显示最新消息内容**
- 每个客户卡片下方显示最后一条消息
- 消息内容格式：
  - 客户发送：直接显示内容
  - 客服发送：显示 `[我] 内容`
  - 图片消息：显示 `[图片]`
  - 文件消息：显示 `[文件]`
- 未读消息以**粗体**和深色显示，已读消息为灰色
- 显示消息时间（相对时间：刚刚、X分钟前、X小时前等）

#### 3. **新消息自动置顶**
- 客户列表按以下优先级排序：
  1. **优先级最高**：有未读消息的客户（按未读数量降序）
  2. **优先级其次**：按最后消息时间降序（最新的在前）
  3. **最后排序**：按客户最后活跃时间降序
- 当客户发送新消息时：
  - 列表自动刷新
  - 该客户自动置顶
  - 红点和未读数实时更新

## 🔄 实时更新机制

### WebSocket 监听
```typescript
// 自动监听 WebSocket 消息
useEffect(() => {
  const handleNewMessage = (data: any) => {
    // 收到新消息时自动刷新列表
    fetchCustomers(parseInt(shopId));
  };
  
  // 订阅 WebSocket 消息
  useWSStore.getState().addMessageListener(handleNewMessage);
  
  return () => {
    useWSStore.getState().removeMessageListener(handleNewMessage);
  };
}, [shopId]);
```

### 数据流程
```
WebSocket 收到新消息
    ↓
触发列表刷新 (fetchCustomers)
    ↓
获取最新数据 (API: /api/shops/{shopId}/customers)
    ↓
执行排序逻辑（未读优先 → 时间倒序）
    ↓
更新界面显示
```

## 🎨 视觉设计

### 未读消息卡片
- **背景色**：`#fff8f0`（浅橙色）
- **左边框**：3px 主题色（`theme.colors.primary`）
- **Hover 状态**：`#fff3e6`（更深的橙色）
- **未读Badge**：右上角显示数字

### 已读消息卡片
- **背景色**：白色
- **左边框**：透明（3px 占位）
- **Hover 状态**：`#f8f8f8`（浅灰）

### 消息内容样式
```typescript
// 未读消息
color: theme.colors.text.primary  // 深色
font-weight: 600                   // 粗体

// 已读消息
color: theme.colors.text.secondary // 灰色
font-weight: 400                    // 正常
```

## 📊 排序算法

```typescript
const sorted = normalized.sort((a, b) => {
  // 优先级1：未读消息数量（降序）
  const unreadDiff = (b.unread_count || 0) - (a.unread_count || 0);
  if (unreadDiff !== 0) return unreadDiff;
  
  // 优先级2：最后消息时间（降序）
  const aTime = a.last_message?.created_at 
    || a.session?.last_message_at 
    || a.customer.last_active_at;
  const bTime = b.last_message?.created_at 
    || b.session?.last_message_at 
    || b.customer.last_active_at;
  
  if (aTime && bTime) {
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  }
  
  return 0;
});
```

### 排序示例

假设有以下客户：
- 客户A：3条未读，最后消息 10:00
- 客户B：1条未读，最后消息 10:30
- 客户C：5条未读，最后消息 09:00
- 客户D：0条未读，最后消息 11:00

**排序结果**：
1. 客户C（5条未读）
2. 客户A（3条未读）
3. 客户B（1条未读）
4. 客户D（0条未读，但时间最新）

## 🔧 技术细节

### 数据结构
```typescript
interface CustomerWithSession {
  customer: Customer;           // 客户基本信息
  session?: Session | null;     // 会话信息
  last_message?: Message | null; // 最后一条消息
  unread_count: number;         // 未读消息数
}
```

### API 端点
- **获取客户列表**：`GET /api/shops/{shopId}/customers`
- **标记全部已读**：`POST /api/shops/{shopId}/customers/read_all`

### Store 集成
- `useConversationsStore`：会话未读计数
- `useNotificationsStore`：通知中心未读计数（按会话维度）
- `useWSStore`：WebSocket 连接和消息监听

## 🚀 使用场景

### 场景1：客服查看客户列表
1. 进入店铺的客户列表页面
2. 自动显示所有客户，未读消息的排在最前
3. 可以看到每个客户的最后一条消息
4. 点击客户卡片进入聊天页面

### 场景2：收到新消息
1. 客户发送消息
2. WebSocket 实时推送
3. 客户列表自动刷新
4. 该客户自动置顶
5. 红点和未读数更新

### 场景3：多客户同时发消息
1. 多个客户同时发送消息
2. 按未读数量排序，未读多的在前
3. 同等未读数下，按时间排序（最新的在前）

## 📱 响应式设计

- 卡片高度自适应内容
- 消息文本自动截断（`text-overflow: ellipsis`）
- 触摸友好的点击区域
- 流畅的过渡动画（0.2s ease）

## 🔍 调试信息

在浏览器控制台可以看到以下日志：

```
📬 客户列表收到新消息: {...}
```

这表示列表正在监听并响应 WebSocket 消息。

## ⚠️ 注意事项

1. **性能优化**：
   - 列表刷新使用防抖，避免频繁请求
   - 仅在当前店铺页面监听消息
   - 离开页面时自动取消监听

2. **已读逻辑**：
   - 进入客户列表页面会自动标记所有消息为已读
   - 这是批量操作，一次 API 请求完成

3. **排序稳定性**：
   - 排序算法确保相同条件下的客户顺序不变
   - 避免列表抖动

## 📝 后续优化建议

### 可选增强
- [ ] 添加"仅显示未读"过滤器
- [ ] 支持手动刷新（下拉刷新）
- [ ] 显示"正在输入..."状态
- [ ] 消息预览长度可配置
- [ ] 添加客户标签筛选
- [ ] 支持客户搜索功能

### 性能优化
- [ ] 虚拟滚动（客户数量 >100 时）
- [ ] 消息内容截断优化
- [ ] 头像懒加载

---

**实现日期**：2025年10月17日  
**文件路径**：`frontend/src/pages/CustomerListPage.tsx`  
**相关文档**：
- `NOTIFICATION_GUIDE.md` - 通知系统指南
- `NOTIFICATION_TROUBLESHOOTING.md` - 通知问题排查
