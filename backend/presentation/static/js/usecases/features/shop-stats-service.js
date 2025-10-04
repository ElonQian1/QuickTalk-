/**
 * ShopStatsService - 店铺会话/未读统计聚合缓存服务 (骨架)
 * 目标:
 *  1. 统一获取店铺统计 (conversation_count / unread_count)
 *  2. 去除分散的 getShopConversationCount / getShopUnreadCount 重复 API 调用
 *  3. 支持缓存 TTL + 并发折叠 (同一 shop 多请求合并)
 *  4. 预留批量刷新 (后续可 /api/shops/stats?ids=1,2)
 * 不做运行验证，仅结构与接口稳定性优先。
 */
(function(){
  'use strict';
  if (window.ShopStatsService) return; // 避免重复注册

  const DEFAULT_TTL_MS = 20_000; // 20s 内重复访问复用缓存

  class StatsCacheEntry {
    constructor(data){
      this.data = data; // { conversation_count, unread_count, loaded_at }
      this.fetchedAt = Date.now();
    }
    isFresh(ttl){
      return (Date.now() - this.fetchedAt) < ttl;
    }
  }

  class ShopStatsServiceImpl {
    constructor(){
      this._cache = new Map();           // shopId -> StatsCacheEntry
      this._inFlight = new Map();        // shopId -> Promise
      this._ttl = DEFAULT_TTL_MS;
      this._debug = false;
      this._fetchImpl = null;            // (shopId)=> Promise<{conversation_count, unread_count}>
    }

    init(options={}){
      this._ttl = typeof options.ttlMs === 'number' ? options.ttlMs : DEFAULT_TTL_MS;
      this._debug = !!options.debug;
      this._fetchImpl = options.fetchStats || this._defaultFetch.bind(this);
      return this;
    }

    /**
     * 主入口: 获取店铺统计 (含缓存 / 并发折叠)
     * @param {number|string} shopId
     * @param {boolean} forceRefresh 是否忽略缓存
     */
    async fetchShopStats(shopId, forceRefresh=false){
      if (!shopId && shopId !== 0) return { conversation_count:0, unread_count:0, stale:true };
      const key = String(shopId);
      const cached = this._cache.get(key);
      if (!forceRefresh && cached && cached.isFresh(this._ttl)) {
        return { ...cached.data, stale:false, fromCache:true };
      }
      // 并发折叠
      if (this._inFlight.has(key)) {
        return this._inFlight.get(key);
      }
      const p = (async()=>{
        try {
          const raw = await this._fetchImpl(shopId);
          const safe = {
            conversation_count: Number(raw?.conversation_count)||0,
            unread_count: Number(raw?.unread_count)||0,
            loaded_at: Date.now()
          };
          this._cache.set(key, new StatsCacheEntry(safe));
          return { ...safe, stale:false, fromCache:false };
        } catch(e){
          if (this._debug) console.warn('[ShopStatsService] 获取失败, 使用兜底 0', shopId, e);
          return { conversation_count:0, unread_count:0, stale:true, error:e?.message };
        } finally {
          this._inFlight.delete(key);
        }
      })();
      this._inFlight.set(key, p);
      return p;
    }

    /** 批量刷新 (设计占位: 后续可优化为单请求返回多 shop) */
    async refreshMany(shopIds=[]){
      const tasks = shopIds.map(id=> this.fetchShopStats(id, true));
      return Promise.all(tasks);
    }

    /** 强制失效单个缓存 */
    invalidate(shopId){ this._cache.delete(String(shopId)); }
    /** 全量失效 */
    invalidateAll(){ this._cache.clear(); }

    /** 默认单店铺获取策略: 复用现有 API (两次调用 -> 后期用聚合端点替换) */
    async _defaultFetch(shopId){
      // 若有 unifiedDataSyncManager.fetchShopStats 则直接复用 (高优先)
      if (window.unifiedDataSyncManager && typeof window.unifiedDataSyncManager.fetchShopStats === 'function') {
        return window.unifiedDataSyncManager.fetchShopStats(shopId, true);
      }
      // 回退：分别请求 conversation 列表推导 (会多次 IO, 后续需优化)
      const convCount = await this._fallbackConversationCount(shopId);
      const unread = await this._fallbackUnreadCount(shopId);
      return { conversation_count: convCount, unread_count: unread };
    }

    async _fallbackConversationCount(shopId){
      try {
        if (!window.AuthFetch) throw new Error('AuthFetch 未加载');
        const resp = await window.AuthFetch.safeJsonFetch(`/api/conversations?shop_id=${shopId}`);
        if (resp.ok && Array.isArray(resp.data)) return resp.data.length;
      } catch(e){ if (this._debug) console.warn('convCount 失败', e); }
      return 0;
    }

    async _fallbackUnreadCount(shopId){
      try {
        if (!window.AuthFetch) throw new Error('AuthFetch 未加载');
        const resp = await window.AuthFetch.safeJsonFetch(`/api/conversations?shop_id=${shopId}`);
        if (resp.ok && Array.isArray(resp.data)) {
          return resp.data.reduce((sum,c)=> sum + (c.unread_count||0), 0);
        }
      } catch(e){ if (this._debug) console.warn('unreadCount 失败', e); }
      return 0;
    }
  }

  window.ShopStatsService = new ShopStatsServiceImpl();
  console.log('✅ shop-stats-service.js 加载完成 (骨架)');
})();
