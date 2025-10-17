# 新消息通知功能使用文档

## 📋 功能概述

本系统已实现完整的新消息通知功能，支持：
- ✅ **提示音播放** - 新消息时播放声音提示
- ✅ **设备震动** - 手机端支持震动提醒
- ✅ **浏览器通知** - 桌面/移动端推送通知
- ✅ **设置持久化** - 用户设置自动保存
- ✅ **模块化架构** - 清晰的代码组织结构

---

## 🏗️ 架构说明

### 模块结构

```
frontend/src/
├── types/
│   └── notifications.ts              # 通知相关类型定义
├── services/
│   └── notificationService.ts        # 通知服务（声音、震动、浏览器通知）
├── stores/
│   ├── settingsStore.ts              # 设置持久化 Store (Zustand + persist)
│   └── wsStore.ts                    # WebSocket Store（已集成通知）
└── components/
    └── NotificationPermission/       # 通知权限请求组件
        ├── NotificationPermissionBanner.tsx
        └── index.ts
```

### 数据流

```
WebSocket 接收消息
    ↓
wsStore 处理消息
    ↓
检查发送者类型（仅客户消息触发通知）
    ↓
从 settingsStore 获取用户设置
    ↓
调用 notificationService
    ↓
并行触发：声音 + 震动 + 浏览器通知
```

---

## 🚀 功能使用

### 1. 用户设置界面

在**个人资料页面 → 设置**中，用户可以控制：

- **推送通知** - 总开关，关闭后所有通知停止
- **消息提示音** - 控制是否播放声音（点击时会测试播放）
- **振动提醒** - 控制是否震动（点击时会测试震动）
- **自动回复** - 离线自动回复功能
- **深色模式** - 界面主题切换

所有设置会自动保存到 localStorage，刷新页面后保持。

### 2. 通知权限请求

当用户首次启用通知功能时，系统会：
1. 显示权限请求 Banner（紫色渐变，顶部居中）
2. 用户点击"允许通知"后请求浏览器权限
3. 如果用户点击"稍后再说"，24小时后再次提醒

### 3. 自动通知触发

当收到客户消息时，系统自动：
- ✅ 检查用户设置
- ✅ 播放提示音（如果启用）
- ✅ 触发震动（如果启用且设备支持）
- ✅ 显示浏览器通知（如果权限已授予）

---

## 🔧 开发者集成

### 在其他页面显示权限请求 Banner

```tsx
import { NotificationPermissionBanner } from '../components/NotificationPermission';

function YourPage() {
  return (
    <div>
      {/* 页面内容 */}
      
      {/* 添加通知权限 Banner */}
      <NotificationPermissionBanner 
        autoShow={true}           // 自动显示
        remindAfter={86400000}    // 24小时后再次提醒
      />
    </div>
  );
}
```

### 手动触发通知

```tsx
import { notificationService } from '../services/notificationService';
import { shouldNotify } from '../stores/settingsStore';

// 在需要触发通知的地方
const settings = shouldNotify();
await notificationService.notifyNewMessage({
  playSound: settings.shouldPlaySound,
  vibrate: settings.shouldVibrate,
  showNotification: settings.shouldShowNotification,
  senderName: '客户名称',
  messageContent: '消息内容',
  shopId: 123,
  sessionId: 456,
});
```

### 访问用户设置

```tsx
import { useSettingsStore } from '../stores/settingsStore';

function YourComponent() {
  // 获取设置值
  const soundEnabled = useSettingsStore(state => state.soundEnabled);
  const vibrationEnabled = useSettingsStore(state => state.vibrationEnabled);
  
  // 获取操作方法
  const toggleSound = useSettingsStore(state => state.toggleSound);
  
  return (
    <button onClick={toggleSound}>
      声音: {soundEnabled ? '开' : '关'}
    </button>
  );
}
```

### 检查功能支持

```tsx
import { notificationService } from '../services/notificationService';

const capabilities = notificationService.getCapabilities();

console.log('支持声音:', capabilities.sound);
console.log('支持震动:', capabilities.vibration);
console.log('支持通知:', capabilities.notification);
console.log('通知权限:', capabilities.notificationPermission);
```

---

## 📱 平台兼容性

### 桌面浏览器
- ✅ Chrome/Edge - 完整支持
- ✅ Firefox - 完整支持
- ✅ Safari - 支持（需要用户交互后才能播放声音）

### 移动端
- ✅ Chrome (Android) - 完整支持（包括震动）
- ✅ Safari (iOS) - 支持声音和通知（iOS 不支持 Vibration API）
- ⚠️ iOS Safari 需要添加到主屏幕才能接收推送通知

### 功能矩阵

| 功能 | Desktop | Android | iOS |
|------|---------|---------|-----|
| 提示音 | ✅ | ✅ | ✅* |
| 震动 | ❌ | ✅ | ❌ |
| 浏览器通知 | ✅ | ✅ | ✅** |

*需要用户交互后才能播放
**需要添加到主屏幕

---

## 🎵 添加提示音文件

### 当前状态
系统已配置使用 `/sounds/notification.mp3`，但文件需要手动添加。

### 添加步骤

1. **获取音频文件**
   - 从免费音效网站下载（见 `frontend/public/sounds/SOUND_GUIDE.md`）
   - 使用系统自带提示音
   - 自己录制

2. **文件要求**
   - 格式: MP3 或 WAV
   - 时长: 0.5-2秒
   - 音量: 适中
   - 大小: < 50KB

3. **放置位置**
   ```
   frontend/public/sounds/notification.mp3
   ```

4. **测试**
   - 进入设置页面
   - 点击"消息提示音"开关
   - 应该听到提示音播放

### 临时方案
如果没有音频文件，系统会：
- 尝试加载，失败时静默处理
- 不影响震动和浏览器通知功能
- 在控制台显示友好提示

---

## 🐛 故障排查

### 提示音不播放

**原因**: 浏览器自动播放策略限制

**解决方案**:
1. 确保音频文件存在：`frontend/public/sounds/notification.mp3`
2. 用户需要先与页面交互（点击按钮等）
3. 检查浏览器控制台是否有错误提示
4. 检查音量设置和静音状态

### 震动不工作

**原因**: 设备不支持或浏览器限制

**检查**:
```javascript
console.log('支持震动:', 'vibrate' in navigator);
```

**支持情况**:
- ✅ Android Chrome - 支持
- ❌ iOS Safari - 不支持
- ❌ 桌面浏览器 - 不支持

### 浏览器通知不显示

**可能原因**:
1. 权限被拒绝
2. 系统通知设置关闭
3. 浏览器不支持

**解决步骤**:
1. 检查权限：设置 → 推送通知（会显示 Banner）
2. 检查浏览器设置：设置 → 隐私和安全 → 网站设置 → 通知
3. 检查系统设置：系统通知中心设置

### 设置不保存

**检查**:
1. localStorage 是否可用
2. 浏览器是否在隐私模式
3. 浏览器设置是否阻止 cookie/storage

**验证**:
```javascript
localStorage.getItem('customer-service-settings');
// 应该返回 JSON 字符串
```

---

## 🔐 隐私和权限

### 权限说明

- **通知权限**: 用于显示桌面通知，需要用户主动授权
- **音频播放**: 需要用户交互（点击、触摸等）后才能播放
- **震动**: 某些浏览器需要 HTTPS 环境

### 数据存储

- 所有设置仅保存在用户浏览器本地（localStorage）
- 不会上传到服务器
- 清除浏览器数据会重置设置

---

## 📚 API 参考

### notificationService

```typescript
// 初始化（预加载音频）
await notificationService.init();

// 播放提示音
await notificationService.playSound(volume); // volume: 0-1

// 触发震动
notificationService.vibrate([200]); // 震动 200ms

// 请求通知权限
const permission = await notificationService.requestNotificationPermission();

// 显示通知
await notificationService.showNotification({
  title: '标题',
  body: '内容',
  icon: '/logo.svg',
});

// 综合通知
await notificationService.notifyNewMessage({
  playSound: true,
  vibrate: true,
  showNotification: true,
  senderName: '客户',
  messageContent: '你好',
});
```

### settingsStore

```typescript
// 获取设置
const settings = useSettingsStore.getState();

// 切换设置
useSettingsStore.getState().toggleSound();
useSettingsStore.getState().toggleVibration();
useSettingsStore.getState().toggleNotifications();

// 批量更新
useSettingsStore.getState().updateNotificationSettings({
  soundEnabled: true,
  vibrationEnabled: true,
  soundVolume: 0.8,
});

// 重置为默认值
useSettingsStore.getState().resetToDefaults();
```

---

## 🎨 自定义

### 修改震动模式

在 `types/notifications.ts` 中定义了预设模式：

```typescript
export const VibrationPatterns = {
  short: [200],
  medium: [400],
  long: [600],
  double: [200, 100, 200],
  triple: [200, 100, 200, 100, 200],
  pattern: [100, 50, 100, 50, 100, 50, 400],
};
```

使用：
```typescript
notificationService.vibrate(VibrationPatterns.double);
```

### 修改提示音音量

在 settingsStore 中：
```typescript
useSettingsStore.getState().setSoundVolume(0.8); // 0-1
```

### 修改通知样式

编辑 `NotificationPermissionBanner.tsx` 中的 styled components。

---

## 📝 更新日志

### 2025-10-17 - 初始版本
- ✅ 创建通知服务模块
- ✅ 创建设置持久化 Store
- ✅ 集成到 WebSocket 消息流
- ✅ 升级设置页面
- ✅ 创建权限请求组件
- ✅ 完整的类型定义

---

## 📞 技术支持

如有问题或建议，请查看：
- 项目 README.md
- .github/copilot-instructions.md
- 或在代码中搜索 `@TODO` 标记

