/**
 * @deprecated ui/empty-state.js 已被 UnifiedState 替代。请改用 UnifiedState.use('<preset>')。
 * 此文件将作为兼容层保留一段时间，后续版本会移除。
 */
/** legacy empty-state.js */
(function(){
  'use strict';
  const T = (k,f)=> (typeof window.getText==='function') ? window.getText(k,f) : ((window.StateTexts && window.StateTexts[k]) || f || k);
  function adaptShow(cfg){
    if (!cfg) cfg = {};
    const container = cfg.container || document.createElement('div');
    if (window.UnifiedState){
      window.UnifiedState.show({
        type: cfg.type || (cfg.error? 'error':'empty'),
        target: container,
        icon: cfg.icon,
        title: cfg.title,
        message: cfg.desc,
        action: cfg.action ? { text: cfg.action.label, onClick: cfg.action.onClick } : undefined,
        retry: cfg.retry
      });
      return container.firstChild || container;
    }
    // minimal fallback
    container.textContent = (cfg.title||'');
    return container;
  }
  function render(container, config){
    if (!container) return null;
    container.innerHTML='';
    const node = adaptShow({ ...config, container });
    return node;
  }
  function shops(container){ return render(container, { icon:'🏪', title:T('EMPTY_SHOPS','暂无可用店铺'), desc:T('EMPTY_ADD_FIRST_SHOP_DESC','只有审核通过的店铺会显示在此处') }); }
  function conversations(container){ return render(container, { icon:'💬', title:T('EMPTY_CONVERSATIONS','暂无对话'), desc:'等待客户发起新的对话' }); }
  function messages(container){ return render(container, { icon:'📭', title:T('EMPTY_MESSAGES','暂无消息'), desc:'开始发送第一条消息吧' }); }
  function error(container, title, desc, action){ return render(container, { type:'error', icon:'⚠️', title: title || T('ERROR_GENERIC','加载失败'), desc: desc || T('ERROR_GENERIC_RETRY_DESC','请稍后重试'), action }); }
  window.EmptyState = { render, shops, conversations, messages, error };
  console.warn('[Deprecated] ui/empty-state.js 已委托 UnifiedState');
})();
