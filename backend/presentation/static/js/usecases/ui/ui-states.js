/**
 * UIStates - 统一 Loading / Empty / Error / Inline 状态占位骨架
 * 目的：去除散落在各模块的重复 DOM 逻辑，未来逐步替换
 * 特性：
 *  - 幂等：重复调用会先清空再渲染
 *  - 轻量：无框架依赖，仅原生 DOM
 *  - 可扩展：提供 registerRenderer 扩展自定义主题
 * 暂不做运行验证（结构优先）
 */
(function(){
  'use strict';
  if (window.UIStates) return; // 避免重复注册

  const DEFAULT_THEME = {
    classPrefix: 'uistate',
    icons: {
      loading: '⏳',
      empty: '📭',
      error: '⚠️'
    },
    texts: {
      loading: '加载中...',
      empty: '暂无数据',
      error: '发生错误'
    }
  };

  function ensureContainer(container){
    if (!container) throw new Error('UIStates: container 为空');
  }

  function clear(container){
    ensureContainer(container);
    // 仅清除由 UIStates 生成的节点，保留其它内容（策略：包裹一个 root）
    const existing = container.querySelector(':scope > .uistates-root');
    if (existing) existing.remove();
  }

  function buildRoot(){
    const root = document.createElement('div');
    root.className = 'uistates-root';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.alignItems = 'center';
    root.style.justifyContent = 'center';
    root.style.padding = '24px 12px';
    root.style.color = '#666';
    root.style.fontSize = '14px';
    root.style.lineHeight = '20px';
    root.style.minHeight = '120px';
    root.style.boxSizing = 'border-box';
    return root;
  }

  function mount(container, node){
    clear(container);
    container.appendChild(node);
  }

  function renderState(container, type, message, detail){
    const theme = UIStates._theme;
    const root = buildRoot();

    const icon = document.createElement('div');
    icon.textContent = theme.icons[type] || '';
    icon.style.fontSize = '28px';
    icon.style.marginBottom = '8px';

    const text = document.createElement('div');
    text.textContent = message || theme.texts[type] || '';

    root.appendChild(icon);
    root.appendChild(text);

    if (detail) {
      const detailEl = document.createElement('div');
      detailEl.textContent = detail;
      detailEl.style.marginTop = '6px';
      detailEl.style.fontSize = '12px';
      detailEl.style.color = '#999';
      root.appendChild(detailEl);
    }

    mount(container, root);
  }

  const UIStates = {
    _theme: DEFAULT_THEME,
    setTheme(theme={}){
      this._theme = {
        ...DEFAULT_THEME,
        ...theme,
        icons: { ...DEFAULT_THEME.icons, ...(theme.icons||{}) },
        texts: { ...DEFAULT_THEME.texts, ...(theme.texts||{}) }
      };
    },
    clear(container){ clear(container); },
    showLoading(container, text){ renderState(container, 'loading', text); },
    showEmpty(container, text){ renderState(container, 'empty', text); },
    showError(container, text, detail){ renderState(container, 'error', text, detail); },

    // 扩展渲染器: registerRenderer('customType', (container, options)=>{})
    _custom: {},
    registerRenderer(type, fn){
      if (typeof fn === 'function') this._custom[type] = fn;
    },
    show(type, container, options){
      if (this._custom[type]) return this._custom[type](container, options||{});
      if (['loading','empty','error'].includes(type)) {
        if (type === 'loading') return this.showLoading(container, options && options.text);
        if (type === 'empty') return this.showEmpty(container, options && options.text);
        if (type === 'error') return this.showError(container, options && options.text, options && options.detail);
      }
      console.warn('[UIStates] 未知的状态类型:', type);
    }
  };

  window.UIStates = UIStates;
  console.log('✅ ui-states.js 加载完成 (骨架)');
})();
