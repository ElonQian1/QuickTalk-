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

  constructor(private soundUrl: string) {}

  /**
   * 预加载音频文件
   */
  async preload(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve, reject) => {
      try {
        this.audio = new Audio(this.soundUrl);
        this.audio.preload = 'auto';
        
        this.audio.addEventListener('canplaythrough', () => {
          this.isLoaded = true;
          resolve();
        }, { once: true });

        this.audio.addEventListener('error', (e) => {
          console.error('❌ 音频加载失败:', e);
          reject(new Error('音频加载失败'));
        }, { once: true });

        // 强制开始加载
        this.audio.load();
      } catch (error) {
        console.error('❌ 音频初始化失败:', error);
        reject(error);
      }
    });

    return this.loadPromise;
  }

  /**
   * 播放提示音
   */
  async play(volume: number = 0.5): Promise<void> {
    try {
      if (!this.isLoaded) {
        await this.preload();
      }

      if (!this.audio) {
        throw new Error('音频对象未初始化');
      }

      // 设置音量
      this.audio.volume = Math.max(0, Math.min(1, volume));

      // 重置播放位置
      this.audio.currentTime = 0;

      // 播放音频
      await this.audio.play();
    } catch (error) {
      // 处理自动播放策略限制
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.warn('⚠️ 浏览器阻止自动播放，需要用户交互后才能播放声音');
      } else {
        console.error('❌ 播放提示音失败:', error);
      }
      throw error;
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
  /**
   * 检查通知API是否可用
   */
  isSupported(): boolean {
    return 'Notification' in window;
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
    // Notification API 没有直接的方法关闭指定tag的通知
    // 这里只是提供接口，实际需要保存notification实例来关闭
    console.warn('⚠️ 关闭通知需要保存notification实例');
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
      // 预加载提示音
      await this.audioManager.preload();
      console.log('✅ 通知服务初始化完成');
      this.initialized = true;
    } catch (error) {
      console.error('❌ 通知服务初始化失败:', error);
      // 不抛出错误，允许其他功能继续工作
    }
  }

  /**
   * 播放提示音
   */
  async playSound(volume: number = 0.5): Promise<void> {
    try {
      await this.audioManager.play(volume);
    } catch (error) {
      // 静默处理，不影响其他功能
      console.debug('提示音播放被阻止或失败');
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
    } = options;

    // 播放声音
    if (playSound) {
      this.playSound(0.5).catch(() => {
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
}

// 导出单例
export const notificationService = new NotificationService();

// 导出类型供外部使用
export { AudioNotificationManager, VibrationManager, BrowserNotificationManager };
