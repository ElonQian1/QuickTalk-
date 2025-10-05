/*
 * Feedback 统一通知模块
 * 提供: Feedback.show(message, type?, options?) / success / error / info / warn
 * 去重: 相同 message+type 在冷却期内不重复展示
 * 适配: window.Notify.show / window.Toast.show / window.showToast / alert
 */
(function(){
  'use strict';
  const COOL_MS = 1800;
  const lastShown = new Map(); // key -> timestamp
  const levels = ['success','error','warn','info'];
  function now(){ return Date.now(); }
  function pickAdapter(){
    if (window.Notify && typeof window.Notify.show==='function') return (m,t,o)=>window.Notify.show(m,t,o);
    if (window.Toast && typeof window.Toast.show==='function') return (m,t,o)=>window.Toast.show(m,{ type:t, ...(o||{}) });
    if (typeof window.showToast==='function') return (m,t)=>window.showToast(m,t);
    return (m)=>{ try{ console.log('[FEEDBACK]',m); }catch(_){} };
  }
  function shouldSkip(key){ const ts = lastShown.get(key)||0; if (now()-ts < COOL_MS) return true; lastShown.set(key, now()); return false; }
  function coreShow(message, type='info', options){
    if (!message) return;
    const key = type+'::'+message;
    if (shouldSkip(key)) return;
    try{ pickAdapter()(message, type, options||{});}catch(e){ try{ console.log('[FeedbackFallback]', type, message); }catch(_){} }
  }
  const api = {
    show: coreShow,
    success: (m,o)=>coreShow(m,'success',o),
    error: (m,o)=>coreShow(m,'error',o),
    warn: (m,o)=>coreShow(m,'warn',o),
    info: (m,o)=>coreShow(m,'info',o)
  };
  window.Feedback = api;
})();
