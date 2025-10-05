/**
 * ShopsManager - 店铺业务管理器
 * 职责：店铺列表加载、店铺选择、店铺统计、店铺卡片渲染
 * 依赖：AuthHelper, Notify, UIStates
 */
(function() {
    'use strict';

    class ShopsManager {
        constructor(options = {}) {
            this.shops = [];
            this.activeShopId = null;
            this.onShopSelected = options.onShopSelected || ((shop) => {});
            this.debug = options.debug || false;
        }

        /**
         * 内部统一获取鉴权请求头，优先使用 AuthHelper
         */
        _authHeaders(extra){
            try {
                if (window.AuthHelper && typeof window.AuthHelper.getHeaders === 'function') {
                    const base = window.AuthHelper.getHeaders();
                    return Object.assign({}, base, extra||{});
                }
            } catch(_){ }
            const token = (window.getAuthToken ? window.getAuthToken() : '');
            const fallback = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json' } : { 'Content-Type':'application/json' };
            return Object.assign({}, fallback, extra||{});
        }

        /**
         * 加载并显示店铺列表
         */
        async loadAndShowShops() {
            try {
                const shops = await this.fetchShops();
                const activeShops = this.filterActiveShops(shops);
                this.shops = activeShops;
                
                if (this.debug) {
                    console.log(`[ShopsManager] 加载店铺 ${activeShops.length}/${shops.length}`);
                }
                
                await this.renderShopsList();
                return activeShops;
            } catch (error) {
                console.error('[ShopsManager] 获取店铺列表失败:', error);
                this.shops = [];
                await this.renderShopsList();
                if (window.Notify) {
                    window.Notify.error('获取店铺列表失败', error.message);
                }
                throw error;
            }
        }

        /**
         * 获取店铺数据
         */
        async fetchShops() {
            if (typeof window.fetchShops === 'function') {
                return await window.fetchShops();
            }
            // 统一授权 + JSON 解析
            try {
                if (window.AuthHelper && window.AuthHelper.safeJson){
                    const r = await window.AuthHelper.safeJson('/api/shops');
                    if (r.ok) return Array.isArray(r.data) ? r.data : [];
                    throw new Error(r.error || '获取店铺数据失败');
                }
            } catch(e){ throw e; }
            // 最终兜底：保持原逻辑
            const resp = await fetch('/api/shops', { headers: this._authHeaders() });
            const data = await resp.json();
            if (data.success && data.data) return Array.isArray(data.data)? data.data: [];
            throw new Error(data.error || '获取店铺数据失败');
        }

        /**
         * 过滤活跃店铺
         */
        filterActiveShops(shops) {
            const filterFn = (typeof window.getActiveShops === 'function') 
                ? window.getActiveShops 
                : (shops) => shops.filter(shop => shop.status === 'active' || shop.is_approved);
            
            return filterFn(Array.isArray(shops) ? shops : []);
        }

        /**
         * 渲染店铺列表
         */
        async renderShopsList() {
            // 确保容器存在
            await this.ensureContainer();
            
            const container = document.getElementById('shopsListView');
            if (!container) {
                console.warn('[ShopsManager] shopsListView 容器不存在');
                return;
            }

            container.innerHTML = '';

            if (this.shops.length === 0) {
                this.renderEmptyState(container);
                return;
            }

            const grid = document.createElement('div');
            grid.className = 'shop-grid';

            // 渲染店铺卡片
            for (const shop of this.shops) {
                const card = await this.createShopCard(shop);
                grid.appendChild(card);
            }

            container.appendChild(grid);
        }

        /**
         * 确保容器存在（支持动态片段加载）
         */
        async ensureContainer() {
            try {
                if (window.PartialsLoader && typeof window.PartialsLoader.loadPartials === 'function') {
                    await window.PartialsLoader.loadPartials();
                }
            } catch(e) {
                // 忽略片段加载错误
            }
            
            // 等待容器渲染
            let retries = 3;
            while (retries > 0 && !document.getElementById('shopsListView')) {
                await new Promise(resolve => setTimeout(resolve, 50));
                retries--;
            }
        }

        /**
         * 渲染空状态
         */
        renderEmptyState(container) {
            // 优先使用统一 EmptyState 组件
            try {
                if (window.EmptyState && typeof window.EmptyState.shops === 'function') {
                    window.EmptyState.shops(container); return;
                }
                if (window.UIStates && window.UIStates.showEmpty) {
                    window.UIStates.showEmpty(container, '暂无可用店铺', '只有审核通过的店铺才会在此显示');
                    return;
                }
            } catch(_){}
            // 最终降级（保留原 HTML 以兼容旧样式）
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">🏪</div><h3>暂无可用店铺</h3><p>只有审核通过的店铺才会在此显示；请在店铺通过审核后再来处理客服消息</p></div>';
        }

        /**
         * 创建店铺卡片
         */
        async createShopCard(shop) {
            const stats = await this.getShopStats(shop.id);
            const hasConversations = stats.conversationCount > 0;

            const cardData = {
                ...shop,
                unreadCount: stats.unreadCount,
                conversationCount: stats.conversationCount
            };

            const options = {
                hasConversations,
                onClick: () => this.selectShop(shop),
                actionsHTML: ''
            };

            // 优先使用UI组件
            if (window.ShopCardUI && typeof window.ShopCardUI.build === 'function') {
                const card = window.ShopCardUI.build(cardData, options);
                
                // 异步刷新统计数据
                setTimeout(() => {
                    this.refreshShopStats(shop.id).catch(() => {});
                }, 500);
                
                return card;
            }

            // 降级：简单实现
            return this.createFallbackShopCard(shop, stats, hasConversations);
        }

        /**
         * 获取店铺统计数据
         */
        async getShopStats(shopId) {
            try {
                // 优先使用统一数据管理器
                if (window.unifiedDataSyncManager && 
                    typeof window.unifiedDataSyncManager.fetchShopStats === 'function') {
                    const stats = await window.unifiedDataSyncManager.fetchShopStats(shopId, true);
                    return {
                        conversationCount: stats?.conversation_count || 0,
                        unreadCount: stats?.unread_count || 0
                    };
                }

                // 降级：并行获取统计
                const [conversationCount, unreadCount] = await Promise.all([
                    this.getShopConversationCount(shopId),
                    this.getShopUnreadCount(shopId)
                ]);

                return { conversationCount, unreadCount };
            } catch (error) {
                console.warn('[ShopsManager] 获取店铺统计失败:', shopId, error);
                return { conversationCount: 0, unreadCount: 0 };
            }
        }

        /**
         * 获取店铺对话数量
         */
        async getShopConversationCount(shopId) {
            try {
                if (window.AuthHelper && window.AuthHelper.safeJson){
                    const r = await window.AuthHelper.safeJson(`/api/conversations?shop_id=${shopId}`);
                    if (r.ok && Array.isArray(r.data)) return r.data.length;
                    return 0;
                }
                const response = await fetch(`/api/conversations?shop_id=${shopId}`, { headers: this._authHeaders() });
                const data = await response.json();
                return (data.success && data.data) ? data.data.length : 0;
            } catch (error) { console.error('[ShopsManager] 获取店铺对话数量失败:', error); return 0; }
        }

        /**
         * 获取店铺未读数量
         */
        async getShopUnreadCount(shopId) {
            try {
                if (window.AuthHelper && window.AuthHelper.safeJson){
                    const r = await window.AuthHelper.safeJson(`/api/conversations?shop_id=${shopId}`);
                    if (r.ok && Array.isArray(r.data)) return r.data.reduce((sum, conv)=> sum + (conv.unread_count||0), 0);
                    return 0;
                }
                const response = await fetch(`/api/conversations?shop_id=${shopId}`, { headers: this._authHeaders() });
                const data = await response.json();
                if (data.success && data.data) return data.data.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
                return 0;
            } catch (error) { console.error('[ShopsManager] 获取店铺未读数量失败:', error); return 0; }
        }

        /**
         * 创建降级店铺卡片
         */
        createFallbackShopCard(shop, stats, hasConversations) {
            const shopCard = document.createElement('div');
            shopCard.className = `shop-card ${!hasConversations ? 'shop-card-inactive' : ''}`;
            shopCard.setAttribute('data-shop-id', shop.id);
            
            shopCard.innerHTML = `
                <div class="shop-header">
                    <div class="shop-icon">${shop.name.charAt(0)}</div>
                </div>
                <div class="shop-name">
                    ${shop.name}
                    <span class="unread-count" data-unread="${stats.unreadCount}" 
                          style="display: ${stats.unreadCount > 0 ? 'inline' : 'none'};">
                        ${stats.unreadCount > 0 ? `(${stats.unreadCount})` : ''}
                    </span>
                </div>
                <div class="shop-domain">${shop.domain || '未设置域名'}</div>
            `;

            shopCard.addEventListener('click', () => this.selectShop(shop));
            return shopCard;
        }

        /**
         * 选择店铺
         */
        async selectShop(shop) {
            if (this.debug) {
                console.log('[ShopsManager] 选择店铺:', shop.name, shop.id);
            }

            this.activeShopId = shop.id;

            // 检查是否有对话
            const stats = await this.getShopStats(shop.id);
            const hasConversations = stats.conversationCount > 0;

            if (!hasConversations && window.Notify) {
                window.Notify.info(`店铺 "${shop.name}" 暂无客户对话，等待客户发起对话`);
            }

            // 触发回调
            try {
                await this.onShopSelected(shop, stats);
            } catch (error) {
                console.error('[ShopsManager] 店铺选择回调错误:', error);
            }
        }

        /**
         * 刷新店铺统计数据
         */
        async refreshShopStats(shopId) {
            if (window.DataSyncManager && 
                typeof window.DataSyncManager.forceRefreshShopStats === 'function') {
                try {
                    await window.DataSyncManager.forceRefreshShopStats(shopId);
                } catch (error) {
                    console.warn('[ShopsManager] 刷新统计失败:', shopId, error);
                }
            }
        }

        /**
         * 获取当前选中的店铺ID
         */
        getActiveShopId() {
            return this.activeShopId;
        }

        /**
         * 重置状态
         */
        reset() {
            this.shops = [];
            this.activeShopId = null;
        }

        /**
         * 销毁管理器
         */
        destroy() {
            this.reset();
            this.onShopSelected = null;
        }
    }

    // 暴露到全局
    window.ShopsManager = ShopsManager;
    
    console.log('✅ 店铺管理器已加载 (shops-manager.js)');
})();