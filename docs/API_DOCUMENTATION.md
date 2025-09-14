# QuickTalk 客服系统 API 文档

## 📋 目录

1. [概述](#概述)
2. [认证](#认证)
3. [核心模块 API](#核心模块-api)
4. [UI组件 API](#ui组件-api)
5. [业务管理器 API](#业务管理器-api)
6. [WebSocket API](#websocket-api)
7. [错误处理](#错误处理)
8. [示例代码](#示例代码)

## 概述

QuickTalk 是一个基于模块化架构的实时客服系统，提供了完整的前后端API接口。系统采用事件驱动架构，支持WebSocket实时通信和RESTful API。

### 基础信息
- **版本**: 2.0.0
- **基础URL**: `http://localhost:3030`
- **WebSocket URL**: `ws://localhost:3030/ws`
- **认证方式**: Bearer Token

## 认证

### 登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "email": "admin@example.com"
    }
  }
}
```

### 认证头
所有需要认证的请求必须包含以下请求头：
```http
Authorization: Bearer <token>
```

## 核心模块 API

### Utils 工具类

#### `Utils.formatTime(timestamp, format)`
格式化时间戳为可读字符串

**参数:**
- `timestamp` (number): 时间戳
- `format` (string, optional): 格式字符串，默认 'YYYY-MM-DD HH:mm:ss'

**返回值:** string

**示例:**
```javascript
const formattedTime = Utils.formatTime(Date.now(), 'MM/DD HH:mm');
// 输出: "12/25 14:30"
```

#### `Utils.escapeHtml(str)`
转义HTML特殊字符

**参数:**
- `str` (string): 待转义的字符串

**返回值:** string

**示例:**
```javascript
const safe = Utils.escapeHtml('<script>alert("xss")</script>');
// 输出: "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
```

#### `Utils.generateId(prefix)`
生成唯一ID

**参数:**
- `prefix` (string, optional): ID前缀

**返回值:** string

**示例:**
```javascript
const id = Utils.generateId('user');
// 输出: "user_1640995200123_abc123"
```

#### `Utils.debounce(func, delay)`
防抖函数

**参数:**
- `func` (function): 需要防抖的函数
- `delay` (number): 延迟时间（毫秒）

**返回值:** function

#### `Utils.throttle(func, delay)`
节流函数

**参数:**
- `func` (function): 需要节流的函数
- `delay` (number): 间隔时间（毫秒）

**返回值:** function

#### `Utils.deepClone(obj)`
深度克隆对象

**参数:**
- `obj` (any): 待克隆的对象

**返回值:** any

#### `Utils.validateEmail(email)`
验证邮箱格式

**参数:**
- `email` (string): 邮箱地址

**返回值:** boolean

#### `Utils.validateUrl(url)`
验证URL格式

**参数:**
- `url` (string): URL地址

**返回值:** boolean

### Config 配置管理

#### `Config.get(key, defaultValue)`
获取配置值

**参数:**
- `key` (string): 配置键，支持点号分隔的嵌套键
- `defaultValue` (any, optional): 默认值

**返回值:** any

**示例:**
```javascript
const theme = Config.get('ui.theme', 'light');
const user = Config.get('user.profile');
```

#### `Config.set(key, value)`
设置配置值

**参数:**
- `key` (string): 配置键
- `value` (any): 配置值

**示例:**
```javascript
Config.set('ui.theme', 'dark');
Config.set('user.preferences', { language: 'zh-CN' });
```

#### `Config.has(key)`
检查配置是否存在

**参数:**
- `key` (string): 配置键

**返回值:** boolean

#### `Config.remove(key)`
删除配置

**参数:**
- `key` (string): 配置键

#### `Config.clear()`
清空所有配置

#### `Config.addValidator(key, validator)`
添加配置验证器

**参数:**
- `key` (string): 配置键
- `validator` (function): 验证函数

#### `Config.on(event, callback)`
监听配置变化事件

**参数:**
- `event` (string): 事件名称 ('change', 'set', 'remove')
- `callback` (function): 回调函数

### EventBus 事件总线

#### `EventBus.on(event, callback, options)`
监听事件

**参数:**
- `event` (string): 事件名称
- `callback` (function): 回调函数
- `options` (object, optional): 选项 { once, priority, namespace }

**示例:**
```javascript
EventBus.on('user:login', (user) => {
    console.log('用户登录:', user);
});

// 一次性监听
EventBus.on('app:ready', handleAppReady, { once: true });

// 带优先级的监听
EventBus.on('message:send', handler, { priority: 10 });
```

#### `EventBus.once(event, callback)`
一次性监听事件

**参数:**
- `event` (string): 事件名称
- `callback` (function): 回调函数

#### `EventBus.off(event, callback)`
移除事件监听器

**参数:**
- `event` (string): 事件名称
- `callback` (function, optional): 回调函数，不传则移除所有

#### `EventBus.emit(event, ...args)`
触发事件

**参数:**
- `event` (string): 事件名称
- `...args` (any): 传递给监听器的参数

**返回值:** boolean (是否有监听器处理)

#### `EventBus.emitAsync(event, ...args)`
异步触发事件

**参数:**
- `event` (string): 事件名称
- `...args` (any): 传递给监听器的参数

**返回值:** Promise<boolean>

#### `EventBus.listenerCount(event)`
获取事件监听器数量

**参数:**
- `event` (string): 事件名称

**返回值:** number

## UI组件 API

### Modal 模态框组件

#### 构造函数
```javascript
const modal = new Modal(options);
```

**选项参数:**
```javascript
{
  title: 'string',           // 标题
  content: 'string|element', // 内容
  width: 'string',           // 宽度，如 '500px'
  height: 'string',          // 高度，如 '400px'
  closable: boolean,         // 是否可关闭，默认 true
  maskClosable: boolean,     // 点击遮罩是否关闭，默认 true
  className: 'string',       // 自定义CSS类
  zIndex: number,            // 层级，默认 1000
  animation: 'string',       // 动画类型 ('fade', 'slide', 'zoom')
  onShow: function,          // 显示时回调
  onHide: function,          // 隐藏时回调
  onClose: function          // 关闭时回调
}
```

#### 实例方法

##### `modal.show()`
显示模态框

**返回值:** Promise<void>

##### `modal.hide()`
隐藏模态框

**返回值:** Promise<void>

##### `modal.setTitle(title)`
设置标题

**参数:**
- `title` (string): 新标题

##### `modal.setContent(content)`
设置内容

**参数:**
- `content` (string|HTMLElement): 新内容

##### `modal.destroy()`
销毁模态框

#### 静态方法

##### `Modal.alert(message, title)`
显示警告框

**参数:**
- `message` (string): 消息内容
- `title` (string, optional): 标题

**返回值:** Promise<void>

##### `Modal.confirm(message, title)`
显示确认框

**参数:**
- `message` (string): 消息内容
- `title` (string, optional): 标题

**返回值:** Promise<boolean>

##### `Modal.prompt(message, defaultValue, title)`
显示输入框

**参数:**
- `message` (string): 提示消息
- `defaultValue` (string, optional): 默认值
- `title` (string, optional): 标题

**返回值:** Promise<string|null>

**示例:**
```javascript
// 基础模态框
const modal = new Modal({
    title: '用户信息',
    content: '<p>这是用户详细信息</p>',
    width: '400px'
});
modal.show();

// 确认对话框
const result = await Modal.confirm('确定要删除这条消息吗？');
if (result) {
    // 用户点击了确认
}

// 输入对话框
const name = await Modal.prompt('请输入您的姓名:', '张三');
```

### Form 表单组件

#### 构造函数
```javascript
const form = new Form(container, options);
```

**参数:**
- `container` (HTMLElement|string): 容器元素或选择器
- `options` (object): 配置选项

**选项参数:**
```javascript
{
  fields: [],               // 字段配置数组
  validation: {},           // 验证规则
  autoValidate: boolean,    // 自动验证，默认 true
  submitUrl: 'string',      // 提交URL
  method: 'string',         // 提交方法，默认 'POST'
  onSubmit: function,       // 提交时回调
  onValidate: function,     // 验证时回调
  onChange: function        // 字段改变时回调
}
```

#### 实例方法

##### `form.addField(config)`
添加字段

**参数:**
- `config` (object): 字段配置

##### `form.removeField(name)`
移除字段

**参数:**
- `name` (string): 字段名

##### `form.getFieldValue(name)`
获取字段值

**参数:**
- `name` (string): 字段名

**返回值:** any

##### `form.setFieldValue(name, value)`
设置字段值

**参数:**
- `name` (string): 字段名
- `value` (any): 字段值

##### `form.getValues()`
获取所有字段值

**返回值:** object

##### `form.setValues(values)`
设置所有字段值

**参数:**
- `values` (object): 字段值对象

##### `form.validate()`
验证表单

**返回值:** boolean

##### `form.submit()`
提交表单

**返回值:** Promise<any>

##### `form.reset()`
重置表单

### Button 按钮组件

#### 构造函数
```javascript
const button = new Button(container, options);
```

**选项参数:**
```javascript
{
  text: 'string',           // 按钮文本
  type: 'string',           // 按钮类型 ('primary', 'secondary', 'success', 'warning', 'danger')
  size: 'string',           // 尺寸 ('small', 'medium', 'large')
  disabled: boolean,        // 是否禁用
  loading: boolean,         // 是否显示加载状态
  icon: 'string',           // 图标类名
  onClick: function         // 点击回调
}
```

#### 实例方法

##### `button.setText(text)`
设置按钮文本

##### `button.setLoading(loading)`
设置加载状态

##### `button.setDisabled(disabled)`
设置禁用状态

##### `button.destroy()`
销毁按钮

## 业务管理器 API

### UserManager 用户管理器

#### `UserManager.login(credentials)`
用户登录

**参数:**
- `credentials` (object): { username, password }

**返回值:** Promise<User>

#### `UserManager.logout()`
用户登出

**返回值:** Promise<void>

#### `UserManager.getCurrentUser()`
获取当前用户

**返回值:** User|null

#### `UserManager.updateProfile(data)`
更新用户资料

**参数:**
- `data` (object): 用户数据

**返回值:** Promise<User>

#### `UserManager.changePassword(oldPassword, newPassword)`
修改密码

**参数:**
- `oldPassword` (string): 旧密码
- `newPassword` (string): 新密码

**返回值:** Promise<void>

### MessageManager 消息管理器

#### `MessageManager.sendMessage(conversationId, content, type)`
发送消息

**参数:**
- `conversationId` (string): 会话ID
- `content` (string): 消息内容
- `type` (string, optional): 消息类型，默认 'text'

**返回值:** Promise<Message>

#### `MessageManager.getMessages(conversationId, limit, offset)`
获取消息列表

**参数:**
- `conversationId` (string): 会话ID
- `limit` (number, optional): 限制数量，默认 50
- `offset` (number, optional): 偏移量，默认 0

**返回值:** Promise<Message[]>

#### `MessageManager.markAsRead(messageIds)`
标记消息为已读

**参数:**
- `messageIds` (string|string[]): 消息ID或ID数组

**返回值:** Promise<void>

#### `MessageManager.deleteMessage(messageId)`
删除消息

**参数:**
- `messageId` (string): 消息ID

**返回值:** Promise<void>

### ShopManager 店铺管理器

#### `ShopManager.createShop(data)`
创建店铺

**参数:**
- `data` (object): 店铺数据

**返回值:** Promise<Shop>

#### `ShopManager.getShop(shopId)`
获取店铺详情

**参数:**
- `shopId` (string): 店铺ID

**返回值:** Promise<Shop>

#### `ShopManager.updateShop(shopId, data)`
更新店铺信息

**参数:**
- `shopId` (string): 店铺ID
- `data` (object): 更新数据

**返回值:** Promise<Shop>

#### `ShopManager.deleteShop(shopId)`
删除店铺

**参数:**
- `shopId` (string): 店铺ID

**返回值:** Promise<void>

#### `ShopManager.getShopList(filter, pagination)`
获取店铺列表

**参数:**
- `filter` (object, optional): 筛选条件
- `pagination` (object, optional): 分页参数

**返回值:** Promise<{ shops: Shop[], total: number }>

## WebSocket API

### 连接
```javascript
const ws = new WebSocket('ws://localhost:3030/ws');
```

### 消息格式
所有WebSocket消息都采用JSON格式：

```javascript
{
  type: 'string',      // 消息类型
  data: any,           // 消息数据
  timestamp: number,   // 时间戳
  userId: 'string'     // 用户ID（可选）
}
```

### 消息类型

#### `message` - 聊天消息
```javascript
// 发送
{
  type: 'message',
  data: {
    conversationId: 'string',
    content: 'string',
    messageType: 'text|image|file'
  }
}

// 接收
{
  type: 'message',
  data: {
    id: 'string',
    conversationId: 'string',
    content: 'string',
    senderId: 'string',
    senderName: 'string',
    timestamp: number,
    messageType: 'text|image|file'
  }
}
```

#### `join` - 加入会话
```javascript
{
  type: 'join',
  data: {
    conversationId: 'string',
    userId: 'string'
  }
}
```

#### `leave` - 离开会话
```javascript
{
  type: 'leave',
  data: {
    conversationId: 'string',
    userId: 'string'
  }
}
```

#### `typing` - 输入状态
```javascript
{
  type: 'typing',
  data: {
    conversationId: 'string',
    userId: 'string',
    isTyping: boolean
  }
}
```

#### `user_status` - 用户状态
```javascript
{
  type: 'user_status',
  data: {
    userId: 'string',
    status: 'online|offline|away'
  }
}
```

## 错误处理

### 错误响应格式
```javascript
{
  success: false,
  error: {
    code: 'string',      // 错误代码
    message: 'string',   // 错误消息
    details: any         // 错误详情（可选）
  }
}
```

### 常见错误代码

| 代码 | 描述 |
|------|------|
| INVALID_CREDENTIALS | 无效的登录凭据 |
| TOKEN_EXPIRED | 令牌已过期 |
| PERMISSION_DENIED | 权限不足 |
| RESOURCE_NOT_FOUND | 资源不存在 |
| VALIDATION_ERROR | 数据验证失败 |
| RATE_LIMIT_EXCEEDED | 请求频率超限 |
| INTERNAL_ERROR | 内部服务器错误 |

### 错误处理示例
```javascript
try {
  const result = await UserManager.login({ username, password });
} catch (error) {
  if (error.code === 'INVALID_CREDENTIALS') {
    Modal.alert('用户名或密码错误');
  } else if (error.code === 'RATE_LIMIT_EXCEEDED') {
    Modal.alert('请求过于频繁，请稍后再试');
  } else {
    Modal.alert('登录失败，请重试');
  }
}
```

## 示例代码

### 基础客服窗口集成
```javascript
// 初始化客服系统
const customerService = new CustomerService({
  container: '#customer-service',
  shopId: 'your-shop-id',
  apiKey: 'your-api-key'
});

// 监听消息事件
customerService.on('message:received', (message) => {
  console.log('收到新消息:', message);
});

// 发送消息
customerService.sendMessage('你好，我需要帮助');
```

### 管理后台集成
```javascript
// 初始化管理后台
const adminPanel = new AdminPanel({
  container: '#admin-panel'
});

// 登录
await adminPanel.login('admin', 'password');

// 获取对话列表
const conversations = await adminPanel.getConversations();

// 回复消息
await adminPanel.replyMessage(conversationId, '感谢您的咨询');
```

### 店铺管理
```javascript
// 创建店铺
const shop = await ShopManager.createShop({
  name: '我的店铺',
  domain: 'myshop.com',
  email: 'contact@myshop.com'
});

// 获取集成代码
const integrationCode = await ShopManager.getIntegrationCode(shop.id);

// 更新店铺设置
await ShopManager.updateShop(shop.id, {
  theme: 'dark',
  position: 'bottom-right'
});
```

## 更多信息

- [用户指南](./USER_GUIDE.md)
- [部署指南](./DEPLOYMENT_GUIDE.md)
- [开发指南](./DEVELOPMENT_GUIDE.md)
- [常见问题](./FAQ.md)