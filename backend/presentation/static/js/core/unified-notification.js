/*
 * UnifiedNotification - 统一通知/Toast/提示系统 (最小可用版本 v0.1)
 * 目标:
 *  - 统一 showToast / showSuccess / showError 等分散实现
 *  - 提供多类型: success | error | warning | info
 *  - 自动消失 / 手动关闭 / 无障碍 (ARIA) / 队列与最大并发
 *  - 向下兼容 window.showToast(message,type)
 *  - 预留扩展: loading / confirm / progress / 合并计数 / 去重策略
 */
(function(){
  'use strict';

  if (window.UnifiedNotification) {
    return; // 避免重复初始化
  }

  const DEFAULT_OPTIONS = {
    maxVisible: 5,          // 同时可见的最大通知数
    defaultDuration: 2400,  // 默认显示时长 ms
    animationDuration: 260, // 进出场动画时长
    containerId: 'qt-notify-container',
    zIndex: 10000,
    rtl: false,
    debug: false,
  };

  const TYPE_META = {
    success: { cls: 'unotif-success', icon: '✔' },
    error: { cls: 'unotif-error', icon: '✖' },
    warning: { cls: 'unotif-warning', icon: '⚠' },
    info: { cls: 'unotif-info', icon: 'ℹ' },
  };

  class UnifiedNotification {
    constructor(options = {}) {
      this.options = Object.assign({}, DEFAULT_OPTIONS, options);
      this.queue = [];
      this.active = new Set();
      this.totalCreated = 0;
      this._injectStyles();
      this.container = this._ensureContainer();
      this._log('info', 'UnifiedNotification 初始化完成');
    }

    _log(level, ...args) {
      if (!this.options.debug) return;
      try { console[level]('[UnifiedNotification]', ...args); } catch(_) { /* ignore */ }
    }

    _injectStyles() {
      if (document.getElementById('unified-notification-styles')) return;
      const style = document.createElement('style');
      style.id = 'unified-notification-styles';
      style.textContent = `
        #${DEFAULT_OPTIONS.containerId} {
          position: fixed;
          inset: auto 0 20px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          z-index: ${DEFAULT_OPTIONS.zIndex};
          pointer-events: none;
          padding: 0 12px;
        }
        .unotif-item { 
          font-family: system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif;
          min-width: 180px; max-width: 420px; box-sizing: border-box;
          display: flex; align-items: flex-start; gap: 8px;
          background: #334155; color: #fff; padding: 10px 14px; border-radius: 10px;
          box-shadow: 0 6px 18px -4px rgba(0,0,0,.25),0 2px 4px rgba(0,0,0,.12);
          opacity: 0; transform: translateY(8px) scale(.98); transition: all ${DEFAULT_OPTIONS.animationDuration}ms ease;
          pointer-events: auto; position: relative; line-height: 1.4; font-size: 14px;
        }
        .unotif-item.show { opacity: 1; transform: translateY(0) scale(1); }
        .unotif-item.hide { opacity: 0; transform: translateY(-6px) scale(.96); }
        .unotif-icon { font-size: 16px; line-height: 1; margin-top: 1px; }
        .unotif-content { flex: 1; white-space: pre-wrap; word-break: break-word; }
        .unotif-close { cursor: pointer; border: none; background: none; color: inherit; font-size: 16px; line-height: 1; padding: 0 4px; opacity: .8; }
        .unotif-close:hover { opacity: 1; }
        .unotif-success { background: linear-gradient(135deg,#059669,#047857); }
        .unotif-error { background: linear-gradient(135deg,#dc2626,#b91c1c); }
        .unotif-warning { background: linear-gradient(135deg,#f59e0b,#d97706); }
        .unotif-info { background: linear-gradient(135deg,#334155,#1e293b); }
        .unotif-item[data-merge-count]::after { content: attr(data-merge-count); position: absolute; top: -6px; right: -6px; background: #ef4444; color:#fff; font-size:11px; padding:0 5px; border-radius:12px; box-shadow:0 0 0 2px rgba(0,0,0,.25); }
        @media (prefers-reduced-motion: reduce) { .unotif-item { transition: none; } }
      `;
      document.head.appendChild(style);
    }

    _ensureContainer() {
      let el = document.getElementById(this.options.containerId);
      if (!el) {
        el = document.createElement('div');
        el.id = this.options.containerId;
        el.setAttribute('role','region');
        el.setAttribute('aria-label','通知');
        document.body.appendChild(el);
      }
      return el;
    }

    notify(type, message, opts = {}) {
      if (!TYPE_META[type]) type = 'info';
      const config = Object.assign({ duration: this.options.defaultDuration, id: undefined, allowMerge: true }, opts, { type, message });
      // 去重合并: 查找同类型同消息未隐藏项
      if (config.allowMerge) {
        const existing = [...this.active].find(item => item.dataset.type === type && item.dataset.message === message);
        if (existing) {
          const count = parseInt(existing.dataset.mergeCount || '1', 10) + 1;
          existing.dataset.mergeCount = count.toString();
          existing.setAttribute('data-merge-count', 'x'+count);
          this._log('debug', '合并重复通知', message, '次数', count);
          // 重新延长寿命
          if (existing._autoTimer) {
            clearTimeout(existing._autoTimer);
            existing._autoTimer = this._scheduleAutoHide(existing, config.duration);
          }
          return existing;
        }
      }
      const item = this._createItem(config);
      this.totalCreated++;
      if (this.active.size >= this.options.maxVisible) {
        // 隐藏最旧的
        const oldest = this.active.values().next().value;
        this._hideItem(oldest);
      }
      this.active.add(item);
      this.container.appendChild(item);
      requestAnimationFrame(() => item.classList.add('show'));
      item._autoTimer = this._scheduleAutoHide(item, config.duration);
      return item;
    }

    _createItem(config) {
      const meta = TYPE_META[config.type];
      const div = document.createElement('div');
      div.className = `unotif-item ${meta.cls}`;
      div.dataset.type = config.type;
      div.dataset.message = config.message;
      div.setAttribute('role','alert');
      div.setAttribute('aria-live', config.type === 'error' ? 'assertive' : 'polite');

      const iconSpan = document.createElement('span');
      iconSpan.className = 'unotif-icon';
      iconSpan.textContent = meta.icon;

      const contentDiv = document.createElement('div');
      contentDiv.className = 'unotif-content';
      contentDiv.textContent = config.message;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'unotif-close';
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label','关闭');
      closeBtn.innerHTML = '&#215;';
      closeBtn.addEventListener('click', () => this._hideItem(div));

      div.appendChild(iconSpan);
      div.appendChild(contentDiv);
      div.appendChild(closeBtn);
      return div;
    }

    _scheduleAutoHide(item, duration) {
      if (duration === 0 || duration === Infinity) return null;
      return setTimeout(() => this._hideItem(item), Math.max(800, duration));
    }

    _hideItem(item) {
      if (!item || item.classList.contains('hide')) return;
      item.classList.remove('show');
      item.classList.add('hide');
      clearTimeout(item._autoTimer);
      setTimeout(() => this._removeItem(item), this.options.animationDuration + 30);
    }

    _removeItem(item) {
      if (!item) return;
      if (item.parentNode) item.parentNode.removeChild(item);
      this.active.delete(item);
    }

    clearAll() {
      [...this.active].forEach(i => this._hideItem(i));
    }

    // 快捷方法
    success(msg, opts) { return this.notify('success', msg, opts); }
    error(msg, opts) { return this.notify('error', msg, opts); }
    warning(msg, opts) { return this.notify('warning', msg, opts); }
    info(msg, opts) { return this.notify('info', msg, opts); }

    getStats() {
      return {
        active: this.active.size,
        totalCreated: this.totalCreated,
        maxVisible: this.options.maxVisible
      };
    }
  }

  const instance = new UnifiedNotification({ debug: false });
  window.UnifiedNotification = instance;

  // 兼容旧接口
  window.showToast = function(message, type) { instance.notify(type || 'info', message); };
  window.showError = function(message, opts) { instance.error(message, opts); };
  window.showSuccess = function(message, opts) { instance.success(message, opts); };

  console.log('✅ UnifiedNotification 已加载 (v0.1)');
})();
