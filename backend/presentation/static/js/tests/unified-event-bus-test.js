/**
 * 统一事件系统测试脚本
 * 验证UnifiedEventBus的功能和兼容性
 */
(function() {
    'use strict';

    console.log('🧪 开始统一事件系统测试...');

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

    function runTests() {
        console.group('🧪 统一事件系统测试');

        tests.forEach(({ name, fn }) => {
            try {
                console.group(`📋 测试: ${name}`);
                fn();
                console.groupEnd();
            } catch (error) {
                console.error(`💥 测试失败: ${name}`, error);
                console.groupEnd();
            }
        });

        console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`);
        console.groupEnd();

        return { passed, failed, total: passed + failed };
    }

    // 测试基础功能
    test('统一事件总线基础实例化', () => {
        assert(typeof window.UnifiedEventBus === 'function', 'UnifiedEventBus构造函数存在');
        assert(typeof window.eventBus === 'object', '全局eventBus实例存在');
        assert(typeof window.MessageEventBus === 'object', 'MessageEventBus兼容接口存在');
    });

    test('标准API功能测试 (on/emit)', () => {
        let received = null;
        const testData = { test: 'data', timestamp: Date.now() };
        
        const id = window.eventBus.on('test:standard', (data) => {
            received = data;
        });

        assert(typeof id === 'string', '订阅返回监听器ID');
        
        window.eventBus.emit('test:standard', testData);
        assertEquals(received, testData, '事件数据正确传递');

        window.eventBus.off('test:standard', id);
    });

    test('消息域API功能测试 (subscribe/publish)', () => {
        let received = null;
        const testPayload = { message: 'test', id: 123 };
        
        const unsubscribe = window.eventBus.subscribe('test:message', (payload) => {
            received = payload;
        });

        assert(typeof unsubscribe === 'function', '订阅返回取消函数');
        
        window.eventBus.publish('test:message', testPayload);
        assertEquals(received, testPayload, '消息载荷正确传递');

        unsubscribe();
    });

    test('一次性订阅测试 (once)', () => {
        let callCount = 0;
        
        const unsubscribe = window.eventBus.once('test:once', () => {
            callCount++;
        });

        window.eventBus.emit('test:once');
        window.eventBus.emit('test:once'); // 第二次应该不触发

        assertEquals(callCount, 1, '一次性监听器只执行一次');
    });

    test('MessageEventBus兼容性测试', () => {
        let received = null;
        
        const unsubscribe = window.MessageEventBus.subscribe('test:compat', (data) => {
            received = data;
        });

        window.MessageEventBus.publish('test:compat', 'compat-test');
        assertEquals(received, 'compat-test', 'MessageEventBus兼容接口工作正常');

        unsubscribe();
    });

    test('事件统计功能测试', () => {
        const initialStats = window.eventBus.getStats();
        assert(typeof initialStats === 'object', '统计对象存在');
        assert(typeof initialStats.eventsEmitted === 'number', '事件发布统计存在');
        assert(typeof initialStats.listenersAdded === 'number', '监听器添加统计存在');

        // 添加监听器并发布事件
        const id = window.eventBus.on('test:stats', () => {});
        window.eventBus.emit('test:stats');
        
        const newStats = window.eventBus.getStats();
        assert(newStats.eventsEmitted > initialStats.eventsEmitted, '事件发布计数增加');
        assert(newStats.listenersAdded > initialStats.listenersAdded, '监听器添加计数增加');

        window.eventBus.off('test:stats', id);
    });

    test('多监听器并发测试', () => {
        let count1 = 0, count2 = 0, count3 = 0;
        
        const id1 = window.eventBus.on('test:multi', () => count1++);
        const id2 = window.eventBus.on('test:multi', () => count2++);
        const id3 = window.eventBus.on('test:multi', () => count3++);

        window.eventBus.emit('test:multi');

        assertEquals(count1, 1, '第一个监听器执行');
        assertEquals(count2, 1, '第二个监听器执行');
        assertEquals(count3, 1, '第三个监听器执行');

        window.eventBus.off('test:multi', id1);
        window.eventBus.off('test:multi', id2);
        window.eventBus.off('test:multi', id3);
    });

    test('错误处理测试', () => {
        let normalExecuted = false;
        
        // 添加一个会出错的监听器
        const errorId = window.eventBus.on('test:error', () => {
            throw new Error('测试错误');
        });
        
        // 添加一个正常的监听器
        const normalId = window.eventBus.on('test:error', () => {
            normalExecuted = true;
        });

        // 发布事件，错误不应该影响其他监听器
        window.eventBus.emit('test:error');
        
        assert(normalExecuted, '错误不影响其他监听器执行');

        window.eventBus.off('test:error', errorId);
        window.eventBus.off('test:error', normalId);
    });

    test('清理功能测试', () => {
        // 添加一些监听器
        window.eventBus.on('test:cleanup1', () => {});
        window.eventBus.on('test:cleanup2', () => {});
        window.eventBus.on('test:cleanup2', () => {});

        const eventsBefore = window.eventBus.getEvents().length;
        assert(eventsBefore > 0, '清理前有事件存在');

        // 清理所有监听器
        window.eventBus.clear();

        const eventsAfter = window.eventBus.getEvents().length;
        assertEquals(eventsAfter, 0, '清理后无事件存在');
    });

    // 延迟运行测试，确保所有模块加载完成
    setTimeout(() => {
        const results = runTests();
        
        // 保存测试结果到全局对象
        window.UnifiedEventBusTestResults = results;
        
        if (results.failed === 0) {
            console.log('🎉 所有测试通过！统一事件系统工作正常。');
        } else {
            console.warn(`⚠️ ${results.failed} 个测试失败，请检查日志。`);
        }
    }, 200);

})();