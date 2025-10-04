/**
 * ScrollCoordinator - 滚动协调器 (骨架)
 * 目标:
 *  1. 统一管理聊天容器粘底逻辑
 *  2. 与分页/媒体加载协作 (后续接 MediaLoadScroller.registerAnchor/applyAfterPrepend)
 *  3. 提供 isNearBottom() 接口供业务判断是否自动滚动
 *  4. 轻量、无外部依赖；容器通过注入获取
 */
(function(){
  'use strict';
  if (window.ScrollCoordinator) return;

  class ScrollCoordinatorImpl {
    constructor(){
      this._containerResolver = null; // ()=>HTMLElement
      this._stickThreshold = 60;      // px 内认为仍在底部附近
      this._autoStick = true;         // 是否启用自动粘底
      this._lastUserScrollTop = 0;    // 记录用户滚动位置用于判断方向
      this._debug = false;
      this._boundOnScroll = null;
    }

    init(options={}){
      this._containerResolver = options.getContainer || (()=> document.getElementById('chatMessages'));
      if (typeof options.stickThreshold === 'number') this._stickThreshold = options.stickThreshold;
      if (typeof options.autoStick === 'boolean') this._autoStick = options.autoStick;
      this._debug = !!options.debug;
      this._bind();
      return this;
    }

    _bind(){
      const c = this._containerResolver();
      if (!c || this._boundOnScroll) return;
      this._boundOnScroll = (e)=> this._onScroll(e.target);
      c.addEventListener('scroll', this._boundOnScroll, { passive:true });
    }

    _onScroll(c){
      this._lastUserScrollTop = c.scrollTop;
    }

    isNearBottom(){
      const c = this._containerResolver();
      if (!c) return true; // 没有容器默认允许粘底
      const distance = c.scrollHeight - c.scrollTop - c.clientHeight;
      return distance <= this._stickThreshold;
    }

    scrollToEnd(force=false){
      const c = this._containerResolver();
      if (!c) return;
      if (force || this._autoStick && this.isNearBottom()) {
        c.scrollTop = c.scrollHeight;
      }
    }

    notifyNewMessage(){
      // 新消息渲染完成后尝试粘底
      this.scrollToEnd(false);
    }

    registerPrependAnchor(){
      // 预留：分页向上加载前记录锚点（与 MediaLoadScroller 协作）
      const c = this._containerResolver();
      if (!c) return null;
      return { scrollTop: c.scrollTop, scrollHeight: c.scrollHeight };
    }

    restoreAfterPrepend(anchor){
      const c = this._containerResolver();
      if (!c || !anchor) return;
      const delta = c.scrollHeight - anchor.scrollHeight;
      c.scrollTop = anchor.scrollTop + delta;
    }
  }

  window.ScrollCoordinator = new ScrollCoordinatorImpl();
  console.log('✅ scroll-coordinator.js 加载完成 (骨架)');
})();
