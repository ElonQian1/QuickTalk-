/**
 * ShopsManager - 店铺管理器
 * 继承自BaseManager，专门处理店铺相关的业务逻辑
 * 
 * 优化内容：
 * - 移除重复的API调用代码
 * - 使用BaseManager提供的统一接口
 * - 统一错误处理和状态管理
 */
(function() {
    'use strict';

    // 本地文本访问助手：统一获取文案，兼容尚未完全迁移阶段
    function T(key, fallback) {
        if (typeof window !== 'undefined' && typeof window.getText === 'function') {
            return window.getText(key, fallback || key);
        }
        return (window.StateTexts && window.StateTexts[key]) || fallback || key;
    }

    class ShopsManager extends BaseManager {
        constructor(options = {}) {
            super('ShopsManager', {
                debug: false,
                cacheTimeout: 300000, // 5分钟缓存
                ...options
            });

            // 店铺数据状态
            this.shops = [];
            this.currentShopId = null;
            this.selectedShop = null;

            // 回调函数
            this.callbacks = {
                onShopSelected: options.onShopSelected || (() => {}),
                onShopsLoaded: options.onShopsLoaded || (() => {}),
                onShopChanged: options.onShopChanged || (() => {})
            };

            this.log('info', '店铺管理器初始化完成');

            // 注册到状态协调器
            this.registerToStateCoordinator();
        }

        /**
         * 注册到状态协调器
         */
        registerToStateCoordinator() {
            if (typeof window.stateCoordinator !== 'undefined') {
                window.stateCoordinator.registerManager('shops', this);
                this.log('debug', '已注册到状态协调器');
            }
        }

        /**
         * 加载店铺列表
         */
        async loadShops() {
            if (this.state.loading) {
                this.log('debug', '店铺加载中，跳过重复请求');
                return this.shops;
            }

            this.log('info', '开始加载店铺列表');
            
            try {
                const data = await this.apiCall('/api/shops', {
                    method: 'GET'
                });

                if (data.success && Array.isArray(data.data)) {
                    this.shops = data.data;
                    this.log('info', `店铺加载成功，数量: ${this.shops.length}`);
                    
                    // 触发回调
                    this.callbacks.onShopsLoaded(this.shops);
                    this.emit('shops:loaded', { shops: this.shops });
                } else {
                    throw new Error(data.message || '店铺数据格式错误');
                }

                return this.shops;

            } catch (error) {
                this.log('error', '加载店铺失败:', error.message);
                this.shops = [];
                this.emit('shops:error', { error: error.message });
                throw error;
            }
        }

        /**
         * 选择店铺
         */
        selectShop(shopId) {
            const shop = this.shops.find(s => s.id === shopId);
            if (!shop) {
                this.log('warn', '店铺不存在:', shopId);
                return false;
            }

            const previousShopId = this.currentShopId;
            this.currentShopId = shopId;
            this.selectedShop = shop;

            this.log('info', '店铺已选择:', shop.name);

            // 触发回调
            this.callbacks.onShopSelected(shop);
            this.emit('shop:selected', { 
                shop, 
                previousShopId,
                currentShopId: shopId 
            });

            // 如果店铺发生变化，触发变化事件
            if (previousShopId !== shopId) {
                this.callbacks.onShopChanged(shop, previousShopId);
                this.emit('shop:changed', { shop, previousShopId, currentShopId: shopId });
            }

            return true;
        }

        /**
         * 获取当前选中的店铺
         */
        getCurrentShop() {
            return this.selectedShop;
        }

        /**
         * 获取店铺信息
         */
        getShop(shopId) {
            return this.shops.find(s => s.id === shopId);
        }

        /**
         * 获取店铺统计信息
         */
        async getShopStats(shopId) {
            if (!shopId) {
                shopId = this.currentShopId;
            }

            if (!shopId) {
                this.log('warn', '未指定店铺ID');
                return null;
            }

            try {
                const data = await this.apiCall(`/api/shops/${shopId}/stats`, {
                    method: 'GET'
                });

                if (data.success) {
                    this.log('debug', '店铺统计获取成功:', data.data);
                    return data.data;
                } else {
                    const failMsg = data.message || T('FETCH_STATS_FAIL', '获取统计失败');
                    throw new Error(failMsg);
                }

            } catch (error) {
                const txt = T('FETCH_STATS_FAIL', '获取统计失败');
                this.log('error', txt + ':', error.message);
                return null;
            }
        }

        /**
         * 获取店铺未读消息数
         */
        async getShopUnreadCount(shopId) {
            if (!shopId) {
                shopId = this.currentShopId;
            }

            if (!shopId) {
                return 0;
            }

            try {
                const data = await this.apiCall(`/api/shops/${shopId}/unread-count`, {
                    method: 'GET'
                });

                return data.success ? (data.data.count || 0) : 0;

            } catch (error) {
                const txt = T('FETCH_UNREAD_FAIL', '获取未读数失败');
                this.log('error', txt + ':', error.message);
                return 0;
            }
        }

        /**
         * 更新店铺信息
         */
        async updateShop(shopId, updateData) {
            try {
                const data = await this.apiCall(`/api/shops/${shopId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateData)
                });

                if (data.success) {
                    // 更新本地数据
                    const shopIndex = this.shops.findIndex(s => s.id === shopId);
                    if (shopIndex !== -1) {
                        this.shops[shopIndex] = { ...this.shops[shopIndex], ...data.data };
                        
                        // 如果是当前选中的店铺，更新选中数据
                        if (this.currentShopId === shopId) {
                            this.selectedShop = this.shops[shopIndex];
                        }
                    }

                    this.log('info', '店铺更新成功:', shopId);
                    this.emit('shop:updated', { shopId, data: data.data });
                    
                    return data.data;
                } else {
                    throw new Error(data.message || '更新失败');
                }

            } catch (error) {
                this.log('error', '更新店铺失败:', error.message);
                throw error;
            }
        }

        /**
         * 刷新店铺列表
         */
        async refreshShops() {
            this.clearCache(); // 清除缓存
            return this.loadShops();
        }

        /**
         * 搜索店铺
         */
        searchShops(keyword) {
            if (!keyword) {
                return this.shops;
            }

            const searchTerm = keyword.toLowerCase();
            return this.shops.filter(shop => 
                shop.name.toLowerCase().includes(searchTerm) ||
                shop.description?.toLowerCase().includes(searchTerm) ||
                shop.id.toString().includes(searchTerm)
            );
        }

        /**
         * 获取店铺数量统计
         */
        getShopsCount() {
            return {
                total: this.shops.length,
                active: this.shops.filter(s => s.status === 'active').length,
                pending: this.shops.filter(s => s.status === 'pending').length,
                inactive: this.shops.filter(s => s.status === 'inactive').length
            };
        }

        /**
         * 检查店铺权限
         */
        hasShopPermission(shopId, permission) {
            const shop = this.getShop(shopId);
            if (!shop) return false;

            // 检查用户权限（需要结合用户信息）
            return shop.permissions?.includes(permission) || false;
        }

        /**
         * 重置状态
         */
        reset() {
            this.shops = [];
            this.currentShopId = null;
            this.selectedShop = null;
            this.clearCache();
            this.log('info', '店铺管理器状态已重置');
        }

        /**
         * 获取管理器状态
         */
        getStatus() {
            return {
                ...super.getStatus(),
                shopsCount: this.shops.length,
                currentShopId: this.currentShopId,
                selectedShop: this.selectedShop?.name || null
            };
        }

        /**
         * 销毁管理器
         */
        destroy() {
            this.reset();
            super.destroy();
            this.log('info', '店铺管理器已销毁');
        }
    }

    // 暴露到全局
    window.ShopsManager = ShopsManager;

    console.log('✅ 优化的店铺管理器已加载 (继承BaseManager)');

})();