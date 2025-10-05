/**
 * ShopsManagerRefactored - 店铺管理器重构版
 * 职责：专门处理店铺相关的业务逻辑，包括加载、选择、统计等
 * 独立模块，可重用于不同页面
 */
(function() {
    'use strict';

    class ShopsManagerRefactored {
        constructor(options = {}) {
            this.options = {
                onShopSelected: options.onShopSelected || (() => {}),
                onShopsLoaded: options.onShopsLoaded || (() => {}),
                debug: options.debug || false,
                ...options
            };
            
            this.shops = [];
            this.currentShopId = null;
            this.loading = false;
            this.error = null;
        }

        /**
         * 初始化店铺管理器
         */
        async init() {
            if (this.options.debug) {
                console.log('[ShopsManagerRefactored] 初始化店铺管理器');
            }
            
            await this.loadShops();
        }

        /**
         * 加载店铺列表
         */
        async loadShops() {
            if (this.loading) return this.shops;
            
            this.loading = true;
            this.error = null;
            
            try {
                console.log('[ShopsManagerRefactored] 开始加载店铺列表');

                const response = await fetch('/api/shops', {
                    headers: this.getAuthHeaders()
                });
                
                if (response.status === 401) {
                    console.warn('[ShopsManagerRefactored] 收到401未授权错误');
                    this.error = '登录已过期，请重新登录';
                    this.shops = [];
                    
                    // 尝试重新检查登录状态
                    if (typeof window.checkLoginStatus === 'function') {
                        setTimeout(() => window.checkLoginStatus(), 1000);
                    }
                    return this.shops;
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('[ShopsManagerRefactored] API响应:', data);
                
                if (data.success && Array.isArray(data.data)) {
                    this.shops = this.filterActiveShops(data.data);
                    this.options.onShopsLoaded(this.shops);
                    
                    console.log('[ShopsManagerRefactored] 店铺加载成功，数量:', this.shops.length);
                } else {
                    this.error = data.error || '获取店铺列表失败';
                    console.error('[ShopsManagerRefactored] 获取店铺失败:', this.error);
                    this.shops = [];
                }
            } catch (error) {
                this.error = '网络错误: ' + error.message;
                console.error('[ShopsManagerRefactored] 网络错误:', error);
                this.shops = [];
            } finally {
                this.loading = false;
            }
            
            return this.shops;
        }

        /**
         * 选择店铺
         */
        async selectShop(shop) {
            if (!shop || !shop.id) {
                console.warn('[ShopsManagerRefactored] 无效的店铺对象');
                return;
            }
            
            this.currentShopId = shop.id;
            
            try {
                // 获取店铺统计信息
                const stats = await this.getShopStats(shop.id);
                
                if (this.options.debug) {
                    console.log('[ShopsManagerRefactored] 店铺选择:', shop.name, stats);
                }
                
                // 触发回调
                this.options.onShopSelected(shop, stats);
                
                return { shop, stats };
            } catch (error) {
                console.error('[ShopsManagerRefactored] 选择店铺失败:', error);
                throw error;
            }
        }

        /**
         * 获取店铺统计信息
         */
        async getShopStats(shopId) {
            try {
                const [conversationCount, unreadCount] = await Promise.all([
                    this.getShopConversationCount(shopId),
                    this.getShopUnreadCount(shopId)
                ]);
                
                return {
                    conversationCount,
                    unreadCount,
                    hasConversations: conversationCount > 0
                };
            } catch (error) {
                console.warn('[ShopsManagerRefactored] 获取店铺统计失败:', error);
                return {
                    conversationCount: 0,
                    unreadCount: 0,
                    hasConversations: false
                };
            }
        }

        /**
         * 获取店铺对话数量
         */
        async getShopConversationCount(shopId) {
            try {
                const response = await fetch(`/api/conversations?shop_id=${shopId}`, {
                    headers: this.getAuthHeaders()
                });
                const data = await response.json();
                return (data.success && data.data) ? data.data.length : 0;
            } catch (error) {
                console.error('[ShopsManagerRefactored] 获取对话数量失败:', error);
                return 0;
            }
        }

        /**
         * 获取店铺未读数量
         */
        async getShopUnreadCount(shopId) {
            try {
                const response = await fetch(`/api/conversations?shop_id=${shopId}`, {
                    headers: this.getAuthHeaders()
                });
                const data = await response.json();
                if (data.success && data.data) {
                    return data.data.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
                }
                return 0;
            } catch (error) {
                console.error('[ShopsManagerRefactored] 获取未读数量失败:', error);
                return 0;
            }
        }

        /**
         * 渲染店铺列表
         */
        async renderShopsList() {
            console.log('[ShopsManagerRefactored] 开始渲染店铺列表');
            
            if (this.shops.length === 0) {
                console.log('[ShopsManagerRefactored] 店铺列表为空，先加载店铺');
                await this.loadShops();
            }
            
            // 确保片段已加载
            try {
                if (window.PartialsLoader && typeof window.PartialsLoader.loadPartials === 'function') {
                    console.log('[ShopsManagerRefactored] 开始加载页面组件...');
                    await window.PartialsLoader.loadPartials();
                    console.log('[ShopsManagerRefactored] 页面组件加载完成');
                }
            } catch(e) {
                console.warn('[ShopsManagerRefactored] 片段加载器不可用:', e);
            }

            let container = document.getElementById('shopsListView');
            if (!container) {
                console.log('[ShopsManagerRefactored] shopsListView 容器未找到，延迟重试...');
                // 延迟重试，给组件加载更多时间
                await new Promise(r => setTimeout(r, 500));
                container = document.getElementById('shopsListView');
            }
            
            if (!container) {
                console.error('[ShopsManagerRefactored] shopsListView 容器仍未找到，无法渲染店铺列表');
                throw new Error('找不到店铺列表容器 #shopsListView');
            }

            console.log('[ShopsManagerRefactored] 找到容器，开始渲染内容');
            container.innerHTML = '';

            if (this.loading) {
                container.innerHTML = this.renderLoadingState();
                return;
            }

            if (this.error) {
                container.innerHTML = this.renderErrorState();
                return;
            }

            if (this.shops.length === 0) {
                container.innerHTML = this.renderEmptyState();
                return;
            }

            const shopsGrid = document.createElement('div');
            shopsGrid.className = 'shop-grid';

            // 创建店铺卡片
            for (const shop of this.shops) {
                const shopCard = await this.createShopCard(shop);
                shopsGrid.appendChild(shopCard);
            }

            container.appendChild(shopsGrid);
        }

        /**
         * 创建单个店铺卡片
         */
        async createShopCard(shop) {
            const stats = await this.getShopStats(shop.id);
            const hasConversations = stats.conversationCount > 0;
            
            const onCardClick = async () => {
                if (hasConversations) {
                    await this.selectShop(shop);
                } else {
                    this.showToast(`店铺 "${shop.name}" 暂无客户对话，等待客户发起对话`, 'info');
                    await this.selectShop(shop);
                }
            };

            // 优先使用组件化店铺卡片
            if (window.ShopCardUI && typeof window.ShopCardUI.build === 'function') {
                return window.ShopCardUI.build(
                    { ...shop, unreadCount: stats.unreadCount }, 
                    { hasConversations, onClick: onCardClick, actionsHTML: '' }
                );
            }

            // 降级：简单卡片实现
            const shopCard = document.createElement('div');
            shopCard.className = `shop-card ${!hasConversations ? 'shop-card-inactive' : ''}`;
            shopCard.setAttribute('data-shop-id', shop.id);
            shopCard.innerHTML = `
                <div class="shop-header">
                    <div class="shop-icon">${shop.name.charAt(0)}</div>
                </div>
                <div class="shop-name">
                    ${shop.name}
                </div>
                <div class="shop-domain">${shop.domain || '未设置域名'}</div>
                <div class="shop-unread-badge" data-unread="${stats.unreadCount || 0}" 
                     style="display: ${stats.unreadCount > 0 ? 'flex' : 'none'};">
                    <span class="unread-number">${stats.unreadCount || 0}</span>
                    <span class="unread-label">未读</span>
                </div>
            `;
            shopCard.addEventListener('click', onCardClick);
            
            return shopCard;
        }

        /**
         * 过滤活跃店铺
         */
        filterActiveShops(shops) {
            if (typeof window.getActiveShops === 'function') {
                return window.getActiveShops(shops);
            }
            // 默认返回所有店铺
            return shops.filter(shop => shop && shop.id);
        }

        /**
         * 渲染加载状态
         */
        renderLoadingState() {
            if (window.LoadingStatesUI && typeof window.LoadingStatesUI.spinner === 'function') {
                return window.LoadingStatesUI.spinner('正在加载店铺...').outerHTML;
            }
            return '<div class="loading-state">正在加载店铺...</div>';
        }

        /**
         * 渲染错误状态
         */
        renderErrorState() {
            if (window.ErrorStatesUI && typeof window.ErrorStatesUI.error === 'function') {
                return window.ErrorStatesUI.error('加载失败', this.error).outerHTML;
            }
            return `<div class="error-state">加载失败: ${this.error}</div>`;
        }

        /**
         * 渲染空状态
         */
        renderEmptyState() {
            return `
                <div class="empty-state">
                    <div class="empty-icon">🏪</div>
                    <h3>暂无可用店铺</h3>
                    <p>只有审核通过的店铺才会在此显示；请在店铺通过审核后再来处理客服消息</p>
                </div>
            `;
        }

        /**
         * 获取认证头部
         */
        getAuthHeaders() {
            return window.getAuthHeaders();
        }

        /**
         * 获取认证token
         */
        getAuthToken() {
            return window.getAuthToken();
        }

        /**
         * 显示提示消息
         */
        showToast(message, type = 'info') {
            window.showToast(message, type);
        }

        /**
         * 刷新店铺数据
         */
        async refresh() {
            this.shops = [];
            await this.loadShops();
            await this.renderShopsList();
        }

        /**
         * 销毁管理器
         */
        destroy() {
            this.shops = [];
            this.currentShopId = null;
            this.loading = false;
            this.error = null;
        }
    }

    // 暴露到全局
    window.ShopsManagerRefactored = ShopsManagerRefactored;

    console.log('✅ 店铺管理器重构版已加载 (shops-manager-refactored.js)');

})();