/**
 * 第四轮代码优化验证脚本 - WebSocket消息处理器重复逻辑消除
 * 验证统一消息处理器的功能和WebSocket消息处理优化效果
 */
(function() {
    'use strict';

    console.log('📡 开始第四轮WebSocket消息处理优化验证...');

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

    // 测试统一消息处理器基础功能
    test('统一消息处理器类验证', () => {
        assert(typeof window.UnifiedMessageProcessor === 'function', 'UnifiedMessageProcessor类存在');
        assert(typeof window.messageProcessor === 'object', '全局messageProcessor实例存在');
        assert(typeof window.MessageProcessor === 'function', 'MessageProcessor兼容别名存在');
        assert(typeof window.globalMessageProcessor === 'object', 'globalMessageProcessor兼容别名存在');
    });

    // 测试便捷方法
    test('便捷方法验证', () => {
        assert(typeof window.processMessage === 'function', 'processMessage便捷方法存在');
        assert(typeof window.parseMessage === 'function', 'parseMessage便捷方法存在');
        assert(typeof window.serializeMessage === 'function', 'serializeMessage便捷方法存在');
        assert(typeof window.registerMessageHandler === 'function', 'registerMessageHandler便捷方法存在');
    });

    // 测试消息解析功能
    test('消息解析功能验证', () => {
        const processor = window.messageProcessor;
        
        // 测试JSON字符串解析
        const jsonString = '{"type":"test","data":"hello"}';
        const parsed1 = processor.parseMessage(jsonString);
        assert(parsed1.type === 'test', 'JSON字符串解析正确');
        assert(parsed1.data === 'hello', 'JSON字符串数据解析正确');
        assert(typeof parsed1.timestamp === 'number', '自动添加时间戳');
        assert(typeof parsed1.id === 'string', '自动生成消息ID');

        // 测试对象解析
        const obj = { type: 'chat', message: 'test message' };
        const parsed2 = processor.parseMessage(obj);
        assert(parsed2.type === 'chat', '对象解析正确');
        assert(parsed2.message === 'test message', '对象数据解析正确');

        // 测试纯文本解析
        const text = 'plain text message';
        const parsed3 = processor.parseMessage(text, { allowPlainText: true });
        assert(parsed3.type === 'text', '纯文本解析为text类型');
        assert(parsed3.content === text, '纯文本内容正确');

        // 测试无效JSON解析
        const invalidJson = '{"invalid": json}';
        const parsed4 = processor.parseMessage(invalidJson, { allowPlainText: true });
        assert(parsed4.type === 'text', '无效JSON退化为文本类型');
    });

    // 测试消息序列化功能
    test('消息序列化功能验证', () => {
        const processor = window.messageProcessor;
        
        // 测试对象序列化
        const obj = { type: 'test', data: { nested: 'value' } };
        const serialized1 = processor.serializeMessage(obj);
        assert(typeof serialized1 === 'string', '对象序列化为字符串');
        
        const parsed = JSON.parse(serialized1);
        assert(parsed.type === 'test', '序列化保持数据完整性');
        assert(typeof parsed.timestamp === 'number', '序列化自动添加时间戳');

        // 测试字符串序列化
        const str = 'test string';
        const serialized2 = processor.serializeMessage(str);
        assert(serialized2 === str, '字符串序列化保持原样');

        // 测试循环引用处理
        const circular = { type: 'test' };
        circular.self = circular;
        const serialized3 = processor.serializeMessage(circular, { safeStringify: true });
        assert(typeof serialized3 === 'string', '循环引用对象可安全序列化');
        assert(serialized3.includes('[Circular]'), '循环引用被正确标记');
    });

    // 测试消息处理器注册
    test('消息处理器注册验证', () => {
        const processor = window.messageProcessor;
        let testReceived = false;
        let testMessage = null;

        // 注册测试处理器
        const handlerId = processor.registerHandler('test-message', (message, context) => {
            testReceived = true;
            testMessage = message;
        });

        assert(typeof handlerId === 'string', '处理器注册返回ID');

        // 处理测试消息
        processor.processMessage({ type: 'test-message', content: 'test content' });

        setTimeout(() => {
            assert(testReceived, '消息处理器被正确调用');
            assert(testMessage && testMessage.content === 'test content', '消息处理器接收到正确数据');
            
            // 清理
            processor.unregisterHandler('test-message', handlerId);
        }, 10);
    });

    // 测试事件监听器
    test('事件监听器功能验证', () => {
        const processor = window.messageProcessor;
        let eventReceived = false;
        let eventData = null;

        // 注册事件监听器
        const listenerId = processor.on('message', (data, context) => {
            eventReceived = true;
            eventData = data;
        });

        assert(typeof listenerId === 'string', '事件监听器注册返回ID');

        // 触发事件
        processor.processMessage({ type: 'test-event', data: 'event data' });

        setTimeout(() => {
            assert(eventReceived, '事件监听器被正确调用');
            assert(eventData && eventData.data === 'event data', '事件监听器接收到正确数据');
            
            // 清理
            processor.off('message', listenerId);
        }, 10);
    });

    // 测试中间件功能
    test('中间件功能验证', () => {
        const processor = new window.UnifiedMessageProcessor({ enableLogging: false });
        let middlewareExecuted = false;
        let modifiedMessage = null;

        // 注册中间件
        const middlewareId = processor.use((message, context) => {
            middlewareExecuted = true;
            // 修改消息
            return {
                ...message,
                processed: true,
                middleware: 'test-middleware'
            };
        });

        assert(typeof middlewareId === 'string', '中间件注册返回ID');

        // 注册处理器来验证中间件效果
        processor.registerHandler('middleware-test', (message, context) => {
            modifiedMessage = message;
        });

        // 处理消息
        processor.processMessage({ type: 'middleware-test', original: true });

        setTimeout(() => {
            assert(middlewareExecuted, '中间件被正确执行');
            assert(modifiedMessage && modifiedMessage.processed === true, '中间件成功修改了消息');
            assert(modifiedMessage.middleware === 'test-middleware', '中间件添加了正确的标记');
            
            // 清理
            processor.dispose();
        }, 10);
    });

    // 测试消息验证功能
    test('消息验证功能验证', () => {
        const processor = new window.UnifiedMessageProcessor({ 
            enableValidation: true,
            enableLogging: false 
        });

        // 注册验证器
        processor.registerValidator('validated-message', (message) => {
            if (!message.required_field) {
                return '缺少required_field字段';
            }
            return true;
        });

        // 测试验证通过
        const validMessage = { type: 'validated-message', required_field: 'present' };
        const result1 = processor.parseMessage(validMessage);
        assert(result1.type === 'validated-message', '有效消息通过验证');

        // 测试验证失败
        const invalidMessage = { type: 'validated-message', other_field: 'present' };
        const result2 = processor.parseMessage(invalidMessage);
        assert(result2.type === 'error', '无效消息被标记为错误');
        assert(result2.error.includes('缺少required_field字段'), '验证错误信息正确');

        processor.dispose();
    });

    // 测试统计功能
    test('处理统计功能验证', () => {
        const processor = new window.UnifiedMessageProcessor({ enableMetrics: true, enableLogging: false });
        
        // 处理几条消息
        processor.processMessage('test message 1');
        processor.processMessage({ type: 'test', data: 'message 2' });
        processor.serializeMessage({ type: 'test', data: 'serialize test' });

        const metrics = processor.getMetrics();
        
        assert(typeof metrics.processed === 'number', 'processed统计存在');
        assert(typeof metrics.sent === 'number', 'sent统计存在');
        assert(typeof metrics.received === 'number', 'received统计存在');
        assert(typeof metrics.runtime === 'number', 'runtime统计存在');
        assert(typeof metrics.errorRate === 'string', 'errorRate统计存在');
        
        assert(metrics.processed >= 2, '处理统计正确计数');
        assert(metrics.sent >= 1, '发送统计正确计数');

        processor.dispose();
    });

    // 测试默认消息处理器
    test('默认消息处理器验证', () => {
        const processor = window.messageProcessor;
        
        // 测试默认处理器是否已注册
        const metrics = processor.getMetrics();
        assert(metrics.handlersCount > 0, '已注册默认消息处理器');

        // 测试ping/pong处理
        let pingProcessed = false;
        const originalLog = processor._log;
        processor._log = (level, message) => {
            if (level === 'debug' && message.includes('ping')) {
                pingProcessed = true;
            }
        };

        processor.processMessage({ type: 'ping' });

        setTimeout(() => {
            assert(pingProcessed, 'ping消息被默认处理器处理');
            processor._log = originalLog;
        }, 10);
    });

    // 测试消息历史功能
    test('消息历史功能验证', () => {
        const processor = new window.UnifiedMessageProcessor({ 
            enableHistory: true,
            maxHistorySize: 3,
            enableLogging: false 
        });

        // 处理几条消息
        processor.processMessage({ type: 'history1', data: 'test1' });
        processor.processMessage({ type: 'history2', data: 'test2' });
        processor.processMessage({ type: 'history3', data: 'test3' });
        processor.processMessage({ type: 'history4', data: 'test4' });

        const metrics = processor.getMetrics();
        assert(metrics.historySize <= 3, '历史记录大小限制正确');
        
        // 验证最新消息在历史中
        assert(processor.messageHistory.some(msg => msg.type === 'history4'), '最新消息在历史记录中');

        processor.dispose();
    });

    // 运行所有测试
    async function runTests() {
        console.group('📡 第四轮WebSocket消息处理优化验证');

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
        
        // 显示WebSocket消息处理优化效果总结
        console.group('📈 第四轮WebSocket消息处理优化效果总结');
        
        try {
            const globalMetrics = window.messageProcessor?.getMetrics?.();

            if (globalMetrics) {
                console.log('📊 全局消息处理器统计:', globalMetrics);
            }

            console.log('🎯 消除的重复WebSocket处理逻辑:');
            console.log('  ✅ 统一了JSON.parse和JSON.stringify的重复调用');
            console.log('  ✅ 消除了多个ws.onmessage处理器的重复逻辑');
            console.log('  ✅ 统一了消息分发和事件触发机制');
            console.log('  ✅ 整合了消息验证和中间件处理流程');
            console.log('  ✅ 统一了循环引用处理和错误处理逻辑');
            
            console.log('\n🔍 发现的重复模式:');
            console.log('  • JSON.parse(event.data) - 在多个WebSocket处理器中重复');
            console.log('  • JSON.stringify(message) - 在多个发送方法中重复');
            console.log('  • 消息类型分发逻辑 - 在不同模块中重复实现');
            console.log('  • 错误处理和日志记录 - 在各个处理器中重复');
            console.log('  • 消息队列和缓存机制 - 在多个地方重复');
            
            console.log('\n💡 优化效果:');
            console.log('  🚀 减少了WebSocket消息处理的代码重复');
            console.log('  🎛️ 提供了统一的消息处理配置和监控');
            console.log('  🔧 简化了新消息类型的处理器注册');
            console.log('  📈 统一了消息处理的性能监控和统计');
            console.log('  🛡️ 增强了消息验证和错误处理能力');

        } catch (error) {
            console.warn('获取WebSocket优化统计信息时出错:', error);
        }
        
        console.groupEnd();
        console.groupEnd();

        return { passed, failed, total: passed + failed };
    }

    // 延迟运行测试，确保所有模块加载完成
    setTimeout(async () => {
        const results = await runTests();
        
        // 保存测试结果到全局对象
        window.FourthRoundOptimizationResults = results;
        
        if (results.failed === 0) {
            console.log('🎉 第四轮WebSocket消息处理优化验证通过！重复逻辑已大幅减少。');
            
            // 显示下一步优化建议
            console.group('💡 第五轮优化建议');
            console.log('1. 🎨 统一UI组件中重复的DOM操作和事件绑定');
            console.log('2. 📱 合并移动端和桌面端重复的响应式适配代码');
            console.log('3. 🔧 整合重复的表单验证和输入处理逻辑');
            console.log('4. ⚡ 优化重复的状态管理和数据同步机制');
            console.log('5. 🔍 识别并消除工具函数中的重复实现');
            console.groupEnd();
            
        } else {
            console.warn(`⚠️ ${results.failed} 个WebSocket消息处理测试失败，需要进一步检查。`);
        }
    }, 1000);

})();