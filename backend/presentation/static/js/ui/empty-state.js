/**
 * ui/empty-state.js
 * 职责: 统一空状态/加载失败占位渲染, 减少各模块重复 innerHTML 片段
 * 设计目标:
 *  - 单一入口: EmptyState.render(container, config)
 *  - 语义快捷方法: EmptyState.shops / conversations / messages
 *  - 具备幂等/可重入: 多次调用会覆盖旧内容
 *  - 降级安全: 若参数不完整提供最小结构
 *  - 允许 action: { label, onClick }
 *  - 不依赖框架, 纯原生 JS
 */
(function(){
  'use strict';

  function createRoot(container){
    if (!container) return null;
    container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'empty-state';
    return root;
  }

  function build(config){
    const { icon='📄', title='暂无数据', desc='', action=null, size='md' } = config || {}; 
    const frag = document.createDocumentFragment();
    const iconEl = document.createElement('div');
    iconEl.className = 'empty-icon empty-icon-' + size;
    iconEl.textContent = icon;
    const titleEl = document.createElement('h3');
    titleEl.className = 'empty-title';
    titleEl.textContent = title;
    frag.appendChild(iconEl);
    frag.appendChild(titleEl);
    if (desc){
      const p = document.createElement('p');
      p.className = 'empty-desc';
      p.textContent = desc;
      frag.appendChild(p);
    }
    if (action && action.label && typeof action.onClick === 'function'){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'empty-action-btn';
      btn.textContent = action.label;
      btn.addEventListener('click', (e)=>{ try { action.onClick(e); } catch(err){ console.warn('[EmptyState] action 执行失败', err);} });
      frag.appendChild(btn);
    }
    return frag;
  }

  function render(container, config){
    const root = createRoot(container);
    if (!root) return;
    root.appendChild(build(config||{}));
    container.appendChild(root);
    return root;
  }

  // 语义快捷方法
  function shops(container){
    return render(container, { icon:'🏪', title:'暂无可用店铺', desc:'只有审核通过的店铺会显示在此处' });
  }
  function conversations(container){
    return render(container, { icon:'💬', title:'暂无对话', desc:'等待客户发起新的对话' });
  }
  function messages(container){
    return render(container, { icon:'📭', title:'暂无消息', desc:'开始发送第一条消息吧' });
  }
  function error(container, title='加载失败', desc='请稍后重试', action){
    return render(container, { icon:'⚠️', title, desc, action });
  }

  // 暴露
  window.EmptyState = { render, shops, conversations, messages, error };

  // 简单样式注入(若无样式) —— 避免重复注入
  try {
    if (!document.getElementById('empty-state-inline-style')){
      const style = document.createElement('style');
      style.id = 'empty-state-inline-style';
      style.textContent = 
`.empty-state{padding:40px 16px;text-align:center;color:#555;font-family:inherit;}
.empty-state .empty-icon{font-size:40px;opacity:.6;margin-bottom:12px;}
.empty-state .empty-title{margin:4px 0 8px;font-size:18px;font-weight:600;}
.empty-state .empty-desc{margin:0 0 12px;font-size:14px;line-height:1.5;color:#666;}
.empty-state .empty-action-btn{background:#2563eb;color:#fff;border:0;border-radius:4px;padding:6px 14px;font-size:14px;cursor:pointer;}
.empty-state .empty-action-btn:hover{background:#1d4ed8;}`;
      document.head.appendChild(style);
    }
  } catch(_){}

  console.log('✅ EmptyState 组件已加载 (ui/empty-state.js)');
})();
