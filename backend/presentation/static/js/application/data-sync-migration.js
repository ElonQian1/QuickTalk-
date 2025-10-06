/**
 * 数据同步管理器迁移适配器 - Data Sync Migration Adapter
 * 
 * 🎯 目的：确保旧的数据同步代码平滑迁移到 UnifiedDataSyncManager
 * 
 * 迁移策略：
 * 1. 检测 UnifiedDataSyncManager 是否已加载
 * 2. 将旧的 DataSyncManager 和 RealtimeDataManager 重定向到统一版本
 * 3. 保持100%向后兼容
 * 4. 在控制台输出迁移警告
 * 
 * 已废弃的文件：
 * - data-sync-manager.js (471行) - 旧版数据同步管理器
 * - realtime-data-manager.js (81行) - 实时数据管理器兼容层
 * 
 * 统一版本：
 * - unified-data-sync-manager.js (599行) - 完整功能实现
 * 
 * @version 1.0.0
 * @date 2025-10-06
 */
(function() {
    'use strict';

    // 等待 UnifiedDataSyncManager 加载
    function waitForUnifiedDataSyncManager(callback, timeout = 5000) {
        const startTime = Date.now();
        
        const checkInterval = setInterval(() => {
            if (window.UnifiedDataSyncManager || window.unifiedDataSyncManager) {
                clearInterval(checkInterval);
                callback();
            } else if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                console.error('❌ UnifiedDataSyncManager加载超时，迁移失败');
            }
        }, 50);
    }

    // 获取统一数据同步管理器实例
    function getUnifiedInstance() {
        return window.unifiedDataSyncManager || 
               (window.getModule && window.getModule('UnifiedDataSyncManager')) ||
               null;
    }

    // 执行迁移
    waitForUnifiedDataSyncManager(() => {
        console.group('🔄 数据同步管理器迁移适配器');

        const unified = getUnifiedInstance();
        
        if (!unified) {
            console.error('❌ 无法获取 UnifiedDataSyncManager 实例');
            console.groupEnd();
            return;
        }

        // 1. 迁移 DataSyncManager
        if (window.DataSyncManager && !window.DataSyncManager.__UNIFIED__) {
            console.warn('⚠️ 检测到旧版 DataSyncManager，正在迁移到 UnifiedDataSyncManager');
            
            const OldDataSyncManager = window.DataSyncManager;
            
            // 创建兼容包装器
            function DataSyncManagerCompat() {
                console.warn('⚠️ DataSyncManager 已迁移，请使用 window.unifiedDataSyncManager');
                return unified;
            }
            
            // 复制静态方法和属性
            DataSyncManagerCompat.prototype = Object.create(unified.constructor.prototype);
            DataSyncManagerCompat.__UNIFIED__ = true;
            DataSyncManagerCompat.__MIGRATED__ = true;
            
            window.DataSyncManager = DataSyncManagerCompat;
            
            console.log('✅ DataSyncManager 迁移完成');
        }

        // 2. 迁移 RealtimeDataManager
        if (window.RealtimeDataManager && !window.RealtimeDataManager.__UNIFIED__) {
            console.warn('⚠️ 检测到旧版 RealtimeDataManager，正在迁移到 UnifiedDataSyncManager');
            
            const OldRealtimeDataManager = window.RealtimeDataManager;
            
            // 创建兼容代理
            window.RealtimeDataManager = {
                enableDebugMode: () => {
                    console.debug('🔀 RealtimeDataManager.enableDebugMode() -> UnifiedDataSyncManager');
                    unified.logger?.setLevel('debug');
                },
                
                initialize: () => {
                    console.debug('🔀 RealtimeDataManager.initialize() -> UnifiedDataSyncManager (已自动初始化)');
                    return window.RealtimeDataManager;
                },
                
                refreshAllShopStats: () => {
                    console.debug('🔀 RealtimeDataManager.refreshAllShopStats() -> UnifiedDataSyncManager');
                    const shopElements = document.querySelectorAll('[data-shop-id]');
                    shopElements.forEach(el => {
                        const shopId = el.getAttribute('data-shop-id');
                        if (shopId && !shopId.startsWith('temp-shop-')) {
                            unified.forceRefresh('shop_stats', shopId).catch(err => 
                                console.warn('刷新失败:', shopId, err)
                            );
                        }
                    });
                },
                
                refreshShopStats: (shopId) => {
                    console.debug(`🔀 RealtimeDataManager.refreshShopStats(${shopId}) -> UnifiedDataSyncManager`);
                    return unified.forceRefresh('shop_stats', shopId);
                },
                
                updateShopStatsDOM: (shopId, stats) => {
                    console.debug(`🔀 RealtimeDataManager.updateShopStatsDOM(${shopId}) -> UnifiedDataSyncManager`);
                    return unified.updateShopStatsDOM(shopId, stats);
                },
                
                updateConversationData: (conv) => {
                    console.debug('🔀 RealtimeDataManager.updateConversationData() -> UnifiedDataSyncManager');
                    const conversationId = conv?.id || conv?.conversation_id;
                    if (conversationId) {
                        return unified.forceRefresh('conversation', conversationId);
                    }
                },
                
                clearCache: () => {
                    console.debug('🔀 RealtimeDataManager.clearCache() -> UnifiedDataSyncManager');
                    return unified.clearAllCaches();
                },
                
                getDebugInfo: () => {
                    console.debug('🔀 RealtimeDataManager.getDebugInfo() -> UnifiedDataSyncManager');
                    return unified.getCacheStats();
                },
                
                __UNIFIED__: true,
                __MIGRATED__: true
            };
            
            console.log('✅ RealtimeDataManager 迁移完成');
        }

        // 3. 迁移全局辅助函数
        if (!window.refreshShopStats || !window.refreshShopStats.__UNIFIED__) {
            console.debug('🔀 迁移全局函数: refreshShopStats');
            window.refreshShopStats = function(shopId) {
                return unified.forceRefresh('shop_stats', shopId);
            };
            window.refreshShopStats.__UNIFIED__ = true;
        }

        if (!window.refreshConversation || !window.refreshConversation.__UNIFIED__) {
            console.debug('🔀 迁移全局函数: refreshConversation');
            window.refreshConversation = function(conversationId) {
                return unified.forceRefresh('conversation', conversationId);
            };
            window.refreshConversation.__UNIFIED__ = true;
        }

        if (!window.updateConversationDisplay || !window.updateConversationDisplay.__UNIFIED__) {
            console.debug('🔀 迁移全局函数: updateConversationDisplay');
            window.updateConversationDisplay = function(conversationId, data) {
                return unified.forceRefresh('conversation', conversationId);
            };
            window.updateConversationDisplay.__UNIFIED__ = true;
        }

        if (!window.updateShopStats || !window.updateShopStats.__UNIFIED__) {
            console.debug('🔀 迁移全局函数: updateShopStats');
            window.updateShopStats = function(shopId, stats) {
                return unified.updateShopStatsDOM(shopId, stats);
            };
            window.updateShopStats.__UNIFIED__ = true;
        }

        // 4. 输出迁移报告
        console.log('📊 迁移统计：');
        console.log('  - DataSyncManager:', window.DataSyncManager?.__MIGRATED__ ? '✅ 已迁移' : '⏭️ 跳过');
        console.log('  - RealtimeDataManager:', window.RealtimeDataManager?.__MIGRATED__ ? '✅ 已迁移' : '⏭️ 跳过');
        console.log('  - 统一实例:', unified ? '✅ 可用' : '❌ 不可用');
        console.log('  - 全局函数:', '✅ 已迁移 (4个)');

        console.groupEnd();

        // 5. 触发迁移完成事件
        window.dispatchEvent(new CustomEvent('qt:datasync-migrated', {
            detail: {
                timestamp: Date.now(),
                version: '1.0.0',
                unifiedInstance: !!unified,
                migratedComponents: [
                    'DataSyncManager',
                    'RealtimeDataManager',
                    'refreshShopStats',
                    'refreshConversation',
                    'updateConversationDisplay',
                    'updateShopStats'
                ]
            }
        }));
    });

    /**
     * 提供迁移检查工具
     */
    window.checkDataSyncMigration = function() {
        console.group('🔍 数据同步管理器迁移检查');
        
        const unified = getUnifiedInstance();
        
        console.log('UnifiedDataSyncManager:', unified ? '✅ 已加载' : '❌ 未加载');
        console.log('全局实例 (unifiedDataSyncManager):', window.unifiedDataSyncManager ? '✅ 存在' : '❌ 不存在');
        console.log('DataSyncManager 迁移状态:', window.DataSyncManager?.__MIGRATED__ ? '✅ 已迁移' : '❌ 未迁移');
        console.log('RealtimeDataManager 迁移状态:', window.RealtimeDataManager?.__MIGRATED__ ? '✅ 已迁移' : '❌ 未迁移');
        
        console.log('\n🔧 全局函数状态:');
        console.log('  - refreshShopStats:', window.refreshShopStats?.__UNIFIED__ ? '✅ 已迁移' : '❌ 未迁移');
        console.log('  - refreshConversation:', window.refreshConversation?.__UNIFIED__ ? '✅ 已迁移' : '❌ 未迁移');
        console.log('  - updateConversationDisplay:', window.updateConversationDisplay?.__UNIFIED__ ? '✅ 已迁移' : '❌ 未迁移');
        console.log('  - updateShopStats:', window.updateShopStats?.__UNIFIED__ ? '✅ 已迁移' : '❌ 未迁移');
        
        if (unified) {
            console.log('\n📊 统一数据同步管理器统计：');
            console.table(unified.getCacheStats());
        }
        
        console.groupEnd();
    };

    console.log('✅ 数据同步管理器迁移适配器已加载');
})();
