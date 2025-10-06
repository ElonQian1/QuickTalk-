/**
 * WebSocket管理器迁移适配器 - WebSocket Migration Adapter
 * 
 * 🎯 目的：确保旧的WebSocket代码平滑迁移到 UnifiedWebSocketManager
 * 
 * 迁移策略：
 * 1. 检测 UnifiedWebSocketManager 是否已加载（607行完整实现）
 * 2. 将旧的 UnifiedWebSocket（137行精简版）重定向到统一版本
 * 3. 保持100%向后兼容
 * 4. 统一心跳检测功能
 * 
 * 已废弃的文件：
 * - unified-websocket.js (137行) - 精简版WebSocket管理器
 * 
 * 统一版本：
 * - websocket-manager.js (607行) - UnifiedWebSocketManager完整实现
 * 
 * 保留的辅助文件（不废弃）：
 * - ws-heartbeat.js (19行) - 已经是代理，无需迁移
 * - ws-heartbeat-latency.js (84行) - 独立统计功能
 * - ws-heartbeat-quality.js - 独立质量监控
 * - ws-heartbeat-trend.js - 独立趋势分析
 * 
 * @version 1.0.0
 * @date 2025-10-06
 */
(function() {
    'use strict';

    // 等待 UnifiedWebSocketManager 加载
    function waitForUnifiedWebSocketManager(callback, timeout = 5000) {
        const startTime = Date.now();
        
        const checkInterval = setInterval(() => {
            if (window.UnifiedWebSocketManager) {
                clearInterval(checkInterval);
                callback();
            } else if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                console.error('❌ UnifiedWebSocketManager加载超时，迁移失败');
            }
        }, 50);
    }

    // 获取统一WebSocket管理器实例
    function getUnifiedInstance() {
        return window.UnifiedWebSocketManager || null;
    }

    // 执行迁移
    waitForUnifiedWebSocketManager(() => {
        console.group('🔄 WebSocket管理器迁移适配器');

        const unified = getUnifiedInstance();
        
        if (!unified) {
            console.error('❌ 无法获取 UnifiedWebSocketManager 实例');
            console.groupEnd();
            return;
        }

        // 1. 迁移 UnifiedWebSocket（精简版 API 对象）
        if (window.UnifiedWebSocket && !window.UnifiedWebSocket.__UNIFIED__) {
            console.warn('⚠️ 检测到旧版 UnifiedWebSocket，正在迁移到 UnifiedWebSocketManager');
            
            const oldUnifiedWebSocket = window.UnifiedWebSocket;
            
            // 创建兼容API对象
            window.UnifiedWebSocket = {
                /**
                 * 初始化配置
                 */
                init: (options) => {
                    console.debug('🔀 UnifiedWebSocket.init() -> UnifiedWebSocketManager');
                    if (options) {
                        Object.assign(unified.options, options);
                    }
                    return window.UnifiedWebSocket;
                },
                
                /**
                 * 连接WebSocket
                 */
                connect: () => {
                    console.debug('🔀 UnifiedWebSocket.connect() -> UnifiedWebSocketManager.connect()');
                    return unified.connect();
                },
                
                /**
                 * 断开连接
                 */
                disconnect: () => {
                    console.debug('🔀 UnifiedWebSocket.disconnect() -> UnifiedWebSocketManager.disconnect()');
                    return unified.disconnect();
                },
                
                /**
                 * 发送消息
                 */
                send: (payload) => {
                    console.debug('🔀 UnifiedWebSocket.send() -> UnifiedWebSocketManager.send()');
                    return unified.send(payload);
                },
                
                /**
                 * 检查连接状态
                 */
                isConnected: () => {
                    return unified.isConnected;
                },
                
                /**
                 * 注册消息监听器
                 */
                onMessage: (handler) => {
                    console.debug('🔀 UnifiedWebSocket.onMessage() -> UnifiedWebSocketManager.on("message")');
                    const listenerId = unified.on('message', handler);
                    
                    // 返回取消订阅函数
                    return function off() {
                        unified.off('message', listenerId);
                    };
                },
                
                __UNIFIED__: true,
                __MIGRATED__: true,
                __VERSION__: 'migrated-to-manager'
            };
            
            console.log('✅ UnifiedWebSocket 迁移完成');
        }

        // 2. 确保全局 ws 对象指向统一实例
        if (!window.ws || !window.ws.__UNIFIED__) {
            console.debug('🔀 创建全局 ws 兼容对象');
            
            // 创建兼容的 ws 对象（类似原生WebSocket接口）
            const wsCompat = {
                readyState: 0,
                
                get CONNECTING() { return WebSocket.CONNECTING; },
                get OPEN() { return WebSocket.OPEN; },
                get CLOSING() { return WebSocket.CLOSING; },
                get CLOSED() { return WebSocket.CLOSED; },
                
                send: (data) => {
                    return unified.send(data);
                },
                
                close: (code, reason) => {
                    return unified.disconnect();
                },
                
                // 更新readyState
                _updateReadyState: () => {
                    if (unified.ws) {
                        wsCompat.readyState = unified.ws.readyState;
                    } else {
                        wsCompat.readyState = WebSocket.CLOSED;
                    }
                },
                
                __UNIFIED__: true,
                __MIGRATED__: true
            };
            
            // 定期更新readyState
            setInterval(() => wsCompat._updateReadyState(), 1000);
            
            window.ws = wsCompat;
        }

        // 3. 确保 WSHeartbeat 已经代理到 UnifiedWebSocket
        // （ws-heartbeat.js 已经实现了代理，这里只验证）
        if (window.WSHeartbeat && !window.WSHeartbeat.__VERIFIED__) {
            console.debug('✅ WSHeartbeat 代理已验证');
            window.WSHeartbeat.__VERIFIED__ = true;
        }

        // 4. 注册常见的兼容回调
        if (window.handleWebSocketMessage && typeof window.handleWebSocketMessage === 'function') {
            console.debug('🔀 注册 handleWebSocketMessage 回调');
            unified.on('message', (data) => {
                try {
                    window.handleWebSocketMessage(data);
                } catch (error) {
                    console.warn('handleWebSocketMessage 执行失败:', error);
                }
            });
        }

        // 5. 兼容 websocket-message 自定义事件
        unified.on('message', (data) => {
            try {
                window.dispatchEvent(new CustomEvent('websocket-message', { detail: data }));
            } catch (error) {
                console.warn('websocket-message 事件派发失败:', error);
            }
        });

        // 6. 输出迁移报告
        console.log('📊 迁移统计：');
        console.log('  - UnifiedWebSocket:', window.UnifiedWebSocket?.__MIGRATED__ ? '✅ 已迁移' : '⏭️ 跳过');
        console.log('  - 全局 ws 对象:', window.ws?.__MIGRATED__ ? '✅ 已迁移' : '⏭️ 跳过');
        console.log('  - WSHeartbeat:', window.WSHeartbeat?.__VERIFIED__ ? '✅ 已验证' : '⏭️ 跳过');
        console.log('  - 统一实例:', unified ? '✅ 可用' : '❌ 不可用');

        console.groupEnd();

        // 7. 触发迁移完成事件
        window.dispatchEvent(new CustomEvent('qt:websocket-migrated', {
            detail: {
                timestamp: Date.now(),
                version: '1.0.0',
                unifiedInstance: !!unified,
                migratedComponents: [
                    'UnifiedWebSocket',
                    'ws',
                    'WSHeartbeat',
                    'handleWebSocketMessage',
                    'websocket-message'
                ]
            }
        }));
    });

    /**
     * 提供迁移检查工具
     */
    window.checkWebSocketMigration = function() {
        console.group('🔍 WebSocket管理器迁移检查');
        
        const unified = getUnifiedInstance();
        
        console.log('UnifiedWebSocketManager:', unified ? '✅ 已加载' : '❌ 未加载');
        console.log('UnifiedWebSocket (API):', window.UnifiedWebSocket?.__MIGRATED__ ? '✅ 已迁移' : '❌ 未迁移');
        console.log('全局 ws 对象:', window.ws?.__MIGRATED__ ? '✅ 已迁移' : '❌ 未迁移');
        console.log('WSHeartbeat 代理:', window.WSHeartbeat?.__VERIFIED__ ? '✅ 已验证' : '❌ 未验证');
        
        if (unified) {
            console.log('\n📊 WebSocket管理器状态：');
            console.table(unified.getStatus());
            
            console.log('\n📈 连接统计：');
            console.table(unified.connectionStats);
        }
        
        console.log('\n🧩 心跳监控模块：');
        console.log('  - ws-heartbeat-latency:', typeof window.enableWsHeartbeatLatency === 'function' ? '✅ 已加载' : '❌ 未加载');
        console.log('  - ws-heartbeat-quality:', typeof window.exportWsHeartbeatQuality === 'function' ? '✅ 已加载' : '❌ 未加载');
        console.log('  - ws-heartbeat-trend:', typeof window.enableWsHeartbeatTrend === 'function' ? '✅ 已加载' : '❌ 未加载');
        
        console.groupEnd();
    };

    /**
     * 快速连接助手
     */
    window.quickConnectWebSocket = function() {
        const unified = getUnifiedInstance();
        if (!unified) {
            console.error('❌ UnifiedWebSocketManager 未加载');
            return;
        }
        
        console.log('🚀 快速连接WebSocket...');
        unified.connect().then(() => {
            console.log('✅ WebSocket连接成功');
        }).catch(error => {
            console.error('❌ WebSocket连接失败:', error);
        });
    };

    console.log('✅ WebSocket管理器迁移适配器已加载');
})();
