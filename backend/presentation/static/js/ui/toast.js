/*
 * UI Toast（轻通知）
 * 提供 Toast.show(message, {type, duration}) 与 window.showToast(message, type)
 */
(function(){
  'use strict';

  const DEFAULT_DURATION = 2200;

  function ensureContainer(){
    let c = document.getElementById('toast-container');
    if (!c){
      c = document.createElement('div');
      c.id = 'toast-container';
      c.style.cssText = 'position:fixed;left:0;right:0;bottom:20px;display:flex;flex-direction:column;align-items:center;gap:8px;z-index:9999;pointer-events:none;';
      document.body.appendChild(c);
    }
    return c;
  }

  function createToast(message, type){
    const el = document.createElement('div');
    el.className = 'toast-item';
    el.textContent = message;
    const bg = type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : type === 'warning' ? '#f59e0b' : '#334155';
    el.style.cssText = `color:#fff;background:${bg};padding:10px 14px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.2);opacity:.98;pointer-events:auto;max-width:90%;`;
    return el;
  }

  function show(message, options){
    const { type = 'info', duration = DEFAULT_DURATION } = options || {};
    const container = ensureContainer();
    const el = createToast(message, type);
    container.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 250);
    }, Math.max(800, duration));
  }

  window.Toast = { show };
  // 兼容旧接口
  window.showToast = function(message, type){
    show(message, { type });
  };

  console.log('✅ toast.js 已加载');
})();
