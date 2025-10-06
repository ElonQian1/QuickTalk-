/**
 * 事件总线迁移适配器 - Event Bus Migration Adapter
 * 
 * 🎯 目的：确保旧代码平滑迁移到 UnifiedEventBus
 * 
 * 迁移策略：
 * 1. 检测 UnifiedEventBus 是否已加载
 * 2. 将旧的 EventBus 和 MessageEventBus 重定向到统一版本
 * 3. 保持100%向后兼容
 * 4. 在控制台输出迁移警告
 * 
 * @version 1.0.0
 * @date 2025-10-06
 */
(function() {
    'use strict';

    // 等待 UnifiedEventBus 加载
    function waitForUnifiedEventBus(callback, timeout = 5000) {
        const startTime = Date.now();
        
        const checkInterval = setInterval(() => {
            if (window.UnifiedEventBus && window.eventBus) {
                clearInterval(checkInterval);
                callback();
            } else if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                console.error('❌ UnifiedEventBus加载超时，迁移失败');
            }
        }, 50);
    }

    // 执行迁移
    waitForUnifiedEventBus(() => {
        console.group('🔄 事件总线迁移适配器');

        // 1. 迁移 EventBus (传统事件总线)
        if (window.EventBus && !window.EventBus.__UNIFIED__) {
            console.warn('⚠️ 检测到旧版 EventBus，正在迁移到 UnifiedEventBus');
            
            const oldEventBus = window.EventBus;
            
            // 创建兼容包装器
            window.EventBus = class EventBusCompat extends window.UnifiedEventBus {
                constructor(options) {
                    super(options);
                    console.warn('⚠️ EventBus 已迁移到 UnifiedEventBus，请更新代码使用 window.eventBus');
                }
            };
            
            window.EventBus.__UNIFIED__ = true;
            window.EventBus.__MIGRATED__ = true;
            
            console.log('✅ EventBus 迁移完成');
        }

        // 2. 迁移 MessageEventBus (消息域事件总线)
        if (window.MessageEventBus && !window.MessageEventBus.__UNIFIED__) {
            console.warn('⚠️ 检测到旧版 MessageEventBus，正在迁移到 UnifiedEventBus');
            
            const oldMessageEventBus = window.MessageEventBus;
            
            // 重定向到统一事件总线
            window.MessageEventBus = {
                subscribe: (event, handler) => {
                    console.debug(`🔀 MessageEventBus.subscribe("${event}") -> UnifiedEventBus.subscribe`);
                    return window.eventBus.subscribe(event, handler);
                },
                publish: (event, payload) => {
                    console.debug(`🔀 MessageEventBus.publish("${event}") -> UnifiedEventBus.publish`);
                    window.eventBus.publish(event, payload);
                },
                once: (event, handler) => {
                    console.debug(`🔀 MessageEventBus.once("${event}") -> UnifiedEventBus.once`);
                    return window.eventBus.once(event, handler);
                },
                off: (event, handler) => {
                    console.debug(`🔀 MessageEventBus.off("${event}") -> UnifiedEventBus.off`);
                    window.eventBus.off(event, handler);
                },
                __UNIFIED__: true,
                __MIGRATED__: true
            };
            
            console.log('✅ MessageEventBus 迁移完成');
        }

        // 3. 确保全局 eventBus 实例存在
        if (!window.eventBus) {
            console.warn('⚠️ 全局 eventBus 不存在，创建新实例');
            window.eventBus = new window.UnifiedEventBus({
                debug: window.QT_CONFIG?.debug || false,
                domBridge: window.QT_CONFIG?.features?.messageDomBridge || false
            });
        }

        // 4. 输出迁移报告
        console.log('📊 迁移统计：');
        console.log('  - EventBus:', window.EventBus?.__MIGRATED__ ? '✅ 已迁移' : '⏭️ 跳过');
        console.log('  - MessageEventBus:', window.MessageEventBus?.__MIGRATED__ ? '✅ 已迁移' : '⏭️ 跳过');
        console.log('  - 统一实例:', window.eventBus ? '✅ 可用' : '❌ 不可用');

        console.groupEnd();

        // 5. 触发迁移完成事件
        window.dispatchEvent(new CustomEvent('qt:eventbus-migrated', {
            detail: {
                timestamp: Date.now(),
                version: '1.0.0',
                unifiedEventBus: !!window.UnifiedEventBus,
                globalInstance: !!window.eventBus
            }
        }));
    });

    /**
     * 提供迁移检查工具
     */
    window.checkEventBusMigration = function() {
        console.group('🔍 事件总线迁移检查');
        
        console.log('UnifiedEventBus:', window.UnifiedEventBus ? '✅ 已加载' : '❌ 未加载');
        console.log('全局实例 (eventBus):', window.eventBus ? '✅ 存在' : '❌ 不存在');
        console.log('EventBus 迁移状态:', window.EventBus?.__MIGRATED__ ? '✅ 已迁移' : '❌ 未迁移');
        console.log('MessageEventBus 迁移状态:', window.MessageEventBus?.__MIGRATED__ ? '✅ 已迁移' : '❌ 未迁移');
        
        if (window.eventBus) {
            console.log('\n📊 统一事件总线统计：');
            console.table(window.eventBus.getStats());
            
            console.log('\n📋 当前事件列表：');
            console.log(window.eventBus.getEvents());
        }
        
        console.groupEnd();
    };

    console.log('✅ 事件总线迁移适配器已加载');
})();
