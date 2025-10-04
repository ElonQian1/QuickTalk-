/**
 * unread-badge-aggregator.js
 * 统一未读数聚合模块
 * 职责:
 *  - 定期/事件驱动汇总各店铺/会话未读数
 *  - 数据来源优先级: WebSocket增量缓存 > API拉取 > DOM Fallback
 *  - 对外派发事件: 'unread:update' detail { total, perShop, timestamp }
 *  - 提供查询方法: getTotals(), getShopUnread(shopId)
 *  - 支持配置: QT_CONFIG.intervals.unreadPoll, QT_CONFIG.features.forceUnreadFallback
 *  - 使用 QT_LOG 命名空间: unreadAggregator
 *
 * 依赖: 可选 window.fetchShops / shopCardManager / WebSocket事件 domain.event.message_appended
 */
(function(){
  const NS = 'unreadAggregator';
  if (window.unreadBadgeAggregator) return; // 幂等

  const log = (lvl, ...a) => {
    if (window.QT_LOG) {
      (QT_LOG[lvl]||QT_LOG.info)(NS, ...a);
    } else if (lvl === 'debug') {
      // 静默或简单输出
      // console.log('[debug]', ...a);
    } else {
      console.log(`[${NS}]`, ...a);
    }
  };

  class UnreadBadgeAggregator {
    constructor(options={}){
      this.perShop = {}; // {shopId: unreadCount}
      this.total = 0;
      this.lastTs = Date.now();
      this.wsIncrementalEnabled = true;
      this.pollTimer = null;
      this.options = options;
      this._setupWsListener();
      this._startPolling();
      this.refresh('init');
      log('info', '初始化完成');
    }

    _pollInterval(){
      return (window.QT_CONFIG && window.QT_CONFIG.intervals && window.QT_CONFIG.intervals.unreadPoll) || 15000;
    }

    _setupWsListener(){
      // 监听全局 WebSocket 事件 (假设已有分发到 window 或 document 的机制) 这里使用事件委托模式
      document.addEventListener('ws:domain.event.message_appended', (e) => {
        const msg = e.detail && e.detail.message;
        if (!msg) return;
        const shopId = msg.shop_id || msg.shopId || msg.shopID;
        const unreadDelta = this._shouldCountMessage(msg) ? 1 : 0;
        if (unreadDelta && shopId) {
            this.perShop[shopId] = (this.perShop[shopId]||0) + unreadDelta;
            this._recalcTotal();
            this._emit('ws-increment');
            log('debug', 'WS 增量更新', shopId, this.perShop[shopId]);
        }
      });
    }

    _shouldCountMessage(msg){
      // 忽略自己发送的已读消息，示例逻辑: sender_type === 'agent' 不计入 (以客服端视角)
      if (!msg) return false;
      if (msg.sender_type === 'agent') return false;
      return true;
    }

    _startPolling(){
      const interval = this._pollInterval();
      if (this.pollTimer) clearInterval(this.pollTimer);
      this.pollTimer = setInterval(()=> this.refresh('poll'), interval);
      log('debug', '开始轮询 unread, 间隔(ms)=', interval);
    }

    async refresh(reason='manual'){
      try {
        const apiOk = await this._tryApi();
        if (!apiOk) {
          const domOk = await this._tryDomFallback();
          if (!domOk) log('warn', '未读聚合无数据来源 (API/DOM 均失败)');
        }
        this._recalcTotal();
        this._emit(reason);
      } catch(err){
        log('error', '刷新未读失败', err);
      }
    }

    async _tryApi(){
      // 假设 fetchShops 返回包含 unread_count 或 stats 字段; 可扩展对会话级 API
      if (typeof window.fetchShops !== 'function') return false;
      try {
        const shops = await window.fetchShops({ force:true, ttlMs: 5000 });
        if (!Array.isArray(shops) || shops.length === 0) return false;
        let anyUnreadDefined = false;
        const next = {};
        for (const s of shops){
          const id = s.id || s.shop_id || s.shopId;
          if (!id) continue;
          const unread = s.unread_count ?? s.unreadCount ?? s.unread ?? 0;
          if (unread > 0) anyUnreadDefined = true;
          next[id] = unread;
        }
        if (!anyUnreadDefined) {
          // 如果API没有未读字段，认为此次API对未读无帮助
          return false;
        }
        this.perShop = next;
        log('debug', 'API 聚合完成', next);
        return true;
      } catch(err){
        log('warn', 'API 聚合失败', err);
        return false;
      }
    }

    async _tryDomFallback(){
      // 仅当配置允许时执行 DOM 猜测
      if (window.QT_CONFIG && !window.QT_CONFIG.features.forceUnreadFallback) return false;
      const cards = document.querySelectorAll('.shop-card[data-shop-id]');
      if (cards.length === 0) return false;
      const next = {};
      cards.forEach(card => {
        const sid = card.getAttribute('data-shop-id');
        if (!sid) return;
        const badge = card.querySelector('.unread-count, .unread-badge, .shop-unread-badge');
        let count = 0;
        if (badge){
          count = parseInt(badge.textContent) || parseInt(badge.getAttribute('data-unread')) || 0;
        }
        next[sid] = count;
      });
      this.perShop = next;
      log('debug', 'DOM Fallback 聚合完成', next);
      return true;
    }

    _recalcTotal(){
      this.total = Object.values(this.perShop).reduce((a,b)=>a+b,0);
      this.lastTs = Date.now();
    }

    _emit(reason){
      const detail = { total: this.total, perShop: { ...this.perShop }, reason, timestamp: this.lastTs };
      document.dispatchEvent(new CustomEvent('unread:update', { detail }));
      log('debug', '派发事件 unread:update', detail);
    }

    getTotals(){
      return { total: this.total, perShop: { ...this.perShop }, timestamp: this.lastTs };
    }

    getShopUnread(shopId){
      return this.perShop[shopId] || 0;
    }

    destroy(){
      if (this.pollTimer) clearInterval(this.pollTimer);
      log('info', '已销毁');
    }
  }

  window.UnreadBadgeAggregator = UnreadBadgeAggregator;
  window.unreadBadgeAggregator = new UnreadBadgeAggregator();
  log('info', '未读聚合单例已创建');
})();
