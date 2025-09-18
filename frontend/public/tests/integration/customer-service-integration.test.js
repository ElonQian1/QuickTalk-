/**
 * 集成测试 - 客服系统核心功能集成
 */

describe('客服系统集成测试', () => {
    let mockWebSocket, mockStorage, apiCleanup;
    
    beforeEach(() => {
        // 设置测试环境
        TestUtils.cleanup();
        mockWebSocket = TestUtils.mockWebSocket();
        mockStorage = TestUtils.mockLocalStorage();
        
        // 确保所有模块已加载
        expect(window.EventBus).toBeDefined();
        expect(window.Config).toBeDefined();
        expect(window.Utils).toBeDefined();
        expect(window.Modal).toBeDefined();
    });
    
    afterEach(() => {
        TestUtils.cleanup();
        if (apiCleanup) {
            apiCleanup();
            apiCleanup = null;
        }
    });
    
    describe('用户认证流程', () => {
        it('应该能够完成完整的登录流程', async () => {
            // 模拟登录API
            apiCleanup = TestUtils.mockApiResponse('/api/login', {
                success: true,
                data: {
                    token: 'test-token',
                    user: TestUtils.createTestUser({ id: 1, name: '测试用户' })
                }
            });
            
            // 触发登录
            EventBus.emit('auth:login', {
                username: 'test@example.com',
                password: 'password'
            });
            
            // 等待登录完成
            await TestUtils.wait(50);
            
            // 验证用户状态
            expect(Config.get('user.isLoggedIn')).toBe(true);
            expect(Config.get('user.token')).toBe('test-token');
            
            // 验证存储
            expect(localStorage.getItem).toHaveBeenCalledWith('auth_token');
            expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'test-token');
        });
        
        it('应该处理登录失败', async () => {
            // 模拟登录失败
            apiCleanup = TestUtils.mockApiResponse('/api/login', {
                success: false,
                error: '用户名或密码错误'
            });
            
            let errorCaught = false;
            EventBus.on('auth:error', () => {
                errorCaught = true;
            });
            
            // 触发登录
            EventBus.emit('auth:login', {
                username: 'wrong@example.com',
                password: 'wrongpassword'
            });
            
            await TestUtils.wait(50);
            
            // 验证错误处理
            expect(errorCaught).toBe(true);
            expect(Config.get('user.isLoggedIn')).toBe(false);
        });
    });
    
    describe('消息系统集成', () => {
        beforeEach(() => {
            // 设置已认证状态
            Config.set('user.isLoggedIn', true);
            Config.set('user.id', 1);
        });
        
        it('应该能够发送和接收消息', async () => {
            let messageReceived = null;
            let messageSent = null;
            
            // 监听消息事件
            EventBus.on('message:received', (message) => {
                messageReceived = message;
            });
            
            EventBus.on('message:sent', (message) => {
                messageSent = message;
            });
            
            // 模拟发送消息API
            apiCleanup = TestUtils.mockApiResponse('/api/messages', {
                success: true,
                data: {
                    id: 123,
                    content: '测试消息',
                    userId: 1,
                    timestamp: Date.now()
                }
            });
            
            // 发送消息
            const testMessage = {
                content: '测试消息',
                conversationId: 'test-conversation'
            };
            
            EventBus.emit('message:send', testMessage);
            
            await TestUtils.wait(50);
            
            // 验证消息发送
            expect(messageSent).toBeDefined();
            expect(messageSent.content).toBe('测试消息');
            
            // 模拟WebSocket接收消息
            const wsMessage = {
                type: 'message',
                data: JSON.stringify({
                    id: 124,
                    content: '回复消息',
                    userId: 2,
                    timestamp: Date.now()
                })
            };
            
            // 触发WebSocket消息
            if (window.WebSocket.lastInstance && window.WebSocket.lastInstance.onmessage) {
                window.WebSocket.lastInstance.onmessage(wsMessage);
            }
            
            await TestUtils.wait(50);
            
            // 验证消息接收
            expect(messageReceived).toBeDefined();
            expect(JSON.parse(messageReceived.data).content).toBe('回复消息');
        });
        
        it('应该正确处理会话管理', async () => {
            const conversationId = 'test-conversation-123';
            let conversationCreated = false;
            
            EventBus.on('conversation:created', () => {
                conversationCreated = true;
            });
            
            // 模拟创建会话API
            apiCleanup = TestUtils.mockApiResponse('/api/conversations', {
                success: true,
                data: {
                    id: conversationId,
                    participants: [1, 2],
                    createdAt: new Date().toISOString()
                }
            });
            
            // 创建会话
            EventBus.emit('conversation:create', {
                participantIds: [1, 2],
                shopId: 'test-shop'
            });
            
            await TestUtils.wait(50);
            
            // 验证会话创建
            expect(conversationCreated).toBe(true);
            
            // 验证会话存储
            const activeConversations = Config.get('conversations.active') || [];
            expect(activeConversations.length).toBeGreaterThan(0);
        });
    });
    
    describe('店铺管理集成', () => {
        beforeEach(() => {
            // 设置管理员状态
            Config.set('user.isLoggedIn', true);
            Config.set('user.role', 'admin');
            Config.set('user.id', 1);
        });
        
        it('应该能够创建和管理店铺', async () => {
            let shopCreated = null;
            
            EventBus.on('shop:created', (shop) => {
                shopCreated = shop;
            });
            
            // 模拟创建店铺API
            const testShop = TestUtils.createTestShop({
                name: '新测试店铺',
                domain: 'newtest.example.com'
            });
            
            apiCleanup = TestUtils.mockApiResponse('/api/shops', {
                success: true,
                data: testShop
            });
            
            // 创建店铺
            EventBus.emit('shop:create', {
                name: '新测试店铺',
                domain: 'newtest.example.com',
                ownerId: 1
            });
            
            await TestUtils.wait(50);
            
            // 验证店铺创建
            expect(shopCreated).toBeDefined();
            expect(shopCreated.name).toBe('新测试店铺');
            
            // 验证店铺列表更新
            const shops = Config.get('shops.list') || [];
            const newShop = shops.find(shop => shop.name === '新测试店铺');
            expect(newShop).toBeDefined();
        });
        
        it('应该能够审核店铺', async () => {
            let shopApproved = null;
            
            EventBus.on('shop:approved', (shop) => {
                shopApproved = shop;
            });
            
            // 设置待审核店铺
            const pendingShop = TestUtils.createTestShop({
                id: 999,
                status: 'pending'
            });
            
            Config.set('shops.pending', [pendingShop]);
            
            // 模拟审核API
            apiCleanup = TestUtils.mockApiResponse('/api/shops/999/approve', {
                success: true,
                data: { ...pendingShop, status: 'approved' }
            });
            
            // 审核店铺
            EventBus.emit('shop:approve', { shopId: 999 });
            
            await TestUtils.wait(50);
            
            // 验证店铺审核
            expect(shopApproved).toBeDefined();
            expect(shopApproved.status).toBe('approved');
            
            // 验证店铺状态更新
            const pendingShops = Config.get('shops.pending') || [];
            expect(pendingShops.find(shop => shop.id === 999)).toBeUndefined();
        });
    });
    
    describe('UI组件集成', () => {
        it('应该能够显示和隐藏模态框', async () => {
            // 创建测试模态框
            const modal = new Modal({
                title: '测试模态框',
                content: '这是测试内容'
            });
            
            // 显示模态框
            modal.show();
            
            await TestUtils.wait(100); // 等待动画
            
            // 验证模态框显示
            const modalElement = document.querySelector('.modal');
            expect(modalElement).toBeInDocument();
            expect(modalElement).toBeVisible();
            
            // 验证标题和内容
            expect(modalElement.querySelector('.modal-title').textContent).toBe('测试模态框');
            expect(modalElement.querySelector('.modal-body').textContent).toBe('这是测试内容');
            
            // 隐藏模态框
            modal.hide();
            
            await TestUtils.wait(100); // 等待动画
            
            // 验证模态框隐藏
            expect(modalElement).not.toBeVisible();
        });
        
        it('应该正确处理表单提交', async () => {
            let formSubmitted = false;
            let submittedData = null;
            
            EventBus.on('form:submitted', (data) => {
                formSubmitted = true;
                submittedData = data;
            });
            
            // 创建测试表单
            const formHTML = `
                <form data-test="test-form">
                    <input type="text" name="name" value="测试名称" />
                    <input type="email" name="email" value="test@example.com" />
                    <button type="submit">提交</button>
                </form>
            `;
            
            document.body.insertAdjacentHTML('beforeend', formHTML);
            const form = document.querySelector('[data-test="test-form"]');
            
            // 监听表单提交
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                EventBus.emit('form:submitted', data);
            });
            
            // 触发表单提交
            const submitEvent = TestUtils.mockEvent('submit');
            form.dispatchEvent(submitEvent);
            
            await TestUtils.wait(10);
            
            // 验证表单提交
            expect(formSubmitted).toBe(true);
            expect(submittedData.name).toBe('测试名称');
            expect(submittedData.email).toBe('test@example.com');
        });
    });
    
    describe('错误处理集成', () => {
        it('应该正确处理网络错误', async () => {
            let errorHandled = false;
            let errorMessage = null;
            
            EventBus.on('error:network', (error) => {
                errorHandled = true;
                errorMessage = error.message;
            });
            
            // 模拟网络错误
            window.fetch = () => Promise.reject(new Error('网络连接失败'));
            
            // 触发API调用
            EventBus.emit('api:call', {
                url: '/api/test',
                method: 'GET'
            });
            
            await TestUtils.wait(50);
            
            // 验证错误处理
            expect(errorHandled).toBe(true);
            expect(errorMessage).toContain('网络连接失败');
        });
        
        it('应该正确处理WebSocket连接错误', async () => {
            let connectionError = false;
            
            EventBus.on('websocket:error', () => {
                connectionError = true;
            });
            
            // 模拟WebSocket连接错误
            const ws = new WebSocket('ws://localhost:3030/ws');
            
            setTimeout(() => {
                if (ws.onerror) {
                    ws.onerror({ type: 'error', message: 'WebSocket连接失败' });
                }
            }, 10);
            
            await TestUtils.wait(50);
            
            // 验证错误处理
            expect(connectionError).toBe(true);
        });
    });
    
    describe('性能和内存管理', () => {
        it('应该正确清理事件监听器', () => {
            const testHandler = jest.fn();
            const eventName = 'test:event';
            
            // 添加事件监听器
            EventBus.on(eventName, testHandler);
            
            // 验证监听器存在
            expect(EventBus.listenerCount(eventName)).toBe(1);
            
            // 移除监听器
            EventBus.off(eventName, testHandler);
            
            // 验证监听器已移除
            expect(EventBus.listenerCount(eventName)).toBe(0);
        });
        
        it('应该正确管理组件生命周期', async () => {
            const modal = new Modal({
                title: '生命周期测试',
                content: '测试内容'
            });
            
            // 显示组件
            modal.show();
            
            // 验证组件已创建
            expect(document.querySelector('.modal')).toBeInDocument();
            
            // 销毁组件
            modal.destroy();
            
            // 验证组件已移除
            expect(document.querySelector('.modal')).toBeNull();
        });
    });
});

console.log('[Integration Tests] 集成测试加载完成');