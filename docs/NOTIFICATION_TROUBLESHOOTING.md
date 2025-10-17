# 🔧 音频播放和实时通知问题修复指南

## 问题诊断

### 1. 音频加载失败
**原因**: 浏览器缓存了旧版本的 JavaScript 代码
**日志**: `notificationService.ts:46 ❌ 音频加载失败`

### 2. 红点提示不实时
**原因**: 可能是 WebSocket 消息类型判断或未读计数更新逻辑问题

---

## 🚀 快速修复步骤

### 步骤 1: 强制清除浏览器缓存

#### 方法 A: 硬性重新加载（推荐）
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

#### 方法 B: 开发者工具清除
1. 打开开发者工具 (F12)
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"

#### 方法 C: 手动清除应用数据
1. 打开开发者工具 (F12)
2. 进入 "Application" 标签
3. 左侧选择 "Storage" → "Clear site data"
4. 点击 "Clear site data" 按钮
5. 刷新页面 (F5)

### 步骤 2: 清除 localStorage 旧设置

在浏览器控制台执行:
```javascript
// 清除旧的通知设置
localStorage.removeItem('customer-service-settings')

// 刷新页面
location.reload()
```

### 步骤 3: 验证音频文件可访问

在浏览器地址栏直接访问:
```
http://localhost:3000/sounds/notification.mp3
```

应该能听到铃声或下载文件。

### 步骤 4: 验证声音功能

在浏览器控制台执行:
```javascript
// 测试音频播放
new Audio('/sounds/notification.mp3').play()
  .then(() => console.log('✅ 音频播放成功'))
  .catch(e => console.error('❌ 播放失败:', e))
```

---

## 🔍 检查 WebSocket 消息接收

### 在浏览器控制台查看日志

你应该看到这些日志（如果有新消息):
```
🔄 wsStore接收到消息(规范化): {type: 'new_message', ...}
📋 当前监听器数量: X
📤 分发消息给监听器 0: {...}
📊 更新未读计数: {shopId: X, senderType: 'customer', sessionId: X}
```

### 检查未读计数更新

在控制台执行:
```javascript
// 检查通知 store 状态
import('./stores/notificationsStore').then(m => {
  const state = m.useNotificationsStore.getState()
  console.log('未读计数:', {
    byShop: state.byShop,
    bySession: state.bySession,
    total: state.totalUnread
  })
})
```

---

## 🎯 预期行为

### 当客户发送消息时
1. ✅ 后端广播 `new_message` 事件给所有客服
2. ✅ 前端接收消息并更新未读计数
3. ✅ 如果不在当前会话页，播放声音/震动/桌面通知
4. ✅ 红点显示未读数量

### 音频播放条件
- ✅ 音频文件存在: `/sounds/notification.mp3`
- ✅ 用户已交互过页面（点击/按键）
- ✅ 设置中已开启声音
- ✅ 不在当前会话页面

---

## 🐛 仍然有问题？

### 收集诊断信息

在浏览器控制台执行以下命令并复制结果:

```javascript
// 1. 检查通知服务状态
import('./services/notificationService').then(m => {
  const service = m.notificationService
  console.log('=== 通知服务状态 ===')
  console.log('能力检查:', service.getCapabilities())
  
  // 测试声音
  service.testSound().then(result => {
    console.log('声音测试结果:', result)
  })
})

// 2. 检查设置
import('./stores/settingsStore').then(m => {
  const state = m.useSettingsStore.getState()
  console.log('=== 通知设置 ===')
  console.log({
    notifications: state.notifications,
    soundEnabled: state.soundEnabled,
    vibrationEnabled: state.vibrationEnabled,
    soundVolume: state.soundVolume,
    messagePreview: state.messagePreview
  })
})

// 3. 检查 WebSocket 连接状态
import('./stores/wsStore').then(m => {
  const state = m.useWSStore.getState()
  console.log('=== WebSocket 状态 ===')
  console.log({
    status: state.status,
    activeShopId: state.activeShopId,
    监听器数量: state.messageListeners.length
  })
})

// 4. 检查当前 UI 状态
import('./stores/uiStore').then(m => {
  const state = m.useUIStore.getState()
  console.log('=== UI 状态 ===')
  console.log({
    activeSessionId: state.activeSessionId
  })
})
```

---

## 📝 常见问题

### Q: 为什么听不到声音？
**A**: 
1. 检查浏览器是否静音
2. 检查系统音量
3. 确认已有用户交互（点击过页面）
4. 清除浏览器缓存
5. 确认音频文件存在

### Q: 为什么红点不实时？
**A**:
1. 检查 WebSocket 是否连接成功（查看控制台日志）
2. 确认后端有广播消息（查看后端日志）
3. 检查消息类型是否为 `new_message` 且 `senderType` 为 `customer`

### Q: 为什么在聊天页面还会响铃？
**A**: 这是设计的，应该不会响。如果会响，说明"不打扰"逻辑没生效，需要检查 `activeSessionId` 是否正确设置。

---

## ✅ 成功标志

完成修复后，你应该看到:
- ✅ 控制台无 "❌ 音频加载失败" 错误
- ✅ 收到新消息时听到铃声（如果不在该会话页）
- ✅ 红点实时更新
- ✅ 点击通知跳转到对应会话
