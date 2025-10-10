/**
 * 事件管理工具
 * 提供简单的事件发布订阅机制
 */

export type EventHandler<T = any> = (data: T) => void;
export type EventMap = Record<string, any>;

export class EventEmitter<T extends EventMap = EventMap> {
  private listeners: { [K in keyof T]?: Array<EventHandler<T[K]>> } = {};

  /**
   * 添加事件监听器
   */
  on<K extends keyof T>(event: K, handler: EventHandler<T[K]>): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(handler);
  }

  /**
   * 添加一次性事件监听器
   */
  once<K extends keyof T>(event: K, handler: EventHandler<T[K]>): void {
    const onceHandler = (data: T[K]) => {
      handler(data);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }

  /**
   * 移除事件监听器
   */
  off<K extends keyof T>(event: K, handler: EventHandler<T[K]>): void {
    const eventListeners = this.listeners[event];
    if (eventListeners) {
      const index = eventListeners.indexOf(handler);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
  emit<K extends keyof T>(event: K, data: T[K]): void {
    const eventListeners = this.listeners[event];
    if (eventListeners) {
      eventListeners.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`事件处理器错误 (${String(event)}):`, error);
        }
      });
    }
  }

  /**
   * 移除所有监听器
   */
  removeAllListeners<K extends keyof T>(event?: K): void {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }

  /**
   * 获取事件监听器数量
   */
  listenerCount<K extends keyof T>(event: K): number {
    return this.listeners[event]?.length ?? 0;
  }
}

/**
 * 工具函数：检查页面是否已准备好
 */
export function onReady(callback: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

/**
 * 工具函数：防抖
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = window.setTimeout(() => func(...args), wait);
  };
}

/**
 * 工具函数：节流
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, wait);
    }
  };
}

/**
 * 工具函数：延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 工具函数：获取设备信息
 */
export function getDeviceInfo() {
  const userAgent = navigator.userAgent;
  
  return {
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
    isIOS: /iPad|iPhone|iPod/.test(userAgent),
    isAndroid: /Android/.test(userAgent),
    isChrome: /Chrome/.test(userAgent),
    isSafari: /Safari/.test(userAgent) && !/Chrome/.test(userAgent),
    isFirefox: /Firefox/.test(userAgent),
    hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    devicePixelRatio: window.devicePixelRatio || 1,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  };
}