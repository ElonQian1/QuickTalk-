/**
 * SDK 内部通知服务（与前端同等能力的轻量复刻）
 * - 声音播放（可配 soundUrl）
 * - 设备震动（Vibration API）
 * - 浏览器通知（Notification API）
 * 无第三方依赖；不引入 React。
 */

export type NotificationPermissionState = 'default' | 'granted' | 'denied';

export interface SDKNotificationConfig {
  notificationsEnabled?: boolean; // 总开关
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
  soundUrl?: string; // 如不提供则不播放声音
  soundVolume?: number; // 0-1
  vibrationPattern?: number | number[]; // 默认 [200]
}

export interface MessageNotifyOptions {
  title?: string;
  body?: string;
  tag?: string;
  // 覆盖配置
  playSound?: boolean;
  vibrate?: boolean;
  showNotification?: boolean;
  onClick?: (tag?: string) => void;
}

class AudioNotificationManager {
  private audio: HTMLAudioElement | null = null;
  private loaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor(private url?: string) {}

  setUrl(url?: string) {
    this.url = url;
    this.loaded = false;
    this.audio = null;
    this.loadPromise = null;
  }

  async preload(): Promise<void> {
    if (!this.url) return; // 未配置音频则跳过
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve, reject) => {
      try {
        this.audio = new Audio(this.url);
        this.audio.preload = 'auto';
        this.audio.addEventListener('canplaythrough', () => {
          this.loaded = true;
          resolve();
        }, { once: true });
        this.audio.addEventListener('error', (e) => {
          console.debug('音频加载失败(可忽略):', e);
          // 不 reject，避免整体失败；只是标记无法播放
          this.audio = null;
          this.loaded = false;
          resolve();
        }, { once: true });
        this.audio.load();
      } catch (err) {
        console.debug('音频初始化失败(可忽略):', err);
        resolve();
      }
    });

    return this.loadPromise;
  }

  async play(volume = 0.5): Promise<void> {
    if (!this.url) return; // 未配置音频则直接返回
    try {
      if (!this.loaded) await this.preload();
      if (!this.audio) return;
      this.audio.volume = Math.max(0, Math.min(1, volume));
      this.audio.currentTime = 0;
      await this.audio.play();
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        console.debug('自动播放受限，等待用户交互后再尝试');
      } else {
        console.debug('播放提示音失败(可忽略):', err);
      }
    }
  }
}

class VibrationManager {
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }
  vibrate(pattern: number | number[]): boolean {
    if (!this.isSupported()) return false;
    try { return navigator.vibrate(pattern); } catch { return false; }
  }
}

class BrowserNotificationManager {
  isSupported(): boolean {
    const hasAPI = typeof Notification !== 'undefined';
    const isSecure = typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
    return hasAPI && isSecure;
  }
  getPermission(): NotificationPermissionState {
    if (!this.isSupported()) return 'denied';
    return Notification.permission as NotificationPermissionState;
  }
  async requestPermission(): Promise<NotificationPermissionState> {
    if (!this.isSupported()) return 'denied';
    try { return await Notification.requestPermission() as NotificationPermissionState; }
    catch { return 'denied'; }
  }
  async show(title: string, body?: string, tag?: string, onClick?: (tag?: string) => void): Promise<Notification | null> {
    if (!this.isSupported()) return null;
    if (this.getPermission() !== 'granted') return null;
    try {
      const n = new Notification(title, { body, tag });
      if (onClick) {
        n.onclick = () => { try { window.focus(); } catch {}; onClick(tag); try { n.close(); } catch {}; };
      }
      return n;
    } catch {
      return null;
    }
  }
}

export class SDKNotificationService {
  private audio = new AudioNotificationManager();
  private vibration = new VibrationManager();
  private browser = new BrowserNotificationManager();
  private lastNotifyAt = 0;
  private minNotifyIntervalMs = 2000;
  private cfg: Required<SDKNotificationConfig> = {
    notificationsEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    soundUrl: '',
    soundVolume: 0.5,
    vibrationPattern: [200],
  };

  configure(config?: SDKNotificationConfig) {
    if (!config) return;
    this.cfg = {
      ...this.cfg,
      ...config,
      soundVolume: Math.max(0, Math.min(1, config.soundVolume ?? this.cfg.soundVolume)),
    };
    this.audio.setUrl(this.cfg.soundUrl || undefined);
  }

  async init(): Promise<void> {
    // 预加载音频（若配置了 soundUrl）
    try { await this.audio.preload(); } catch {}
  }

  getCapabilities() {
    return {
      sound: !!this.cfg.soundUrl,
      vibration: this.vibration.isSupported(),
      notification: typeof Notification !== 'undefined',
      notificationPermission: this.browser.getPermission(),
    };
  }

  async requestNotificationPermission(): Promise<NotificationPermissionState> {
    return this.browser.requestPermission();
  }

  async notifyNewMessage(options?: MessageNotifyOptions): Promise<void> {
    if (!this.cfg.notificationsEnabled) return;
    const playSound = options?.playSound ?? this.cfg.soundEnabled;
    const vibrate = options?.vibrate ?? this.cfg.vibrationEnabled;
    const showNotification = options?.showNotification ?? true;

    const now = Date.now();
    const throttled = now - this.lastNotifyAt < this.minNotifyIntervalMs;
    if (!throttled) this.lastNotifyAt = now;

    if (playSound) {
      // 节流下仍允许播放一次轻提示（此处简单：节流时跳过声音，避免抖动）
      if (!throttled) {
        await this.audio.play(this.cfg.soundVolume);
      }
    }

    if (vibrate) {
      if (!throttled) {
        this.vibration.vibrate(this.cfg.vibrationPattern);
      }
    }

    if (showNotification) {
      const title = options?.title || '新消息';
      const body = options?.body || undefined;
      const tag = options?.tag || undefined;
      await this.browser.show(title, body, tag, options?.onClick);
    }
  }
}

export const createSDKNotificationService = (config?: SDKNotificationConfig) => {
  const svc = new SDKNotificationService();
  svc.configure(config);
  return svc;
};
