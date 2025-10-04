/**
 * notify.js
 * 职责: 统一Toast通知门面，避免各模块重复showToast降级逻辑
 * 提供一致的通知API，支持多种类型、自动清理、队列管理
 */
(function(){
  'use strict';
  
  const DEFAULT_DURATION = 3000;
  const MAX_TOASTS = 5;
  let toastQueue = [];
  
  // 显示通知（主入口）
  function show(message, type = 'info', duration = DEFAULT_DURATION) {
    if (!message || typeof message !== 'string') return;
    
    // 1. 优先使用全局Toast组件
    if (typeof window.showToast === 'function') {
      return window.showToast(message, type, duration);
    }
    
    // 2. 尝试其他可能的Toast实现
    if (window.Toast && typeof window.Toast.show === 'function') {
      return window.Toast.show(message, type, duration);
    }
    
    if (window.toastr && typeof window.toastr[type] === 'function') {
      return window.toastr[type](message);
    }
    
    // 3. 降级：创建简单DOM Toast
    return showFallbackToast(message, type, duration);
  }
  
  // 降级Toast实现
  function showFallbackToast(message, type, duration) {
    // 限制队列长度
    if (toastQueue.length >= MAX_TOASTS) {
      const oldest = toastQueue.shift();
      if (oldest && oldest.parentNode) oldest.parentNode.removeChild(oldest);
    }
    
    const toast = document.createElement('div');
    toast.className = `fallback-toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 10000;
      padding: 12px 16px; border-radius: 4px; color: white; 
      font-size: 14px; max-width: 300px; word-wrap: break-word;
      background: ${getTypeColor(type)}; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      transform: translateX(100%); transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    toastQueue.push(toast);
    
    // 入场动画
    setTimeout(() => { toast.style.transform = 'translateX(0)'; }, 10);
    
    // 自动清理
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
        const idx = toastQueue.indexOf(toast);
        if (idx >= 0) toastQueue.splice(idx, 1);
      }, 300);
    }, duration);
    
    return toast;
  }
  
  function getTypeColor(type) {
    switch(type) {
      case 'success': return '#4CAF50';
      case 'error': return '#F44336';
      case 'warning': return '#FF9800';
      case 'info': default: return '#2196F3';
    }
  }
  
  // 便利方法
  function success(message, duration) { return show(message, 'success', duration); }
  function error(message, duration) { return show(message, 'error', duration); }
  function warning(message, duration) { return show(message, 'warning', duration); }
  function info(message, duration) { return show(message, 'info', duration); }
  
  // 清理所有Toast
  function clear() {
    toastQueue.forEach(toast => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
    toastQueue = [];
  }
  
  // 暴露到全局
  window.Notify = {
    show: show,
    success: success,
    error: error,
    warning: warning,
    info: info,
    clear: clear
  };
  
  console.log('✅ 通知助手已加载 (notify.js)');
})();
