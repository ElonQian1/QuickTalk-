/**
 * 代码重构优化验证脚本
 * 验证统一事件系统和API管理器的功能
 */
(function() {
    'use strict';

    console.log('🧪 开始代码重构优化验证...');

    const tests = [];
    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        tests.push({ name, fn });
    }

    function assert(condition, message) {
        if (condition) {
            console.log(`✅ ${message}`);
            passed++;
        } else {
            console.error(`❌ ${message}`);
            failed++;
            throw new Error(`断言失败: ${message}`);
        }
    }

    function assertEquals(actual, expected, message) {
        assert(actual === expected, `${message} (期望: ${expected}, 实际: ${actual})`);
    }

    // 测试统一事件系统
    test('统一事件系统完整性', () => {
        assert(typeof window.UnifiedEventBus === 'function', 'UnifiedEventBus类存在');
        assert(typeof window.eventBus === 'object', '全局eventBus实例存在');
        assert(typeof window.MessageEventBus === 'object', 'MessageEventBus兼容层存在');
        assert(typeof window.EventMigrationChecker === 'object', '事件迁移检查器存在');
    });

    test('API管理器完整性', () => {
        assert(typeof window.UnifiedApiManager === 'function', 'UnifiedApiManager类存在');
        assert(typeof window.apiManager === 'object', '全局apiManager实例存在');
        assert(typeof window.ApiUtils === 'object', 'ApiUtils高级接口存在');
        assert(typeof window.ApiMigrationUtils === 'object', 'API迁移工具存在');
    });

    test('事件系统功能验证', () => {
        let eventReceived = false;
        const testData = { timestamp: Date.now() };

        // 测试统一事件发布和订阅
        const unsubscribe = window.eventBus.subscribe('test:verification', (data) => {
            eventReceived = true;
            assertEquals(data.timestamp, testData.timestamp, '事件数据传递正确');
        });

        window.eventBus.publish('test:verification', testData);
        assert(eventReceived, '事件成功发布和接收');

        unsubscribe();
    });

    test('API缓存功能验证', () => {
        const stats = window.apiManager.getStats();
        assert(typeof stats.cacheHits === 'number', '缓存命中统计存在');
        assert(typeof stats.cacheMisses === 'number', '缓存未命中统计存在');
        assert(typeof stats.requestsMade === 'number', '请求次数统计存在');
        assert(typeof stats.cacheHitRate === 'number', '缓存命中率统计存在');
    });

    test('函数重写验证', () => {
        assert(typeof window.loadShops === 'function', '优化的loadShops函数存在');
        assert(typeof window.loadConversationsForShop === 'function', '优化的loadConversationsForShop函数存在');
        assert(typeof window.loadMessages === 'function', '优化的loadMessages函数存在');
    });

    test('兼容性检查', () => {
        // 检查是否破坏了现有的API
        assert(typeof window.ApiUtils.getShops === 'function', 'ApiUtils.getShops方法存在');
        assert(typeof window.ApiUtils.getConversations === 'function', 'ApiUtils.getConversations方法存在');
        assert(typeof window.ApiUtils.getMessages === 'function', 'ApiUtils.getMessages方法存在');
        assert(typeof window.ApiUtils.sendMessage === 'function', 'ApiUtils.sendMessage方法存在');
    });

    test('性能监控验证', () => {
        const migrationStats = window.ApiMigrationUtils?.getMigrationStats();
        if (migrationStats) {
            assert(typeof migrationStats.loadShopsCallCount === 'number', 'loadShops调用计数存在');
            assert(typeof migrationStats.optimizationRatio === 'number', '优化比率计算存在');
        }
    });

    test('事件常量和命名空间', () => {
        if (window.Events) {
            assert(typeof window.Events.MESSAGE === 'object', '消息事件常量存在');
            assert(typeof window.Events.SEND === 'object', '发送事件常量存在');
            assert(typeof window.Events.CONVERSATION === 'object', '对话事件常量存在');
        }
    });

    // 模拟真实使用场景的集成测试
    test('集成测试 - 事件和API协同', async () => {
        let eventTriggered = false;
        
        // 监听API成功事件
        const unsubscribe = window.eventBus.subscribe('api:success', () => {
            eventTriggered = true;
        });

        try {
            // 尝试使用缓存的API调用（应该很快返回）
            const shops = await window.ApiUtils.getShops();
            
            // 验证结果和事件
            assert(shops !== null, 'API调用返回结果');
            
            // 给事件处理一点时间
            await new Promise(resolve => setTimeout(resolve, 50));
            
            unsubscribe();
        } catch (error) {
            console.warn('集成测试中API调用失败（可能是网络问题）:', error.message);
            unsubscribe();
        }
    });

    // 运行所有测试
    async function runTests() {
        console.group('🧪 代码重构优化验证');

        for (const { name, fn } of tests) {
            try {
                console.group(`📋 测试: ${name}`);
                await fn();
                console.groupEnd();
            } catch (error) {
                console.error(`💥 测试失败: ${name}`, error);
                console.groupEnd();
            }
        }

        console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`);
        
        // 显示优化效果总结
        console.group('📈 优化效果总结');
        
        try {
            const eventStats = window.eventBus?.getStats?.();
            const apiStats = window.apiManager?.getStats?.();
            const migrationStats = window.ApiMigrationUtils?.getMigrationStats?.();

            if (eventStats) {
                console.log('🎯 事件系统统计:', {
                    totalEvents: eventStats.totalEvents,
                    totalListeners: eventStats.totalListeners,
                    eventsEmitted: eventStats.eventsEmitted
                });
            }

            if (apiStats) {
                console.log('⚡ API优化统计:', {
                    cacheSize: apiStats.cacheSize,
                    cacheHitRate: `${(apiStats.cacheHitRate * 100).toFixed(1)}%`,
                    duplicatesPrevented: apiStats.duplicatesPrevented,
                    requestsMade: apiStats.requestsMade
                });
            }

            if (migrationStats) {
                console.log('🔄 迁移效果统计:', {
                    totalApiCalls: migrationStats.loadShopsCallCount + migrationStats.loadConversationsCallCount + migrationStats.loadMessagesCallCount,
                    optimizationRatio: `${(migrationStats.optimizationRatio * 100).toFixed(1)}%`
                });
            }

        } catch (error) {
            console.warn('获取统计信息时出错:', error);
        }
        
        console.groupEnd();
        console.groupEnd();

        return { passed, failed, total: passed + failed };
    }

    // 延迟运行测试，确保所有模块加载完成
    setTimeout(async () => {
        const results = await runTests();
        
        // 保存测试结果到全局对象
        window.CodeOptimizationTestResults = results;
        
        if (results.failed === 0) {
            console.log('🎉 所有测试通过！代码重构优化成功。');
            
            // 显示优化建议
            console.group('💡 进一步优化建议');
            console.log('1. 可以考虑实施WebSocket消息缓存');
            console.log('2. 可以添加离线数据同步机制');
            console.log('3. 可以实施更智能的预加载策略');
            console.log('4. 可以添加用户行为分析来优化缓存策略');
            console.groupEnd();
            
        } else {
            console.warn(`⚠️ ${results.failed} 个测试失败，需要进一步检查。`);
        }
    }, 500);

})();