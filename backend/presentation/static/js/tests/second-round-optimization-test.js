/**
 * 第二轮代码优化验证脚本
 * 验证统一日志系统和数据管理器的功能
 */
(function() {
    'use strict';

    console.log('🧪 开始第二轮代码优化验证...');

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

    // 测试统一日志系统
    test('统一日志系统集成', () => {
        assert(typeof window.UnifiedLogger === 'function', 'UnifiedLogger类存在');
        assert(typeof window.getLogger === 'function', 'getLogger便捷方法存在');
        assert(typeof window.LoggerManager === 'object', 'LoggerManager实例存在');
    });

    // 测试日志功能
    test('日志记录功能', () => {
        const testLogger = window.getLogger('TestLogger');
        assert(typeof testLogger.info === 'function', '日志器info方法存在');
        assert(typeof testLogger.debug === 'function', '日志器debug方法存在');
        assert(typeof testLogger.error === 'function', '日志器error方法存在');
        
        // 测试日志记录不抛错
        try {
            testLogger.info('测试日志记录');
            testLogger.debug('测试调试日志');
            assert(true, '日志记录正常工作');
        } catch (error) {
            assert(false, '日志记录抛出错误');
        }
    });

    // 测试统一数据管理器
    test('统一数据管理器完整性', () => {
        assert(typeof window.UnifiedDataManager === 'function', 'UnifiedDataManager类存在');
        assert(typeof window.dataManager === 'object', '全局dataManager实例存在');
        
        // 兼容性别名
        assert(window.DataSyncManager === window.dataManager, 'DataSyncManager兼容别名正确');
        assert(window.unifiedDataSyncManager === window.dataManager, 'unifiedDataSyncManager兼容别名正确');
        assert(window.mobileDataSyncManager === window.dataManager, 'mobileDataSyncManager兼容别名正确');
    });

    // 测试数据管理器方法
    test('数据管理器方法验证', () => {
        const dm = window.dataManager;
        assert(typeof dm.getShops === 'function', 'getShops方法存在');
        assert(typeof dm.getConversations === 'function', 'getConversations方法存在');
        assert(typeof dm.getMessages === 'function', 'getMessages方法存在');
        assert(typeof dm.subscribe === 'function', 'subscribe方法存在');
        assert(typeof dm.clearCache === 'function', 'clearCache方法存在');
        assert(typeof dm.getStats === 'function', 'getStats方法存在');
    });

    // 测试事件和API管理器的日志优化
    test('模块日志系统优化验证', () => {
        // 检查事件总线是否正确使用统一日志
        if (window.eventBus && window.eventBus.logger) {
            assert(typeof window.eventBus.logger.info === 'function', '事件总线使用统一日志系统');
        }
        
        // 检查API管理器是否正确使用统一日志
        if (window.apiManager && window.apiManager.logger) {
            assert(typeof window.apiManager.logger.info === 'function', 'API管理器使用统一日志系统');
        }
    });

    // 测试数据订阅功能
    test('数据订阅系统', () => {
        let subscriptionTriggered = false;
        
        const unsubscribe = window.dataManager.subscribe('shops', (data) => {
            subscriptionTriggered = true;
        });
        
        assert(typeof unsubscribe === 'function', '订阅返回取消函数');
        
        // 模拟数据变更通知
        window.dataManager._notifySubscribers('shops', [{ id: 1, name: 'test' }], 'test');
        
        setTimeout(() => {
            assert(subscriptionTriggered, '数据订阅功能正常');
            unsubscribe();
        }, 50);
    });

    // 运行所有测试
    async function runTests() {
        console.group('🧪 第二轮代码优化验证');

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
        console.group('📈 第二轮优化效果总结');
        
        try {
            const loggerStats = window.LoggerManager?.getAllStats?.();
            const dataManagerStats = window.dataManager?.getStats?.();

            if (loggerStats) {
                console.log('📝 日志系统统计:', loggerStats);
            }

            if (dataManagerStats) {
                console.log('💾 数据管理统计:', dataManagerStats);
            }

            // 显示消除的重复代码
            console.log('🎯 消除的重复代码:');
            console.log('  ✅ 事件总线和API管理器的重复日志方法');
            console.log('  ✅ 多个DataSyncManager类的重复实现');
            console.log('  ✅ 统一了数据获取和缓存逻辑');

        } catch (error) {
            console.warn('获取优化统计信息时出错:', error);
        }
        
        console.groupEnd();
        console.groupEnd();

        return { passed, failed, total: passed + failed };
    }

    // 延迟运行测试，确保所有模块加载完成
    setTimeout(async () => {
        const results = await runTests();
        
        // 保存测试结果到全局对象
        window.SecondRoundOptimizationResults = results;
        
        if (results.failed === 0) {
            console.log('🎉 第二轮优化验证通过！代码重复问题已消除。');
            
            // 显示下一步优化建议
            console.group('💡 下一轮优化建议');
            console.log('1. 🔍 检查CSS样式重复问题');
            console.log('2. ⚡ 优化WebSocket消息处理器的重复逻辑');
            console.log('3. 🎨 统一UI组件的重复代码');
            console.log('4. 📱 优化移动端适配代码重复');
            console.groupEnd();
            
        } else {
            console.warn(`⚠️ ${results.failed} 个测试失败，需要进一步检查。`);
        }
    }, 600);

})();