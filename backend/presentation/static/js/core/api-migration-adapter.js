/**
 * API调用迁移适配器
 * 
 * 目标：将现有的loadShops等函数无缝迁移到UnifiedApiManager
 * 策略：保持API兼容性，内部使用统一管理器
 */
(function() {
    'use strict';

    // 确保UnifiedApiManager已加载
    if (!window.UnifiedApiManager || !window.apiManager) {
        console.error('❌ API迁移失败：UnifiedApiManager未加载');
        return;
    }

    console.log('🔄 开始API调用迁移适配器初始化...');

    /**
     * 迁移状态跟踪
     */
    const migrationState = {
        loadShopsCallCount: 0,
        loadConversationsCallCount: 0,
        loadMessagesCallCount: 0,
        cacheHits: 0,
        duplicatesPrevented: 0
    };

    /**
     * 通用错误处理
     */
    function handleApiError(functionName, error) {
        console.error(`❌ ${functionName}失败:`, error);
        
        // 触发错误事件
        if (window.eventBus) {
            window.eventBus.emit('api:error', { 
                function: functionName, 
                error: error.message || error 
            });
        }

        return null;
    }

    /**
     * 通用成功处理
     */
    function handleApiSuccess(functionName, data) {
        console.log(`✅ ${functionName}成功`);
        
        // 触发成功事件
        if (window.eventBus) {
            window.eventBus.emit('api:success', { 
                function: functionName, 
                dataLength: Array.isArray(data) ? data.length : 'N/A'
            });
        }

        return data;
    }

    /**
     * 优化的loadShops函数
     */
    async function optimizedLoadShops(forceRefresh = false) {
        migrationState.loadShopsCallCount++;
        
        try {
            const startTime = Date.now();
            const result = await window.ApiUtils.getShops(forceRefresh);
            const duration = Date.now() - startTime;
            
            if (result && result.error) {
                throw new Error(result.error);
            }

            // 检查是否来自缓存
            const stats = window.apiManager.getStats();
            const wasCacheHit = duration < 50; // 小于50ms通常是缓存
            
            if (wasCacheHit) {
                migrationState.cacheHits++;
                console.log('📦 loadShops缓存命中');
            }

            console.log(`⚡ loadShops优化执行 (${duration}ms, 第${migrationState.loadShopsCallCount}次调用)`);
            
            // 更新全局状态
            if (window.shops !== result) {
                window.shops = result;
                
                // 触发数据更新事件
                if (window.eventBus) {
                    window.eventBus.emit('shops:updated', { shops: result, fromCache: wasCacheHit });
                }
            }

            return handleApiSuccess('loadShops', result);
            
        } catch (error) {
            return handleApiError('loadShops', error);
        }
    }

    /**
     * 优化的loadConversationsForShop函数
     */
    async function optimizedLoadConversationsForShop(shopId, forceRefresh = false) {
        if (!shopId) {
            console.warn('⚠️ loadConversationsForShop: shopId为空');
            return null;
        }

        migrationState.loadConversationsCallCount++;
        
        try {
            const startTime = Date.now();
            const result = await window.ApiUtils.getConversations(shopId, forceRefresh);
            const duration = Date.now() - startTime;
            
            if (result && result.error) {
                throw new Error(result.error);
            }

            const wasCacheHit = duration < 50;
            if (wasCacheHit) {
                migrationState.cacheHits++;
            }

            console.log(`⚡ loadConversationsForShop优化执行 (${duration}ms, shopId: ${shopId})`);
            
            // 更新对话管理器
            if (window.ConversationsManager) {
                const cm = window.ConversationsManager;
                if (typeof cm.setConversations === 'function') {
                    cm.setConversations(result || []);
                }
            }

            // 触发事件
            if (window.eventBus) {
                window.eventBus.emit('conversations:updated', { 
                    shopId, 
                    conversations: result, 
                    fromCache: wasCacheHit 
                });
            }

            return handleApiSuccess('loadConversationsForShop', result);
            
        } catch (error) {
            return handleApiError('loadConversationsForShop', error);
        }
    }

    /**
     * 优化的loadMessages函数
     */
    async function optimizedLoadMessages(conversationId, forceRefresh = false) {
        if (!conversationId) {
            console.warn('⚠️ loadMessages: conversationId为空');
            return null;
        }

        migrationState.loadMessagesCallCount++;
        
        try {
            const startTime = Date.now();
            const result = await window.ApiUtils.getMessages(conversationId, forceRefresh);
            const duration = Date.now() - startTime;
            
            if (result && result.error) {
                throw new Error(result.error);
            }

            const wasCacheHit = duration < 50;
            if (wasCacheHit) {
                migrationState.cacheHits++;
            }

            console.log(`⚡ loadMessages优化执行 (${duration}ms, conversationId: ${conversationId})`);
            
            // 更新消息管理器
            if (window.MessagesManager) {
                const mm = window.MessagesManager;
                if (typeof mm.setMessages === 'function') {
                    mm.setMessages(result || []);
                }
            }

            // 更新MessageStateStore
            if (window.MessageStateStore && typeof window.MessageStateStore.setMessages === 'function') {
                window.MessageStateStore.setMessages(conversationId, result || []);
            }

            // 触发事件
            if (window.eventBus) {
                window.eventBus.emit('messages:updated', { 
                    conversationId, 
                    messages: result, 
                    fromCache: wasCacheHit 
                });
            }

            return handleApiSuccess('loadMessages', result);
            
        } catch (error) {
            return handleApiError('loadMessages', error);
        }
    }

    /**
     * 智能刷新检测器
     */
    function shouldForceRefresh(lastCallTime, functionName) {
        if (!lastCallTime) return false;
        
        const elapsed = Date.now() - lastCallTime;
        const thresholds = {
            loadShops: 60000,       // 1分钟
            loadConversations: 30000, // 30秒
            loadMessages: 15000      // 15秒
        };
        
        return elapsed > (thresholds[functionName] || 30000);
    }

    /**
     * 重写全局函数
     */
    
    // 保存原始函数（如果存在）
    const originalLoadShops = window.loadShops;
    const originalLoadConversationsForShop = window.loadConversationsForShop;
    const originalLoadMessages = window.loadMessages;

    // 使用优化版本替换
    window.loadShops = optimizedLoadShops;
    window.loadConversationsForShop = optimizedLoadConversationsForShop;
    window.loadMessages = optimizedLoadMessages;

    /**
     * 批量操作优化
     */
    window.ApiMigrationUtils = {
        /**
         * 批量加载店铺数据
         */
        async batchLoadShopData(shopIds) {
            try {
                const results = await window.ApiUtils.getBatchShopStats(shopIds);
                console.log('📦 批量加载店铺数据完成:', results.length);
                return results;
            } catch (error) {
                console.error('❌ 批量加载失败:', error);
                return [];
            }
        },

        /**
         * 智能预加载
         */
        async preloadData(shopId) {
            console.log('🚀 开始智能预加载...');
            
            try {
                // 并行预加载店铺和对话数据
                const [shops, conversations] = await Promise.all([
                    window.ApiUtils.getShops(),
                    shopId ? window.ApiUtils.getConversations(shopId) : Promise.resolve([])
                ]);

                console.log('✅ 智能预加载完成');
                return { shops, conversations };
            } catch (error) {
                console.error('❌ 智能预加载失败:', error);
                return { shops: [], conversations: [] };
            }
        },

        /**
         * 获取迁移统计
         */
        getMigrationStats() {
            const apiStats = window.apiManager.getStats();
            return {
                ...migrationState,
                ...apiStats,
                optimizationRatio: migrationState.cacheHits / (migrationState.loadShopsCallCount + migrationState.loadConversationsCallCount + migrationState.loadMessagesCallCount) || 0
            };
        },

        /**
         * 重置统计
         */
        resetStats() {
            Object.keys(migrationState).forEach(key => {
                migrationState[key] = 0;
            });
            console.log('📊 迁移统计已重置');
        },

        /**
         * 调试信息
         */
        debug() {
            console.group('🔍 API迁移调试信息');
            console.log('📊 迁移统计:', this.getMigrationStats());
            console.log('🔄 原始函数保存:', {
                loadShops: !!originalLoadShops,
                loadConversationsForShop: !!originalLoadConversationsForShop,
                loadMessages: !!originalLoadMessages
            });
            window.apiManager.debug();
            console.groupEnd();
        }
    };

    /**
     * 定期统计报告
     */
    setInterval(() => {
        const stats = window.ApiMigrationUtils.getMigrationStats();
        if (stats.requestsMade > 0) {
            console.log(`📊 API优化报告: 请求${stats.requestsMade}次, 缓存命中率${(stats.cacheHitRate * 100).toFixed(1)}%, 重复防止${stats.duplicatesPrevented}次`);
        }
    }, 60000); // 每分钟报告一次

    console.log('✅ API调用迁移适配器初始化完成');

    // 自动运行优化检查
    setTimeout(() => {
        console.log('🧪 API迁移自检:', window.ApiMigrationUtils.getMigrationStats());
    }, 100);

})();