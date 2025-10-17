/**
 * 通知服务模块
 * 封装声音、震动、浏览器通知功能
 * 
 * Purpose: 统一管理所有通知相关功能
 * Input: 通知配置和消息数据
 * Output: 触发对应的通知效果
 * Errors: 权限被拒、音频加载失败、API不支持等
 */

import {
  NotificationOptions,
  NotificationPermissionState,
  MessageNotificationOptions,
} from '../types/notifications';

/**
 * 音频管理类
 * 负责加载和播放提示音
 */
class AudioNotificationManager {
  private audio: HTMLAudioElement | null = null;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;
  private isActivated = false; // 是否已通过用户交互激活

  constructor(private soundUrl: string) {
    // 监听用户首次交互，激活音频上下文
    this.setupUserActivation();
  }

  /**
   * 设置用户激活监听
   */
  private setupUserActivation(): void {
    const activate = () => {
      if (this.isActivated) return;
      this.isActivated = true;
      console.log('🎵 音频上下文已激活');
      // 移除监听器
      document.removeEventListener('click', activate);
      document.removeEventListener('keydown', activate);
      document.removeEventListener('touchstart', activate);
    };

    document.addEventListener('click', activate, { passive: true });
    document.addEventListener('keydown', activate, { passive: true });
    document.addEventListener('touchstart', activate, { passive: true });
  }

  /**
   * 预加载音频文件
   */
  async preload(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve) => {
      try {
        this.audio = new Audio(this.soundUrl);
        this.audio.preload = 'auto';
        
        this.audio.addEventListener('canplaythrough', () => {
          this.isLoaded = true;
          console.log('✅ 提示音加载成功');
          resolve();
        }, { once: true });

        this.audio.addEventListener('error', () => {
          console.info('ℹ️ 提示音文件未找到，声音功能将被禁用。请参阅 /public/sounds/SOUND_GUIDE.md');
          this.audio = null;
          this.isLoaded = false;
          // 优雅降级：不抛出错误，允许其他通知功能继续工作
          resolve();
        }, { once: true });

        // 强制开始加载
        this.audio.load();
      } catch (error) {
        console.info('ℹ️ 音频初始化失败，声音功能将被禁用');
        this.audio = null;
        this.isLoaded = false;
        // 优雅降级：不抛出错误
        resolve();
      }
    });

    return this.loadPromise;
  }

  /**
   * 播放提示音
   */
  async play(volume: number = 0.5): Promise<void> {
    try {
      // 检查是否已激活
      if (!this.isActivated) {
        console.info('ℹ️ 音频未激活，需要用户交互后才能播放声音');
        return;
      }

      if (!this.isLoaded) {
        await this.preload();
      }

      if (!this.audio) {
        // 音频对象未初始化（文件加载失败），静默跳过
        console.debug('音频对象未初始化');
        return;
      }

      // 设置音量
      this.audio.volume = Math.max(0, Math.min(1, volume));

      // 重置播放位置
      this.audio.currentTime = 0;

      // 播放音频
      const playPromise = this.audio.play();
      if (playPromise) {
        await playPromise;
        console.log('🔊 提示音播放成功');
      }
    } catch (error) {
      // 处理自动播放策略限制
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.info('ℹ️ 浏览器阻止自动播放，需要用户交互后才能播放声音');
      } else {
        console.debug('播放提示音失败:', error);
      }
      // 不再抛出错误，静默处理
    }
  }

  /**
   * 停止播放
   */
  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  /**
   * 销毁音频对象
   */
  destroy(): void {
    this.stop();
    if (this.audio) {
      this.audio.src = '';
      this.audio = null;
    }
    this.isLoaded = false;
    this.loadPromise = null;
  }
}

/**
 * 震动管理类
 * 封装 Vibration API
 */
class VibrationManager {
  /**
   * 检查震动API是否可用
   */
  isSupported(): boolean {
    return 'vibrate' in navigator;
  }

  /**
   * 触发震动
   * @param pattern 震动模式 [震动时长, 暂停时长, ...]
   */
  vibrate(pattern: number | number[]): boolean {
    if (!this.isSupported()) {
      console.warn('⚠️ 当前设备不支持震动API');
      return false;
    }

    try {
      return navigator.vibrate(pattern);
    } catch (error) {
      console.error('❌ 震动触发失败:', error);
      return false;
    }
  }

  /**
   * 取消所有震动
   */
  cancel(): boolean {
    if (!this.isSupported()) {
      return false;
    }

    try {
      return navigator.vibrate(0);
    } catch (error) {
      console.error('❌ 取消震动失败:', error);
      return false;
    }
  }
}

/**
 * 浏览器通知管理类
 * 封装 Notification API
 */
class BrowserNotificationManager {
  private registry: Map<string, Set<Notification>> = new Map();

  /**
   * 检查通知API是否可用
   */
  isSupported(): boolean {
    const hasAPI = 'Notification' in window;
    // 仅在 https 或 localhost 下允许浏览器通知
    const isSecure = window?.location?.protocol === 'https:' || window?.location?.hostname === 'localhost';
    return hasAPI && isSecure;
  }

  /**
   * 获取当前权限状态
   */
  getPermission(): NotificationPermissionState {
    if (!this.isSupported()) {
      return 'denied';
    }
    return Notification.permission as NotificationPermissionState;
  }

  /**
   * 请求通知权限
   */
  async requestPermission(): Promise<NotificationPermissionState> {
    if (!this.isSupported()) {
      console.warn('⚠️ 当前浏览器不支持通知API');
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      return permission as NotificationPermissionState;
    } catch (error) {
      console.error('❌ 请求通知权限失败:', error);
      return 'denied';
    }
  }

  /**
   * 显示浏览器通知
   */
  async show(options: NotificationOptions): Promise<Notification | null> {
    if (!this.isSupported()) {
      console.warn('⚠️ 当前浏览器不支持通知API');
      return null;
    }

    const permission = this.getPermission();
    if (permission !== 'granted') {
      console.warn('⚠️ 通知权限未授予，当前状态:', permission);
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/logo192.svg',
        tag: options.tag,
        requireInteraction: options.requireInteraction,
        silent: options.silent,
        data: options.data,
      });
      // 维护实例注册表（用于后续按 tag 关闭）
      if (options.tag) {
        const set = this.registry.get(options.tag) || new Set<Notification>();
        set.add(notification);
        this.registry.set(options.tag, set);
        notification.onclose = () => {
          const s = this.registry.get(options.tag!);
          if (s) {
            s.delete(notification);
            if (s.size === 0) this.registry.delete(options.tag!);
          }
        };
      }

      // 点击回调
      if (options.onClick) {
        notification.onclick = (ev) => {
          try {
            window?.focus?.();
          } catch {}
          options.onClick!({ notification, data: options.data });
          try { notification.close(); } catch {}
        };
      }

      return notification;
    } catch (error) {
      console.error('❌ 显示通知失败:', error);
      return null;
    }
  }

  /**
   * 关闭所有通知（通过tag）
   */
  async closeByTag(tag: string): Promise<void> {
    const set = this.registry.get(tag);
    if (!set) return;
    set.forEach((n) => { try { n.close(); } catch {} });
    this.registry.delete(tag);
  }
}

/**
 * 通知服务主类
 * 统一管理所有通知功能
 */
class NotificationService {
  private audioManager: AudioNotificationManager;
  private vibrationManager: VibrationManager;
  private browserNotificationManager: BrowserNotificationManager;
  private initialized = false;
  private lastNotifyAt = 0;
  private minNotifyIntervalMs = 2000; // 节流：两秒内只提醒一次

  constructor() {
    // 初始化提示音管理器（使用 public 目录下的音频文件）
    this.audioManager = new AudioNotificationManager('/sounds/notification.mp3');
    this.vibrationManager = new VibrationManager();
    this.browserNotificationManager = new BrowserNotificationManager();
  }

  /**
   * 初始化服务（预加载资源）
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // 预加载提示音（失败时不影响其他功能）
      await this.audioManager.preload();
      this.initialized = true;
      console.log('✅ 通知服务初始化完成');
    } catch (error) {
      // 即使音频加载失败，仍标记为已初始化，允许震动和浏览器通知继续工作
      this.initialized = true;
      console.info('ℹ️ 通知服务部分初始化（音频不可用）');
    }
  }

  /**
   * 播放提示音
   */
  async playSound(volume: number = 1.0): Promise<void> {
    try {
      await this.audioManager.play(volume);
    } catch (error) {
      // 静默处理，不影响其他功能
      console.debug('提示音播放被阻止或失败');
    }
  }

  /**
   * 测试音频播放功能（用于调试）
   */
  async testSound(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔊 开始测试音频播放...');
      console.log('音频文件路径:', '/sounds/notification.mp3');
      
      // 检查音频文件是否存在
      const response = await fetch('/sounds/notification.mp3', { method: 'HEAD' });
      if (!response.ok) {
        return { success: false, error: `音频文件不存在 (${response.status})` };
      }
      console.log('✅ 音频文件存在');

      // 尝试播放
      await this.audioManager.play(1.0);
      console.log('✅ 音频播放成功');
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ 音频播放失败:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 触发震动
   */
  vibrate(pattern: number | number[] = [200]): boolean {
    return this.vibrationManager.vibrate(pattern);
  }

  /**
   * 取消震动
   */
  cancelVibration(): boolean {
    return this.vibrationManager.cancel();
  }

  /**
   * 检查通知权限
   */
  getNotificationPermission(): NotificationPermissionState {
    return this.browserNotificationManager.getPermission();
  }

  /**
   * 请求通知权限
   */
  async requestNotificationPermission(): Promise<NotificationPermissionState> {
    return this.browserNotificationManager.requestPermission();
  }

  /**
   * 显示浏览器通知
   */
  async showNotification(options: NotificationOptions): Promise<Notification | null> {
    return this.browserNotificationManager.show(options);
  }

  /**
   * 触发消息通知（综合接口）
   * 根据配置自动触发声音、震动、浏览器通知
   */
  async notifyNewMessage(options: MessageNotificationOptions): Promise<void> {
    const {
      playSound = false,
      vibrate = false,
      showNotification = false,
      senderName = '新消息',
      messageContent = '',
      shopId,
      sessionId,
      onClick,
    } = options;

    // 节流控制：两秒内合并提醒
    const now = Date.now();
    if (now - this.lastNotifyAt < this.minNotifyIntervalMs) {
      // 仍允许更新浏览器通知内容（可选：合并未读数），此处简化为跳过声音/震动
      if (showNotification) {
        await this.showNotification({
          title: senderName,
          body: messageContent,
          icon: '/logo192.svg',
          tag: sessionId ? `session-${sessionId}` : `shop-${shopId}`,
          requireInteraction: false,
          data: { shopId, sessionId },
          onClick: onClick ? () => onClick({ shopId, sessionId }) : undefined,
        });
      }
      return;
    }
    this.lastNotifyAt = now;

    // 播放声音
    if (playSound) {
      this.playSound(1.0).catch(() => { // 最大音量
        // 静默失败
      });
    }

    // 触发震动
    if (vibrate) {
      this.vibrate([200]);
    }

    // 显示浏览器通知
    if (showNotification) {
      await this.showNotification({
        title: senderName,
        body: messageContent,
        icon: '/logo192.svg',
        tag: sessionId ? `session-${sessionId}` : `shop-${shopId}`,
        requireInteraction: false,
        data: { shopId, sessionId },
        onClick: onClick ? ({}) => onClick({ shopId, sessionId }) : undefined,
      });
    }
  }

  /**
   * 检查各项功能支持情况
   */
  getCapabilities() {
    return {
      sound: true, // 音频播放基本都支持
      vibration: this.vibrationManager.isSupported(),
      notification: this.browserNotificationManager.isSupported(),
      notificationPermission: this.getNotificationPermission(),
    };
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.audioManager.destroy();
    this.vibrationManager.cancel();
    this.initialized = false;
  }

  /**
   * 根据 tag 关闭系统通知（例如进入某会话后清理该会话残留通知）
   */
  async closeByTag(tag: string): Promise<void> {
    try {
      await this.browserNotificationManager.closeByTag(tag);
    } catch (e) {
      console.debug('关闭通知失败(可忽略):', e);
    }
  }
}

// 导出单例
export const notificationService = new NotificationService();

// 导出类型供外部使用
export { AudioNotificationManager, VibrationManager, BrowserNotificationManager };
