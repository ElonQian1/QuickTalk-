/*
 * UnifiedLoading - 统一加载状态管理 (最小版本 v0.1)
 * 目标：统一 global 与 inline 加载；支持 key+引用计数；wrap 包装异步；超时自动清理；与通知系统协作
 */
(function(){
  'use strict';
  if (window.UnifiedLoading) return; // 避免重复初始化

  const DEFAULTS = {
    defaultText: '加载中...',
    animationMs: 220,
    globalContainerId: 'qt-loading-layer',
    zIndex: 10005,
    debug: false
  };

  function logDebug(enabled, ...args){ if (enabled) console.log('[UnifiedLoading]', ...args); }

  class UnifiedLoading {
    constructor(options={}) {
      this.opts = Object.assign({}, DEFAULTS, options);
      this.entries = new Map(); // key -> entry
      this.totalCreated = 0;
      this._injectStyles();
      this.overlayContainer = this._ensureOverlayContainer();
      this.globalContainer = this._ensureGlobalContainer();
      logDebug(this.opts.debug, 'Initialized');
    }

    _injectStyles(){
      if (document.getElementById('unified-loading-styles')) return;
      const style = document.createElement('style');
      style.id = 'unified-loading-styles';
      style.textContent = `
        #${DEFAULTS.globalContainerId} { position: fixed; inset:0; pointer-events:none; z-index:${DEFAULTS.zIndex}; display:flex; flex-direction:column; align-items:center; gap:12px; padding-top:120px; }
        #${DEFAULTS.overlayContainerId} { position: fixed; inset:0; z-index:${DEFAULTS.zIndex + 1}; pointer-events:none; }
        .uload-global { background:rgba(17,25,40,.55); backdrop-filter: blur(6px); border:1px solid rgba(255,255,255,.1); color:#fff; padding:14px 18px; border-radius:14px; display:flex; align-items:center; gap:10px; box-shadow:0 6px 20px -6px rgba(0,0,0,.4); opacity:0; transform:translateY(6px) scale(.96); transition:all ${DEFAULTS.animationMs}ms ease; font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Helvetica Neue,Arial; }
        .uload-global.show { opacity:1; transform:translateY(0) scale(1); }
        .uload-inline { display:inline-flex; align-items:center; gap:6px; font:13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Helvetica Neue,Arial; color:#555; }
        .uload-spinner { width:20px; height:20px; border:3px solid rgba(255,255,255,.25); border-top:3px solid #38bdf8; border-radius:50%; animation:uload-spin 1s linear infinite; flex-shrink:0; }
        .uload-inline .uload-spinner { width:16px; height:16px; border:2px solid #d1d5db; border-top:2px solid #3b82f6; }
        .uload-text { white-space:nowrap; }
        @keyframes uload-spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
        .uload-hide { opacity:0!important; transform:translateY(-4px) scale(.94)!important; }
        .uload-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.38); backdrop-filter:blur(4px); pointer-events:auto; opacity:0; transition:opacity ${DEFAULTS.animationMs}ms ease; }
        .uload-overlay.show { opacity:1; }
        .uload-overlay-box { background:rgba(17,25,40,.68); padding:16px 22px; border-radius:16px; display:flex; align-items:center; gap:12px; color:#fff; border:1px solid rgba(255,255,255,.12); box-shadow:0 8px 26px -8px rgba(0,0,0,.45); font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Helvetica Neue,Arial; }
        .uload-skeleton { display:flex; flex-direction:column; gap:10px; animation:uload-skel-pulse 1.4s ease-in-out infinite; width:100%; }
        .uload-skel-avatar { width:42px; height:42px; border-radius:50%; background:linear-gradient(90deg,#e5e7eb,#f1f5f9,#e5e7eb); background-size:200% 100%; animation:uload-skel-shine 2s linear infinite; }
        .uload-skel-line { height:14px; border-radius:7px; background:linear-gradient(90deg,#e5e7eb,#f1f5f9,#e5e7eb); background-size:200% 100%; animation:uload-skel-shine 2s linear infinite; }
        .uload-skel-line.short { width:60%; }
        @keyframes uload-skel-pulse { 0%,100% { opacity:1 } 50% { opacity:.55 } }
        @keyframes uload-skel-shine { 0% { background-position:0 0 } 100% { background-position:200% 0 } }
      `;
      document.head.appendChild(style);
    }

    _ensureGlobalContainer(){
      let c = document.getElementById(this.opts.globalContainerId);
      if (!c){
        c = document.createElement('div');
        c.id = this.opts.globalContainerId;
        document.body.appendChild(c);
      }
      return c;
    }

    _ensureOverlayContainer(){
      let c = document.getElementById(this.opts.overlayContainerId || DEFAULTS.overlayContainerId);
      if (!c){
        c = document.createElement('div');
        c.id = this.opts.overlayContainerId || DEFAULTS.overlayContainerId;
        document.body.appendChild(c);
      }
      return c;
    }

    _resolveTarget(target){
      if (!target) return null;
      if (typeof target === 'string') return document.querySelector(target);
      if (target instanceof Element) return target;
      return null;
    }

    _nextKey(scope){
      return `${scope}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    }

    show(scopeOrOptions, key, options){
      // Normalize arguments
      let cfg; 
      if (typeof scopeOrOptions === 'string') {
        cfg = Object.assign({}, options||{}, { scope: scopeOrOptions, key, text: (options && options.text) || options?.text });
      } else {
        cfg = Object.assign({}, scopeOrOptions || {});
      }
      cfg.scope = cfg.scope || 'global';
      cfg.key = cfg.key || key || this._nextKey(cfg.scope);
      cfg.text = cfg.text || this.opts.defaultText;

      const existing = this.entries.get(cfg.key);
      if (existing) {
        existing.refCount++;
        if (cfg.timeout) this._refreshTimeout(existing, cfg.timeout);
        logDebug(this.opts.debug, 'ref++', cfg.key, '=>', existing.refCount);
        return { key: cfg.key, element: existing.element, scope: existing.scope };
      }

      let element;
      if (cfg.scope === 'global') {
        element = this._createGlobalElement(cfg.text, cfg.key);
        this.globalContainer.appendChild(element);
        requestAnimationFrame(()=> element.classList.add('show'));
        document.body.setAttribute('aria-busy','true');
      } else if (cfg.scope === 'inline') {
        const targetEl = this._resolveTarget(cfg.target);
        if (!targetEl) { logDebug(this.opts.debug, 'inline target missing'); return null; }
        const original = targetEl.innerHTML;
        element = this._createInlineElement(cfg.text, cfg.key);
        targetEl.setAttribute('data-uload-original', original);
        targetEl.innerHTML = '';
        targetEl.appendChild(element);
        targetEl.setAttribute('aria-busy','true');
      } else if (cfg.scope === 'overlay') {
        element = this._createOverlayElement(cfg.text, cfg.key);
        this.overlayContainer.appendChild(element);
        requestAnimationFrame(()=> element.classList.add('show'));
        document.body.setAttribute('aria-busy','true');
      } else if (cfg.scope === 'skeleton') {
        const targetEl = this._resolveTarget(cfg.target);
        if (!targetEl) { logDebug(this.opts.debug, 'skeleton target missing'); return null; }
        const original = targetEl.innerHTML;
        element = this._createSkeletonElement(cfg); // cfg 可包含 lines, showAvatar
        targetEl.setAttribute('data-uload-original', original);
        targetEl.innerHTML = '';
        targetEl.appendChild(element);
        targetEl.setAttribute('aria-busy','true');
      } else {
        logDebug(this.opts.debug, 'unsupported scope in v0.1', cfg.scope);
        return null;
      }

      const entry = {
        key: cfg.key,
        scope: cfg.scope,
        element,
        refCount: 1,
        target: (cfg.scope==='inline'? this._resolveTarget(cfg.target): null),
        placeholder: null,
        createdAt: Date.now(),
        timeoutId: null,
        closeReason: null
      };
      if (cfg.timeout) this._setTimeout(entry, cfg.timeout);

      this.entries.set(cfg.key, entry);
      this.totalCreated++;
      logDebug(this.opts.debug, 'show', cfg.key, cfg.scope);
      return { key: cfg.key, element, scope: cfg.scope };
    }

    _createGlobalElement(text, key){
      const wrap = document.createElement('div');
      wrap.className = 'uload-global';
      wrap.dataset.key = key;
      wrap.innerHTML = `<div class="uload-spinner"></div><div class="uload-text">${text}</div>`;
      return wrap;
    }

    _createInlineElement(text, key){
      const wrap = document.createElement('span');
      wrap.className = 'uload-inline';
      wrap.dataset.key = key;
      wrap.innerHTML = `<span class="uload-spinner"></span><span class="uload-text">${text}</span>`;
      return wrap;
    }

    _createOverlayElement(text, key){
      const overlay = document.createElement('div');
      overlay.className = 'uload-overlay';
      overlay.dataset.key = key;
      overlay.innerHTML = `<div class="uload-overlay-box"><div class='uload-spinner'></div><div class='uload-text'>${text}</div></div>`;
      return overlay;
    }

    _createSkeletonElement(cfg){
      const { key, lines = (cfg.lines||3), showAvatar = cfg.showAvatar } = cfg;
      const wrap = document.createElement('div');
      wrap.className = 'uload-skeleton';
      if (key) wrap.dataset.key = key;
      if (showAvatar){
        const av = document.createElement('div');
        av.className = 'uload-skel-avatar';
        wrap.appendChild(av);
      }
      for (let i=0;i<lines;i++){
        const line = document.createElement('div');
        line.className = 'uload-skel-line' + (i===lines-1? ' short':'' );
        wrap.appendChild(line);
      }
      return wrap;
    }

    _setTimeout(entry, ms){
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
      entry.timeoutId = setTimeout(()=>{
        logDebug(this.opts.debug, 'timeout hide', entry.key);
        entry.closeReason = 'timeout';
        this.hide(entry.key);
      }, ms);
    }
    _refreshTimeout(entry, ms){ this._setTimeout(entry, ms); }

    hide(key){
      const entry = this.entries.get(key);
      if (!entry) return false;
      entry.refCount--;
      logDebug(this.opts.debug, 'ref--', key, '=>', entry.refCount);
      if (entry.refCount > 0) return false;
      if (!entry.closeReason) entry.closeReason = 'normal';
      this._removeEntry(entry);
      return true;
    }

    _removeEntry(entry){
      clearTimeout(entry.timeoutId);
      if (entry.scope === 'inline' && entry.target){
        const original = entry.target.getAttribute('data-uload-original');
        if (original !== null) entry.target.innerHTML = original;
        entry.target.removeAttribute('aria-busy');
      } else if (entry.scope === 'global' || entry.scope === 'overlay') {
        entry.element.classList.add('uload-hide');
        setTimeout(()=>{
          if (entry.element.parentNode) entry.element.parentNode.removeChild(entry.element);
          if (![...this.entries.values()].some(e=> e.scope==='global' || e.scope==='overlay')) {
            document.body.removeAttribute('aria-busy');
          }
        }, this.opts.animationMs+30);
      } else if (entry.scope === 'skeleton' && entry.target){
        const original = entry.target.getAttribute('data-uload-original');
        if (original !== null) entry.target.innerHTML = original;
        entry.target.removeAttribute('aria-busy');
      }
      this.entries.delete(entry.key);
    }

    clearAll(){
      [...this.entries.keys()].forEach(k=> this.hide(k));
    }

    wrap(promise, options){
      const showResult = this.show(options);
      const key = showResult && showResult.key;
      const successMsg = options && options.successNotify;
      const errorMsg = options && options.errorNotify;
      return Promise.resolve(promise)
        .then(res=>{ if (successMsg && window.UnifiedNotification) window.UnifiedNotification.success(successMsg); return res; })
        .catch(err=>{ if (errorMsg && window.UnifiedNotification) window.UnifiedNotification.error(errorMsg); throw err; })
        .finally(()=>{ if (key) this.hide(key); });
    }

    getStats(){
      const byScope = {};
      const reasons = { normal:0, timeout:0, other:0 };
      for (const e of this.entries.values()) {
        byScope[e.scope] = (byScope[e.scope]||0)+1;
        if (e.closeReason){
          if (reasons[e.closeReason] == null) reasons.other++; else reasons[e.closeReason]++;
        }
      }
      return { active: this.entries.size, byScope, totalCreated: this.totalCreated, reasons };
    }

    isActive(key){ return this.entries.has(key); }
  }

  const instance = new UnifiedLoading();
  window.UnifiedLoading = instance;

  // 旧接口桥接 (首阶段仅 global)
  window.showLoading = function(text, key){ return instance.show('global', key||'__legacy_global__', { text }); };
  window.hideLoading = function(key){ return instance.hide(key||'__legacy_global__'); };

  console.log('✅ UnifiedLoading 已加载 (v0.1 global+inline)');
})();
