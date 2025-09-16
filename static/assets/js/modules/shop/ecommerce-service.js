/**
 * 移动端多店铺电商客服系统
 * 基于淘宝客服最佳实践，提供三级导航：
 * 1. 消息总览（显示所有店铺的未读消息汇总）
 * 2. 店铺对话列表（显示某个店铺的所有客户对话）
 * 3. 具体聊天界面（与某个客户的对话详情）
 * 
 * @author QuickTalk Team
 * @version 2.0.0
 */

class MobileEcommerceCustomerService {
    constructor() {
        this.currentUser = null;
        this.shops = [];
        this.conversations = {};  // 按店铺ID分组的对话
        this.currentShop = null;
        this.currentConversation = null;
        this.unreadCounts = {};   // 每个店铺的未读消息数
        this.totalUnreadCount = 0;
        this.websocket = null;
        this.refreshTimer = null;
        
        // 页面状态管理
        this.currentView = 'overview'; // overview, shop, chat
        this.viewStack = ['overview'];
        
        console.log('🛒 移动端多店铺电商客服系统初始化');
    }

    /**
     * 初始化系统
     */
    async init() {
        try {
            console.log('🚀 启动移动端多店铺客服系统...');
            
            // 1. 验证用户登录状态
            await this.authenticateUser();
            
            // 2. 连接WebSocket
            this.initWebSocket();
            
            // 3. 加载店铺数据
            await this.loadShops();
            
            // 4. 加载未读消息统计
            await this.loadUnreadCounts();
            
            // 5. 初始化UI
            this.initializeUI();
            
            // 6. 绑定事件监听器
            this.bindEvents();
            
            // 7. 启动自动刷新
            this.startAutoRefresh();
            
            // 8. 显示消息总览
            this.showMessageOverview();
            
            console.log('✅ 移动端多店铺客服系统初始化完成');
            
        } catch (error) {
            console.error('❌ 系统初始化失败:', error);
            this.showError('系统初始化失败，请刷新页面重试');
        }
    }

    /**
     * 验证用户登录状态
     */
    async authenticateUser() {
        const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
        if (!sessionId) {
            throw new Error('用户未登录');
        }

        try {
            const response = await fetch('/api/auth/me', {
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                console.log('👤 当前用户:', this.currentUser.username);
            } else {
                throw new Error('用户验证失败');
            }
        } catch (error) {
            console.error('❌ 用户验证失败:', error);
            throw error;
        }
    }

    /**
     * 初始化WebSocket连接
     */
    initWebSocket() {
        try {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('🔌 WebSocket连接已建立');
                this.updateConnectionStatus(true);
                
                // 发送用户认证
                this.websocket.send(JSON.stringify({
                    type: 'auth',
                    sessionId: localStorage.getItem('sessionId')
                }));
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('❌ 解析WebSocket消息失败:', error);
                }
            };
            
            this.websocket.onclose = () => {
                console.log('🔌 WebSocket连接已断开');
                this.updateConnectionStatus(false);
                
                // 5秒后重连
                setTimeout(() => this.initWebSocket(), 5000);
            };
            
            this.websocket.onerror = (error) => {
                console.error('❌ WebSocket连接错误:', error);
                this.updateConnectionStatus(false);
            };
            
        } catch (error) {
            console.error('❌ WebSocket初始化失败:', error);
        }
    }

    /**
     * 处理WebSocket消息
     */
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'new_message':
                this.handleNewMessage(data);
                break;
            case 'message_read':
                this.handleMessageRead(data);
                break;
            case 'typing':
                this.handleTyping(data);
                break;
            case 'user_online':
                this.handleUserOnline(data);
                break;
            case 'user_offline':
                this.handleUserOffline(data);
                break;
            default:
                console.log('🤔 未知WebSocket消息类型:', data.type);
        }
    }

    /**
     * 处理新消息
     */
    handleNewMessage(data) {
        const { shopId, userId, message } = data;
        
        // 更新未读计数
        if (!this.unreadCounts[shopId]) {
            this.unreadCounts[shopId] = 0;
        }
        this.unreadCounts[shopId]++;
        this.totalUnreadCount++;
        
        // 更新UI
        this.updateUnreadBadges();
        
        // 如果正在查看该对话，立即显示新消息
        if (this.currentView === 'chat' && 
            this.currentShop?.id === shopId && 
            this.currentConversation?.userId === userId) {
            this.addMessageToChat(message);
        }
        
        // 更新对话列表
        this.updateConversationInList(shopId, userId, message);
        
        // 播放提示音
        this.playNotificationSound();
        
        // 显示系统通知
        this.showNotification(`来自 ${this.getShopName(shopId)} 的新消息`, message.content);
    }

    /**
     * 加载店铺列表
     */
    async loadShops() {
        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch('/api/admin/shops', {
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                const data = await response.json();
                this.shops = data.shops || [];
                console.log('🏪 已加载店铺列表:', this.shops.length, '个店铺');
            } else {
                throw new Error('获取店铺列表失败');
            }
        } catch (error) {
            console.error('❌ 加载店铺列表失败:', error);
            // 使用测试数据
            this.shops = [
                {
                    id: 'shop_test_1',
                    name: '测试店铺1',
                    domain: 'test1.example.com',
                    status: 'active'
                }
            ];
        }
    }

    /**
     * 加载未读消息统计
     */
    async loadUnreadCounts() {
        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch('/api/messages/unread-counts', {
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                const data = await response.json();
                this.unreadCounts = data.counts || {};
                this.totalUnreadCount = Object.values(this.unreadCounts).reduce((sum, count) => sum + count, 0);
                
                console.log('📊 已加载未读消息统计:', this.unreadCounts);
                this.updateUnreadBadges();
            } else {
                throw new Error('获取未读消息统计失败');
            }
        } catch (error) {
            console.error('❌ 加载未读消息统计失败:', error);
        }
    }

    /**
     * 初始化UI界面
     */
    initializeUI() {
        // 创建消息页面的HTML结构
        const messagesPage = document.getElementById('messagesPage');
        if (!messagesPage) {
            console.error('❌ 找不到消息页面容器');
            return;
        }

        messagesPage.innerHTML = `
            <div class="mobile-customer-service">
                <!-- 页面头部 -->
                <div class="page-header" id="pageHeader">
                    <button class="back-btn" id="backBtn" style="display: none;" onclick="mobileCustomerService.goBack()">
                        ← 返回
                    </button>
                    <div class="page-title" id="pageTitle">消息中心</div>
                    <button class="refresh-btn" id="refreshBtn" onclick="mobileCustomerService.refresh()">
                        🔄
                    </button>
                </div>

                <!-- 页面内容 -->
                <div class="page-content" id="pageContent">
                    <div class="loading">正在加载...</div>
                </div>

                <!-- 聊天输入框（仅在聊天页面显示） -->
                <div class="chat-input-container" id="chatInputContainer" style="display: none;">
                    <div class="chat-input">
                        <input type="text" id="messageInput" placeholder="输入消息..." />
                        <button id="sendBtn" onclick="mobileCustomerService.sendMessage()">发送</button>
                    </div>
                </div>
            </div>
        `;

        // 添加样式
        this.addStyles();
    }

    /**
     * 添加样式
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .mobile-customer-service {
                height: 100%;
                display: flex;
                flex-direction: column;
                background: #f5f5f5;
            }

            .page-header {
                height: 50px;
                background: #fff;
                border-bottom: 1px solid #e9ecef;
                display: flex;
                align-items: center;
                padding: 0 15px;
                position: relative;
            }

            .back-btn {
                background: none;
                border: none;
                font-size: 16px;
                color: #007AFF;
                cursor: pointer;
                margin-right: 10px;
            }

            .page-title {
                flex: 1;
                text-align: center;
                font-weight: 600;
                font-size: 16px;
            }

            .refresh-btn {
                background: none;
                border: none;
                font-size: 16px;
                cursor: pointer;
            }

            .page-content {
                flex: 1;
                overflow-y: auto;
                background: #fff;
            }

            /* 消息总览样式 */
            .message-overview {
                padding: 0;
            }

            .overview-stats {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                text-align: center;
            }

            .total-unread {
                font-size: 32px;
                font-weight: bold;
                margin-bottom: 5px;
            }

            .stats-label {
                font-size: 14px;
                opacity: 0.9;
            }

            .shop-list {
                padding: 0;
            }

            .shop-item {
                display: flex;
                align-items: center;
                padding: 15px;
                border-bottom: 1px solid #f0f0f0;
                cursor: pointer;
                transition: background 0.2s;
            }

            .shop-item:hover {
                background: #f8f9fa;
            }

            .shop-avatar {
                position: relative;
                margin-right: 15px;
            }

            .avatar-circle {
                width: 50px;
                height: 50px;
                border-radius: 25px;
                background: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 18px;
            }

            .unread-badge {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #FF3B30;
                color: white;
                border-radius: 12px;
                min-width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
            }

            .shop-info {
                flex: 1;
                min-width: 0;
            }

            .shop-name {
                font-size: 16px;
                font-weight: 600;
                color: #333;
                margin-bottom: 5px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .shop-domain {
                font-size: 12px;
                color: #666;
                margin-bottom: 3px;
            }

            .last-message {
                font-size: 14px;
                color: #999;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .shop-meta {
                text-align: right;
                color: #999;
                font-size: 12px;
            }

            .chevron {
                margin-top: 5px;
                font-size: 16px;
                color: #ccc;
            }

            /* 对话列表样式 */
            .conversation-list {
                padding: 0;
            }

            .conversation-item {
                display: flex;
                align-items: center;
                padding: 15px;
                border-bottom: 1px solid #f0f0f0;
                cursor: pointer;
                transition: background 0.2s;
            }

            .conversation-item:hover {
                background: #f8f9fa;
            }

            .user-avatar {
                width: 45px;
                height: 45px;
                border-radius: 22.5px;
                background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                margin-right: 15px;
            }

            .conversation-info {
                flex: 1;
                min-width: 0;
            }

            .conversation-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 5px;
            }

            .user-name {
                font-size: 16px;
                font-weight: 600;
                color: #333;
            }

            .message-time {
                font-size: 12px;
                color: #999;
            }

            .last-message-preview {
                font-size: 14px;
                color: #666;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* 聊天界面样式 */
            .chat-messages {
                padding: 15px;
                height: 100%;
                overflow-y: auto;
            }

            .message {
                margin-bottom: 15px;
                display: flex;
                flex-direction: column;
            }

            .message.user {
                align-items: flex-end;
            }

            .message.admin {
                align-items: flex-start;
            }

            .message-bubble {
                max-width: 80%;
                padding: 12px 16px;
                border-radius: 18px;
                font-size: 16px;
                line-height: 1.4;
                word-wrap: break-word;
            }

            .message.user .message-bubble {
                background: #007AFF;
                color: white;
                border-bottom-right-radius: 5px;
            }

            .message.admin .message-bubble {
                background: #e9ecef;
                color: #333;
                border-bottom-left-radius: 5px;
            }

            .message-timestamp {
                font-size: 12px;
                color: #999;
                margin-top: 5px;
                text-align: center;
            }

            /* 聊天输入框样式 */
            .chat-input-container {
                background: #fff;
                border-top: 1px solid #e9ecef;
                padding: 15px;
            }

            .chat-input {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            #messageInput {
                flex: 1;
                border: 1px solid #ddd;
                border-radius: 25px;
                padding: 12px 16px;
                font-size: 16px;
                outline: none;
            }

            #sendBtn {
                background: #007AFF;
                color: white;
                border: none;
                border-radius: 25px;
                padding: 12px 20px;
                font-size: 16px;
                cursor: pointer;
            }

            /* 空状态样式 */
            .empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px 20px;
                color: #999;
                text-align: center;
            }

            .empty-icon {
                font-size: 48px;
                margin-bottom: 15px;
                opacity: 0.5;
            }

            .empty-message {
                font-size: 16px;
                margin-bottom: 8px;
            }

            .empty-description {
                font-size: 14px;
                color: #ccc;
            }

            /* 加载状态 */
            .loading {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 40px;
                color: #999;
            }

            /* 响应式调整 */
            @media (max-width: 375px) {
                .message-bubble {
                    max-width: 85%;
                    font-size: 15px;
                }
                
                .shop-item, .conversation-item {
                    padding: 12px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * 显示消息总览
     */
    showMessageOverview() {
        console.log('📋 显示消息总览');
        
        this.currentView = 'overview';
        this.updatePageHeader('消息中心', false);
        
        const content = document.getElementById('pageContent');
        if (!content) return;

        const html = `
            <div class="message-overview">
                <div class="overview-stats">
                    <div class="total-unread">${this.totalUnreadCount}</div>
                    <div class="stats-label">条未读消息</div>
                </div>
                
                <div class="shop-list">
                    ${this.shops.map(shop => this.renderShopOverviewItem(shop)).join('')}
                </div>
                
                ${this.shops.length === 0 ? this.renderEmptyState('🏪', '暂无店铺', '请先创建店铺') : ''}
            </div>
        `;

        content.innerHTML = html;
        this.hideChatInput();
    }

    /**
     * 渲染店铺总览项目
     */
    renderShopOverviewItem(shop) {
        const unreadCount = this.unreadCounts[shop.id] || 0;
        const lastMessage = this.getShopLastMessage(shop.id);

        return `
            <div class="shop-item" onclick="mobileCustomerService.showShopConversations('${shop.id}')">
                <div class="shop-avatar">
                    <div class="avatar-circle">${shop.name.charAt(0).toUpperCase()}</div>
                    ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
                </div>
                <div class="shop-info">
                    <div class="shop-name">${shop.name}</div>
                    <div class="shop-domain">${shop.domain}</div>
                    <div class="last-message">${lastMessage?.content || '暂无消息'}</div>
                </div>
                <div class="shop-meta">
                    <div class="timestamp">${lastMessage ? this.formatTime(lastMessage.timestamp) : ''}</div>
                    <div class="chevron">›</div>
                </div>
            </div>
        `;
    }

    /**
     * 显示店铺对话列表
     */
    async showShopConversations(shopId) {
        console.log('🏪 显示店铺对话列表:', shopId);
        
        const shop = this.shops.find(s => s.id === shopId);
        if (!shop) {
            console.error('❌ 找不到店铺:', shopId);
            return;
        }

        this.currentShop = shop;
        this.currentView = 'shop';
        this.viewStack.push('shop');
        this.updatePageHeader(shop.name, true);

        // 显示加载状态
        const content = document.getElementById('pageContent');
        content.innerHTML = '<div class="loading">正在加载对话...</div>';

        try {
            // 加载该店铺的对话列表
            await this.loadShopConversations(shopId);
            this.renderShopConversations();
        } catch (error) {
            console.error('❌ 加载店铺对话失败:', error);
            content.innerHTML = this.renderEmptyState('❌', '加载失败', '请稍后重试');
        }
    }

    /**
     * 加载店铺对话列表
     */
    async loadShopConversations(shopId) {
        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch(`/api/shops/${shopId}/conversations`, {
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                const data = await response.json();
                this.conversations[shopId] = data.conversations || [];
                console.log('💬 已加载对话列表:', this.conversations[shopId].length, '个对话');
            } else {
                throw new Error('获取对话列表失败');
            }
        } catch (error) {
            console.error('❌ 加载对话列表失败:', error);
            // 使用测试数据
            this.conversations[shopId] = [];
        }
    }

    /**
     * 渲染店铺对话列表
     */
    renderShopConversations() {
        const content = document.getElementById('pageContent');
        const conversations = this.conversations[this.currentShop.id] || [];

        if (conversations.length === 0) {
            content.innerHTML = this.renderEmptyState('💬', '暂无对话', '等待客户发起对话');
            this.hideChatInput();
            return;
        }

        const html = `
            <div class="conversation-list">
                ${conversations.map(conv => this.renderConversationItem(conv)).join('')}
            </div>
        `;

        content.innerHTML = html;
        this.hideChatInput();
    }

    /**
     * 渲染对话项目
     */
    renderConversationItem(conversation) {
        const unreadCount = conversation.unread_count || 0;
        
        return `
            <div class="conversation-item" onclick="mobileCustomerService.showChat('${conversation.user_id}')">
                <div class="user-avatar">${(conversation.user_name || 'U').charAt(0).toUpperCase()}</div>
                <div class="conversation-info">
                    <div class="conversation-meta">
                        <div class="user-name">${conversation.user_name || '匿名用户'}</div>
                        <div class="message-time">${this.formatTime(conversation.last_message_time)}</div>
                    </div>
                    <div class="last-message-preview">${conversation.last_message || '暂无消息'}</div>
                </div>
                ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
            </div>
        `;
    }

    /**
     * 显示聊天界面
     */
    async showChat(userId) {
        console.log('💬 显示聊天界面:', userId);
        
        if (!this.currentShop) {
            console.error('❌ 当前店铺为空');
            return;
        }

        this.currentConversation = { userId };
        this.currentView = 'chat';
        this.viewStack.push('chat');
        this.updatePageHeader(`与 ${userId} 的对话`, true);

        // 显示加载状态
        const content = document.getElementById('pageContent');
        content.innerHTML = '<div class="loading">正在加载消息...</div>';

        try {
            // 加载聊天消息
            await this.loadChatMessages(this.currentShop.id, userId);
            this.renderChatMessages();
            this.showChatInput();
        } catch (error) {
            console.error('❌ 加载聊天消息失败:', error);
            content.innerHTML = this.renderEmptyState('❌', '加载失败', '请稍后重试');
        }
    }

    /**
     * 加载聊天消息
     */
    async loadChatMessages(shopId, userId) {
        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch(`/api/messages/conversation?shopId=${shopId}&userId=${userId}`, {
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentMessages = data.messages || [];
                console.log('📨 已加载聊天消息:', this.currentMessages.length, '条消息');
            } else {
                throw new Error('获取聊天消息失败');
            }
        } catch (error) {
            console.error('❌ 加载聊天消息失败:', error);
            // 使用测试数据
            this.currentMessages = [];
        }
    }

    /**
     * 渲染聊天消息
     */
    renderChatMessages() {
        const content = document.getElementById('pageContent');
        
        if (this.currentMessages.length === 0) {
            content.innerHTML = this.renderEmptyState('💭', '暂无消息', '开始对话吧');
            return;
        }

        const html = `
            <div class="chat-messages" id="chatMessages">
                ${this.currentMessages.map(msg => this.renderMessage(msg)).join('')}
            </div>
        `;

        content.innerHTML = html;
        
        // 滚动到底部
        setTimeout(() => {
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }, 100);
    }

    /**
     * 渲染消息
     */
    renderMessage(message) {
        const isUser = message.sender_type === 'user';
        const senderClass = isUser ? 'user' : 'admin';
        
        return `
            <div class="message ${senderClass}">
                <div class="message-bubble">${message.content}</div>
                <div class="message-timestamp">${this.formatTime(message.created_at)}</div>
            </div>
        `;
    }

    /**
     * 发送消息
     */
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message || !this.currentShop || !this.currentConversation) {
            return;
        }

        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch('/api/messages/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': sessionId
                },
                body: JSON.stringify({
                    shopId: this.currentShop.id,
                    userId: this.currentConversation.userId,
                    content: message,
                    senderType: 'admin'
                })
            });

            if (response.ok) {
                // 清空输入框
                input.value = '';
                
                // 添加消息到界面
                const messageObj = {
                    content: message,
                    sender_type: 'admin',
                    created_at: new Date().toISOString()
                };
                
                this.addMessageToChat(messageObj);
                
            } else {
                throw new Error('发送消息失败');
            }
        } catch (error) {
            console.error('❌ 发送消息失败:', error);
            this.showToast('发送失败，请重试', 'error');
        }
    }

    /**
     * 添加消息到聊天界面
     */
    addMessageToChat(message) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageHTML = this.renderMessage(message);
        chatMessages.insertAdjacentHTML('beforeend', messageHTML);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // 将消息添加到当前消息列表
        if (!this.currentMessages) {
            this.currentMessages = [];
        }
        this.currentMessages.push(message);
    }

    /**
     * 更新页面头部
     */
    updatePageHeader(title, showBackBtn) {
        const pageTitle = document.getElementById('pageTitle');
        const backBtn = document.getElementById('backBtn');
        
        if (pageTitle) pageTitle.textContent = title;
        if (backBtn) backBtn.style.display = showBackBtn ? 'block' : 'none';
    }

    /**
     * 显示聊天输入框
     */
    showChatInput() {
        const chatInputContainer = document.getElementById('chatInputContainer');
        if (chatInputContainer) {
            chatInputContainer.style.display = 'block';
        }
    }

    /**
     * 隐藏聊天输入框
     */
    hideChatInput() {
        const chatInputContainer = document.getElementById('chatInputContainer');
        if (chatInputContainer) {
            chatInputContainer.style.display = 'none';
        }
    }

    /**
     * 返回上一页
     */
    goBack() {
        if (this.viewStack.length > 1) {
            this.viewStack.pop();
            const previousView = this.viewStack[this.viewStack.length - 1];
            
            switch (previousView) {
                case 'overview':
                    this.showMessageOverview();
                    break;
                case 'shop':
                    this.renderShopConversations();
                    this.updatePageHeader(this.currentShop?.name || '店铺', true);
                    break;
                default:
                    this.showMessageOverview();
            }
        } else {
            this.showMessageOverview();
        }
    }

    /**
     * 刷新当前页面
     */
    async refresh() {
        switch (this.currentView) {
            case 'overview':
                await this.loadUnreadCounts();
                this.showMessageOverview();
                break;
            case 'shop':
                if (this.currentShop) {
                    await this.loadShopConversations(this.currentShop.id);
                    this.renderShopConversations();
                }
                break;
            case 'chat':
                if (this.currentShop && this.currentConversation) {
                    await this.loadChatMessages(this.currentShop.id, this.currentConversation.userId);
                    this.renderChatMessages();
                }
                break;
        }
    }

    /**
     * 更新未读徽章
     */
    updateUnreadBadges() {
        this.totalUnreadCount = Object.values(this.unreadCounts).reduce((sum, count) => sum + count, 0);
        
        // 更新底部导航的未读徽章
        const messagesBadge = document.getElementById('messagesBadge');
        if (messagesBadge) {
            if (this.totalUnreadCount > 0) {
                messagesBadge.textContent = this.totalUnreadCount;
                messagesBadge.style.display = 'flex';
            } else {
                messagesBadge.style.display = 'none';
            }
        }
    }

    /**
     * 更新连接状态
     */
    updateConnectionStatus(connected) {
        const connectionDot = document.getElementById('connectionDot');
        const connectionText = document.getElementById('connectionText');
        
        if (connectionDot) {
            if (connected) {
                connectionDot.classList.remove('disconnected');
            } else {
                connectionDot.classList.add('disconnected');
            }
        }
        
        if (connectionText) {
            connectionText.textContent = connected ? '已连接' : '未连接';
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 绑定消息输入框回车发送
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
    }

    /**
     * 启动自动刷新
     */
    startAutoRefresh() {
        // 每30秒刷新一次未读消息统计
        this.refreshTimer = setInterval(async () => {
            await this.loadUnreadCounts();
            if (this.currentView === 'overview') {
                this.showMessageOverview();
            }
        }, 30000);
    }

    /**
     * 获取店铺最后一条消息
     */
    getShopLastMessage(shopId) {
        // 这里可以从缓存或API获取最后一条消息
        return null;
    }

    /**
     * 获取店铺名称
     */
    getShopName(shopId) {
        const shop = this.shops.find(s => s.id === shopId);
        return shop ? shop.name : '未知店铺';
    }

    /**
     * 格式化时间
     */
    formatTime(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) { // 小于1分钟
            return '刚刚';
        } else if (diff < 3600000) { // 小于1小时
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (date.toDateString() === now.toDateString()) { // 今天
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
        }
    }

    /**
     * 渲染空状态
     */
    renderEmptyState(icon, message, description) {
        return `
            <div class="empty-state">
                <div class="empty-icon">${icon}</div>
                <div class="empty-message">${message}</div>
                <div class="empty-description">${description}</div>
            </div>
        `;
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        console.error('❌', message);
        // 这里可以显示错误提示
    }

    /**
     * 显示提示信息
     */
    showToast(message, type = 'info') {
        console.log('📢', message);
        // 这里可以显示提示信息
    }

    /**
     * 显示系统通知
     */
    showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body });
        }
    }

    /**
     * 播放提示音
     */
    playNotificationSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQbBzKG0fPTgC4GJWy/7N2QQgsFXsPm7qNbHQU6ltn1x3UsBC9+zPLagTEIGGG57+OZSA0PVKzn77BdGgU1kNn1yHEqBC5zxPTchjEHGGO98+WVPQ0NUqzl766OeRs=');
            audio.volume = 0.3;
            audio.play().catch(e => console.log('播放提示音失败:', e));
        } catch (error) {
            console.log('播放提示音失败:', error);
        }
    }

    /**
     * 销毁实例
     */
    destroy() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        
        if (this.websocket) {
            this.websocket.close();
        }
    }
}

// 创建全局实例
window.mobileCustomerService = new MobileEcommerceCustomerService();

console.log('📦 移动端多店铺电商客服系统模块已加载');
