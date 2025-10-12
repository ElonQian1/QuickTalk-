# Messages Components

消息中心页面的模块化组件集合。

## 组件列表

### StatsSection
基础的统计信息容器组件，使用与统计页面相同的样式。

**特点:**
- 统一的毛玻璃效果背景
- 圆角和阴影设计
- 响应式布局

### MessageStats
消息中心专用的统计组件，展示店铺、客户和未读消息数量。

**Props:**
- `totalShops: number` - 店铺总数
- `totalCustomers: number` - 客户总数  
- `unreadMessages: number` - 未读消息数

### ConversationCard
会话卡片组件，显示单个店铺的对话信息。

**Props:**
- `shopName: string` - 店铺名称
- `customerCount: number` - 客户数量
- `unreadCount: number` - 未读消息数
- `lastMessage?: object` - 最后一条消息
- `onClick: () => void` - 点击回调

### EmptyState
空状态组件集合，用于显示无数据时的提示。

**组件:**
- `EmptyState` - 容器
- `EmptyIcon` - 图标容器
- `EmptyTitle` - 标题
- `EmptyDescription` - 描述文本

## 使用示例

```tsx
import { MessageStats, EmptyState, EmptyIcon, EmptyTitle, EmptyDescription } from '../../components/Messages';

// 统计信息
<MessageStats
  totalShops={10}
  totalCustomers={50}
  unreadMessages={5}
/>

// 空状态
<EmptyState>
  <EmptyIcon>💬</EmptyIcon>
  <EmptyTitle>暂无对话</EmptyTitle>
  <EmptyDescription>当有客户发起对话时，会显示在这里</EmptyDescription>
</EmptyState>
```

## 样式特点

- 使用统一的主题系统
- 与统计页面保持一致的设计语言
- 完全响应式设计
- 支持暗色模式（如果主题支持）