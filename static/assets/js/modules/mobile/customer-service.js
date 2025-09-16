/**
 * 移动端多店铺客服系统 - 完整版
 * 采用三级架构：消息总览 -> 店铺对话列表 -> 具体聊天
 * 类似淘宝等电商平台的客服系统设计
 * 
 * @author QuickTalk Team
 * @version 2.0.0
 * @date 2025-09-12
 */

class MobileCustomerService {
    constructor() {
        this.currentUser = null;
        this.shops = [];
        this.conversations = {};  // 按店铺ID分组的对话
        this.currentShop = null;
        this.currentConversation = null;
        this.unreadCounts = {};   // 按店铺ID的未读消息数
        this.websocket = null;
        this.pageStack = ['home'];
        this.isInitialized = false;
        
        console.log('📱 移动端多店铺客服系统初始化');
    }

    /**
     * 初始化客服系统
     */
    async init() {
        if (this.isInitialized) {
            console.log('⚠️ 客服系统已初始化，跳过重复初始化');
            return;
        }

        try {
            console.log('🚀 开始初始化移动端客服系统...');
            
            // 获取当前用户信息
            await this.getCurrentUser();
            
            // 加载店铺列表
            await this.loadShops();
            
            // 加载未读消息统计
            await this.loadUnreadCounts();
            
            // 初始化WebSocket连接
            this.initWebSocket();
            
            // 绑定事件监听器
            this.bindEvents();
            
            // 更新底部导航未读数
            this.updateBottomNavUnreadCount();
            
            this.isInitialized = true;
            console.log('✅ 移动端客服系统初始化完成');
            
        } catch (error) {
            console.error('❌ 客服系统初始化失败:', error);
            this.showError('系统初始化失败: ' + error.message);
        }
    }

    /**
     * 获取当前用户信息
     */
    async getCurrentUser() {
        const sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            throw new Error('未找到登录会话');
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
                throw new Error('获取用户信息失败');
            }
        } catch (error) {
            console.error('❌ 获取用户信息失败:', error);
            throw error;
        }
    }

    /**
     * 加载店铺列表
     */
    async loadShops() {
        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch('/api/shops', {
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                const data = await response.json();
                this.shops = Array.isArray(data) ? data : data.shops || [];
                console.log(`🏪 加载店铺列表: ${this.shops.length} 个店铺`);
            } else {
                throw new Error('加载店铺列表失败');
            }
        } catch (error) {
            console.error('❌ 加载店铺列表失败:', error);
            throw error;
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
            // 使用统一的WebSocket客户端
            if (typeof UnifiedWebSocketClient === 'undefined') {
                console.error('错误: UnifiedWebSocketClient 未加载。请先引入 websocket-client.min.js');
                return;
            }

            this.websocket = UnifiedWebSocketClient.createCustomerClient({
                debug: true,
                reconnect: true,
                heartbeat: true,
                sessionId: localStorage.getItem('sessionId')
            });

            this.websocket.onOpen(() => {
                console.log('🔌 WebSocket连接已建立');
            });

            this.websocket.onMessage((data) => {
                try {
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('❌ WebSocket消息解析失败:', error);
                }
            });

            this.websocket.onClose(() => {
                console.log('🔌 WebSocket连接已断开，5秒后重连...');
                setTimeout(() => this.initWebSocket(), 5000);
            });

            this.websocket.onError((error) => {
                console.error('❌ WebSocket连接错误:', error);
            });

            // 连接WebSocket
            this.websocket.connect();

            this.websocket.onerror = (error) => {
                console.error('❌ WebSocket连接错误:', error);
            };

        } catch (error) {
            console.error('❌ WebSocket初始化失败:', error);
        }
    }

    /**
     * 处理WebSocket消息
     */
    handleWebSocketMessage(data) {
        console.log('📨 收到WebSocket消息:', data);

        switch (data.type) {
            case 'new_message':
                this.handleNewMessage(data);
                break;
            case 'message_read':
                this.handleMessageRead(data);
                break;
            case 'conversation_update':
                this.handleConversationUpdate(data);
                break;
            case 'unread_count_update':
                this.handleUnreadCountUpdate(data);
                break;
            default:
                console.log('🤔 未知消息类型:', data.type);
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
        
        // 更新底部导航未读数
        this.updateBottomNavUnreadCount();
        
        // 如果当前正在查看该对话，实时更新消息
        if (this.currentShop?.id === shopId && this.currentConversation?.userId === userId) {
            this.appendMessageToChat(message);
        }
        
        // 显示通知
        this.showNotification(`${data.shopName || '店铺'} 有新消息`, message.content);
        
        console.log('📨 处理新消息完成:', { shopId, userId, unreadCount: this.unreadCounts[shopId] });
    }

    /**
     * 处理消息已读
     */
    handleMessageRead(data) {
        const { shopId, messageId } = data;
        
        // 减少未读计数
        if (this.unreadCounts[shopId] > 0) {
            this.unreadCounts[shopId]--;
        }
        
        // 更新底部导航未读数
        this.updateBottomNavUnreadCount();
        
        console.log('👁️ 消息已读:', { shopId, messageId, unreadCount: this.unreadCounts[shopId] });
    }

    /**
     * 处理未读计数更新
     */
    handleUnreadCountUpdate(data) {
        const { shopId, count } = data;
        this.unreadCounts[shopId] = count;
        this.updateBottomNavUnreadCount();
        console.log('🔢 未读计数更新:', { shopId, count });
    }

    /**
     * 显示消息总览页面（店铺列表）
     */
    showMessageOverview() {
        console.log('📋 显示消息总览');
        
        const content = document.getElementById('messagesContent');
        const title = document.getElementById('messagesTitle');
        
        if (!content) {
            console.error('❌ 找不到消息内容容器');
            return;
        }

        title.textContent = '消息中心';

        // 计算总未读数
        const totalUnread = Object.values(this.unreadCounts).reduce((sum, count) => sum + count, 0);

        if (this.shops.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🏪</div>
                    <div class="empty-title">暂无店铺</div>
                    <div class="empty-subtitle">请先创建店铺来接收消息</div>
                    <button class="action-btn" onclick="window.mobileCustomerService.goToShopsPage()">
                        前往店铺管理
                    </button>
                </div>
            `;
            return;
        }

        const html = `
            <div class="message-overview">
                <div class="stats-summary">
                    <div class="stats-item">
                        <div class="stats-number">${this.shops.length}</div>
                        <div class="stats-label">总店铺</div>
                    </div>
                    <div class="stats-item highlight">
                        <div class="stats-number">${totalUnread}</div>
                        <div class="stats-label">未读消息</div>
                    </div>
                </div>
                
                <div class="shop-list">
                    ${this.shops.map(shop => this.renderShopItem(shop)).join('')}
                </div>
            </div>
        `;

        content.innerHTML = html;
    }

    /**
     * 渲染店铺项目
     */
    renderShopItem(shop) {
        const unreadCount = this.unreadCounts[shop.id] || 0;
        const hasUnread = unreadCount > 0;

        return `
            <div class="shop-item ${hasUnread ? 'has-unread' : ''}" 
                 onclick="window.mobileCustomerService.showShopConversations('${shop.id}')">
                <div class="shop-avatar">
                    <div class="avatar-text">${shop.name.charAt(0)}</div>
                    ${hasUnread ? `<div class="unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</div>` : ''}
                </div>
                <div class="shop-info">
                    <div class="shop-name">${shop.name}</div>
                    <div class="shop-domain">${shop.domain}</div>
                    <div class="shop-status ${shop.status}">${this.getShopStatusText(shop.status)}</div>
                </div>
                <div class="shop-meta">
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
        
        this.currentShop = this.shops.find(shop => shop.id === shopId);
        if (!this.currentShop) {
            console.error('❌ 找不到店铺:', shopId);
            return;
        }

        const content = document.getElementById('messagesContent');
        const title = document.getElementById('messagesTitle');
        
        title.textContent = this.currentShop.name;
        content.innerHTML = '<div class="loading">正在加载对话...</div>';

        try {
            await this.loadShopConversations(shopId);
            this.renderShopConversations();
        } catch (error) {
            console.error('❌ 加载店铺对话失败:', error);
            content.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">加载失败</div>
                    <div class="error-subtitle">${error.message}</div>
                    <button class="retry-btn" onclick="window.mobileCustomerService.showShopConversations('${shopId}')">
                        重试
                    </button>
                </div>
            `;
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
                const conversations = await response.json();
                this.conversations[shopId] = conversations;
                console.log(`💬 加载店铺 ${shopId} 的对话: ${conversations.length} 个对话`);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取对话列表失败');
            }
        } catch (error) {
            console.error('❌ 加载店铺对话失败:', error);
            throw error;
        }
    }

    /**
     * 渲染店铺对话列表
     */
    renderShopConversations() {
        const content = document.getElementById('messagesContent');
        const conversations = this.conversations[this.currentShop.id] || [];

        if (conversations.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💬</div>
                    <div class="empty-title">暂无对话</div>
                    <div class="empty-subtitle">等待客户发起对话</div>
                </div>
            `;
            return;
        }

        const html = `
            <div class="conversation-list">
                ${conversations.map(conv => this.renderConversationItem(conv)).join('')}
            </div>
        `;

        content.innerHTML = html;
    }

    /**
     * 渲染对话项目
     */
    renderConversationItem(conversation) {
        const hasUnread = conversation.unreadCount > 0;
        const lastMessageTime = this.formatTime(conversation.lastMessageTime);

        return `
            <div class="conversation-item ${hasUnread ? 'has-unread' : ''}" 
                 onclick="window.mobileCustomerService.openChat('${conversation.userId}')">
                <div class="user-avatar">
                    <div class="avatar-text">${conversation.userName.charAt(0)}</div>
                    ${hasUnread ? `<div class="unread-badge">${conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</div>` : ''}
                </div>
                <div class="conversation-info">
                    <div class="conversation-meta">
                        <div class="user-name">${conversation.userName}</div>
                        <div class="message-time">${lastMessageTime}</div>
                    </div>
                    <div class="last-message">${conversation.lastMessage || '暂无消息'}</div>
                </div>
                <div class="conversation-actions">
                    <div class="chevron">›</div>
                </div>
            </div>
        `;
    }

    /**
     * 打开聊天页面
     */
    async openChat(userId) {
        console.log('💬 打开聊天页面:', { shopId: this.currentShop.id, userId });
        
        this.currentConversation = this.conversations[this.currentShop.id]?.find(c => c.userId === userId);
        if (!this.currentConversation) {
            console.error('❌ 找不到对话:', userId);
            return;
        }

        // 切换到聊天页面
        this.switchToPage('chat');
        
        // 加载聊天消息
        await this.loadChatMessages(userId);
        
        // 标记消息为已读
        this.markConversationAsRead(userId);
    }

    /**
     * 加载聊天消息
     */
    async loadChatMessages(userId) {
        const chatMessages = document.getElementById('chatMessages');
        const chatTitle = document.getElementById('chatTitle');
        
        chatTitle.textContent = this.currentConversation.userName;
        chatMessages.innerHTML = '<div class="loading">正在加载消息...</div>';

        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch(`/api/shops/${this.currentShop.id}/users/${userId}/messages`, {
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                const messages = await response.json();
                this.renderChatMessages(messages);
            } else {
                throw new Error('加载聊天消息失败');
            }
        } catch (error) {
            console.error('❌ 加载聊天消息失败:', error);
            chatMessages.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">加载失败</div>
                    <button class="retry-btn" onclick="window.mobileCustomerService.loadChatMessages('${userId}')">
                        重试
                    </button>
                </div>
            `;
        }
    }

    /**
     * 渲染聊天消息
     */
    renderChatMessages(messages) {
        const chatMessages = document.getElementById('chatMessages');
        
        if (messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💬</div>
                    <div class="empty-title">暂无消息</div>
                </div>
            `;
            return;
        }

        const html = messages.map(msg => this.renderChatMessage(msg)).join('');
        chatMessages.innerHTML = html;
        
        // 滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * 渲染单条聊天消息
     */
    renderChatMessage(message) {
        const isUser = message.sender === 'user';
        const time = this.formatTime(message.created_at);

        return `
            <div class="message ${isUser ? 'user' : 'admin'}">
                <div class="message-content">
                    <div class="message-text">${message.content}</div>
                    <div class="message-time">${time}</div>
                </div>
            </div>
        `;
    }

    /**
     * 发送消息
     */
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message || !this.currentConversation) {
            return;
        }

        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch('/api/send-admin-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': sessionId
                },
                body: JSON.stringify({
                    shopId: this.currentShop.id,
                    userId: this.currentConversation.userId,
                    message: message
                })
            });

            if (response.ok) {
                // 清空输入框
                input.value = '';
                
                // 添加消息到聊天界面
                this.appendMessageToChat({
                    content: message,
                    sender: 'admin',
                    created_at: new Date().toISOString()
                });
                
                console.log('✅ 消息发送成功');
            } else {
                throw new Error('发送消息失败');
            }
        } catch (error) {
            console.error('❌ 发送消息失败:', error);
            this.showError('发送消息失败: ' + error.message);
        }
    }

    /**
     * 添加消息到聊天界面
     */
    appendMessageToChat(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageHtml = this.renderChatMessage(message);
        
        chatMessages.insertAdjacentHTML('beforeend', messageHtml);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * 标记对话为已读
     */
    async markConversationAsRead(userId) {
        try {
            const sessionId = localStorage.getItem('sessionId');
            await fetch('/api/mark-messages-read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': sessionId
                },
                body: JSON.stringify({
                    shopId: this.currentShop.id,
                    userId: userId
                })
            });

            // 更新本地未读计数
            if (this.unreadCounts[this.currentShop.id] > 0) {
                this.unreadCounts[this.currentShop.id] -= this.currentConversation.unreadCount;
                this.currentConversation.unreadCount = 0;
                this.updateBottomNavUnreadCount();
            }

        } catch (error) {
            console.error('❌ 标记消息已读失败:', error);
        }
    }

    /**
     * 更新底部导航未读数
     */
    updateBottomNavUnreadCount() {
        const badge = document.getElementById('messagesBadge');
        if (!badge) return;

        const totalUnread = Object.values(this.unreadCounts).reduce((sum, count) => sum + count, 0);
        
        if (totalUnread > 0) {
            badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }

    /**
     * 页面切换
     */
    switchToPage(pageName) {
        // 隐藏当前页面
        document.querySelectorAll('.page.active').forEach(page => {
            page.classList.remove('active');
        });

        // 显示目标页面
        const targetPage = document.getElementById(pageName + 'Page');
        if (targetPage) {
            targetPage.classList.add('active');
            
            // 更新页面栈
            if (this.pageStack[this.pageStack.length - 1] !== pageName) {
                this.pageStack.push(pageName);
            }
        }
    }

    /**
     * 返回上一页
     */
    goBack() {
        if (this.pageStack.length > 1) {
            this.pageStack.pop();
            const previousPage = this.pageStack[this.pageStack.length - 1];
            
            if (previousPage === 'messages') {
                // 如果返回到消息页面，需要重新显示相应内容
                if (this.currentShop) {
                    this.renderShopConversations();
                } else {
                    this.showMessageOverview();
                }
            }
            
            this.switchToPage(previousPage);
        }
    }

    /**
     * 前往店铺管理页面
     */
    goToShopsPage() {
        const event = new CustomEvent('switchPage', { detail: 'shops' });
        document.dispatchEvent(event);
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 消息输入框回车发送
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }

        // 返回按钮
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('back-btn')) {
                this.goBack();
            }
        });

        console.log('🎧 事件监听器已绑定');
    }

    /**
     * 获取店铺状态文本
     */
    getShopStatusText(status) {
        const statusMap = {
            'active': '运行中',
            'pending': '审核中',
            'suspended': '已暂停',
            'rejected': '已拒绝'
        };
        return statusMap[status] || '未知';
    }

    /**
     * 格式化时间
     */
    formatTime(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // 小于1分钟
        if (diff < 60000) {
            return '刚刚';
        }
        
        // 小于1小时
        if (diff < 3600000) {
            return Math.floor(diff / 60000) + '分钟前';
        }
        
        // 小于1天
        if (diff < 86400000) {
            return Math.floor(diff / 3600000) + '小时前';
        }
        
        // 大于1天，显示具体时间
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    /**
     * 显示通知
     */
    showNotification(title, message) {
        // 如果支持浏览器通知
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '/favicon.ico'
            });
        }
        
        // 显示页面内通知
        console.log(`🔔 ${title}: ${message}`);
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        console.error('❌ 错误:', message);
        // 可以添加更友好的错误显示
    }

    /**
     * 请求通知权限
     */
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
}

// 全局实例
window.mobileCustomerService = new MobileCustomerService();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 DOM加载完成，准备初始化客服系统');
});

console.log('📦 移动端多店铺客服系统模块已加载');
