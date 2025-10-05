/**
 * message-boot.js
 * 职责：集中处理 MessageModule 的初始化副作用与可选子系统装配，减轻 message-module.js 体积
 * 设计目标：
 *  - 幂等：多次调用不重复初始化
 *  - 可观测：暴露 window.__MessageBootInfo 用于调试
 *  - 渐进迁移：仅搬运“启动期副作用”逻辑，不改变原模块对外 API
 *  - 安全降级：缺失依赖时静默跳过
 */
(function(){
  'use strict';
  if (window.MessageBoot && typeof window.MessageBoot.init === 'function') return; // 幂等

  const BootState = {
    inited: false,
    steps: [],
    startedAt: 0,
    finishedAt: 0
  };

  function mark(step, ok, meta){
    BootState.steps.push({ step, ok, meta: meta || null, ts: Date.now() });
  }

  function safe(fn, label){
    try { const r = fn(); mark(label, true); return r; } catch(e){ mark(label,false,String(e&&e.message||e)); }
  }

  function init(options){
    if (BootState.inited){ return window.MessageModuleInstance; }
    BootState.inited = true; BootState.startedAt = Date.now();
    const opts = options || {};
    let instance = opts.instance;
    if (!instance){
      safe(()=>{ instance = new window.MessageModule(); }, 'create-instance');
    } else {
      mark('reuse-instance', true);
    }

    if (!instance){ mark('abort-no-instance', false); BootState.finishedAt = Date.now(); return null; }

    // 子系统：滚动协调 + 媒体滚动集成 (原 setTimeout 内部逻辑已迁移，这里保持幂等调用)
    safe(()=>{
      if (window.ScrollCoordinator && typeof window.ScrollCoordinator.init === 'function'){
        window.ScrollCoordinator.init({ getContainer: ()=> document.getElementById('chatMessages'), autoStick: true, stickThreshold: 80 });
      }
    }, 'scroll-coordinator');

    safe(()=>{
      if (window.MediaScrollIntegration && typeof window.MediaScrollIntegration.ensureInit==='function'){
        window.MediaScrollIntegration.ensureInit();
      }
    }, 'media-scroll-integration');

    // 渲染器
    safe(()=>{
      if (window.MessageRenderer && typeof window.MessageRenderer.init === 'function'){
        instance._renderer = window.MessageRenderer.init(instance);
      }
    }, 'message-renderer');

    // 渲染适配器 (增量渲染)
    safe(()=>{
      if (window.MessageRenderAdapter && !instance._renderAdapter){
        instance._renderAdapter = window.MessageRenderAdapter.init({ sender: instance._sender });
      }
    }, 'render-adapter');

    // 新发送器 (若尚未存在)
    safe(()=>{
      if (!instance._sender && window.MessageSender){
        instance._sender = window.MessageSender.create({
          wsSend: (payload)=>{
            if (instance.wsAdapter) return instance.wsAdapter.send(payload);
            if (instance.websocket && instance.websocket.readyState === WebSocket.OPEN){
              try { instance.websocket.send(JSON.stringify(payload)); return true; } catch(_){ return false; }
            }
            return false;
          },
          conversationResolver: ()=> instance.currentConversationId
        });
        if (window.MessageEventBus){
          MessageEventBus.subscribe('send.enqueued', ({tempMessage})=>{
            instance.renderMessage(tempMessage);
            instance._notifyNewMessageForScroll();
          });
          MessageEventBus.subscribe('send.ack', ()=>{ instance.renderMessages(); });
          MessageEventBus.subscribe('send.failed', ({tempMessage})=>{
            instance.renderMessages();
            instance.showToast('消息发送失败，可重试: '+ (tempMessage.content||'').slice(0,20), 'warn');
          });
        }
      }
    }, 'message-sender');

    // 初始化增强特性 (迁移)
    safe(()=>{
      if (window.ShopStatsService && typeof window.ShopStatsService.init === 'function'){
        window.ShopStatsService.init({ ttlMs: 20000 });
      }
    }, 'shop-stats-service');

    safe(()=>{
      if (window.CustomerNumbering && typeof window.CustomerNumbering.init === 'function'){
        window.CustomerNumbering.init({ prefix: '客户', strategy: 'sequential-hash', padLength: 4 });
      }
    }, 'customer-numbering');

    BootState.finishedAt = Date.now();
    window.MessageModuleInstance = instance; // 兼容历史代码
    return instance;
  }

  // 调试接口
  window.__MessageBootInfo = window.__MessageBootInfo || {
    get: ()=> ({ ...BootState }),
    steps: ()=> BootState.steps.slice(),
    duration: ()=> (BootState.finishedAt && BootState.startedAt) ? (BootState.finishedAt - BootState.startedAt) : 0
  };

  window.MessageBoot = { init };

  // 自动延迟初始化：条件满足时启动（可由外部更显式控制）
  function auto(){
    if (window.AUTO_MESSAGE_BOOT === false) return; // 允许外部关闭自动
    if (document.readyState === 'complete' || document.readyState === 'interactive'){
      setTimeout(()=> init(), 0);
    } else {
      document.addEventListener('DOMContentLoaded', ()=> init());
    }
  }
  auto();
})();
