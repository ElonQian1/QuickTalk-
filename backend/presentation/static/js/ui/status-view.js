/**
 * ui/status-view.js
 * 统一 Loading / Empty / Error / Content 状态门面
 * 目标:
 *  - 取代分散的 showLoadingSkeleton / showLoadingState / renderEmptyState / showErrorState
 *  - 复用已有组件: LoadingStatesUI.spinner, EmptyState.*, ErrorStatesUI.errorBlock
 *  - 幂等: 同一容器连续渲染相同状态不重复重排
 *  - 降级安全: 若依赖组件缺失提供最小占位
 */
(function(){
  'use strict';

  const STATE_KEY = '__qt_status_view_state__';

  function ensureContainer(container){
    if (!container) return null;
    return container;
  }

  function setState(container, state){
    try { container[STATE_KEY] = state; } catch(_){}
  }
  function getState(container){
    try { return container[STATE_KEY]; } catch(_) { return null; }
  }

  function sameState(container, next){
    const prev = getState(container);
    if (!prev) return false;
    // 仅比较类型/标题/描述 以减少无谓渲染
    return prev.type === next.type && prev.title === next.title && prev.desc === next.desc;
  }

  function clear(container){
    container = ensureContainer(container); if (!container) return;
    if (container.firstChild && container.firstChild.classList && container.firstChild.classList.contains('qt-status-view-wrapper')){
      container.removeChild(container.firstChild);
    }
    setState(container, { type: 'content' });
  }

  function wrapper(){
    const w = document.createElement('div');
    w.className = 'qt-status-view-wrapper';
    return w;
  }

  function render(container, cfg){
    container = ensureContainer(container); if (!container) return;
    const next = cfg || { type: 'unknown' };
    if (sameState(container, next)) return; // 幂等
    clear(container);
    const w = wrapper();
    // 分派
    if (cfg.type === 'loading') {
      if (window.LoadingStatesUI && window.LoadingStatesUI.spinner){
        w.appendChild(window.LoadingStatesUI.spinner(cfg.text || '加载中...'));
      } else {
        w.innerHTML = '<div class="loading-state">'+ (cfg.text||'加载中...') +'</div>';
      }
    } else if (cfg.type === 'empty') {
      // 复用 EmptyState 语义快捷
      const domain = cfg.domain || 'generic';
      if (window.EmptyState){
        if (domain === 'conversations' && EmptyState.conversations) EmptyState.conversations(w);
        else if (domain === 'messages' && EmptyState.messages) EmptyState.messages(w);
        else if (domain === 'shops' && EmptyState.shops) EmptyState.shops(w);
        else EmptyState.render(w, { icon: cfg.icon || '📄', title: cfg.title || '暂无数据', desc: cfg.desc || '' });
      } else {
        w.innerHTML = '<div class="empty-state"><div class="empty-icon">📄</div><h3>'+(cfg.title||'暂无数据')+'</h3><p>'+ (cfg.desc||'') +'</p></div>';
      }
    } else if (cfg.type === 'error') {
      if (window.EmptyState && EmptyState.error){
        EmptyState.error(w, cfg.title || '加载失败', cfg.desc || '请稍后重试', cfg.action);
      } else if (window.ErrorStatesUI && ErrorStatesUI.errorBlock){
        w.appendChild(ErrorStatesUI.errorBlock(cfg.title || '加载失败', cfg.desc || '请稍后重试'));
      } else {
        w.innerHTML = '<div class="error-message"><div class="empty-icon">⚠️</div><div class="empty-title">'+(cfg.title||'加载失败')+'</div><div class="empty-desc">'+(cfg.desc||'请稍后重试')+'</div></div>';
      }
      if (cfg.action && cfg.action.label && typeof cfg.action.onClick === 'function'){
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'status-retry-btn';
        btn.textContent = cfg.action.label;
        btn.addEventListener('click', (e)=>{ try { cfg.action.onClick(e); } catch(err){ console.warn('[StatusView] action 执行失败', err); } });
        w.appendChild(btn);
      }
    } else {
      // 未知类型, 不渲染（保持内容态）
      return;
    }
    container.insertBefore(w, container.firstChild || null);
    setState(container, next);
  }

  // 语义 API
  function loading(container, text){ render(container, { type: 'loading', text }); }
  function error(container, title, desc, action){ render(container, { type: 'error', title, desc, action }); }
  function empty(container, domain){ render(container, { type: 'empty', domain }); }

  // 批量接口
  window.StatusView = { show: render, loading, error, empty, clear };

  // 内联样式（一次性注入）
  try {
    if (!document.getElementById('status-view-inline-style')){
      const style = document.createElement('style');
      style.id = 'status-view-inline-style';
      style.textContent = 
`.qt-status-view-wrapper{position:relative;}
.qt-status-view-wrapper .loading-state{text-align:center;padding:32px 12px;color:#555;font-size:14px;}
.qt-status-view-wrapper .status-retry-btn{margin-top:12px;background:#2563eb;color:#fff;border:0;border-radius:4px;padding:6px 14px;font-size:14px;cursor:pointer;}
.qt-status-view-wrapper .status-retry-btn:hover{background:#1d4ed8;}`;
      document.head.appendChild(style);
    }
  } catch(_){}

  console.log('✅ StatusView 已加载 (ui/status-view.js)');
})();
