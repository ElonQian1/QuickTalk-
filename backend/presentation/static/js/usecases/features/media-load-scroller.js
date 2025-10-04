/**
 * MediaLoadScroller - 媒体元素加载后滚动位置校正协调器 (设计骨架 - 小步6)
 * 场景: prepend 加载历史消息或滚动过程中图片/视频异步加载导致位置跳动/粘底失效。
 * 功能目标:
 *   1. 监听容器内 <img>, <video> load 事件，批处理计算高度增量
 *   2. 在向上分页 (prepend) 后保持视口锚点 (首条旧消息) 不移动
 *   3. 在粘底模式下(聊天进行中) 保持滚动在底部
 *   4. 可被 ScrollCoordinator / PaginationLoader 调用: registerAnchor(beforeHeight) -> applyAfter()
 * 限制: 不做运行验证; 仅保留结构+调用契约。后续再接线。
 */
(function(){
  'use strict';
  if (window.MediaLoadScroller) return;

  class MediaLoadScrollerImpl {
    constructor(){
      this._containerResolver = null;   // ()=> HTMLElement
      this._batchDelay = 60;            // ms 延迟聚合
      this._pending = false;
      this._lastAppliedAt = 0;
      this._anchor = null;              // { scrollTopBefore, scrollHeightBefore }
      this._stickyBottomResolver = null;// ()=> boolean  是否当前应粘底
      this._debug = false;
    }

    init(options={}){
      this._containerResolver = options.getContainer || (()=> null);
      this._stickyBottomResolver = options.isStickyBottom || (()=> false);
      this._batchDelay = typeof options.batchDelay === 'number' ? options.batchDelay : 60;
      this._debug = !!options.debug;
      this._bindLoadListeners();
      return this;
    }

    /** 在进行 prepend 前记录锚点 (由 PaginationLoader 调用) */
    registerAnchor(){
      const c = this._containerResolver();
      if (!c) return;
      this._anchor = { scrollTopBefore: c.scrollTop, scrollHeightBefore: c.scrollHeight };
    }

    /** 媒体可能尚未加载, 先等待批处理再调整 */
    applyAfterPrepend(){
      // 如果媒体都已缓存则立即尝试一次
      this._scheduleAdjust();
    }

    _bindLoadListeners(){
      const c = this._containerResolver();
      if (!c) return;
      const observer = (e)=> {
        // 任何媒体加载完成 => 触发一次聚合调整
        this._scheduleAdjust();
      };
      // 事件委托: 监听冒泡的 load (需捕获阶段 true)
      c.addEventListener('load', observer, true);
      this._loadListener = observer;
    }

    _scheduleAdjust(){
      if (this._pending) return;
      this._pending = true;
      setTimeout(()=> { this._pending=false; this._applyAdjust(); }, this._batchDelay);
    }

    _applyAdjust(){
      const c = this._containerResolver();
      if (!c) return;
      const shouldStick = this._stickyBottomResolver();
      if (this._anchor){
        // 计算 prepend 前后高度差, 调整 scrollTop 以保持视口锚点
        const delta = c.scrollHeight - this._anchor.scrollHeightBefore;
        c.scrollTop = this._anchor.scrollTopBefore + delta;
        if (this._debug) console.log('[MediaLoadScroller] anchor adjust delta=', delta);
      } else if (shouldStick) {
        c.scrollTop = c.scrollHeight; // 粘底模式保持在底部
      }
      this._anchor = null; // 单次使用
      this._lastAppliedAt = Date.now();
    }
  }

  window.MediaLoadScroller = new MediaLoadScrollerImpl();
  console.log('✅ media-load-scroller.js 加载完成 (设计骨架)');
})();
