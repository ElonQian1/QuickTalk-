/*
 * UnifiedState - 统一的 Empty/Error 状态展示 (最小版本 v0.1)
 * 目标：消除分散的 createEmptyUI / createErrorUI / EmptyStatesUI / 模板重复
 */
(function(){
  'use strict';
  if (window.UnifiedState) return;

  // 本地文本访问助手（示例性替换阶段）。若全局 getText 已存在则复用；否则回退到原始访问模式。
  const T = (k, fallback) => {
    if (typeof window.getText === 'function') return window.getText(k, fallback);
    try { if (window.StateTexts && Object.prototype.hasOwnProperty.call(window.StateTexts, k)) return window.StateTexts[k]; } catch(_){}
    return (fallback !== undefined) ? fallback : k;
  };

  const STYLE_ID = 'unified-state-styles';
  const DEFAULTS = {
    injectOldClass: true,
    debug: false
  };

  const TYPE_PRESETS = {
    empty: { icon: '📭', title: T('EMPTY_GENERIC','暂无数据'), message: T('EMPTY_GENERIC_DESC','当前没有可显示的内容') },
    error: { icon: '❌', title: T('ERROR_GENERIC','加载失败'), message: T('ERROR_GENERIC_RETRY_DESC','获取数据时出现问题') }
  };

  class UnifiedStateManager {
    constructor(options={}){
      this.opts = Object.assign({}, DEFAULTS, options);
      this.entries = new Map(); // key -> { key,type,targetEl,element,createdAt }
      this.totalCreated = 0;
      this.customPresets = {}; // name -> config | function(ctx)
      this._ensureStyles();
    }

    _log(...a){ if (this.opts.debug) console.log('[UnifiedState]', ...a); }

    _ensureStyles(){
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        .u-state { font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Helvetica Neue,Arial; color:#475569; border:1px dashed #cbd5e1; border-radius:12px; padding:28px 20px; background:#f8fafc; display:flex; align-items:flex-start; gap:16px; position:relative; }
        .u-state.u-state-variant-default { }
        .u-state-icon { font-size:32px; line-height:1; filter:drop-shadow(0 2px 4px rgba(0,0,0,.15)); }
        .u-state-body { display:flex; flex-direction:column; gap:6px; }
        .u-state-title { font-weight:600; font-size:15px; color:#1e293b; }
        .u-state-message { font-size:13px; color:#475569; }
        .u-state-action { align-self:flex-start; margin-top:6px; background:#2563eb; color:#fff; padding:6px 12px; border:none; border-radius:6px; cursor:pointer; font-size:13px; box-shadow:0 2px 6px -1px rgba(0,0,0,.25); }
        .u-state-action:hover { background:#1d4ed8; }
        .u-state-error { border-color:#fecaca; background:#fef2f2; }
        .u-state-error .u-state-title { color:#b91c1c; }
        .u-state-error .u-state-message { color:#991b1b; }
        .u-state-empty { border-color:#cbd5e1; }
        .u-state[data-updating="true"] { opacity:.6; }
        .u-state-compact { padding:14px 16px; border-radius:10px; }
        .u-state.u-legacy-empty { /* marker to allow old css hook if needed */ }
        .u-state.u-legacy-error { }
        @media (prefers-color-scheme: dark){
          .u-state { background:#1e293b; border-color:#334155; color:#cbd5e1; }
          .u-state-title { color:#f1f5f9; }
          .u-state-message { color:#cbd5e1; }
          .u-state-error { background:#431920; border-color:#7f1d1d; }
          .u-state-error .u-state-title { color:#fca5a5; }
          .u-state-error .u-state-message { color:#fecaca; }
        }
      `;
      document.head.appendChild(style);
    }

    registerPreset(name, def){
      if (!name) return;
      this.customPresets[name] = def;
      this._log('registerPreset', name);
    }

    use(name, target, opts={}){
      // 允许 name 映射到 type 或完全自定义
      const preset = this.customPresets[name];
      if (!preset){
        this._log('preset missing', name);
        return this.show(Object.assign({ type: name, target }, opts));
      }
      if (typeof preset === 'function') {
        const cfg = preset({ target, opts, state: this });
        return this.show(Object.assign({}, cfg, { target }));
      } else {
        return this.show(Object.assign({}, preset, opts, { target }));
      }
    }

    show(typeOrOptions, key, options){
      let cfg;
      if (typeof typeOrOptions === 'string') {
        cfg = Object.assign({}, options||{}, { type: typeOrOptions, key });
      } else {
        cfg = Object.assign({}, typeOrOptions||{});
      }
      cfg.type = cfg.type || 'empty';
      // 支持扩展：若 custom preset 指向基础类型映射
      if (!TYPE_PRESETS[cfg.type]) {
        if (this.customPresets[cfg.type]) {
          // 若为扩展 preset，允许其指定 baseType
          const ext = this.customPresets[cfg.type];
          if (ext && typeof ext === 'object' && ext.baseType && TYPE_PRESETS[ext.baseType]) {
            cfg._baseType = ext.baseType;
          } else {
            cfg._baseType = 'empty';
          }
        } else {
          cfg._baseType = 'empty';
        }
      }
      cfg.key = cfg.key || key || this._genKey(cfg.type);

      const targetEl = this._resolveTarget(cfg.target);
      if (!targetEl) { this._log('target missing'); return null; }

      const existing = this.entries.get(cfg.key);
      if (existing) {
        this._updateElement(existing.element, cfg);
        existing.element.dataset.updating = 'true';
        setTimeout(()=> existing.element && existing.element.removeAttribute('data-updating'), 150);
        return existing.element;
      }

  const baseType = TYPE_PRESETS[cfg.type] ? cfg.type : (cfg._baseType || 'empty');
  const preset = TYPE_PRESETS[baseType];
  cfg.icon = cfg.icon || preset.icon;
  cfg.title = cfg.title || preset.title;
  cfg.message = cfg.message || preset.message;

      const el = this._buildElement(cfg);
      targetEl.innerHTML = '';
      targetEl.appendChild(el);

      this.entries.set(cfg.key, { key: cfg.key, type: cfg.type, targetEl, element: el, createdAt: Date.now() });
      this.totalCreated++;
      this._dispatch('state:shown', { key: cfg.key, type: cfg.type });
      return el;
    }

    hide(key){
      const entry = this.entries.get(key);
      if (!entry) return false;
      if (entry.element && entry.element.parentNode) {
        entry.element.parentNode.removeChild(entry.element);
      }
      this.entries.delete(key);
      this._dispatch('state:hidden', { key, type: entry.type });
      return true;
    }

    replace(target, type, options){
      return this.show(Object.assign({}, options||{}, { target, type }));
    }

    getStats(){
      const byType = {};
      for (const e of this.entries.values()) {
        byType[e.type] = (byType[e.type]||0)+1;
      }
      return { active: this.entries.size, byType, totalCreated: this.totalCreated };
    }

    _buildElement(cfg){
      const el = document.createElement('div');
      el.className = `u-state u-state-${cfg.type} u-state-variant-${cfg.variant||'default'}` + (cfg.className? ' '+cfg.className:'');
      if (this.opts.injectOldClass) {
        if (cfg.type === 'empty') el.classList.add('empty-state','u-legacy-empty');
        if (cfg.type === 'error') el.classList.add('error-state','u-legacy-error');
      }
      el.setAttribute('role', cfg.type === 'error' ? 'alert' : 'status');
      el.setAttribute('aria-label', cfg.ariaLabel || cfg.title || cfg.message || cfg.type);
      el.dataset.key = cfg.key;
      el.innerHTML = `
        <div class="u-state-icon">${cfg.icon}</div>
        <div class="u-state-body">
          ${cfg.title ? `<div class="u-state-title">${this._escape(cfg.title)}</div>` : ''}
          <div class="u-state-message">${this._escape(cfg.message||'')}</div>
          <div class="u-state-action-slot"></div>
        </div>
      `;
      if (cfg.action || cfg.retry) {
        this._attachAction(el, cfg);
      }
      return el;
    }

    _updateElement(el, cfg){
      if (!el) return;
      const titleNode = el.querySelector('.u-state-title');
      if (cfg.title && titleNode) titleNode.textContent = cfg.title;
      else if (cfg.title && !titleNode) {
        const body = el.querySelector('.u-state-body');
        if (body) {
          const t = document.createElement('div');
          t.className = 'u-state-title';
          t.textContent = cfg.title;
          body.insertBefore(t, body.firstChild.nextSibling || body.firstChild);
        }
      }
      const msgNode = el.querySelector('.u-state-message');
      if (cfg.message && msgNode) msgNode.textContent = cfg.message;
      if (cfg.action || cfg.retry) {
        this._attachAction(el, cfg, true);
      }
    }

    _attachAction(el, cfg, updating=false){
      const slot = el.querySelector('.u-state-action-slot');
      if (!slot) return;
      slot.innerHTML = '';
      const action = cfg.retry ? { text: cfg.action?.text || '重试', onClick: cfg.retry } : cfg.action;
      if (!action || !action.text) return;
      const btn = document.createElement('button');
      btn.className = 'u-state-action';
      btn.type = 'button';
      btn.textContent = action.text;
      btn.addEventListener('click', e => {
        try { action.onClick && action.onClick(e); } catch(err){ console.error(err); }
      });
      slot.appendChild(btn);
    }

    _dispatch(name, detail){
      try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch(_){}
    }

    _resolveTarget(t){
      if (!t) return null;
      if (t instanceof Element) return t;
      if (typeof t === 'string') return document.querySelector(t);
      return null;
    }

    _genKey(type){
      return `${type}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    }

    _escape(str){
      return String(str).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    }
  }

  const UnifiedState = new UnifiedStateManager();
  window.UnifiedState = UnifiedState;

  // 注册核心业务预设（轻量，不改变已有 empty / error）
  UnifiedState.registerPreset('conversations', {
    type: 'empty',
    icon: '💬',
    // 示例替换：使用 T() 访问常量
    title: T('EMPTY_CONVERSATIONS','暂无对话'),
    message: '等待客户发起新的对话'
  });
  UnifiedState.registerPreset('shops', {
    type: 'empty',
    icon: '🏪',
    // 示例替换：title 与 message 使用 T()
    title: T('EMPTY_SHOPS','暂无可用店铺'),
    message: T('EMPTY_ADD_FIRST_SHOP_DESC','店铺审核通过后会显示在此')
  });
  UnifiedState.registerPreset('messages', {
    type: 'empty',
    icon: '📭',
    title: T('EMPTY_MESSAGES','暂无消息'),
    message: T('EMPTY_MESSAGES_DESC','本对话尚无历史消息')
  });
  UnifiedState.registerPreset('search', ctx => {
    const keyword = ctx.opts?.keyword || '';
    return {
      type: 'empty',
      icon: '🔍',
      title: '未找到匹配结果',
      message: keyword ? `没有找到包含 "${keyword}" 的内容` : '试试其他搜索关键词'
    };
  });
  UnifiedState.registerPreset('workbench', {
    type: 'empty',
    icon: '📊',
    title: T('EMPTY_WORKBENCH', T('EMPTY_GENERIC','暂无数据')),
    message: T('EMPTY_WORKBENCH_DESC','统计周期内没有可显示的数据')
  });
  UnifiedState.registerPreset('network', {
    type: 'error',
    icon: '🌐',
    title: T('NETWORK_ERROR_TITLE','网络连接异常'),
    message: T('NETWORK_ERROR_DESC','请检查网络连接后重试'),
    retry: () => window.location.reload()
  });
  UnifiedState.registerPreset('generic', ctx => ({
    type: ctx.opts?.error ? 'error' : 'empty',
    icon: ctx.opts?.icon || (ctx.opts?.error ? '⚠️' : '📋'),
    title: ctx.opts?.title || (ctx.opts?.error ? T('ERROR_GENERIC','加载失败') : T('EMPTY_GENERIC','暂无数据')),
    message: ctx.opts?.message || ctx.opts?.desc || (ctx.opts?.error ? T('ERROR_GENERIC_RETRY_DESC','请稍后重试') : ''),
    action: ctx.opts?.action
  }));


  // 兼容旧接口包装 (延迟存在时再覆盖)
  if (!window.EmptyStatesUI) {
    window.EmptyStatesUI = {
  empty: (msg=T('EMPTY_GENERIC','暂无数据'), actionText='', actionCb) => {
        const key = `legacy-empty-${Date.now()}`;
        const container = document.createElement('div');
        UnifiedState.show({ type:'empty', key, target: container, message: msg, action: actionText? { text: actionText, onClick: actionCb }: undefined });
        console.warn('[Deprecation] EmptyStatesUI.empty 已由 UnifiedState 接管');
        return container.firstChild;
      },
  error: (msg=T('ERROR_GENERIC','加载失败'), retryCb) => {
        const key = `legacy-error-${Date.now()}`;
        const container = document.createElement('div');
        UnifiedState.show({ type:'error', key, target: container, message: msg, retry: retryCb });
        console.warn('[Deprecation] EmptyStatesUI.error 已由 UnifiedState 接管');
        return container.firstChild;
      }
    };
  }

  console.log('✅ UnifiedState 已加载 (v0.1 empty+error)');
})();
