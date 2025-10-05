/*
 * @deprecated empty-states.js 已被 UnifiedState 取代；请迁移到 UnifiedState.use('<preset>').
 * 若 unified-state-adapter.js 已加载，window.EmptyStatesUI.* 已被接管。
 * 此文件仅为未迁移代码提供兜底，后续将移除。
 */
/*
 * UI: 空状态组件 (legacy)
 */
(function(){
  'use strict';
  // 轻量文本助手，复用全局 getText / StateTexts
  function T(k, fb){
    if (typeof window.getText === 'function') return window.getText(k, fb||k);
    return (window.StateTexts && window.StateTexts[k]) || fb || k;
  }
  // 若 UnifiedState 已存在则直接用其 preset，否则降级构造一个最小空结构
  function usePreset(preset){
    if (window.UnifiedState) {
      const container = document.createElement('div');
      window.UnifiedState.use(preset, container, {});
      return container.firstChild || container;
    }
    // fallback 极简（避免早期加载顺序报错）
    const wrap = document.createElement('div');
    wrap.className = 'empty-state';
    wrap.textContent = preset;
    return wrap;
  }
  function conversations(){ return usePreset('conversations'); }
  function shops(){ return usePreset('shops'); }
  function messages(){ return usePreset('messages'); }
  function workbench(){ return usePreset('workbench'); }
  function search(){ return usePreset('search'); }
  function generic(icon, title, desc){
    if (window.UnifiedState){
      const container = document.createElement('div');
      window.UnifiedState.show({ type:'empty', target: container, icon: icon||'📋', title: title || T('EMPTY_GENERIC','暂无数据'), message: desc||'' });
      return container.firstChild || container;
    }
    const wrap = document.createElement('div');
    wrap.className='empty-state';
    wrap.textContent = title || 'empty';
    return wrap;
  }
  function build(icon, title, desc){ return generic(icon, title, desc); }
  window.EmptyStatesUI = { build, conversations, shops, messages, search, workbench, generic };
  console.warn('[Deprecated] empty-states.js 已瘦身并委托 UnifiedState, 请迁移到 UnifiedState.use()');
})();

