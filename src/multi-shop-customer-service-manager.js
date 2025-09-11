/**
 * 多店铺电商客服最佳实践架构设计
 * 
 * 三级导航架构：
 * 1. 消息总览 -> 显示所有店铺的未读消息汇总
 * 2. 店铺对话列表 -> 点击店铺查看该店铺的所有客户对话
 * 3. 具体聊天界面 -> 点击客户查看具体对话内容
 * 
 * 类似淘宝客服的用户体验：
 * - 底部导航显示未读消息数量
 * - 按店铺分组管理对话
 * - 实时消息提醒和状态更新
 * - 支持快速回复和模板回复
 * 
 * @author QuickTalk Team
 * @version 2.0.0
 */

class MultiShopCustomerServiceManager {
    constructor() {
        this.currentUser = null;
        this.shops = [];
        this.conversations = [];
        this.unreadCounts = {};
        this.currentView = 'overview'; // overview, shop-detail, conversation
        this.currentShop = null;
        this.currentConversation = null;
        this.websocket = null;
        this.messageSearchEnabled = false;
        
        console.log('🏪 多店铺客服系统初始化');
    }

    /**
     * 初始化多店铺客服系统
     * 按照最佳实践的顺序加载功能模块
     */
    async init() {
        try {
            console.log('🚀 开始初始化多店铺客服系统...');
            
            // 阶段1：身份验证和基础数据
            await this.authenticateUser();
            await this.loadShopsWithPermissions();
            
            // 阶段2：实时通信
            this.initWebSocket();
            await this.loadUnreadCounts();
            
            // 阶段3：用户界面
            this.createCustomerServiceInterface();
            this.bindEvents();
            
            // 阶段4：高级功能（只有有数据时才启用）
            await this.conditionallyEnableAdvancedFeatures();
            
            console.log('✅ 多店铺客服系统初始化完成');
            
        } catch (error) {
            console.error('❌ 多店铺客服系统初始化失败:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * 用户身份验证
     */
    async authenticateUser() {
        const sessionId = localStorage.getItem('sessionId');
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
                console.log('👤 用户验证成功:', this.currentUser.username);
            } else {
                throw new Error('用户身份验证失败');
            }
        } catch (error) {
            console.error('❌ 身份验证失败:', error);
            throw error;
        }
    }

    /**
     * 加载用户有权限访问的店铺
     */
    async loadShopsWithPermissions() {
        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch('/api/shops', {
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                const data = await response.json();
                this.shops = Array.isArray(data) ? data : data.shops || [];
                console.log(`🏪 加载店铺权限: ${this.shops.length} 个可访问店铺`);
                
                if (this.shops.length === 0) {
                    console.warn('⚠️ 用户没有任何店铺权限');
                }
            } else {
                throw new Error('获取店铺权限失败');
            }
        } catch (error) {
            console.error('❌ 加载店铺权限失败:', error);
            throw error;
        }
    }

    /**
     * 创建多店铺客服界面
     */
    createCustomerServiceInterface() {
        const existingInterface = document.getElementById('multiShopCustomerService');
        if (existingInterface) {
            existingInterface.remove();
        }

        const interfaceHTML = this.getCustomerServiceInterfaceHTML();
        const container = document.querySelector('.main-content') || document.body;
        
        const interfaceDiv = document.createElement('div');
        interfaceDiv.id = 'multiShopCustomerService';
        interfaceDiv.innerHTML = interfaceHTML;
        
        container.appendChild(interfaceDiv);
        
        // 默认显示总览页面
        this.showOverview();
        
        console.log('🎨 多店铺客服界面已创建');
    }

    /**
     * 获取客服界面HTML
     */
    getCustomerServiceInterfaceHTML() {
        return `
            <div class="customer-service-container">
                <!-- 头部导航 -->
                <div class="cs-header">
                    <div class="cs-nav">
                        <button class="nav-btn ${this.currentView === 'overview' ? 'active' : ''}" 
                                onclick="customerServiceManager.showOverview()">
                            📊 消息总览
                        </button>
                        <button class="nav-btn" id="backBtn" style="display: none;" 
                                onclick="customerServiceManager.goBack()">
                            ← 返回
                        </button>
                    </div>
                    <div class="cs-title" id="csTitle">消息总览</div>
                </div>

                <!-- 主要内容区域 -->
                <div class="cs-content" id="csContent">
                    <!-- 内容将通过JavaScript动态加载 -->
                </div>

                <!-- 底部导航栏 -->
                <div class="bottom-nav">
                    <div class="nav-item ${this.currentView === 'overview' ? 'active' : ''}" 
                         onclick="customerServiceManager.showOverview()">
                        <div class="nav-icon">💬</div>
                        <div class="nav-text">消息</div>
                        <div class="nav-badge" id="totalUnreadBadge" style="display: none;">0</div>
                    </div>
                    <div class="nav-item" onclick="customerServiceManager.showAnalytics()">
                        <div class="nav-icon">📊</div>
                        <div class="nav-text">数据</div>
                    </div>
                    <div class="nav-item" onclick="customerServiceManager.showSettings()">
                        <div class="nav-icon">⚙️</div>
                        <div class="nav-text">设置</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 显示消息总览（所有店铺的消息汇总）
     */
    showOverview() {
        this.currentView = 'overview';
        this.currentShop = null;
        this.currentConversation = null;
        
        document.getElementById('csTitle').textContent = '消息总览';
        document.getElementById('backBtn').style.display = 'none';
        
        const content = document.getElementById('csContent');
        content.innerHTML = this.getOverviewHTML();
        
        this.loadOverviewData();
        this.updateBottomNavActive('overview');
        
        console.log('📊 显示消息总览');
    }

    /**
     * 获取总览页面HTML
     */
    getOverviewHTML() {
        return `
            <div class="overview-container">
                <!-- 统计卡片 -->
                <div class="stats-cards">
                    <div class="stat-card">
                        <div class="stat-number" id="totalUnreadMessages">0</div>
                        <div class="stat-label">未读消息</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="activeConversations">0</div>
                        <div class="stat-label">活跃对话</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="onlineShops">0</div>
                        <div class="stat-label">在线店铺</div>
                    </div>
                </div>

                <!-- 店铺列表 -->
                <div class="shops-section">
                    <h3>📝 店铺消息</h3>
                    <div class="shops-list" id="shopsList">
                        <div class="loading">正在加载店铺列表...</div>
                    </div>
                </div>

                <!-- 快速操作 -->
                <div class="quick-actions">
                    <h3>⚡ 快速操作</h3>
                    <div class="action-buttons">
                        <button class="action-btn" onclick="customerServiceManager.showAllUnread()">
                            📮 查看所有未读
                        </button>
                        <button class="action-btn" onclick="customerServiceManager.showRecentChats()">
                            🕒 最近对话
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 加载总览数据
     */
    async loadOverviewData() {
        try {
            // 统计数据
            let totalUnread = 0;
            let activeConversations = 0;
            let onlineShops = this.shops.length;

            for (const shopId in this.unreadCounts) {
                totalUnread += this.unreadCounts[shopId];
                if (this.unreadCounts[shopId] > 0) {
                    activeConversations++;
                }
            }

            // 更新统计显示
            document.getElementById('totalUnreadMessages').textContent = totalUnread;
            document.getElementById('activeConversations').textContent = activeConversations;
            document.getElementById('onlineShops').textContent = onlineShops;

            // 更新底部导航未读数
            this.updateBottomNavUnreadCount(totalUnread);

            // 加载店铺列表
            await this.loadShopsListForOverview();

        } catch (error) {
            console.error('❌ 加载总览数据失败:', error);
        }
    }

    /**
     * 为总览页面加载店铺列表
     */
    async loadShopsListForOverview() {
        const shopsList = document.getElementById('shopsList');
        
        if (this.shops.length === 0) {
            shopsList.innerHTML = '<div class="empty-state">暂无店铺</div>';
            return;
        }

        const shopsHTML = this.shops.map(shop => {
            const unreadCount = this.unreadCounts[shop.id] || 0;
            const hasUnread = unreadCount > 0;
            
            return `
                <div class="shop-item ${hasUnread ? 'has-unread' : ''}" 
                     onclick="customerServiceManager.showShopDetail(${shop.id})">
                    <div class="shop-info">
                        <div class="shop-avatar">🏪</div>
                        <div class="shop-details">
                            <div class="shop-name">${shop.name}</div>
                            <div class="shop-status">
                                ${hasUnread ? `${unreadCount} 条未读消息` : '暂无新消息'}
                            </div>
                        </div>
                    </div>
                    ${hasUnread ? `<div class="unread-badge">${unreadCount}</div>` : ''}
                    <div class="arrow">→</div>
                </div>
            `;
        }).join('');

        shopsList.innerHTML = shopsHTML;
    }

    /**
     * 显示特定店铺的对话列表
     */
    async showShopDetail(shopId) {
        const shop = this.shops.find(s => s.id === shopId);
        if (!shop) {
            console.error('❌ 店铺不存在:', shopId);
            return;
        }

        this.currentView = 'shop-detail';
        this.currentShop = shop;
        this.currentConversation = null;

        document.getElementById('csTitle').textContent = shop.name;
        document.getElementById('backBtn').style.display = 'block';

        const content = document.getElementById('csContent');
        content.innerHTML = '<div class="loading">正在加载对话列表...</div>';

        try {
            await this.loadShopConversations(shopId);
        } catch (error) {
            console.error('❌ 加载店铺对话失败:', error);
            content.innerHTML = '<div class="error">加载对话列表失败</div>';
        }

        console.log('🏪 显示店铺详情:', shop.name);
    }

    /**
     * 加载店铺的对话列表
     */
    async loadShopConversations(shopId) {
        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch(`/api/shops/${shopId}/conversations`, {
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                const conversations = await response.json();
                this.renderShopConversations(conversations);
            } else {
                throw new Error('获取对话列表失败');
            }
        } catch (error) {
            console.error('❌ 加载店铺对话失败:', error);
            throw error;
        }
    }

    /**
     * 渲染店铺对话列表
     */
    renderShopConversations(conversations) {
        const content = document.getElementById('csContent');
        
        if (conversations.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💬</div>
                    <div class="empty-title">暂无对话</div>
                    <div class="empty-desc">当前店铺还没有客户对话</div>
                </div>
            `;
            return;
        }

        const conversationsHTML = `
            <div class="conversations-container">
                <div class="conversations-header">
                    <h3>💬 客户对话 (${conversations.length})</h3>
                </div>
                <div class="conversations-list">
                    ${conversations.map(conv => this.getConversationItemHTML(conv)).join('')}
                </div>
            </div>
        `;

        content.innerHTML = conversationsHTML;
    }

    /**
     * 获取对话项HTML
     */
    getConversationItemHTML(conversation) {
        const unreadCount = conversation.unread_count || 0;
        const hasUnread = unreadCount > 0;
        const lastMessage = conversation.last_message || '';
        const lastTime = conversation.last_message_time ? 
                         new Date(conversation.last_message_time).toLocaleString() : '';

        return `
            <div class="conversation-item ${hasUnread ? 'has-unread' : ''}" 
                 onclick="customerServiceManager.showConversation(${conversation.id})">
                <div class="customer-avatar">👤</div>
                <div class="conversation-info">
                    <div class="customer-name">${conversation.customer_name || '匿名客户'}</div>
                    <div class="last-message">${lastMessage}</div>
                    <div class="last-time">${lastTime}</div>
                </div>
                ${hasUnread ? `<div class="unread-badge">${unreadCount}</div>` : ''}
            </div>
        `;
    }

    /**
     * 显示具体对话
     */
    async showConversation(conversationId) {
        try {
            this.currentView = 'conversation';
            this.currentConversation = { id: conversationId };

            const content = document.getElementById('csContent');
            content.innerHTML = '<div class="loading">正在加载对话...</div>';

            // 加载对话消息
            await this.loadConversationMessages(conversationId);

            // 标记为已读
            await this.markConversationAsRead(conversationId);

            console.log('💬 显示对话:', conversationId);

        } catch (error) {
            console.error('❌ 显示对话失败:', error);
        }
    }

    /**
     * 条件性启用高级功能
     * 只有在用户有数据且登录后才启用搜索等高级功能
     */
    async conditionallyEnableAdvancedFeatures() {
        try {
            // 检查是否有消息数据
            const hasShops = this.shops.length > 0;
            const hasUnreadMessages = Object.keys(this.unreadCounts).length > 0;
            const hasData = hasShops || hasUnreadMessages;

            if (hasData) {
                console.log('📊 检测到消息数据，启用高级功能...');
                
                // 启用消息搜索功能
                await this.enableMessageSearch();
                
                // 可以在这里添加其他高级功能
                // await this.enableAnalytics();
                // await this.enableAIFeatures();
                
            } else {
                console.log('⏰ 暂无消息数据，高级功能将在有数据时自动启用');
            }
        } catch (error) {
            console.error('❌ 启用高级功能失败:', error);
        }
    }

    /**
     * 启用消息搜索功能
     */
    async enableMessageSearch() {
        if (this.messageSearchEnabled) {
            console.log('🔍 消息搜索已启用');
            return;
        }

        if (typeof initMessageSearch === 'function') {
            const result = initMessageSearch();
            if (result) {
                this.messageSearchEnabled = true;
                console.log('✅ 消息搜索功能已启用');
            } else {
                console.warn('⚠️ 消息搜索功能启用失败');
            }
        } else {
            console.warn('⚠️ 消息搜索功能不可用');
        }
    }

    /**
     * 返回上一级
     */
    goBack() {
        if (this.currentView === 'conversation') {
            this.showShopDetail(this.currentShop.id);
        } else if (this.currentView === 'shop-detail') {
            this.showOverview();
        }
    }

    /**
     * 更新底部导航未读数
     */
    updateBottomNavUnreadCount(totalUnread = null) {
        if (totalUnread === null) {
            totalUnread = Object.values(this.unreadCounts).reduce((sum, count) => sum + count, 0);
        }

        const badge = document.getElementById('totalUnreadBadge');
        if (badge) {
            if (totalUnread > 0) {
                badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    /**
     * 更新底部导航活动状态
     */
    updateBottomNavActive(activeView) {
        document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        if (activeView === 'overview') {
            document.querySelector('.bottom-nav .nav-item').classList.add('active');
        }
    }

    /**
     * WebSocket消息处理
     */
    handleWebSocketMessage(data) {
        console.log('📨 收到WebSocket消息:', data);

        switch (data.type) {
            case 'new_message':
                this.handleNewMessage(data.message);
                break;
            case 'message_read':
                this.handleMessageRead(data.messageId);
                break;
            case 'conversation_update':
                this.handleConversationUpdate(data.conversation);
                break;
            default:
                console.log('🤔 未知消息类型:', data.type);
        }
    }

    /**
     * 处理新消息
     */
    handleNewMessage(message) {
        console.log('📨 收到新消息:', message);
        
        // 更新未读计数
        if (!this.unreadCounts[message.shop_id]) {
            this.unreadCounts[message.shop_id] = 0;
        }
        this.unreadCounts[message.shop_id]++;
        
        // 更新UI
        this.updateBottomNavUnreadCount();
        
        // 如果在总览页面，刷新数据
        if (this.currentView === 'overview') {
            this.loadOverviewData();
        }
        
        // 如果在对应店铺页面，刷新对话列表
        if (this.currentView === 'shop-detail' && this.currentShop && this.currentShop.id === message.shop_id) {
            this.loadShopConversations(this.currentShop.id);
        }
        
        // 如果搜索功能还未启用，现在有消息数据了，尝试启用
        if (!this.messageSearchEnabled) {
            this.enableMessageSearch();
        }
    }

    /**
     * 初始化错误处理
     */
    handleInitializationError(error) {
        console.error('❌ 初始化失败:', error);
        
        const content = document.getElementById('csContent') || document.body;
        content.innerHTML = `
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <div class="error-title">初始化失败</div>
                <div class="error-message">${error.message}</div>
                <button class="retry-btn" onclick="customerServiceManager.init()">重试</button>
            </div>
        `;
    }

    /**
     * 初始化错误处理
     */
    handleInitializationError(error) {
        console.error('❌ 初始化失败:', error);
        
        const content = document.getElementById('csContent') || document.body;
        content.innerHTML = `
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <div class="error-title">初始化失败</div>
                <div class="error-message">${error.message}</div>
                <button class="retry-btn" onclick="customerServiceManager.init()">重试</button>
            </div>
        `;
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
                console.log('📊 未读消息统计:', this.unreadCounts);
            } else {
                console.warn('⚠️ 获取未读消息统计失败');
            }
        } catch (error) {
            console.error('❌ 加载未读消息统计失败:', error);
        }
    }

    /**
     * 初始化WebSocket连接
     */
    initWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('🔌 WebSocket连接已建立');
                // 发送身份验证
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
                    console.error('❌ WebSocket消息解析失败:', error);
                }
            };

            this.websocket.onclose = () => {
                console.log('🔌 WebSocket连接已断开，5秒后重连...');
                setTimeout(() => this.initWebSocket(), 5000);
            };

            this.websocket.onerror = (error) => {
                console.error('❌ WebSocket连接错误:', error);
            };

        } catch (error) {
            console.error('❌ WebSocket初始化失败:', error);
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 页面可见性变化处理
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.websocket && this.websocket.readyState !== WebSocket.OPEN) {
                console.log('🔄 页面重新激活，重连WebSocket');
                this.initWebSocket();
            }
        });

        // 窗口焦点变化处理
        window.addEventListener('focus', () => {
            this.refreshCurrentView();
        });

        console.log('🎧 事件监听器已绑定');
    }

    /**
     * 刷新当前视图
     */
    refreshCurrentView() {
        if (this.currentView === 'overview') {
            this.loadOverviewData();
        } else if (this.currentView === 'shop-detail' && this.currentShop) {
            this.loadShopConversations(this.currentShop.id);
        } else if (this.currentView === 'conversation' && this.currentConversation) {
            this.loadConversationMessages(this.currentConversation.id);
        }
    }

    /**
     * 加载对话消息
     */
    async loadConversationMessages(conversationId) {
        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch(`/api/conversations/${conversationId}/messages`, {
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                const messages = await response.json();
                this.renderConversation(messages);
            } else {
                throw new Error('获取对话消息失败');
            }
        } catch (error) {
            console.error('❌ 加载对话消息失败:', error);
            const content = document.getElementById('csContent');
            content.innerHTML = '<div class="error">加载对话失败</div>';
        }
    }

    /**
     * 渲染对话界面
     */
    renderConversation(messages) {
        const content = document.getElementById('csContent');
        
        const conversationHTML = `
            <div class="conversation-container">
                <div class="messages-list" id="messagesList">
                    ${messages.map(msg => this.getMessageHTML(msg)).join('')}
                </div>
                <div class="message-input-container">
                    <input type="text" id="messageInput" placeholder="输入消息..." class="message-input">
                    <button id="sendBtn" class="send-btn">发送</button>
                </div>
            </div>
        `;

        content.innerHTML = conversationHTML;

        // 绑定发送消息事件
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // 滚动到底部
        setTimeout(() => {
            const messagesList = document.getElementById('messagesList');
            messagesList.scrollTop = messagesList.scrollHeight;
        }, 100);
    }

    /**
     * 获取消息HTML
     */
    getMessageHTML(message) {
        const isStaff = message.sender_type === 'staff';
        const time = new Date(message.timestamp).toLocaleTimeString();
        
        return `
            <div class="message ${isStaff ? 'message-staff' : 'message-customer'}">
                <div class="message-content">${message.content}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
    }

    /**
     * 发送消息
     */
    async sendMessage() {
        const input = document.getElementById('messageInput');
        if (!input || !this.currentConversation) return;

        const content = input.value.trim();
        if (!content) return;

        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch(`/api/conversations/${this.currentConversation.id}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': sessionId
                },
                body: JSON.stringify({
                    content: content,
                    sender_type: 'staff'
                })
            });

            if (response.ok) {
                input.value = '';
                // 重新加载消息
                await this.loadConversationMessages(this.currentConversation.id);
            } else {
                throw new Error('发送消息失败');
            }
        } catch (error) {
            console.error('❌ 发送消息失败:', error);
            alert('发送消息失败');
        }
    }

    /**
     * 标记对话为已读
     */
    async markConversationAsRead(conversationId) {
        try {
            const sessionId = localStorage.getItem('sessionId');
            await fetch(`/api/conversations/${conversationId}/mark-read`, {
                method: 'POST',
                headers: { 'X-Session-Id': sessionId }
            });
            
            // 更新本地未读计数
            for (const shopId in this.unreadCounts) {
                if (this.unreadCounts[shopId] > 0) {
                    this.unreadCounts[shopId] = Math.max(0, this.unreadCounts[shopId] - 1);
                }
            }
            
            this.updateBottomNavUnreadCount();
            
        } catch (error) {
            console.error('❌ 标记已读失败:', error);
        }
    }

    /**
     * 显示数据分析页面
     */
    showAnalytics() {
        console.log('📊 显示数据分析页面');
        // TODO: 实现数据分析页面
        alert('数据分析功能开发中...');
    }

    /**
     * 显示设置页面
     */
    showSettings() {
        console.log('⚙️ 显示设置页面');
        // TODO: 实现设置页面
        alert('设置功能开发中...');
    }

    /**
     * 显示所有未读消息
     */
    showAllUnread() {
        console.log('📮 显示所有未读消息');
        // TODO: 实现显示所有未读消息
        alert('查看所有未读消息功能开发中...');
    }

    /**
     * 显示最近对话
     */
    showRecentChats() {
        console.log('🕒 显示最近对话');
        // TODO: 实现显示最近对话
        alert('最近对话功能开发中...');
    }

    // 其他必要的方法将继续补充...
}

// 全局实例
window.customerServiceManager = null;

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiShopCustomerServiceManager;
}
