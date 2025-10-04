/**
 * MessagesPaginationLoader - 消息历史分页加载骨架 (小步：仅结构，不接 UI，不做真实 API 调用)
 * 目标：提供统一向上分页（prepend）逻辑 + 滚动位置保持 + 幂等初始化
 * 不依赖具体消息管理器；由外部注入 fetch / render / 容器获取函数
 * 暂不验证运行，仅保证结构清晰与可扩展性
 */
(function(){
  'use strict';
  if (window.MessagesPaginationLoader) {
    // 避免重复定义
    return;
  }

  const DEFAULT_PAGE_SIZE = 30;

  class PaginationLoader {
    constructor(){
      this._inited = false;
      this._config = null; // { pageSize, debounceMs }
      this._ctx = null;    // 注入: { getConversationId, fetchPage, onPrepend, getContainer, getMessagesRef }

      // 状态
      this._loading = false;
      this._exhausted = false;
      this._oldestCursor = null; // 代表最早一条消息的 id 或 timestamp
      this._lastScrollTriggerTs = 0;
      this._scrollHandlerBound = null;
    }

    /**
     * 初始化
     * @param {Object} options
     *  - getConversationId(): string | null
     *  - fetchPage(beforeCursor): Promise<{ messages: Array, cursor: any }>
     *  - onPrepend(newMessages: Array): void  (期望外部已维护升序)
     *  - getContainer(): HTMLElement  (滚动容器, 必须固定高度可滚动)
     *  - getMessagesRef(): Array  (外部当前消息数组引用, 用于计算新的 oldestCursor)
     *  - pageSize?: number
     *  - debounceMs?: number
     */
    init(options={}){
      if (this._inited) return this;
      this._config = {
        pageSize: typeof options.pageSize === 'number' ? options.pageSize : DEFAULT_PAGE_SIZE,
        debounceMs: typeof options.debounceMs === 'number' ? options.debounceMs : 250
      };
      this._ctx = {
        getConversationId: options.getConversationId || (()=>null),
        fetchPage: options.fetchPage || (async()=>({ messages: [], cursor: null })),
        onPrepend: options.onPrepend || (()=>{}),
        getContainer: options.getContainer || (()=>null),
        getMessagesRef: options.getMessagesRef || (()=>[]) 
      };
      this._inited = true;
      this._bindScrollListener();
      return this;
    }

    /**
     * 外部在初次 loadMessages 后可调用 syncOldestCursor() 来建立初始游标
     * 策略：取当前消息数组第一条的 id 或 created_at
     */
    syncOldestCursor(){
      const msgs = this._ctx.getMessagesRef();
      if (Array.isArray(msgs) && msgs.length > 0) {
        const first = msgs[0];
        this._oldestCursor = first.id || first.created_at || first.timestamp || null;
      }
    }

    /**
     * 主动触发向上加载更多
     */
    async loadOlder(){
      if (!this._inited) return;
      if (this._loading || this._exhausted) return;
      const convId = this._ctx.getConversationId();
      if (!convId) return; // 没有当前对话则不加载

      const container = this._ctx.getContainer();
      if (!container) return;

      this._loading = true;
      let prevHeight = container.scrollHeight;
      let beforeCursor = this._oldestCursor; // null 表示第一次可让后端返回最新之前一批 or 全量上边界

      try {
        const page = await this._ctx.fetchPage(beforeCursor);
        const newMessages = (page && Array.isArray(page.messages)) ? page.messages : [];

        if (newMessages.length === 0) {
          // 空页：直接设 exhausted，除非首次 beforeCursor=null 可以再尝试一次（策略：立即耗尽）
          this._exhausted = true;
          this._loading = false;
          return;
        }

        // 预插入：假设外部 onPrepend 会保证整体升序
        this._ctx.onPrepend(newMessages);

        // 滚动保持：插入前后的高度差
        const newHeight = container.scrollHeight;
        const delta = newHeight - prevHeight;
        // 将 scrollTop 向下偏移增量，保持视口位置
        container.scrollTop = container.scrollTop + delta;

        // 更新 oldestCursor（使用插入后全局第一条）
        const all = this._ctx.getMessagesRef();
        if (Array.isArray(all) && all.length > 0) {
          const first = all[0];
          this._oldestCursor = first.id || first.created_at || first.timestamp || this._oldestCursor;
        }

        // 判断是否耗尽：返回条数 < pageSize => exhausted
        if (newMessages.length < this._config.pageSize) {
          this._exhausted = true;
        }
      } catch (e) {
        // 失败不修改 exhausted，让用户可重试
        // 这里不做 UI，交由未来 UIStates 接入
        if (window && window.console) {
          console.warn('[MessagesPaginationLoader] loadOlder error', e);
        }
      } finally {
        this._loading = false;
      }
    }

    /**
     * 绑定滚动监听：接近顶部触发加载
     * 触发条件：scrollTop <= 40px
     */
    _bindScrollListener(){
      const container = this._ctx.getContainer();
      if (!container) return; // 首次可能还没有，外部可稍后调用 rebindScrollListener()
      if (this._scrollHandlerBound) return;
      this._scrollHandlerBound = this._onScroll.bind(this);
      container.addEventListener('scroll', this._scrollHandlerBound, { passive: true });
    }

    /** 供外部在容器节点晚于 init 出现时重绑 */
    rebindScrollListener(){
      this._bindScrollListener();
    }

    _onScroll(e){
      if (!this._inited) return;
      if (this._loading || this._exhausted) return;
      const container = e.target;
      if (!container) return;
      if (container.scrollTop <= 40) {
        const now = Date.now();
        if (now - this._lastScrollTriggerTs < this._config.debounceMs) return; // 防抖
        this._lastScrollTriggerTs = now;
        this.loadOlder();
      }
    }

    /** 手动重置（切换对话时调用） */
    reset(){
      this._loading = false;
      this._exhausted = false;
      this._oldestCursor = null;
      this._lastScrollTriggerTs = 0;
    }

    /** 状态导出，方便调试 */
    getState(){
      return {
        inited: this._inited,
        loading: this._loading,
        exhausted: this._exhausted,
        oldestCursor: this._oldestCursor
      };
    }
  }

  // 暴露全局单例工厂：允许多实例（每个对话各自）但默认提供一个 shared
  window.MessagesPaginationLoader = {
    create(){ return new PaginationLoader(); },
    // 共享实例（简单场景）
    getShared(){
      if (!this._shared) this._shared = new PaginationLoader();
      return this._shared;
    }
  };

  console.log('✅ messages-pagination-loader.js 加载完成 (骨架)');
})();
