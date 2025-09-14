/**
 * 测试配置文件
 */

window.TestConfig = {
    // 测试环境配置
    environment: 'test',
    
    // 模块路径映射
    paths: {
        core: '/assets/js/core',
        components: '/assets/js/components',
        managers: '/assets/js/managers',
        tests: '/tests'
    },
    
    // 测试套件配置
    suites: {
        // 核心模块测试
        core: [
            'utils.test.js',
            'config.test.js',
            'event-bus.test.js',
            'api-client.test.js'
        ],
        
        // UI组件测试
        components: [
            'modal.test.js',
            'form.test.js',
            'button.test.js',
            'navigation.test.js',
            'notification.test.js'
        ],
        
        // 业务管理器测试
        managers: [
            'user-manager.test.js',
            'message-manager.test.js',
            'shop-manager.test.js'
        ]
    },
    
    // 测试选项
    options: {
        // 超时时间（毫秒）
        timeout: 5000,
        
        // 是否显示详细输出
        verbose: true,
        
        // 是否在第一个失败后停止
        failFast: false,
        
        // 是否并行运行测试
        parallel: false,
        
        // 测试报告格式
        reporter: 'default',
        
        // 覆盖率阈值
        coverage: {
            statements: 80,
            branches: 75,
            functions: 80,
            lines: 80
        }
    },
    
    // 模拟数据配置
    mocks: {
        // API模拟
        api: {
            baseUrl: 'http://localhost:3000',
            timeout: 1000,
            responses: {
                '/api/test': { success: true, data: 'test' }
            }
        },
        
        // localStorage模拟
        localStorage: true,
        
        // WebSocket模拟
        webSocket: true
    },
    
    // 夹具数据
    fixtures: {
        users: [
            { id: 1, name: '测试用户1', email: 'test1@example.com' },
            { id: 2, name: '测试用户2', email: 'test2@example.com' }
        ],
        
        messages: [
            { id: 1, content: '测试消息1', userId: 1, timestamp: Date.now() },
            { id: 2, content: '测试消息2', userId: 2, timestamp: Date.now() }
        ],
        
        shops: [
            { id: 1, name: '测试店铺1', domain: 'test1.com', status: 'active' },
            { id: 2, name: '测试店铺2', domain: 'test2.com', status: 'pending' }
        ]
    }
};

/**
 * 测试工具类
 */
window.TestUtils = {
    /**
     * 创建模拟DOM元素
     */
    createMockElement(tag = 'div', attributes = {}) {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'class') {
                element.className = value;
            } else if (key === 'style') {
                Object.assign(element.style, value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        return element;
    },
    
    /**
     * 模拟事件
     */
    mockEvent(type, options = {}) {
        return new Event(type, {
            bubbles: true,
            cancelable: true,
            ...options
        });
    },
    
    /**
     * 模拟鼠标事件
     */
    mockMouseEvent(type, options = {}) {
        return new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            ...options
        });
    },
    
    /**
     * 模拟键盘事件
     */
    mockKeyEvent(type, key, options = {}) {
        return new KeyboardEvent(type, {
            bubbles: true,
            cancelable: true,
            key: key,
            code: `Key${key.toUpperCase()}`,
            ...options
        });
    },
    
    /**
     * 等待异步操作
     */
    wait(ms = 0) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    /**
     * 等待条件满足
     */
    async waitFor(condition, timeout = 1000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            if (await condition()) {
                return true;
            }
            await this.wait(10);
        }
        
        throw new Error(`等待条件超时: ${timeout}ms`);
    },
    
    /**
     * 模拟API响应
     */
    mockApiResponse(url, response, delay = 0) {
        const originalFetch = window.fetch;
        
        window.fetch = function(requestUrl, options) {
            if (requestUrl.includes(url)) {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve({
                            ok: true,
                            json: () => Promise.resolve(response),
                            text: () => Promise.resolve(JSON.stringify(response))
                        });
                    }, delay);
                });
            }
            
            return originalFetch.call(this, requestUrl, options);
        };
        
        // 返回清理函数
        return () => {
            window.fetch = originalFetch;
        };
    },
    
    /**
     * 模拟localStorage
     */
    mockLocalStorage() {
        const storage = {};
        
        const mockStorage = {
            getItem: jest.fn((key) => storage[key] || null),
            setItem: jest.fn((key, value) => {
                storage[key] = value.toString();
            }),
            removeItem: jest.fn((key) => {
                delete storage[key];
            }),
            clear: jest.fn(() => {
                Object.keys(storage).forEach(key => delete storage[key]);
            }),
            get length() {
                return Object.keys(storage).length;
            },
            key: jest.fn((index) => {
                const keys = Object.keys(storage);
                return keys[index] || null;
            })
        };
        
        Object.defineProperty(window, 'localStorage', {
            value: mockStorage,
            writable: true
        });
        
        return mockStorage;
    },
    
    /**
     * 模拟WebSocket
     */
    mockWebSocket() {
        class MockWebSocket {
            constructor(url) {
                this.url = url;
                this.readyState = WebSocket.CONNECTING;
                this.onopen = null;
                this.onclose = null;
                this.onmessage = null;
                this.onerror = null;
                
                // 模拟连接过程
                setTimeout(() => {
                    this.readyState = WebSocket.OPEN;
                    if (this.onopen) {
                        this.onopen({ type: 'open' });
                    }
                }, 10);
            }
            
            send(data) {
                if (this.readyState === WebSocket.OPEN) {
                    // 模拟回显
                    setTimeout(() => {
                        if (this.onmessage) {
                            this.onmessage({
                                type: 'message',
                                data: `echo: ${data}`
                            });
                        }
                    }, 10);
                }
            }
            
            close() {
                this.readyState = WebSocket.CLOSED;
                if (this.onclose) {
                    this.onclose({ type: 'close' });
                }
            }
        }
        
        MockWebSocket.CONNECTING = 0;
        MockWebSocket.OPEN = 1;
        MockWebSocket.CLOSING = 2;
        MockWebSocket.CLOSED = 3;
        
        window.WebSocket = MockWebSocket;
        
        return MockWebSocket;
    },
    
    /**
     * 获取随机测试数据
     */
    getRandomFixture(type) {
        const fixtures = window.TestConfig.fixtures[type];
        if (!fixtures || !fixtures.length) {
            return null;
        }
        
        const randomIndex = Math.floor(Math.random() * fixtures.length);
        return { ...fixtures[randomIndex] };
    },
    
    /**
     * 创建测试用户
     */
    createTestUser(overrides = {}) {
        return {
            id: Math.floor(Math.random() * 10000),
            name: '测试用户',
            email: 'test@example.com',
            role: 'user',
            createdAt: new Date().toISOString(),
            ...overrides
        };
    },
    
    /**
     * 创建测试消息
     */
    createTestMessage(overrides = {}) {
        return {
            id: Math.floor(Math.random() * 10000),
            content: '测试消息内容',
            userId: 1,
            timestamp: Date.now(),
            read: false,
            ...overrides
        };
    },
    
    /**
     * 创建测试店铺
     */
    createTestShop(overrides = {}) {
        return {
            id: Math.floor(Math.random() * 10000),
            name: '测试店铺',
            domain: 'test.example.com',
            status: 'active',
            ownerId: 1,
            createdAt: new Date().toISOString(),
            ...overrides
        };
    },
    
    /**
     * 清理测试环境
     */
    cleanup() {
        // 清理DOM
        const testElements = document.querySelectorAll('[data-test]');
        testElements.forEach(el => el.remove());
        
        // 重置事件总线
        if (window.EventBus) {
            window.EventBus.removeAllListeners();
        }
        
        // 清理localStorage
        if (localStorage && typeof localStorage.clear === 'function') {
            localStorage.clear();
        }
        
        // 重置配置
        if (window.Config && typeof window.Config.reset === 'function') {
            window.Config.reset();
        }
    }
};

/**
 * 断言扩展
 */
if (window.expect) {
    // 添加自定义断言方法
    window.expect.extend = function(extensions) {
        Object.entries(extensions).forEach(([name, matcher]) => {
            window.Expect.prototype[name] = function(...args) {
                const result = matcher(this.actual, ...args);
                this.assert(result.pass, result.message);
                return this;
            };
        });
    };
    
    // 添加常用的自定义断言
    window.expect.extend({
        toBeVisible() {
            const element = this.actual;
            const isVisible = element && 
                element.offsetParent !== null && 
                window.getComputedStyle(element).display !== 'none' &&
                window.getComputedStyle(element).visibility !== 'hidden';
                
            return {
                pass: isVisible,
                message: `期望元素${this.isNot ? '不' : ''}可见`
            };
        },
        
        toHaveClass(className) {
            const element = this.actual;
            const hasClass = element && element.classList && element.classList.contains(className);
            
            return {
                pass: hasClass,
                message: `期望元素${this.isNot ? '不' : ''}包含CSS类 ${className}`
            };
        },
        
        toBeInDocument() {
            const element = this.actual;
            const inDocument = element && document.body.contains(element);
            
            return {
                pass: inDocument,
                message: `期望元素${this.isNot ? '不' : ''}在文档中`
            };
        }
    });
}

console.log('[TestConfig] 测试配置加载完成');