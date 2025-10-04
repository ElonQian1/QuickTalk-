/**
 * ui-states.js
 * 职责: 统一UI状态管理（加载/空/错误），避免各模块重复条件判断
 * 提供一致的状态展示API，支持骨架屏、空状态、错误提示的统一样式
 */
(function(){
  'use strict';
  
  // 显示加载状态
  function showLoading(container, text = '正在加载...') {
    if (!container) return null;
    
    container.innerHTML = '';
    
    // 1. 优先使用全局加载组件
    if (window.LoadingStatesUI && typeof window.LoadingStatesUI.spinner === 'function') {
      const spinner = window.LoadingStatesUI.spinner(text);
      container.appendChild(spinner);
      return spinner;
    }
    
    // 2. 降级：创建简单加载指示器
    const loading = document.createElement('div');
    loading.className = 'ui-state-loading';
    loading.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">${text}</div>
      </div>
    `;
    loading.style.cssText = `
      display: flex; align-items: center; justify-content: center;
      padding: 40px 20px; text-align: center; color: #666;
    `;
    
    // 简单CSS动画
    const style = document.createElement('style');
    style.textContent = `
      .loading-spinner {
        width: 32px; height: 32px; margin: 0 auto 12px;
        border: 3px solid #f3f3f3; border-top: 3px solid #3498db;
        border-radius: 50%; animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .loading-text { font-size: 14px; }
    `;
    if (!document.querySelector('[data-ui-states-style]')) {
      style.setAttribute('data-ui-states-style', 'true');
      document.head.appendChild(style);
    }
    
    container.appendChild(loading);
    return loading;
  }
  
  // 显示空状态
  function showEmpty(container, options = {}) {
    if (!container) return null;
    
    const {
      icon = '📭',
      title = '暂无数据', 
      description = '当前没有可显示的内容',
      actionText = null,
      onAction = null
    } = options;
    
    container.innerHTML = '';
    
    // 1. 优先使用全局空状态组件
    if (window.EmptyStatesUI && typeof window.EmptyStatesUI.general === 'function') {
      const empty = window.EmptyStatesUI.general(icon, title, description, actionText, onAction);
      container.appendChild(empty);
      return empty;
    }
    
    // 2. 降级：创建简单空状态
    const empty = document.createElement('div');
    empty.className = 'ui-state-empty';
    empty.style.cssText = `
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 60px 20px; text-align: center;
    `;
    
    let html = `
      <div class="empty-icon" style="font-size: 48px; margin-bottom: 16px;">${icon}</div>
      <h3 style="margin: 0 0 8px; font-size: 18px; color: #333;">${title}</h3>
      <p style="margin: 0; color: #666; font-size: 14px;">${description}</p>
    `;
    
    if (actionText && onAction) {
      html += `
        <button class="empty-action" style="
          margin-top: 20px; padding: 8px 16px; border: 1px solid #ddd;
          background: white; border-radius: 4px; cursor: pointer;
        ">${actionText}</button>
      `;
    }
    
    empty.innerHTML = html;
    
    if (actionText && onAction) {
      const btn = empty.querySelector('.empty-action');
      if (btn) btn.addEventListener('click', onAction);
    }
    
    container.appendChild(empty);
    return empty;
  }
  
  // 显示错误状态
  function showError(container, title = '加载失败', message = '请稍后重试', onRetry = null) {
    if (!container) return null;
    
    container.innerHTML = '';
    
    // 1. 优先使用全局错误组件
    if (window.ErrorStatesUI && typeof window.ErrorStatesUI.errorBlock === 'function') {
      const error = window.ErrorStatesUI.errorBlock(title, message, onRetry);
      container.appendChild(error);
      return error;
    }
    
    // 2. 降级：创建简单错误状态
    const error = document.createElement('div');
    error.className = 'ui-state-error';
    error.style.cssText = `
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 40px 20px; text-align: center;
    `;
    
    let html = `
      <div class="error-icon" style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <h3 style="margin: 0 0 8px; font-size: 16px; color: #f44336;">${title}</h3>
      <p style="margin: 0; color: #666; font-size: 14px;">${message}</p>
    `;
    
    if (onRetry) {
      html += `
        <button class="error-retry" style="
          margin-top: 16px; padding: 8px 16px; border: none;
          background: #f44336; color: white; border-radius: 4px; cursor: pointer;
        ">重试</button>
      `;
    }
    
    error.innerHTML = html;
    
    if (onRetry) {
      const btn = error.querySelector('.error-retry');
      if (btn) btn.addEventListener('click', onRetry);
    }
    
    container.appendChild(error);
    return error;
  }
  
  // 显示骨架屏（可选）
  function showSkeleton(container, type = 'list', count = 3) {
    if (!container) return null;
    
    container.innerHTML = '';
    
    // 优先使用全局骨架屏组件
    if (window.SkeletonListUI && typeof window.SkeletonListUI.buildConversationsSkeleton === 'function') {
      const skeleton = window.SkeletonListUI.buildConversationsSkeleton(count);
      container.appendChild(skeleton);
      return skeleton;
    }
    
    // 降级：简单骨架屏
    const skeleton = document.createElement('div');
    skeleton.className = 'ui-state-skeleton';
    for (let i = 0; i < count; i++) {
      const item = document.createElement('div');
      item.style.cssText = `
        height: 60px; margin-bottom: 12px; background: #f5f5f5;
        border-radius: 4px; position: relative; overflow: hidden;
      `;
      // 简单闪烁动画
      item.innerHTML = '<div style="position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent);animation:skeleton-loading 1.5s infinite;"></div>';
      skeleton.appendChild(item);
    }
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes skeleton-loading {
        0% { left: -100%; }
        100% { left: 100%; }
      }
    `;
    if (!document.querySelector('[data-skeleton-style]')) {
      style.setAttribute('data-skeleton-style', 'true');
      document.head.appendChild(style);
    }
    
    container.appendChild(skeleton);
    return skeleton;
  }
  
  // 暴露到全局
  window.UIStates = {
    showLoading: showLoading,
    showEmpty: showEmpty,
    showError: showError,
    showSkeleton: showSkeleton
  };
  
  console.log('✅ UI状态助手已加载 (ui-states.js)');
})();