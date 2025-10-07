/**
 * notify.js
 * 注意：此文件提供适配器模式，但可能与toast.js重复
 * 建议：逐步迁移到统一的toast.js实现
 * 职责: 统一Toast通知门面，避免各模块重复showToast降级逻辑
 * 提供一致的通知API，支持多种类型、自动清理、队列管理
 */
(function(){
  'use strict';
  
  const DEFAULT_DURATION = 3000;
  const MAX_TOASTS = 5;
  let toastQueue = [];
  
  // 显示通知（主入口）- 简化实现，优先使用标准toast.js
  function show(message, type = 'info', duration = DEFAULT_DURATION) {
    if (!message || typeof message !== 'string') return;
    
    // 优先使用标准的showToast实现（由toast.js提供）
    if (typeof window.showToast === 'function') {
      return window.showToast(message, type);
    }
    
    // 降级到控制台
    console.log(`[Notify] ${type.toUpperCase()}: ${message}`);
  }
  
  // 简化的API - 统一委托给toast.js
  const NotifyAPI = {
    show,
    success: (msg, duration) => show(msg, 'success', duration),
    error: (msg, duration) => show(msg, 'error', duration), 
    warning: (msg, duration) => show(msg, 'warning', duration),
    info: (msg, duration) => show(msg, 'info', duration),
    clear: () => {
      // 委托给Toast组件清理
      if (window.Toast && window.Toast.clearAll) {
        window.Toast.clearAll();
      }
    }
  };

  // 全局注册
  window.Notify = NotifyAPI;
  
  console.log('✅ 简化的Notify适配器已加载（委托toast.js）');

})();
