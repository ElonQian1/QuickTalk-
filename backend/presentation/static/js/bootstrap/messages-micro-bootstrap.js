/*
 * messages-micro-bootstrap.js — 单一消息模块启动器（小步快跑第1步）
 * 目标：
 *  1. 确保只实例化精简协调器 MessageModuleRefactored
 *  2. 提供向后兼容的 window.MessageModule 全局引用
 *  3. 等待 Partials 与关键管理器加载再启动，避免竞态
 *  4. 首次启动后调用 showShops() 进入店铺视图
 *  5. 幂等：防止二次初始化
 */
(function(){
  'use strict';

  let started = false;

  async function wait(ms){ return new Promise(r=>setTimeout(r, ms)); }

  async function waitFor(conditionFn, timeout=5000, interval=60){
    const start = Date.now();
    while(!conditionFn()){
      if (Date.now()-start > timeout) return false;
      await wait(interval);
    }
    return true;
  }

  async function ensurePartials(){
    try {
      if (window.PartialsLoader && typeof window.PartialsLoader.loadPartials==='function'){
        await window.PartialsLoader.loadPartials();
      }
    } catch(e){ console.warn('[messages-micro-bootstrap] 部分片段加载可能失败, 继续启动', e); }
  }

  function managersReady(){
    return !!(window.ShopsManagerRefactored && window.ConversationsManagerRefactored && window.MessagesManagerRefactored && window.MessageWSAdapter);
  }

  async function start(){
    if (started){ return; }
    started = true;

    // 1. 等待 DOM 基本就绪
    if (document.readyState === 'loading'){
      await new Promise(r=> document.addEventListener('DOMContentLoaded', r, { once:true }));
    }

    // 2. 等待管理器类加载（避免脚本顺序竞态）
    await waitFor(managersReady, 4000).catch(()=>{});

    // 3. 片段加载（视图容器）
    await ensurePartials();

    // 4. 实例化精简协调器
    if (!window.MessageModuleRefactored){
      console.error('[messages-micro-bootstrap] MessageModuleRefactored 未加载，终止启动');
      return;
    }
    const instance = new window.MessageModuleRefactored();

    // 5. 向后兼容：如果 legacy 名称尚未占用，则建立指向
    if (!window.MessageModule){
      window.MessageModule = instance; // 直接赋实例，兼容旧脚本存取字段
    }
    window.MessageModuleRef = instance;

    // 6. 首屏：展示店铺列表（失败不阻塞）
    try { await instance.showShops(); } catch(e){ console.warn('[messages-micro-bootstrap] showShops 失败', e); }

    console.log('✅ messages-micro-bootstrap 启动完成 (单一协调器)');
  }

  // 若页面存在旧的 messages-init，会与本启动器功能重叠；先延迟执行以保证我们成为唯一协调器入口
  setTimeout(start, 30);
})();
