/**
 * 通知系统类型定义
 * 用于声音、震动、浏览器通知等功能
 */

/**
 * 通知设置配置
 */
export interface NotificationSettings {
  /** 是否启用推送通知 */
  notifications: boolean;
  /** 是否启用消息提示音 */
  soundEnabled: boolean;
  /** 是否启用振动提醒 */
  vibrationEnabled: boolean;
  /** 提示音音量 (0-1) */
  soundVolume: number;
  /** 振动模式 */
  vibrationPattern: number[];
}

/**
 * 通知权限状态
 */
export type NotificationPermissionState = 'default' | 'granted' | 'denied';

/**
 * 通知配置选项
 */
export interface NotificationOptions {
  /** 通知标题 */
  title: string;
  /** 通知内容 */
  body?: string;
  /** 通知图标 */
  icon?: string;
  /** 通知标签（用于替换相同标签的通知） */
  tag?: string;
  /** 是否需要持续交互 */
  requireInteraction?: boolean;
  /** 静默通知（不播放声音） */
  silent?: boolean;
  /** 附加数据 */
  data?: any;
}

/**
 * 消息通知触发选项
 */
export interface MessageNotificationOptions {
  /** 是否播放声音 */
  playSound?: boolean;
  /** 是否震动 */
  vibrate?: boolean;
  /** 是否显示浏览器通知 */
  showNotification?: boolean;
  /** 消息发送者名称 */
  senderName?: string;
  /** 消息内容 */
  messageContent?: string;
  /** 店铺ID */
  shopId?: number;
  /** 会话ID */
  sessionId?: number;
}

/**
 * 振动模式预设
 */
export const VibrationPatterns = {
  /** 短震动 (200ms) */
  short: [200],
  /** 中等震动 (400ms) */
  medium: [400],
  /** 长震动 (600ms) */
  long: [600],
  /** 双震动 (200ms, 暂停100ms, 200ms) */
  double: [200, 100, 200],
  /** 三震动 */
  triple: [200, 100, 200, 100, 200],
  /** 节奏震动 */
  pattern: [100, 50, 100, 50, 100, 50, 400],
} as const;

/**
 * 默认通知设置
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  notifications: true,
  soundEnabled: true,
  vibrationEnabled: true,
  soundVolume: 0.5,
  vibrationPattern: [200],
};
