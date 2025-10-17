# 🔔 新消息通知功能 - 快速开始

## 🎯 5分钟上手指南

### 对于用户

1. **打开设置页面**
   - 点击右上角头像
   - 选择"设置"

2. **开启通知功能**
   - 开启"推送通知"开关
   - 开启"消息提示音"开关（可选）
   - 开启"振动提醒"开关（可选，仅手机支持）

3. **授予浏览器权限**
   - 点击"消息提示音"时会测试播放
   - 首次开启"推送通知"时，会弹出浏览器权限请求
   - 点击"允许"即可

4. **完成！**
   - 当有新消息时，系统会自动提醒
   - 设置会自动保存，下次打开依然有效

---

### 对于开发者

#### 1. 添加提示音文件（可选）

如果不添加，系统会静默处理，不影响其他功能。

```bash
# 下载或复制一个提示音文件到：
frontend/public/sounds/notification.mp3

# 文件要求：
# - 格式：MP3 或 WAV
# - 时长：0.5-2秒
# - 大小：< 50KB
```

推荐获取方式：
- [Freesound](https://freesound.org/) - 搜索 "notification"
- Windows: `C:\Windows\Media\` 复制系统提示音
- macOS: `/System/Library/Sounds/` 复制系统提示音

#### 2. 在页面中显示权限请求 Banner（可选）

如果需要在特定页面引导用户授权：

```tsx
import { NotificationPermissionBanner } from '@/components/NotificationPermission';

function YourPage() {
  return (
    <div>
      {/* 你的页面内容 */}
      
      {/* 添加权限请求 Banner */}
      <NotificationPermissionBanner />
    </div>
  );
}
```

#### 3. 手动触发通知（可选）

如果需要在自定义场景触发通知：

```tsx
import { notificationService } from '@/services/notificationService';
import { shouldNotify } from '@/stores/settingsStore';

// 获取用户设置
const settings = shouldNotify();

// 触发通知
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

---

## ✅ 功能验证

### 检查清单

- [ ] 前端编译无错误：`npx tsc --noEmit`
- [ ] 设置页面能正常打开
- [ ] 开关能正常切换
- [ ] 点击声音开关时有测试播放
- [ ] 点击震动开关时有测试震动（仅手机）
- [ ] 设置刷新后依然保存
- [ ] WebSocket 连接正常
- [ ] 收到客户消息时触发通知

### 测试步骤

1. **测试设置持久化**
   ```
   1. 打开设置页面
   2. 开启"消息提示音"
   3. 刷新页面
   4. 再次打开设置
   5. ✅ 开关应该依然是开启状态
   ```

2. **测试声音播放**
   ```
   1. 打开设置页面
   2. 点击"消息提示音"开关
   3. ✅ 应该听到提示音（如果有音频文件）
   4. ✅ 或显示 Toast 提示（如果没有音频文件）
   ```

3. **测试震动**
   ```
   1. 在手机上打开设置页面
   2. 点击"振动提醒"开关
   3. ✅ 手机应该震动一次
   ```

4. **测试浏览器通知**
   ```
   1. 开启"推送通知"
   2. 如果未授权，会显示紫色 Banner
   3. 点击"允许通知"
   4. 浏览器弹出权限请求
   5. 点击"允许"
   6. ✅ Banner 消失，权限已授予
   ```

5. **测试消息通知**
   ```
   1. 确保所有开关都已开启
   2. 使用另一个设备/浏览器作为客户发送消息
   3. ✅ 应该听到提示音
   4. ✅ 手机应该震动
   5. ✅ 显示桌面通知
   ```

---

## 🐛 常见问题

### 提示音不播放？

**原因**: 浏览器自动播放限制

**解决**:
1. 确保 `frontend/public/sounds/notification.mp3` 文件存在
2. 用户需要先与页面交互（点击任何按钮）
3. 在设置中点击"消息提示音"开关测试

### 震动不工作？

**原因**: 设备不支持

**检查**:
- iOS 不支持 Vibration API
- 桌面浏览器不支持震动
- 只有 Android 手机支持

### 通知不显示？

**原因**: 权限问题

**解决**:
1. 检查是否授予了浏览器通知权限
2. 检查系统通知设置是否开启
3. iOS 需要将网站添加到主屏幕（PWA）

### 设置不保存？

**原因**: localStorage 问题

**检查**:
1. 浏览器是否在隐私模式
2. 浏览器设置是否禁用 Storage
3. 打开控制台输入：`localStorage.getItem('customer-service-settings')`

---

## 📚 更多文档

- **完整文档**: `docs/NOTIFICATION_GUIDE.md`
- **实现总结**: `docs/NOTIFICATION_IMPLEMENTATION_SUMMARY.md`
- **音频指南**: `frontend/public/sounds/SOUND_GUIDE.md`
- **项目规范**: `.github/copilot-instructions.md`

---

## 💡 提示

### 推荐配置
- ✅ 推送通知：开启
- ✅ 消息提示音：开启
- ✅ 振动提醒：开启（手机）
- ✅ 音量：0.5（默认）

### 最佳实践
- 在工作时间开启所有通知
- 下班后可关闭声音，保留震动
- 休息时间关闭所有通知

### 性能优化
- 提示音已预加载，不影响性能
- 通知处理是异步的，不阻塞消息接收
- 所有错误都静默处理，不影响用户体验

---

## 🚀 立即开始

1. 确保项目已启动：`npm run dev`
2. 打开浏览器访问系统
3. 进入设置页面开启通知
4. 发送测试消息验证功能

**就这么简单！功能已完全集成，开箱即用。** ✨
