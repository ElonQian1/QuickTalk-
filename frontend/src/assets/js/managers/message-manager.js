/**
 * MessageManager - 消息管理器
 * 负责消息和对话的管理，包括店铺对话列表、聊天界面等
 * 
 * 功能特性:
 * - 店铺消息列表加载和渲染
 * - 对话列表管理和显示
 * - 聊天消息的加载和渲染
 * - 实时消息计数和通知
 * - 时间格式化和用户体验优化
 */

export class MessageManager {
    constructor(dependencies = {}) {
        // 依赖注入
        this.apiClient = dependencies.apiClient || window.APIClient;
        this.eventBus = dependencies.eventBus || window.EventBus;
        this.config = dependencies.config || window.ConfigManager;
        this.utils = dependencies.utils || window.Utils;
        this.pageManager = dependencies.pageManager || window.PageManager;
        
        // 状态管理
        this.currentShops = [];
        this.messageCounters = new Map();
        this.conversations = new Map();
        this.loadingStates = new Map();
        this.currentChatShop = null;
        this.currentChatUser = null;
        
        // 配置
        this.loadingDelay = 500; // 模拟加载延迟
        this.refreshInterval = 30000; // 自动刷新间隔
        this.refreshTimer = null;
        
        this.init();
    }
    
    /**
     * 初始化管理器
     */
    init() {
        this.bindEvents();
        this.startAutoRefresh();
        this.logInfo('MessageManager 初始化完成');
    }
    
    /**
     * 绑定事件监听
     */
    bindEvents() {
        // 监听店铺数据更新
        this.eventBus?.on('shops:loaded', (data) => {
            this.currentShops = data.shops || [];
            this.logInfo('收到店铺数据更新:', this.currentShops.length);
        });
        
        // 监听页面切换
        this.eventBus?.on('page:switched', (pageId, params) => {
            if (pageId === 'messages') {
                this.loadShopList();
            } else if (pageId === 'chat') {
                if (params?.shopId && params?.userId) {
                    this.loadChatMessages(params.shopId, params.userId);
                }
            }
        });
        
        // 监听新消息事件
        this.eventBus?.on('message:received', (messageData) => {
            this.handleNewMessage(messageData);
        });
        
        // 监听WebSocket连接状态
        this.eventBus?.on('websocket:connected', () => {
            this.logInfo('WebSocket已连接，开始实时消息同步');
        });
    }
    
    /**
     * 加载店铺列表（用于消息页面）
     */
    loadShopList() {
        const contentElement = document.getElementById('messagesContent');
        const titleElement = document.getElementById('messagesTitle');
        
        if (!contentElement || !titleElement) {
            this.logError('找不到消息页面元素');
            return;
        }
        
        titleElement.textContent = '店铺列表';
        this.showLoadingState(contentElement, '正在加载店铺...');
        
        // 模拟异步加载
        setTimeout(() => {
            this.renderShopList(contentElement);
        }, this.loadingDelay);
    }
    
    /**
     * 渲染店铺列表
     * @param {HTMLElement} container - 容器元素
     */
    renderShopList(container) {
        if (this.currentShops.length === 0) {
            this.renderEmptyState(container, {
                icon: '🏪',
                title: '暂无店铺',
                subtitle: '请先创建店铺'
            });
            return;
        }
        
        const shopListHTML = this.currentShops.map(shop => {
            const unreadCount = this.messageCounters.get(shop.id) || 0;
            const shopName = this.utils?.escapeHtml(shop.name) || shop.name;
            const shopDomain = this.utils?.escapeHtml(shop.domain) || shop.domain;
            
            return `
                <div class="shop-item" onclick="window.MessageManager?.viewShopConversations('${shop.id}') || MessageManager.viewShopConversations('${shop.id}')" data-shop-id="${shop.id}">
                    <div class="shop-avatar">${shopName.charAt(0)}</div>
                    <div class="shop-info">
                        <div class="shop-name">${shopName}</div>
                        <div class="shop-domain">${shopDomain}</div>
                    </div>
                    ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
                </div>
            `;
        }).join('');
        
        container.innerHTML = `<div class="shop-list">${shopListHTML}</div>`;
        
        // 触发事件
        this.eventBus?.emit('messages:shopListRendered', {
            shopsCount: this.currentShops.length,
            totalUnread: this.getTotalUnreadCount()
        });
    }
    
    /**
     * 查看店铺对话列表
     * @param {string} shopId - 店铺ID
     */
    viewShopConversations(shopId) {
        const shop = this.currentShops.find(s => s.id === shopId);
        if (!shop) {
            this.logError('找不到店铺:', shopId);
            return;
        }
        
        const contentElement = document.getElementById('messagesContent');
        const titleElement = document.getElementById('messagesTitle');
        
        if (!contentElement || !titleElement) {
            this.logError('找不到消息页面元素');
            return;
        }
        
        titleElement.textContent = shop.name;
        this.showLoadingState(contentElement, '正在加载对话...');
        
        // 触发事件
        this.eventBus?.emit('shop:conversationsViewing', {
            shopId: shopId,
            shopName: shop.name
        });
        
        // 模拟异步加载对话
        setTimeout(() => {
            this.loadConversationsForShop(shopId, contentElement);
        }, this.loadingDelay);
    }
    
    /**
     * 加载店铺的对话列表
     * @param {string} shopId - 店铺ID
     * @param {HTMLElement} container - 容器元素
     */
    async loadConversationsForShop(shopId, container) {
        try {
            // 尝试从API加载真实数据
            const conversations = await this.fetchConversations(shopId);
            this.renderConversations(conversations, container, shopId);
        } catch (error) {
            this.logError('加载对话失败，使用模拟数据:', error);
            // 降级到模拟数据
            this.renderMockConversations(container, shopId);
        }
    }
    
    /**
     * 从API获取对话数据
     * @param {string} shopId - 店铺ID
     * @returns {Promise<Array>} 对话列表
     */
    async fetchConversations(shopId) {
        if (!this.apiClient) {
            throw new Error('API客户端不可用');
        }
        
        const sessionId = this.config?.get('sessionId') || window.sessionId;
        const response = await this.apiClient.get(`/api/conversations/${shopId}`, {
            headers: { 'X-Session-Id': sessionId }
        });
        
        return response.conversations || response || [];
    }
    
    /**
     * 渲染对话列表
     * @param {Array} conversations - 对话数据
     * @param {HTMLElement} container - 容器元素
     * @param {string} shopId - 店铺ID
     */
    renderConversations(conversations, container, shopId) {
        if (conversations.length === 0) {
            this.renderEmptyState(container, {
                icon: '💬',
                title: '暂无对话',
                subtitle: '等待用户发起对话'
            });
            return;
        }
        
        const conversationListHTML = conversations.map(conv => {
            const userName = this.utils?.escapeHtml(conv.userName || `用户${conv.userId}`) || conv.userName || `用户${conv.userId}`;
            const lastMessage = this.utils?.escapeHtml(conv.lastMessage || '') || conv.lastMessage || '';
            const timeText = this.formatTime(conv.lastMessageTime || conv.updatedAt || new Date());
            
            return `
                <div class="conversation-item" onclick="window.MessageManager?.openChat('${shopId}', '${conv.userId}') || MessageManager.openChat('${shopId}', '${conv.userId}')" data-conversation-id="${conv.id || conv.userId}">
                    <div class="user-avatar">${userName.charAt(0)}</div>
                    <div class="conversation-info">
                        <div class="conversation-meta">
                            <div class="user-name">${userName}</div>
                            <div class="message-time">${timeText}</div>
                        </div>
                        <div class="last-message">${lastMessage}</div>
                    </div>
                    ${(conv.unreadCount || 0) > 0 ? `<div class="unread-badge">${conv.unreadCount}</div>` : ''}
                </div>
            `;
        }).join('');
        
        container.innerHTML = conversationListHTML;
        
        // 缓存对话数据
        this.conversations.set(shopId, conversations);
        
        // 触发事件
        this.eventBus?.emit('conversations:rendered', {
            shopId: shopId,
            count: conversations.length
        });
    }
    
    /**
     * 渲染模拟对话数据
     * @param {HTMLElement} container - 容器元素
     * @param {string} shopId - 店铺ID
     */
    renderMockConversations(container, shopId) {
        const mockConversations = [
            {
                userId: 'user_123',
                userName: '用户123',
                lastMessage: '你好，我想咨询一下产品信息',
                lastMessageTime: new Date(Date.now() - 120000),
                unreadCount: 2
            },
            {
                userId: 'user_456',
                userName: '客户456',
                lastMessage: '请问这个商品还有货吗？',
                lastMessageTime: new Date(Date.now() - 300000),
                unreadCount: 0
            }
        ];
        
        this.renderConversations(mockConversations, container, shopId);
    }
    
    /**
     * 打开聊天界面
     * @param {string} shopId - 店铺ID
     * @param {string} userId - 用户ID
     */
    openChat(shopId, userId) {
        this.logInfo('打开聊天界面:', shopId, userId);
        
        // 更新当前聊天状态
        this.currentChatShop = shopId;
        this.currentChatUser = userId;
        
        // 触发事件
        this.eventBus?.emit('chat:opening', {
            shopId: shopId,
            userId: userId
        });
        
        // 使用页面管理器切换页面
        if (this.pageManager) {
            this.pageManager.switchPage('chat', { shopId, userId });
        } else if (window.PageManager) {
            window.PageManager.switchPage('chat', { shopId, userId });
        } else if (typeof PageManager !== 'undefined') {
            PageManager.switchPage('chat', { shopId, userId });
        } else {
            this.logError('页面管理器不可用');
        }
    }
    
    /**
     * 加载聊天消息
     * @param {string} shopId - 店铺ID
     * @param {string} userId - 用户ID
     */
    loadChatMessages(shopId, userId) {
        this.currentChatShop = shopId;
        this.currentChatUser = userId;
        
        const shop = this.currentShops.find(s => s.id === shopId);
        const titleElement = document.getElementById('chatTitle');
        const messagesContainer = document.getElementById('chatMessages');
        
        if (!titleElement || !messagesContainer) {
            this.logError('找不到聊天页面元素');
            return;
        }
        
        titleElement.textContent = `${shop?.name || '店铺'} - 用户${userId}`;
        this.showLoadingState(messagesContainer, '正在加载消息...');
        
        // 触发事件
        this.eventBus?.emit('chat:messagesLoading', {
            shopId: shopId,
            userId: userId
        });
        
        // 模拟异步加载消息
        setTimeout(() => {
            this.loadMessagesForChat(shopId, userId, messagesContainer);
        }, this.loadingDelay);
    }
    
    /**
     * 加载聊天的消息数据
     * @param {string} shopId - 店铺ID
     * @param {string} userId - 用户ID
     * @param {HTMLElement} container - 容器元素
     */
    async loadMessagesForChat(shopId, userId, container) {
        try {
            // 尝试从API加载真实消息
            const messages = await this.fetchMessages(shopId, userId);
            this.renderChatMessages(messages, container);
        } catch (error) {
            this.logError('加载消息失败，使用模拟数据:', error);
            // 降级到模拟数据
            this.renderMockMessages(container);
        }
    }
    
    /**
     * 从API获取消息数据
     * @param {string} shopId - 店铺ID
     * @param {string} userId - 用户ID
     * @returns {Promise<Array>} 消息列表
     */
    async fetchMessages(shopId, userId) {
        if (!this.apiClient) {
            throw new Error('API客户端不可用');
        }
        
        const sessionId = this.config?.get('sessionId') || window.sessionId;
        const response = await this.apiClient.get(`/api/messages/${shopId}/${userId}`, {
            headers: { 'X-Session-Id': sessionId }
        });
        
        return response.messages || response || [];
    }
    
    /**
     * 渲染聊天消息
     * @param {Array} messages - 消息数据
     * @param {HTMLElement} container - 容器元素
     */
    renderChatMessages(messages, container) {
        if (!container) {
            container = document.getElementById('chatMessages');
        }
        
        if (!container) {
            this.logError('找不到消息容器');
            return;
        }
        
        if (messages.length === 0) {
            this.renderEmptyState(container, {
                icon: '💭',
                title: '暂无消息',
                subtitle: '开始对话吧'
            });
            return;
        }
        
        const messagesHTML = messages.map(message => {
            const senderClass = message.sender === 'user' ? 'user' : 'admin';
            const content = this.utils?.escapeHtml(message.content) || message.content;
            const timeText = this.formatTime(message.timestamp || message.createdAt || new Date());
            
            return `
                <div class="message ${senderClass}" data-message-id="${message.id}">
                    <div class="message-content">${content}</div>
                    <div class="message-time">${timeText}</div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = messagesHTML;
        this.scrollToBottom(container);
        
        // 触发事件
        this.eventBus?.emit('chat:messagesRendered', {
            shopId: this.currentChatShop,
            userId: this.currentChatUser,
            count: messages.length
        });
    }
    
    /**
     * 渲染模拟消息数据
     * @param {HTMLElement} container - 容器元素
     */
    renderMockMessages(container) {
        const mockMessages = [
            {
                id: '1',
                content: '你好，我想咨询一下产品信息',
                sender: 'user',
                timestamp: new Date(Date.now() - 60000)
            },
            {
                id: '2',
                content: '您好！请问您想了解哪方面的产品信息呢？',
                sender: 'admin',
                timestamp: new Date(Date.now() - 30000)
            },
            {
                id: '3',
                content: '我想了解价格和配送信息',
                sender: 'user',
                timestamp: new Date()
            }
        ];
        
        this.renderChatMessages(mockMessages, container);
    }
    
    /**
     * 处理新消息
     * @param {Object} messageData - 消息数据
     */
    handleNewMessage(messageData) {
        const { shopId, userId, message } = messageData;
        
        // 更新未读计数
        if (message.sender === 'user') {
            const currentCount = this.messageCounters.get(shopId) || 0;
            this.messageCounters.set(shopId, currentCount + 1);
        }
        
        // 如果当前正在查看这个对话，实时添加消息
        if (this.currentChatShop === shopId && this.currentChatUser === userId) {
            this.appendMessage(message);
        }
        
        // 触发事件
        this.eventBus?.emit('message:processed', messageData);
    }
    
    /**
     * 添加新消息到聊天界面
     * @param {Object} message - 消息对象
     */
    appendMessage(message) {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        
        const senderClass = message.sender === 'user' ? 'user' : 'admin';
        const content = this.utils?.escapeHtml(message.content) || message.content;
        const timeText = this.formatTime(message.timestamp || new Date());
        
        const messageHTML = `
            <div class="message ${senderClass}" data-message-id="${message.id}">
                <div class="message-content">${content}</div>
                <div class="message-time">${timeText}</div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', messageHTML);
        this.scrollToBottom(container);
    }
    
    /**
     * 滚动到底部
     * @param {HTMLElement} container - 容器元素
     */
    scrollToBottom(container) {
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
    
    /**
     * 格式化时间显示
     * @param {Date|string|number} timestamp - 时间戳
     * @returns {string} 格式化后的时间文本
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // 验证日期有效性
        if (isNaN(date.getTime())) {
            return '刚刚';
        }
        
        if (diff < 60000) {
            return '刚刚';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        } else if (diff < 86400000) {
            return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
        }
    }
    
    /**
     * 显示加载状态
     * @param {HTMLElement} container - 容器元素
     * @param {string} message - 加载消息
     */
    showLoadingState(container, message = '正在加载...') {
        if (container) {
            container.innerHTML = `<div class="loading">${message}</div>`;
        }
    }
    
    /**
     * 渲染空状态
     * @param {HTMLElement} container - 容器元素
     * @param {Object} options - 选项 {icon, title, subtitle}
     */
    renderEmptyState(container, options = {}) {
        const { icon = '📭', title = '暂无数据', subtitle = '' } = options;
        
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${icon}</div>
                <div>${title}</div>
                ${subtitle ? `<small>${subtitle}</small>` : ''}
            </div>
        `;
    }
    
    /**
     * 获取总未读消息数
     * @returns {number} 总未读数
     */
    getTotalUnreadCount() {
        let total = 0;
        for (const count of this.messageCounters.values()) {
            total += count;
        }
        return total;
    }
    
    /**
     * 清除店铺的未读计数
     * @param {string} shopId - 店铺ID
     */
    clearUnreadCount(shopId) {
        this.messageCounters.set(shopId, 0);
        
        // 更新UI
        const shopElement = document.querySelector(`[data-shop-id="${shopId}"] .unread-badge`);
        if (shopElement) {
            shopElement.remove();
        }
    }
    
    /**
     * 开始自动刷新
     */
    startAutoRefresh() {
        this.stopAutoRefresh();
        
        this.refreshTimer = setInterval(() => {
            // 只在消息相关页面时自动刷新
            const currentPage = this.config?.get('currentPage');
            if (currentPage === 'messages' || currentPage === 'chat') {
                this.refreshCurrentView();
            }
        }, this.refreshInterval);
    }
    
    /**
     * 停止自动刷新
     */
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
    
    /**
     * 刷新当前视图
     */
    refreshCurrentView() {
        const currentPage = this.config?.get('currentPage');
        
        if (currentPage === 'messages') {
            this.loadShopList();
        } else if (currentPage === 'chat' && this.currentChatShop && this.currentChatUser) {
            this.loadChatMessages(this.currentChatShop, this.currentChatUser);
        }
    }
    
    /**
     * 记录信息日志
     * @param {...any} args - 日志参数
     */
    logInfo(...args) {
        console.log('[MessageManager]', ...args);
    }
    
    /**
     * 记录错误日志
     * @param {...any} args - 日志参数
     */
    logError(...args) {
        console.error('[MessageManager]', ...args);
    }
    
    /**
     * 销毁管理器
     */
    destroy() {
        this.stopAutoRefresh();
        
        this.eventBus?.off('shops:loaded');
        this.eventBus?.off('page:switched');
        this.eventBus?.off('message:received');
        this.eventBus?.off('websocket:connected');
        
        this.currentShops = [];
        this.messageCounters.clear();
        this.conversations.clear();
        this.loadingStates.clear();
        this.currentChatShop = null;
        this.currentChatUser = null;
        
        this.logInfo('MessageManager 已销毁');
    }
}

// 全局注册（向后兼容）
if (typeof window !== 'undefined') {
    window.MessageManager = MessageManager;
    
    // 实例化管理器
    if (!window.messageManagerInstance) {
        window.messageManagerInstance = new MessageManager();
        
        // 绑定静态方法（向后兼容）
        MessageManager.loadShopList = (...args) => window.messageManagerInstance.loadShopList(...args);
        MessageManager.viewShopConversations = (...args) => window.messageManagerInstance.viewShopConversations(...args);
        MessageManager.openChat = (...args) => window.messageManagerInstance.openChat(...args);
        MessageManager.loadChatMessages = (...args) => window.messageManagerInstance.loadChatMessages(...args);
        MessageManager.renderChatMessages = (...args) => window.messageManagerInstance.renderChatMessages(...args);
        MessageManager.formatTime = (...args) => window.messageManagerInstance.formatTime(...args);
    }
}

export default MessageManager;