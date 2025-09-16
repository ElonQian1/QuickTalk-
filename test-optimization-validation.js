/**
 * 代码优化验证测试脚本
 * 验证所有统一组件的功能完整性和兼容性
 */

console.log('🧪 开始代码优化验证测试...\n');

// 测试配置
const testConfig = {
    testTimeout: 5000,
    wsUrl: 'ws://localhost:3030/ws',
    apiUrl: 'http://localhost:3030',
    testMessages: [
        { type: 'text', content: '测试消息1' },
        { type: 'text', content: '测试消息2' },
        { type: 'auth', sessionId: 'test-session-123' }
    ]
};

// 测试结果收集器
const testResults = {
    passed: 0,
    failed: 0,
    errors: [],
    details: []
};

/**
 * 测试工具函数
 */
function assert(condition, message) {
    if (condition) {
        testResults.passed++;
        testResults.details.push(`✅ ${message}`);
        console.log(`✅ ${message}`);
    } else {
        testResults.failed++;
        testResults.errors.push(message);
        testResults.details.push(`❌ ${message}`);
        console.error(`❌ ${message}`);
    }
}

function logTest(testName) {
    console.log(`\n🔬 测试: ${testName}`);
    console.log('─'.repeat(50));
}

/**
 * 1. 测试 UnifiedUtils 工具库
 */
function testUnifiedUtils() {
    logTest('UnifiedUtils 工具库功能测试');
    
    try {
        // 测试深拷贝
        const original = { a: 1, b: { c: 2 }, d: [1, 2, 3] };
        const cloned = UnifiedUtils.deepClone(original);
        
        assert(JSON.stringify(cloned) === JSON.stringify(original), 'deepClone: 拷贝内容正确');
        assert(cloned !== original, 'deepClone: 对象引用不同');
        assert(cloned.b !== original.b, 'deepClone: 嵌套对象引用不同');
        
        // 测试防抖函数
        let debounceCounter = 0;
        const debouncedFn = UnifiedUtils.debounce(() => debounceCounter++, 100);
        
        debouncedFn();
        debouncedFn();
        debouncedFn();
        
        setTimeout(() => {
            assert(debounceCounter === 1, 'debounce: 防抖函数正常工作');
        }, 200);
        
        // 测试节流函数
        let throttleCounter = 0;
        const throttledFn = UnifiedUtils.throttle(() => throttleCounter++, 100);
        
        throttledFn();
        throttledFn();
        throttledFn();
        
        assert(throttleCounter === 1, 'throttle: 节流函数正常工作');
        
        // 测试时间格式化
        const testDate = new Date('2024-12-01T12:30:45');
        const formatted = UnifiedUtils.formatTime(testDate, 'YYYY-MM-DD HH:mm:ss');
        
        assert(formatted === '2024-12-01 12:30:45', 'formatTime: 时间格式化正确');
        
        // 测试ID生成
        const id1 = UnifiedUtils.generateId('test');
        const id2 = UnifiedUtils.generateId('test');
        
        assert(id1 !== id2, 'generateId: 生成的ID唯一');
        assert(id1.startsWith('test_'), 'generateId: ID前缀正确');
        
        // 测试空值检查
        assert(UnifiedUtils.isEmpty(''), 'isEmpty: 空字符串检测正确');
        assert(UnifiedUtils.isEmpty([]), 'isEmpty: 空数组检测正确');
        assert(UnifiedUtils.isEmpty({}), 'isEmpty: 空对象检测正确');
        assert(!UnifiedUtils.isEmpty('test'), 'isEmpty: 非空值检测正确');
        
        // 测试JSON安全解析
        const validJson = '{"test": "value"}';
        const invalidJson = '{invalid json}';
        
        assert(UnifiedUtils.safeJsonParse(validJson).test === 'value', 'safeJsonParse: 有效JSON解析正确');
        assert(UnifiedUtils.safeJsonParse(invalidJson, null) === null, 'safeJsonParse: 无效JSON返回默认值');
        
        // 测试文件大小格式化
        assert(UnifiedUtils.formatFileSize(1024) === '1 KB', 'formatFileSize: KB格式化正确');
        assert(UnifiedUtils.formatFileSize(1048576) === '1 MB', 'formatFileSize: MB格式化正确');
        
        // 测试邮箱验证
        assert(UnifiedUtils.isValidEmail('test@example.com'), 'isValidEmail: 有效邮箱验证正确');
        assert(!UnifiedUtils.isValidEmail('invalid-email'), 'isValidEmail: 无效邮箱验证正确');
        
        // 测试URL验证
        assert(UnifiedUtils.isValidUrl('https://example.com'), 'isValidUrl: 有效URL验证正确');
        assert(!UnifiedUtils.isValidUrl('invalid-url'), 'isValidUrl: 无效URL验证正确');
        
    } catch (error) {
        assert(false, `UnifiedUtils测试异常: ${error.message}`);
    }
}

/**
 * 2. 测试 UnifiedWebSocketClient
 */
function testUnifiedWebSocketClient() {
    logTest('UnifiedWebSocketClient WebSocket客户端测试');
    
    try {
        let messageReceived = false;
        let connectionEstablished = false;
        
        const client = new UnifiedWebSocketClient({
            url: testConfig.wsUrl,
            onConnect: () => {
                connectionEstablished = true;
                console.log('🔗 WebSocket连接已建立');
            },
            onMessage: (data) => {
                messageReceived = true;
                console.log('📨 收到消息:', data);
            },
            onDisconnect: () => {
                console.log('🔌 WebSocket连接已断开');
            },
            onError: (error) => {
                console.log('❌ WebSocket错误:', error);
            },
            autoReconnect: true,
            reconnectInterval: 1000
        });
        
        assert(typeof client.connect === 'function', 'UnifiedWebSocketClient: connect方法存在');
        assert(typeof client.disconnect === 'function', 'UnifiedWebSocketClient: disconnect方法存在');
        assert(typeof client.send === 'function', 'UnifiedWebSocketClient: send方法存在');
        assert(typeof client.isConnected === 'function', 'UnifiedWebSocketClient: isConnected方法存在');
        
        // 尝试连接（如果服务器运行）
        try {
            client.connect();
            
            setTimeout(() => {
                if (connectionEstablished) {
                    assert(true, 'UnifiedWebSocketClient: 连接建立成功');
                    
                    // 测试发送消息
                    client.send(testConfig.testMessages[0]);
                    
                    setTimeout(() => {
                        assert(messageReceived, 'UnifiedWebSocketClient: 消息收发正常');
                        client.disconnect();
                    }, 1000);
                } else {
                    assert(false, 'UnifiedWebSocketClient: 连接建立失败（可能服务器未运行）');
                }
            }, 2000);
            
        } catch (error) {
            assert(false, `UnifiedWebSocketClient连接测试失败: ${error.message}`);
        }
        
    } catch (error) {
        assert(false, `UnifiedWebSocketClient测试异常: ${error.message}`);
    }
}

/**
 * 3. 测试 UnifiedMessageManager
 */
function testUnifiedMessageManager() {
    logTest('UnifiedMessageManager 消息管理器测试');
    
    try {
        // 创建测试容器
        const testContainer = document.createElement('div');
        testContainer.id = 'test-messages';
        document.body.appendChild(testContainer);
        
        const messageManager = new UnifiedMessageManager({
            containerId: 'test-messages',
            onNewMessage: (message) => {
                console.log('📩 新消息回调:', message);
            }
        });
        
        assert(typeof messageManager.addMessage === 'function', 'UnifiedMessageManager: addMessage方法存在');
        assert(typeof messageManager.addMessageToUI === 'function', 'UnifiedMessageManager: addMessageToUI方法存在');
        assert(typeof messageManager.addImageMessage === 'function', 'UnifiedMessageManager: addImageMessage方法存在');
        assert(typeof messageManager.markMessagesAsRead === 'function', 'UnifiedMessageManager: markMessagesAsRead方法存在');
        
        // 测试添加文本消息
        const testMessage = {
            id: 'test-msg-1',
            content: '这是一条测试消息',
            sender_type: 'customer',
            created_at: new Date().toISOString()
        };
        
        messageManager.addMessage(testMessage);
        
        const messageElements = testContainer.querySelectorAll('.message');
        assert(messageElements.length === 1, 'UnifiedMessageManager: 消息添加到DOM成功');
        
        const messageContent = testContainer.querySelector('.message-content');
        assert(messageContent && messageContent.textContent.includes('这是一条测试消息'), 'UnifiedMessageManager: 消息内容显示正确');
        
        // 测试添加图片消息
        const imageMessage = {
            id: 'test-img-1',
            content: '图片消息',
            sender_type: 'staff',
            file_url: '/test-image.jpg',
            file_name: 'test.jpg',
            created_at: new Date().toISOString()
        };
        
        messageManager.addImageMessage(imageMessage);
        
        const imageElements = testContainer.querySelectorAll('.message');
        assert(imageElements.length === 2, 'UnifiedMessageManager: 图片消息添加成功');
        
        const imageElement = testContainer.querySelector('img');
        assert(imageElement && imageElement.src.includes('test-image.jpg'), 'UnifiedMessageManager: 图片消息显示正确');
        
        // 测试标记已读
        messageManager.markMessagesAsRead(['test-msg-1']);
        
        const readMessage = testContainer.querySelector('[data-message-id="test-msg-1"]');
        assert(readMessage && readMessage.classList.contains('read'), 'UnifiedMessageManager: 消息标记已读成功');
        
        // 清理测试容器
        document.body.removeChild(testContainer);
        
    } catch (error) {
        assert(false, `UnifiedMessageManager测试异常: ${error.message}`);
    }
}

/**
 * 4. 测试兼容性和集成
 */
function testCompatibilityAndIntegration() {
    logTest('兼容性和集成测试');
    
    try {
        // 测试全局变量存在
        assert(typeof window.UnifiedUtils !== 'undefined', '兼容性: UnifiedUtils全局可用');
        assert(typeof window.UnifiedWebSocketClient !== 'undefined', '兼容性: UnifiedWebSocketClient全局可用');
        assert(typeof window.UnifiedMessageManager !== 'undefined', '兼容性: UnifiedMessageManager全局可用');
        
        // 测试Utils别名
        assert(window.Utils === window.UnifiedUtils, '兼容性: Utils别名正确设置');
        
        // 测试组件互操作性
        const utils = new UnifiedUtils();
        const testData = { test: 'integration' };
        const clonedData = UnifiedUtils.deepClone(testData);
        
        assert(JSON.stringify(clonedData) === JSON.stringify(testData), '集成测试: 组件间数据传递正常');
        
        // 测试错误处理
        try {
            UnifiedUtils.safeJsonParse('{invalid json}');
            assert(true, '集成测试: 错误处理机制正常');
        } catch (error) {
            assert(false, '集成测试: 错误处理机制异常');
        }
        
    } catch (error) {
        assert(false, `兼容性测试异常: ${error.message}`);
    }
}

/**
 * 5. 性能测试
 */
function testPerformance() {
    logTest('性能测试');
    
    try {
        // 测试大量数据深拷贝性能
        const startTime = performance.now();
        const largeObject = {
            data: new Array(1000).fill(0).map((_, i) => ({ id: i, value: `item_${i}` }))
        };
        
        const cloned = UnifiedUtils.deepClone(largeObject);
        const endTime = performance.now();
        const cloneTime = endTime - startTime;
        
        assert(cloneTime < 100, `性能测试: 深拷贝性能合格 (${cloneTime.toFixed(2)}ms < 100ms)`);
        assert(cloned.data.length === 1000, '性能测试: 大量数据拷贝正确');
        
        // 测试防抖函数性能
        let counter = 0;
        const perfStartTime = performance.now();
        const debouncedFn = UnifiedUtils.debounce(() => counter++, 10);
        
        for (let i = 0; i < 100; i++) {
            debouncedFn();
        }
        
        const perfEndTime = performance.now();
        const debounceTime = perfEndTime - perfStartTime;
        
        assert(debounceTime < 50, `性能测试: 防抖函数性能合格 (${debounceTime.toFixed(2)}ms < 50ms)`);
        
    } catch (error) {
        assert(false, `性能测试异常: ${error.message}`);
    }
}

/**
 * 生成测试报告
 */
function generateTestReport() {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 代码优化验证测试报告');
    console.log('═'.repeat(60));
    
    const totalTests = testResults.passed + testResults.failed;
    const successRate = totalTests > 0 ? (testResults.passed / totalTests * 100).toFixed(2) : 0;
    
    console.log(`✅ 通过测试: ${testResults.passed}`);
    console.log(`❌ 失败测试: ${testResults.failed}`);
    console.log(`📈 成功率: ${successRate}%`);
    
    if (testResults.failed > 0) {
        console.log('\n❌ 失败的测试:');
        testResults.errors.forEach(error => console.log(`  • ${error}`));
    }
    
    console.log('\n📝 详细结果:');
    testResults.details.forEach(detail => console.log(`  ${detail}`));
    
    const reportData = {
        timestamp: new Date().toISOString(),
        totalTests,
        passed: testResults.passed,
        failed: testResults.failed,
        successRate: parseFloat(successRate),
        errors: testResults.errors,
        details: testResults.details
    };
    
    // 将报告保存到localStorage（如果可用）
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('optimization_test_report', JSON.stringify(reportData));
        console.log('\n💾 测试报告已保存到 localStorage');
    }
    
    return reportData;
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    console.log('🚀 开始执行优化验证测试套件...\n');
    
    try {
        // 检查必要组件是否已加载
        if (typeof UnifiedUtils === 'undefined') {
            console.error('❌ UnifiedUtils 未加载，请确保已引入相关脚本');
            return;
        }
        
        // 执行各项测试
        testUnifiedUtils();
        testUnifiedWebSocketClient();
        testUnifiedMessageManager();
        testCompatibilityAndIntegration();
        testPerformance();
        
        // 等待异步测试完成
        await new Promise(resolve => setTimeout(resolve, testConfig.testTimeout));
        
        // 生成测试报告
        const report = generateTestReport();
        
        if (report.failed === 0) {
            console.log('\n🎉 所有测试通过！代码优化验证成功！');
        } else {
            console.log('\n⚠️  部分测试失败，请检查相关功能');
        }
        
        return report;
        
    } catch (error) {
        console.error('❌ 测试执行异常:', error);
        assert(false, `测试执行异常: ${error.message}`);
        return generateTestReport();
    }
}

// 自动运行测试（如果在浏览器环境中）
if (typeof window !== 'undefined' && window.document) {
    // 等待页面加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAllTests);
    } else {
        runAllTests();
    }
}

// 导出测试函数（如果在Node.js环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllTests,
        testUnifiedUtils,
        testUnifiedWebSocketClient,
        testUnifiedMessageManager,
        testCompatibilityAndIntegration,
        testPerformance,
        generateTestReport
    };
}