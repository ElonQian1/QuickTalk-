/*
 * unified-state-adapter.js
 * @purpose 强制统一旧 EmptyStatesUI 到 UnifiedState 预设 / API，减少分散实现。
 * @strategy 覆盖 window.EmptyStatesUI 的全部方法；若 UnifiedState 不存在则安全返回。
 * @notes   不删除旧文件，提供幂等覆盖。附一次性 deprecation 提示。
 */
(function(){
  'use strict';
  const WARN_KEY = '__empty_states_adapter_warned__';
  function onceWarn(){
    if (window[WARN_KEY]) return; window[WARN_KEY] = true;
    console.warn('[Deprecation] EmptyStatesUI 已被 UnifiedState 适配层接管，请迁移至 UnifiedState.use(<preset>)');
  }
  function safe(){ return !!(window.UnifiedState && typeof window.UnifiedState.show === 'function'); }
  function ensure(){ if(!safe()) { console.warn('[UnifiedStateAdapter] UnifiedState 尚未加载'); return false;} return true; }
  function pickTarget(target){
    if (target) return target;
    const c = document.createElement('div');
    return c;
  }
  function adapt(){
    const S = window.UnifiedState;
    const api = {
      conversations(target, opts){ if(!ensure()) return null; onceWarn(); target = pickTarget(target); return S.use('conversations', target, opts); },
      shops(target, opts){ if(!ensure()) return null; onceWarn(); target = pickTarget(target); return S.use('shops', target, opts); },
      messages(target, opts){ if(!ensure()) return null; onceWarn(); target = pickTarget(target); return S.use('messages', target, opts); },
      search(keyword='', target, opts){ if(!ensure()) return null; onceWarn(); if(typeof target !== 'object' || target instanceof Element) { opts = opts || {}; } target = pickTarget(target); return S.use('search', target, Object.assign({}, opts||{}, { keyword })); },
      workbench(target, opts){ if(!ensure()) return null; onceWarn(); target = pickTarget(target); return S.use('workbench', target, opts); },
      network(target, opts){ if(!ensure()) return null; onceWarn(); target = pickTarget(target); return S.use('network', target, opts); },
      generic(icon='📋', title='暂无内容', message='', target, opts){ if(!ensure()) return null; onceWarn(); target = pickTarget(target); return S.use('generic', target, Object.assign({ icon, title, message }, opts||{})); },
      empty(message='暂无数据', actionText='', actionCb, target, opts){ if(!ensure()) return null; onceWarn(); target = pickTarget(target); return S.show({ type:'empty', target, message, action: actionText? { text: actionText, onClick: actionCb }: undefined }); },
      error(message='加载失败', retryCb, target, opts){ if(!ensure()) return null; onceWarn(); target = pickTarget(target); return S.show({ type:'error', target, message, retry: retryCb }); },
      // 兼容旧 replaceContent / restoreContent（直接覆盖目标 innerHTML）
      replaceContent(el, node){ if(!el) return; el.innerHTML=''; if(node instanceof Element) el.appendChild(node); },
      restoreContent() { /* no-op: 建议由业务重写 */ }
    };
    window.EmptyStatesUI = Object.assign({}, window.EmptyStatesUI||{}, api);
  }
  adapt();
  console.log('✅ UnifiedState Adapter 已加载 (覆盖 EmptyStatesUI)');
})();
