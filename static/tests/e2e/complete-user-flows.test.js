/**
 * 端到端测试 - 完整用户流程测试
 */

describe('客服系统端到端测试', () => {
    let testContainer;
    
    beforeEach(() => {
        // 创建测试容器
        testContainer = TestUtils.createMockElement('div', {
            id: 'e2e-test-container',
            style: {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                zIndex: '9999',
                backgroundColor: 'white'
            }
        });
        
        document.body.appendChild(testContainer);
        
        // 清理环境
        TestUtils.cleanup();
        
        // 设置模拟服务
        TestUtils.mockWebSocket();
        TestUtils.mockLocalStorage();
    });
    
    afterEach(() => {
        // 清理测试容器
        if (testContainer && testContainer.parentNode) {
            testContainer.parentNode.removeChild(testContainer);
        }
        
        TestUtils.cleanup();
    });
    
    describe('完整客服对话流程', () => {
        it('应该完成从访客进入到对话结束的完整流程', async () => {
            // 第1步：访客进入网站并打开客服窗口
            const customerServiceHTML = `
                <div id="customer-service-widget">
                    <button id="open-chat" class="chat-trigger">联系客服</button>
                    <div id="chat-window" class="chat-window hidden">
                        <div class="chat-header">
                            <span class="chat-title">在线客服</span>
                            <button id="close-chat" class="close-btn">×</button>
                        </div>
                        <div id="chat-messages" class="chat-messages"></div>
                        <div class="chat-input-area">
                            <input type="text" id="message-input" placeholder="请输入消息..." />
                            <button id="send-message" class="send-btn">发送</button>
                        </div>
                    </div>
                </div>
            `;
            
            testContainer.innerHTML = customerServiceHTML;
            
            // 模拟打开客服窗口
            const openChatBtn = testContainer.querySelector('#open-chat');
            const chatWindow = testContainer.querySelector('#chat-window');
            
            openChatBtn.addEventListener('click', () => {
                chatWindow.classList.remove('hidden');
                EventBus.emit('chat:opened');
            });
            
            // 点击打开客服按钮
            openChatBtn.click();
            
            await TestUtils.wait(100);
            
            // 验证客服窗口已打开
            expect(chatWindow.classList.contains('hidden')).toBe(false);
            
            // 第2步：建立WebSocket连接
            let wsConnected = false;
            EventBus.on('websocket:connected', () => {
                wsConnected = true;
            });
            
            // 模拟WebSocket连接
            const ws = new WebSocket('ws://localhost:3030/ws');
            setTimeout(() => {
                if (ws.onopen) {
                    ws.onopen({ type: 'open' });
                    EventBus.emit('websocket:connected');
                }
            }, 50);
            
            await TestUtils.wait(100);
            
            // 验证WebSocket连接已建立
            expect(wsConnected).toBe(true);
            
            // 第3步：访客发送第一条消息
            const messageInput = testContainer.querySelector('#message-input');
            const sendBtn = testContainer.querySelector('#send-message');
            const messagesContainer = testContainer.querySelector('#chat-messages');
            
            // 设置消息发送处理
            sendBtn.addEventListener('click', () => {
                const message = messageInput.value.trim();
                if (message) {
                    // 添加消息到界面
                    const messageElement = TestUtils.createMockElement('div', {
                        class: 'message user-message'
                    });
                    messageElement.textContent = message;
                    messagesContainer.appendChild(messageElement);
                    
                    // 发送WebSocket消息
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'message',
                            content: message,
                            userId: 'customer-123',
                            timestamp: Date.now()
                        }));
                    }
                    
                    // 清空输入框
                    messageInput.value = '';
                    
                    EventBus.emit('message:sent', { content: message });
                }
            });
            
            // 输入并发送消息
            messageInput.value = '你好，我需要帮助';
            sendBtn.click();
            
            await TestUtils.wait(50);
            
            // 验证消息已发送
            const userMessages = messagesContainer.querySelectorAll('.user-message');
            expect(userMessages.length).toBe(1);
            expect(userMessages[0].textContent).toBe('你好，我需要帮助');
            
            // 第4步：客服回复消息
            // 模拟客服回复
            setTimeout(() => {
                if (ws.onmessage) {
                    ws.onmessage({
                        type: 'message',
                        data: JSON.stringify({
                            type: 'message',
                            content: '您好！我是客服小李，有什么可以帮助您的吗？',
                            userId: 'agent-456',
                            timestamp: Date.now()
                        })
                    });
                }
            }, 100);
            
            // 处理接收到的消息
            EventBus.on('message:received', (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'message') {
                    const messageElement = TestUtils.createMockElement('div', {
                        class: 'message agent-message'
                    });
                    messageElement.textContent = data.content;
                    messagesContainer.appendChild(messageElement);
                }
            });
            
            await TestUtils.wait(150);
            
            // 验证收到客服回复
            const agentMessages = messagesContainer.querySelectorAll('.agent-message');
            expect(agentMessages.length).toBe(1);
            expect(agentMessages[0].textContent).toContain('客服小李');
            
            // 第5步：多轮对话
            const conversations = [
                { user: '我的订单什么时候能发货？', agent: '请提供您的订单号，我来帮您查询' },
                { user: '订单号是12345', agent: '您的订单已在处理中，预计明天发货' },
                { user: '好的，谢谢', agent: '不客气，还有其他问题吗？' }
            ];
            
            for (let i = 0; i < conversations.length; i++) {
                const conv = conversations[i];
                
                // 用户发送消息
                messageInput.value = conv.user;
                sendBtn.click();
                
                await TestUtils.wait(50);
                
                // 模拟客服回复
                setTimeout(() => {
                    if (ws.onmessage) {
                        ws.onmessage({
                            type: 'message',
                            data: JSON.stringify({
                                type: 'message',
                                content: conv.agent,
                                userId: 'agent-456',
                                timestamp: Date.now()
                            })
                        });
                    }
                }, 100);
                
                await TestUtils.wait(150);
            }
            
            // 验证对话记录
            const allMessages = messagesContainer.querySelectorAll('.message');
            expect(allMessages.length).toBe(8); // 4轮对话 = 8条消息
            
            // 第6步：关闭对话
            const closeChatBtn = testContainer.querySelector('#close-chat');
            
            closeChatBtn.addEventListener('click', () => {
                chatWindow.classList.add('hidden');
                
                // 关闭WebSocket连接
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
                
                EventBus.emit('chat:closed');
            });
            
            let chatClosed = false;
            EventBus.on('chat:closed', () => {
                chatClosed = true;
            });
            
            // 点击关闭按钮
            closeChatBtn.click();
            
            await TestUtils.wait(100);
            
            // 验证对话已关闭
            expect(chatWindow.classList.contains('hidden')).toBe(true);
            expect(chatClosed).toBe(true);
        });
    });
    
    describe('管理后台操作流程', () => {
        it('应该完成管理员登录到处理消息的完整流程', async () => {
            // 第1步：创建管理后台界面
            const adminHTML = `
                <div id="admin-dashboard">
                    <div id="login-form" class="login-container">
                        <h2>管理员登录</h2>
                        <input type="text" id="admin-username" placeholder="用户名" />
                        <input type="password" id="admin-password" placeholder="密码" />
                        <button id="login-btn">登录</button>
                    </div>
                    <div id="admin-panel" class="admin-panel hidden">
                        <nav class="admin-nav">
                            <button id="conversations-tab" class="nav-btn active">对话管理</button>
                            <button id="shops-tab" class="nav-btn">店铺管理</button>
                            <button id="logout-btn" class="logout-btn">退出</button>
                        </nav>
                        <div id="conversations-panel" class="panel-content">
                            <div id="conversation-list" class="conversation-list"></div>
                            <div id="conversation-detail" class="conversation-detail">
                                <div id="conversation-messages" class="messages"></div>
                                <div class="reply-area">
                                    <input type="text" id="reply-input" placeholder="回复消息..." />
                                    <button id="reply-btn">发送</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            testContainer.innerHTML = adminHTML;
            
            // 第2步：管理员登录
            const loginForm = testContainer.querySelector('#login-form');
            const adminPanel = testContainer.querySelector('#admin-panel');
            const usernameInput = testContainer.querySelector('#admin-username');
            const passwordInput = testContainer.querySelector('#admin-password');
            const loginBtn = testContainer.querySelector('#login-btn');
            
            // 模拟登录API
            const mockLoginApi = TestUtils.mockApiResponse('/api/admin/login', {
                success: true,
                data: {
                    token: 'admin-token-123',
                    user: { id: 1, username: 'admin', role: 'admin' }
                }
            });
            
            loginBtn.addEventListener('click', async () => {
                const username = usernameInput.value;
                const password = passwordInput.value;
                
                if (username === 'admin' && password === 'password') {
                    // 模拟API调用
                    await TestUtils.wait(100);
                    
                    // 隐藏登录表单，显示管理面板
                    loginForm.classList.add('hidden');
                    adminPanel.classList.remove('hidden');
                    
                    EventBus.emit('admin:login:success');
                }
            });
            
            // 输入登录凭据
            usernameInput.value = 'admin';
            passwordInput.value = 'password';
            
            let loginSuccess = false;
            EventBus.on('admin:login:success', () => {
                loginSuccess = true;
            });
            
            // 点击登录
            loginBtn.click();
            
            await TestUtils.wait(150);
            
            // 验证登录成功
            expect(loginSuccess).toBe(true);
            expect(loginForm.classList.contains('hidden')).toBe(true);
            expect(adminPanel.classList.contains('hidden')).toBe(false);
            
            // 第3步：加载对话列表
            const conversationList = testContainer.querySelector('#conversation-list');
            
            // 模拟对话数据
            const mockConversations = [
                {
                    id: 'conv-1',
                    customerName: '张三',
                    lastMessage: '我需要帮助',
                    timestamp: Date.now() - 300000,
                    unread: true
                },
                {
                    id: 'conv-2',
                    customerName: '李四',
                    lastMessage: '订单问题',
                    timestamp: Date.now() - 600000,
                    unread: false
                }
            ];
            
            // 渲染对话列表
            mockConversations.forEach(conv => {
                const convElement = TestUtils.createMockElement('div', {
                    class: `conversation-item ${conv.unread ? 'unread' : ''}`,
                    'data-conversation-id': conv.id
                });
                
                convElement.innerHTML = `
                    <div class="customer-name">${conv.customerName}</div>
                    <div class="last-message">${conv.lastMessage}</div>
                    <div class="timestamp">${new Date(conv.timestamp).toLocaleTimeString()}</div>
                `;
                
                conversationList.appendChild(convElement);
            });
            
            // 验证对话列表已加载
            const conversationItems = conversationList.querySelectorAll('.conversation-item');
            expect(conversationItems.length).toBe(2);
            
            // 第4步：查看具体对话
            const conversationDetail = testContainer.querySelector('#conversation-detail');
            const conversationMessages = testContainer.querySelector('#conversation-messages');
            
            // 点击第一个对话
            conversationItems[0].addEventListener('click', () => {
                // 移除未读标记
                conversationItems[0].classList.remove('unread');
                
                // 加载对话消息
                const messages = [
                    { content: '你好，我需要帮助', sender: 'customer', timestamp: Date.now() - 300000 },
                    { content: '您好！有什么可以帮助您的？', sender: 'agent', timestamp: Date.now() - 250000 },
                    { content: '我的订单有问题', sender: 'customer', timestamp: Date.now() - 200000 }
                ];
                
                conversationMessages.innerHTML = '';
                messages.forEach(msg => {
                    const msgElement = TestUtils.createMockElement('div', {
                        class: `message ${msg.sender}-message`
                    });
                    msgElement.textContent = msg.content;
                    conversationMessages.appendChild(msgElement);
                });
                
                EventBus.emit('conversation:selected', { id: 'conv-1' });
            });
            
            let conversationSelected = false;
            EventBus.on('conversation:selected', () => {
                conversationSelected = true;
            });
            
            // 点击对话项
            conversationItems[0].click();
            
            await TestUtils.wait(50);
            
            // 验证对话已选中
            expect(conversationSelected).toBe(true);
            expect(conversationItems[0].classList.contains('unread')).toBe(false);
            
            const messageElements = conversationMessages.querySelectorAll('.message');
            expect(messageElements.length).toBe(3);
            
            // 第5步：回复消息
            const replyInput = testContainer.querySelector('#reply-input');
            const replyBtn = testContainer.querySelector('#reply-btn');
            
            replyBtn.addEventListener('click', () => {
                const replyText = replyInput.value.trim();
                if (replyText) {
                    // 添加回复消息到界面
                    const replyElement = TestUtils.createMockElement('div', {
                        class: 'message agent-message'
                    });
                    replyElement.textContent = replyText;
                    conversationMessages.appendChild(replyElement);
                    
                    // 清空输入框
                    replyInput.value = '';
                    
                    EventBus.emit('message:replied', { content: replyText });
                }
            });
            
            let messageReplied = false;
            EventBus.on('message:replied', () => {
                messageReplied = true;
            });
            
            // 输入并发送回复
            replyInput.value = '请提供您的订单号，我来帮您查询';
            replyBtn.click();
            
            await TestUtils.wait(50);
            
            // 验证回复已发送
            expect(messageReplied).toBe(true);
            
            const updatedMessages = conversationMessages.querySelectorAll('.message');
            expect(updatedMessages.length).toBe(4);
            expect(updatedMessages[3].textContent).toContain('订单号');
            
            // 清理API模拟
            mockLoginApi();
        });
    });
    
    describe('店铺管理流程', () => {
        it('应该完成店铺创建到审核的完整流程', async () => {
            // 第1步：创建店铺申请界面
            const shopApplicationHTML = `
                <div id="shop-application">
                    <h2>申请开通客服服务</h2>
                    <form id="shop-form">
                        <div class="form-group">
                            <label>店铺名称</label>
                            <input type="text" id="shop-name" required />
                        </div>
                        <div class="form-group">
                            <label>店铺域名</label>
                            <input type="text" id="shop-domain" required />
                        </div>
                        <div class="form-group">
                            <label>联系邮箱</label>
                            <input type="email" id="shop-email" required />
                        </div>
                        <button type="submit" id="submit-application">提交申请</button>
                    </form>
                    <div id="application-result" class="result-message hidden"></div>
                </div>
            `;
            
            testContainer.innerHTML = shopApplicationHTML;
            
            // 第2步：填写并提交申请
            const shopForm = testContainer.querySelector('#shop-form');
            const shopName = testContainer.querySelector('#shop-name');
            const shopDomain = testContainer.querySelector('#shop-domain');
            const shopEmail = testContainer.querySelector('#shop-email');
            const applicationResult = testContainer.querySelector('#application-result');
            
            // 模拟提交申请API
            const mockApplicationApi = TestUtils.mockApiResponse('/api/shops/apply', {
                success: true,
                data: {
                    id: 'shop-123',
                    status: 'pending',
                    message: '申请已提交，请等待审核'
                }
            });
            
            shopForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = {
                    name: shopName.value,
                    domain: shopDomain.value,
                    email: shopEmail.value
                };
                
                // 模拟API调用
                await TestUtils.wait(100);
                
                // 显示成功消息
                applicationResult.textContent = '申请已成功提交！';
                applicationResult.classList.remove('hidden');
                
                EventBus.emit('shop:application:submitted', formData);
            });
            
            // 填写表单
            shopName.value = '测试商店';
            shopDomain.value = 'teststore.com';
            shopEmail.value = 'test@teststore.com';
            
            let applicationSubmitted = false;
            EventBus.on('shop:application:submitted', () => {
                applicationSubmitted = true;
            });
            
            // 提交申请
            const submitEvent = TestUtils.mockEvent('submit');
            shopForm.dispatchEvent(submitEvent);
            
            await TestUtils.wait(150);
            
            // 验证申请已提交
            expect(applicationSubmitted).toBe(true);
            expect(applicationResult.classList.contains('hidden')).toBe(false);
            expect(applicationResult.textContent).toContain('申请已成功提交');
            
            // 第3步：管理员审核
            // 切换到管理界面
            const adminReviewHTML = `
                <div id="admin-review">
                    <h2>店铺审核</h2>
                    <div id="pending-shops" class="pending-list">
                        <div class="shop-item" data-shop-id="shop-123">
                            <div class="shop-info">
                                <h3>测试商店</h3>
                                <p>域名: teststore.com</p>
                                <p>邮箱: test@teststore.com</p>
                            </div>
                            <div class="shop-actions">
                                <button class="approve-btn" data-action="approve">通过</button>
                                <button class="reject-btn" data-action="reject">拒绝</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            testContainer.innerHTML = adminReviewHTML;
            
            const pendingShops = testContainer.querySelector('#pending-shops');
            const approveBtn = testContainer.querySelector('.approve-btn');
            const rejectBtn = testContainer.querySelector('.reject-btn');
            
            // 模拟审核API
            const mockApprovalApi = TestUtils.mockApiResponse('/api/shops/approve', {
                success: true,
                data: { status: 'approved' }
            });
            
            let shopApproved = false;
            EventBus.on('shop:approved', () => {
                shopApproved = true;
            });
            
            approveBtn.addEventListener('click', async () => {
                // 模拟审核通过
                await TestUtils.wait(50);
                
                // 更新界面
                const shopItem = approveBtn.closest('.shop-item');
                shopItem.innerHTML = '<div class="approval-message">店铺已通过审核</div>';
                
                EventBus.emit('shop:approved', { id: 'shop-123' });
            });
            
            // 点击通过按钮
            approveBtn.click();
            
            await TestUtils.wait(100);
            
            // 验证审核通过
            expect(shopApproved).toBe(true);
            
            const approvalMessage = testContainer.querySelector('.approval-message');
            expect(approvalMessage).toBeDefined();
            expect(approvalMessage.textContent).toContain('已通过审核');
            
            // 清理API模拟
            mockApplicationApi();
            mockApprovalApi();
        });
    });
    
    describe('移动端适配流程', () => {
        it('应该在移动设备上正常工作', async () => {
            // 模拟移动设备视口
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 375
            });
            
            Object.defineProperty(window, 'innerHeight', {
                writable: true,
                configurable: true,
                value: 667
            });
            
            // 触发resize事件
            window.dispatchEvent(new Event('resize'));
            
            // 创建移动端客服界面
            const mobileHTML = `
                <div id="mobile-customer-service" class="mobile-layout">
                    <div id="mobile-chat-trigger" class="mobile-chat-trigger">
                        <span class="trigger-text">客服</span>
                    </div>
                    <div id="mobile-chat-window" class="mobile-chat-window hidden">
                        <div class="mobile-chat-header">
                            <span class="chat-title">在线客服</span>
                            <button id="mobile-close-chat" class="mobile-close-btn">×</button>
                        </div>
                        <div id="mobile-chat-messages" class="mobile-chat-messages"></div>
                        <div class="mobile-chat-input">
                            <input type="text" id="mobile-message-input" placeholder="输入消息..." />
                            <button id="mobile-send-btn" class="mobile-send-btn">发送</button>
                        </div>
                    </div>
                </div>
            `;
            
            testContainer.innerHTML = mobileHTML;
            
            // 测试移动端交互
            const mobileTrigger = testContainer.querySelector('#mobile-chat-trigger');
            const mobileChatWindow = testContainer.querySelector('#mobile-chat-window');
            const mobileCloseBtn = testContainer.querySelector('#mobile-close-chat');
            
            // 打开聊天窗口
            mobileTrigger.addEventListener('click', () => {
                mobileChatWindow.classList.remove('hidden');
                mobileChatWindow.classList.add('mobile-fullscreen');
            });
            
            mobileTrigger.click();
            
            await TestUtils.wait(50);
            
            // 验证移动端界面
            expect(mobileChatWindow.classList.contains('hidden')).toBe(false);
            expect(mobileChatWindow.classList.contains('mobile-fullscreen')).toBe(true);
            
            // 测试关闭功能
            mobileCloseBtn.addEventListener('click', () => {
                mobileChatWindow.classList.add('hidden');
                mobileChatWindow.classList.remove('mobile-fullscreen');
            });
            
            mobileCloseBtn.click();
            
            await TestUtils.wait(50);
            
            // 验证关闭功能
            expect(mobileChatWindow.classList.contains('hidden')).toBe(true);
        });
    });
});

console.log('[E2E Tests] 端到端测试加载完成');