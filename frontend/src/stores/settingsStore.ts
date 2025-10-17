/**
 * 用户设置持久化 Store
 * 使用 Zustand + persist 中间件
 * 
 * Purpose: 管理用户个性化设置并持久化到 localStorage
 * Input: 设置更新操作
 * Output: 持久化的设置状态
 * Errors: localStorage 读写失败时降级到内存存储
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  VibrationPatterns,
} from '../types/notifications';

/**
 * 设置 Store 状态接口
 */
interface SettingsState extends NotificationSettings {
  // 聊天设置
  autoReply: boolean;
  autoReplyMessage: string;
  
  // 显示设置
  darkMode: boolean;
  language: string;
  fontSize: 'small' | 'medium' | 'large';
  
  // 其他设置
  messagePreview: boolean; // 通知中是否显示消息预览
  
  // Actions
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  toggleNotifications: () => void;
  toggleSound: () => void;
  toggleVibration: () => void;
  setSoundVolume: (volume: number) => void;
  setVibrationPattern: (pattern: number[]) => void;
  
  toggleAutoReply: () => void;
  setAutoReplyMessage: (message: string) => void;
  
  toggleDarkMode: () => void;
  setLanguage: (language: string) => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  
  toggleMessagePreview: () => void;
  
  // 重置所有设置
  resetToDefaults: () => void;
}

/**
 * 默认设置值
 */
const DEFAULT_SETTINGS: Omit<
  SettingsState,
  | 'updateNotificationSettings'
  | 'toggleNotifications'
  | 'toggleSound'
  | 'toggleVibration'
  | 'setSoundVolume'
  | 'setVibrationPattern'
  | 'toggleAutoReply'
  | 'setAutoReplyMessage'
  | 'toggleDarkMode'
  | 'setLanguage'
  | 'setFontSize'
  | 'toggleMessagePreview'
  | 'resetToDefaults'
> = {
  ...DEFAULT_NOTIFICATION_SETTINGS,
  autoReply: false,
  autoReplyMessage: '您好，我暂时无法回复，稍后会尽快回复您。',
  darkMode: false,
  language: 'zh-CN',
  fontSize: 'medium',
  messagePreview: true,
};

/**
 * 设置 Store
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // 初始状态
      ...DEFAULT_SETTINGS,

      // 通知设置相关 Actions
      updateNotificationSettings: (settings) => {
        set((state) => ({
          ...state,
          ...settings,
        }));
      },

      toggleNotifications: () => {
        set((state) => ({
          notifications: !state.notifications,
        }));
      },

      toggleSound: () => {
        set((state) => ({
          soundEnabled: !state.soundEnabled,
        }));
      },

      toggleVibration: () => {
        set((state) => ({
          vibrationEnabled: !state.vibrationEnabled,
        }));
      },

      setSoundVolume: (volume) => {
        set({
          soundVolume: Math.max(0, Math.min(1, volume)),
        });
      },

      setVibrationPattern: (pattern) => {
        set({ vibrationPattern: pattern });
      },

      // 聊天设置相关 Actions
      toggleAutoReply: () => {
        set((state) => ({
          autoReply: !state.autoReply,
        }));
      },

      setAutoReplyMessage: (message) => {
        set({ autoReplyMessage: message });
      },

      // 显示设置相关 Actions
      toggleDarkMode: () => {
        set((state) => ({
          darkMode: !state.darkMode,
        }));
      },

      setLanguage: (language) => {
        set({ language });
      },

      setFontSize: (size) => {
        set({ fontSize: size });
      },

      // 其他设置 Actions
      toggleMessagePreview: () => {
        set((state) => ({
          messagePreview: !state.messagePreview,
        }));
      },

      // 重置为默认值
      resetToDefaults: () => {
        set(DEFAULT_SETTINGS);
      },
    }),
    {
      name: 'customer-service-settings', // localStorage key
      storage: createJSONStorage(() => localStorage),
      
      // 部分持久化：只持久化需要的字段
      partialize: (state) => ({
        // 通知设置
        notifications: state.notifications,
        soundEnabled: state.soundEnabled,
        vibrationEnabled: state.vibrationEnabled,
        soundVolume: state.soundVolume,
        vibrationPattern: state.vibrationPattern,
        
        // 聊天设置
        autoReply: state.autoReply,
        autoReplyMessage: state.autoReplyMessage,
        
        // 显示设置
        darkMode: state.darkMode,
        language: state.language,
        fontSize: state.fontSize,
        
        // 其他设置
        messagePreview: state.messagePreview,
      }),

      // 版本控制：未来如果设置结构变化，可以用来迁移
      version: 1,

      // 迁移函数（当版本号变化时调用）
      migrate: (persistedState: any, version: number) => {
        // 如果是老版本，可以在这里进行数据迁移
        if (version === 0) {
          // 例如：从老版本迁移到新版本
          return {
            ...DEFAULT_SETTINGS,
            ...persistedState,
          };
        }
        return persistedState as SettingsState;
      },
    }
  )
);

/**
 * 获取通知设置的辅助函数
 */
export const getNotificationSettings = (): NotificationSettings => {
  const state = useSettingsStore.getState();
  return {
    notifications: state.notifications,
    soundEnabled: state.soundEnabled,
    vibrationEnabled: state.vibrationEnabled,
    soundVolume: state.soundVolume,
    vibrationPattern: state.vibrationPattern,
  };
};

/**
 * 检查是否应该触发通知的辅助函数
 */
export const shouldNotify = () => {
  const state = useSettingsStore.getState();
  return {
    shouldPlaySound: state.notifications && state.soundEnabled,
    shouldVibrate: state.notifications && state.vibrationEnabled,
    shouldShowNotification: state.notifications,
    soundVolume: state.soundVolume,
    vibrationPattern: state.vibrationPattern,
  };
};

/**
 * 预设的震动模式选择器
 */
export const VibrationPatternPresets = VibrationPatterns;
