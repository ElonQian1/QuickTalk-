/**
 * 移动端消息管理器 - 多店铺电商客服系统
 * 采用三级架构：消息总览 -> 店铺对话列表 -> 具体聊天
 * 
 * @author QuickTalk Team
 * @version 1.0.0
 */

class MobileMessageManager {
    constructor() {
        this.currentUser = null;
        this.shops = [];
        this.conversations = [];
        this.currentShop = null;
        this.currentConversation = null;
        this.unreadCounts = {};
        this.websocket = null;
        
        console.log('📱 移动端消息管理器初始化');
    }

    /**
     * 初始化消息管理器
     */
    async init() {
        try {
            console.log('🚀 开始初始化消息管理器...');
            
            // 获取当前用户信息
            await this.getCurrentUser();
            
            // 初始化WebSocket连接
            this.initWebSocket();
            
            // 加载店铺列表
            await this.loadShops();
            
            // 加载未读消息统计
            await this.loadUnreadCounts();
            
            // 绑定事件监听器
            this.bindEvents();
            
            // 🔍 在所有基础数据加载完成后，初始化搜索功能
            await this.initSearchFunctionality();
            
            console.log('✅ 消息管理器初始化完成');
            
        } catch (error) {
            console.error('❌ 消息管理器初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化搜索功能 - 只有在用户登录且有数据后才启用
     */
    async initSearchFunctionality() {
        try {
            // 检查是否有店铺和消息数据
            const hasData = this.shops.length > 0 || Object.keys(this.unreadCounts).length > 0;
            
            if (hasData && typeof initMessageSearch === 'function') {
                const searchInitialized = initMessageSearch();
                if (searchInitialized) {
                    console.log('🔍 消息搜索功能已启用');
                } else {
                    console.log('⏰ 搜索功能启用失败，将在有消息数据时重试');
                }
            } else {
                console.log('⏰ 暂无消息数据，搜索功能将稍后启用');
            }
        } catch (error) {
            console.error('❌ 搜索功能初始化失败:', error);
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
     * 初始化WebSocket连接
     */
    initWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            console.log('🔌 [WEBSOCKET] 开始初始化WebSocket连接:', wsUrl);
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('🔌 [WEBSOCKET] ✅ WebSocket连接已建立');
                console.log('🔌 [WEBSOCKET] 发送身份验证，sessionId:', localStorage.getItem('sessionId'));
                // 发送身份验证
                const authMessage = {
                    type: 'auth',
                    sessionId: localStorage.getItem('sessionId')
                };
                console.log('🔌 [WEBSOCKET] 发送认证消息:', authMessage);
                this.websocket.send(JSON.stringify(authMessage));
            };

            this.websocket.onmessage = (event) => {
                try {
                    console.log('🔌 [WEBSOCKET] 收到原始消息:', event.data);
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('❌ [WEBSOCKET] 消息解析失败:', error, '原始数据:', event.data);
                }
            };

            this.websocket.onclose = (event) => {
                console.log('🔌 [WEBSOCKET] ❌ 连接已断开，代码:', event.code, '原因:', event.reason);
                console.log('🔌 [WEBSOCKET] 5秒后重连...');
                setTimeout(() => this.initWebSocket(), 5000);
            };

            this.websocket.onerror = (error) => {
                console.error('❌ [WEBSOCKET] 连接错误:', error);
                console.log('🔌 [WEBSOCKET] 连接状态:', this.websocket.readyState);
            };

        } catch (error) {
            console.error('❌ [WEBSOCKET] 初始化失败:', error);
        }
    }

    /**
     * 处理WebSocket消息
     */
    handleWebSocketMessage(data) {
        console.log('📨 [WEBSOCKET] 收到WebSocket消息:', data);
        console.log('📨 [WEBSOCKET] 消息类型:', data.type);
        console.log('📨 [WEBSOCKET] 消息内容:', data.message);
        console.log('📨 [WEBSOCKET] 完整数据结构:', JSON.stringify(data, null, 2));

        switch (data.type) {
            case 'auth_success':
                console.log('✅ [WEBSOCKET] 认证成功:', data);
                break;
            case 'new_message':
                console.log('✅ [WEBSOCKET] 处理新消息，消息对象:', data.message);
                console.log('📨 [WEBSOCKET] 消息文件URL:', data.message?.file_url);
                console.log('📨 [WEBSOCKET] 消息类型:', data.message?.message_type);
                this.handleNewMessage(data.message);
                break;
            case 'message_read':
                console.log('✅ [WEBSOCKET] 处理消息已读');
                this.handleMessageRead(data.messageId);
                break;
            case 'conversation_update':
                console.log('✅ [WEBSOCKET] 处理对话更新');
                this.handleConversationUpdate(data.conversation);
                break;
            case 'error':
                console.error('❌ [WEBSOCKET] 服务器错误:', data.message);
                break;
            default:
                console.log('🤔 [WEBSOCKET] 未知消息类型:', data.type, data);
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
                const shops = await response.json();
                this.shops = Array.isArray(shops) ? shops : shops.shops || [];
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
                
                // 更新底部导航的未读数
                this.updateBottomNavUnreadCount();
            } else {
                console.warn('⚠️ 获取未读消息统计失败');
            }
        } catch (error) {
            console.error('❌ 加载未读消息统计失败:', error);
        }
    }

    /**
     * 显示消息总览页面（所有店铺）
     */
    showMessageOverview() {
        console.log('📋 显示消息总览');
        
        const content = document.getElementById('messageContent');
        if (!content) {
            console.error('❌ 找不到消息内容容器');
            return;
        }

        // 计算总未读数
        const totalUnread = Object.values(this.unreadCounts).reduce((sum, count) => sum + count, 0);

        const html = `
            <div class="message-overview">
                <div class="page-header">
                    <h2>消息中心</h2>
                    <div class="total-unread">${totalUnread}条未读</div>
                </div>
                
                <div class="shop-list">
                    ${this.shops.map(shop => this.renderShopItem(shop)).join('')}
                </div>
                
                ${this.shops.length === 0 ? '<div class="empty-state">暂无店铺</div>' : ''}
            </div>
        `;

        content.innerHTML = html;
    }

    /**
     * 渲染店铺项目
     */
    renderShopItem(shop) {
        const unreadCount = this.unreadCounts[shop.id] || 0;
        const lastMessage = this.getShopLastMessage(shop.id);

        return `
            <div class="shop-item" onclick="messageManager.showShopConversations('${shop.id}')">
                <div class="shop-avatar">
                    <div class="avatar-text">${shop.name.charAt(0)}</div>
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
        
        this.currentShop = this.shops.find(shop => shop.id === shopId);
        if (!this.currentShop) {
            console.error('❌ 找不到店铺:', shopId);
            return;
        }

        try {
            await this.loadShopConversations(shopId);
            this.renderShopConversations();
        } catch (error) {
            console.error('❌ 加载店铺对话失败:', error);
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
                this.conversations = data.conversations || [];
                console.log(`💬 加载对话列表: ${this.conversations.length} 个对话`);
            } else {
                throw new Error('加载对话列表失败');
            }
        } catch (error) {
            console.error('❌ 加载对话列表失败:', error);
            throw error;
        }
    }

    /**
     * 渲染店铺对话列表
     */
    renderShopConversations() {
        const content = document.getElementById('messageContent');
        if (!content) return;

        const html = `
            <div class="conversation-list">
                <div class="page-header">
                    <button class="back-btn" onclick="messageManager.showMessageOverview()">‹ 返回</button>
                    <h2>${this.currentShop.name}</h2>
                </div>
                
                <div class="conversations">
                    ${this.conversations.map(conv => this.renderConversationItem(conv)).join('')}
                </div>
                
                ${this.conversations.length === 0 ? '<div class="empty-state">暂无对话</div>' : ''}
            </div>
        `;

        content.innerHTML = html;
    }

    /**
     * 渲染对话项目
     */
    renderConversationItem(conversation) {
        const unreadCount = conversation.unread_count || 0;
        const lastMessage = conversation.last_message;

        return `
            <div class="conversation-item" onclick="messageManager.showChatWindow('${conversation.id}')">
                <div class="user-avatar">
                    <div class="avatar-text">${conversation.customer_name?.charAt(0) || '?'}</div>
                    ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
                </div>
                <div class="conversation-info">
                    <div class="customer-name">${conversation.customer_name || '匿名用户'}</div>
                    <div class="last-message">${lastMessage?.content || '暂无消息'}</div>
                </div>
                <div class="conversation-meta">
                    <div class="timestamp">${lastMessage ? this.formatTime(lastMessage.created_at) : ''}</div>
                    <div class="chevron">›</div>
                </div>
            </div>
        `;
    }

    /**
     * 显示聊天窗口
     */
    async showChatWindow(conversationId) {
        console.log('💬 显示聊天窗口:', conversationId);
        
        this.currentConversation = this.conversations.find(conv => conv.id === conversationId);
        if (!this.currentConversation) {
            console.error('❌ 找不到对话:', conversationId);
            return;
        }

        try {
            await this.loadConversationMessages(conversationId);
            this.renderChatWindow();
            
            // 标记消息为已读
            await this.markMessagesAsRead(conversationId);
        } catch (error) {
            console.error('❌ 加载聊天窗口失败:', error);
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
                const data = await response.json();
                // API直接返回消息数组，不是包装在 messages 字段中
                this.currentConversation.messages = Array.isArray(data) ? data : (data.messages || []);
                console.log(`📄 加载消息: ${this.currentConversation.messages.length} 条`);
            } else {
                throw new Error('加载消息失败');
            }
        } catch (error) {
            console.error('❌ 加载消息失败:', error);
            throw error;
        }
    }

    /**
     * 渲染聊天窗口
     */
    renderChatWindow() {
        const content = document.getElementById('messageContent');
        if (!content) return;

        const messages = this.currentConversation.messages || [];

        const html = `
            <div class="chat-window">
                <div class="chat-header">
                    <button class="back-btn" onclick="messageManager.showShopConversations('${this.currentShop.id}')">‹ 返回</button>
                    <div class="chat-title">
                        <div class="customer-name">${this.currentConversation.customer_name || '匿名用户'}</div>
                        <div class="shop-name">${this.currentShop.name}</div>
                    </div>
                </div>
                
                <div class="messages-container" id="messagesContainer">
                    ${messages.map(msg => this.renderMessage(msg)).join('')}
                </div>
                
                <div class="message-input">
                    <div class="input-container">
                        <button class="attachment-btn" onclick="messageManager.showAttachmentMenu()" title="发送文件">📎</button>
                        <input type="text" id="messageInput" placeholder="输入消息..." />
                        <button class="emoji-btn" onclick="messageManager.showEmojiPanel()" title="表情">😊</button>
                        <button class="send-btn" onclick="messageManager.sendMessage()">发送</button>
                    </div>
                    
                    <!-- 附件选择菜单 -->
                    <div class="attachment-menu" id="attachmentMenu" style="display: none;">
                        <div class="attachment-option" onclick="messageManager.selectAttachment('image')">
                            <div class="option-icon">🖼️</div>
                            <div class="option-text">图片</div>
                        </div>
                        <div class="attachment-option" onclick="messageManager.selectAttachment('file')">
                            <div class="option-icon">📄</div>
                            <div class="option-text">文件</div>
                        </div>
                        <div class="attachment-option" onclick="messageManager.selectAttachment('audio')">
                            <div class="option-icon">🎤</div>
                            <div class="option-text">语音</div>
                        </div>
                    </div>
                    
                    <!-- 表情面板 -->
                    <div class="emoji-panel" id="emojiPanel" style="display: none;">
                        <div class="emoji-grid">
                            ${this.generateEmojiGrid()}
                        </div>
                    </div>
                    
                    <!-- 隐藏的文件输入 -->
                    <input type="file" id="fileInput" style="display: none;" onchange="messageManager.handleFileSelect(event)" />
                </div>
            </div>
        `;

        content.innerHTML = html;
        
        // 滚动到底部
        setTimeout(() => {
            const container = document.getElementById('messagesContainer');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 100);
    }

    /**
     * 渲染消息
     */
    renderMessage(message) {
        console.log('🎨 渲染消息:', message);
        const isFromCustomer = message.sender_type === 'customer';
        const messageClass = isFromCustomer ? 'message-customer' : 'message-staff';

        let messageContent = '';
        
        // 根据消息类型渲染不同的内容
        console.log('🎨 [RENDER] 消息类型:', message.message_type);
        console.log('🎨 [RENDER] 文件URL:', message.file_url);
        console.log('🎨 [RENDER] 文件名:', message.file_name);
        switch (message.message_type) {
            case 'image':
                console.log('🖼️ [RENDER] 开始渲染图片消息');
                console.log('🖼️ [RENDER] file_url:', message.file_url);
                console.log('🖼️ [RENDER] file_name:', message.file_name);
                if (message.file_url) {
                    console.log('✅ [RENDER] 文件URL存在，生成图片HTML');
                    messageContent = `
                        <div class="message-image">
                            <img src="${message.file_url}" alt="${message.file_name || '图片'}" 
                                 onclick="previewImage('${message.file_url}')" />
                            ${message.content && message.content !== '[图片]' ? `<div class="image-caption">${message.content}</div>` : ''}
                        </div>
                    `;
                    console.log('✅ [RENDER] 图片HTML生成完成:', messageContent);
                } else {
                    console.log('⚠️ [RENDER] 图片消息缺少file_url，显示占位符');
                    messageContent = `<div class="message-text">${message.content || '[图片]'}</div>`;
                }
                break;
            
            case 'file':
                messageContent = `
                    <div class="message-file">
                        <div class="file-icon">📄</div>
                        <div class="file-info">
                            <div class="file-name">${message.file_name || '未知文件'}</div>
                            <div class="file-size">${this.formatFileSize(message.file_size || 0)}</div>
                        </div>
                        <a href="${message.file_url}" download="${message.file_name}" class="file-download">下载</a>
                    </div>
                `;
                break;
            
            case 'audio':
                messageContent = `
                    <div class="message-audio">
                        <audio controls>
                            <source src="${message.file_url}" type="audio/mpeg">
                            您的浏览器不支持音频播放
                        </audio>
                        <div class="audio-info">语音消息</div>
                    </div>
                `;
                break;
            
            case 'video':
                messageContent = `
                    <div class="message-video">
                        <video controls width="250" height="140">
                            <source src="${message.file_url}" type="video/mp4">
                            您的浏览器不支持视频播放
                        </video>
                    </div>
                `;
                break;
            
            case 'emoji':
                messageContent = `<div class="message-emoji">${message.content}</div>`;
                break;
            
            default:
                messageContent = `<div class="message-text">${message.content}</div>`;
        }

        return `
            <div class="message ${messageClass}">
                <div class="message-content">${messageContent}</div>
                <div class="message-time">${this.formatTime(message.created_at)}</div>
            </div>
        `;
    }

    /**
     * 工具方法
     */
    
    // 格式化时间
    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
        
        return date.toLocaleDateString();
    }

    // 获取店铺最后消息
    getShopLastMessage(shopId) {
        // TODO: 实现获取店铺最后消息的逻辑
        return null;
    }

    // 更新底部导航未读数
    updateBottomNavUnreadCount() {
        const totalUnread = Object.values(this.unreadCounts).reduce((sum, count) => sum + count, 0);
        const badge = document.querySelector('.nav-item.messages .unread-badge');
        
        if (badge) {
            if (totalUnread > 0) {
                badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // 处理新消息
    handleNewMessage(message) {
        console.log('📨 [NEW_MESSAGE] 收到新消息:', message);
        console.log('📨 [NEW_MESSAGE] 消息类型:', message.message_type);
        console.log('📨 [NEW_MESSAGE] 文件URL:', message.file_url);
        console.log('📨 [NEW_MESSAGE] 当前对话:', this.currentConversation?.id);
        console.log('📨 [NEW_MESSAGE] 消息对话ID:', message.conversation_id);
        
        // 更新未读计数
        if (!this.unreadCounts[message.shop_id]) {
            this.unreadCounts[message.shop_id] = 0;
        }
        this.unreadCounts[message.shop_id]++;
        
        // 更新UI
        this.updateBottomNavUnreadCount();
        
        // 如果当前在对话中，实时添加消息
        if (this.currentConversation && this.currentConversation.id === message.conversation_id) {
            console.log('📨 [NEW_MESSAGE] ✅ 添加消息到当前聊天');
            this.addMessageToCurrentChat(message);
        } else {
            console.log('📨 [NEW_MESSAGE] ❌ 不是当前对话，跳过实时显示', {
                currentConversation: this.currentConversation?.id,
                messageConversation: message.conversation_id
            });
        }
        
        // 🔍 如果搜索功能还未启用，现在有消息数据了，尝试启用
        if (!window.messageSearchManager && typeof initMessageSearch === 'function') {
            const searchInitialized = initMessageSearch();
            if (searchInitialized) {
                console.log('🔍 收到新消息后，搜索功能已启用');
            }
        }
    }

    // 标记消息为已读
    async markMessagesAsRead(conversationId) {
        try {
            const sessionId = localStorage.getItem('sessionId');
            await fetch(`/api/conversations/${conversationId}/mark-read`, {
                method: 'POST',
                headers: { 'X-Session-Id': sessionId }
            });
        } catch (error) {
            console.error('❌ 标记已读失败:', error);
        }
    }

    // 发送消息
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
                console.log('✅ 消息发送成功');
                
                // 重新加载消息列表以显示新发送的消息
                await this.loadConversationMessages(this.currentConversation.id);
                this.renderChatWindow();
            } else {
                throw new Error('发送消息失败');
            }
        } catch (error) {
            console.error('❌ 发送消息失败:', error);
            alert('发送失败，请重试');
        }
    }

    // 绑定事件监听器
    bindEvents() {
        // 回车发送消息
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.id === 'messageInput') {
                this.sendMessage();
            }
        });
        
        // 点击其他地方关闭菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.attachment-menu') && !e.target.closest('.attachment-btn')) {
                this.hideAttachmentMenu();
            }
            if (!e.target.closest('.emoji-panel') && !e.target.closest('.emoji-btn')) {
                this.hideEmojiPanel();
            }
        });
    }

    // =============== 多媒体消息功能 ===============

    // 显示附件菜单
    showAttachmentMenu() {
        const menu = document.getElementById('attachmentMenu');
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
        }
        this.hideEmojiPanel();
    }

    // 隐藏附件菜单
    hideAttachmentMenu() {
        const menu = document.getElementById('attachmentMenu');
        if (menu) {
            menu.style.display = 'none';
        }
    }

    // 显示表情面板
    showEmojiPanel() {
        const panel = document.getElementById('emojiPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
        this.hideAttachmentMenu();
    }

    // 隐藏表情面板
    hideEmojiPanel() {
        const panel = document.getElementById('emojiPanel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    // 生成表情网格
    generateEmojiGrid() {
        const emojis = [
            '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
            '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
            '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
            '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
            '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
            '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
            '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💯'
        ];
        
        return emojis.map(emoji => 
            `<div class="emoji-item" onclick="messageManager.insertEmoji('${emoji}')">${emoji}</div>`
        ).join('');
    }

    // 插入表情
    insertEmoji(emoji) {
        const input = document.getElementById('messageInput');
        if (input) {
            input.value += emoji;
            input.focus();
        }
        this.hideEmojiPanel();
    }

    // 选择附件类型
    selectAttachment(type) {
        const fileInput = document.getElementById('fileInput');
        if (!fileInput) return;

        // 设置文件类型过滤
        switch (type) {
            case 'image':
                fileInput.accept = 'image/*';
                break;
            case 'file':
                fileInput.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar';
                break;
            case 'audio':
                fileInput.accept = 'audio/*';
                break;
            default:
                fileInput.accept = '*/*';
        }

        fileInput.dataset.messageType = type;
        fileInput.click();
        this.hideAttachmentMenu();
    }

    // 处理文件选择
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const messageType = event.target.dataset.messageType || 'file';
        
        try {
            // 显示上传进度
            this.showUploadProgress(file.name);
            
            // 上传文件
            const fileInfo = await this.uploadFile(file);
            
            // 发送多媒体消息
            await this.sendMediaMessage(fileInfo, messageType);
            
            // 清理
            event.target.value = '';
            this.hideUploadProgress();
            
        } catch (error) {
            console.error('文件上传失败:', error);
            this.hideUploadProgress();
            alert('文件上传失败: ' + error.message);
        }
    }

    // 上传文件
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        const sessionId = localStorage.getItem('sessionId');
        const response = await fetch('/api/files/upload', {
            method: 'POST',
            headers: {
                'X-Session-Id': sessionId
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '上传失败');
        }

        const result = await response.json();
        return result.file;
    }

    // 发送多媒体消息
    async sendMediaMessage(fileInfo, messageType) {
        if (!this.currentConversation) return;

        const sessionId = localStorage.getItem('sessionId');
        const response = await fetch(`/api/conversations/${this.currentConversation.id}/messages/media`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({
                fileId: fileInfo.id,
                messageType: messageType,
                content: `[${this.getMessageTypeText(messageType)}]`
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '发送失败');
        }

        console.log('✅ 多媒体消息发送成功');
        
        // 检查WebSocket连接状态
        this.checkWebSocketStatus();
    }
    
    // 检查WebSocket连接状态
    checkWebSocketStatus() {
        console.log('🔌 [WEBSOCKET_STATUS] 检查WebSocket连接状态:');
        if (!this.websocket) {
            console.log('🔌 [WEBSOCKET_STATUS] ❌ WebSocket对象不存在');
            return;
        }
        
        const states = {
            0: 'CONNECTING (连接中)',
            1: 'OPEN (已连接)',
            2: 'CLOSING (关闭中)',
            3: 'CLOSED (已关闭)'
        };
        
        console.log('🔌 [WEBSOCKET_STATUS] 连接状态:', states[this.websocket.readyState]);
        console.log('🔌 [WEBSOCKET_STATUS] URL:', this.websocket.url);
        console.log('🔌 [WEBSOCKET_STATUS] 协议:', this.websocket.protocol);
        
        if (this.websocket.readyState !== 1) {
            console.log('⚠️ [WEBSOCKET_STATUS] WebSocket未连接，尝试重连...');
            this.initWebSocket();
        }
    }

    // 获取消息类型文本
    getMessageTypeText(type) {
        const typeMap = {
            image: '图片',
            file: '文件',
            audio: '语音',
            video: '视频'
        };
        return typeMap[type] || '文件';
    }

    // 显示上传进度
    showUploadProgress(fileName) {
        const container = document.getElementById('messagesContainer');
        if (!container) return;

        const progressHtml = `
            <div class="upload-progress" id="uploadProgress">
                <div class="progress-info">
                    <div class="file-name">正在上传: ${fileName}</div>
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', progressHtml);
        container.scrollTop = container.scrollHeight;
    }

    // 隐藏上传进度
    hideUploadProgress() {
        const progress = document.getElementById('uploadProgress');
        if (progress) {
            progress.remove();
        }
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 绑定事件监听器
    bindEvents() {
        // 回车发送消息
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.id === 'messageInput') {
                this.sendMessage();
            }
        });
        
        // 点击其他地方关闭菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.attachment-menu') && !e.target.closest('.attachment-btn')) {
                this.hideAttachmentMenu();
            }
            if (!e.target.closest('.emoji-panel') && !e.target.closest('.emoji-btn')) {
                this.hideEmojiPanel();
            }
        });
    }

    // 添加消息到当前聊天
    addMessageToCurrentChat(message) {
        console.log('📨 [ADD_MESSAGE] 开始添加消息到聊天界面:', message);
        
        const container = document.getElementById('messagesContainer');
        if (!container) {
            console.error('❌ [ADD_MESSAGE] 找不到消息容器 #messagesContainer');
            return;
        }
        
        console.log('📨 [ADD_MESSAGE] 找到消息容器，开始渲染消息');
        const messageHtml = this.renderMessage(message);
        console.log('📨 [ADD_MESSAGE] 渲染的HTML:', messageHtml);
        
        container.insertAdjacentHTML('beforeend', messageHtml);
        container.scrollTop = container.scrollHeight;
        console.log('✅ [ADD_MESSAGE] 消息已添加到界面');
    }
}

// 导出到全局作用域
window.MobileMessageManager = MobileMessageManager;

// 全局调试功能
window.checkWebSocketStatus = function() {
    if (window.mobileMessageManager) {
        window.mobileMessageManager.checkWebSocketStatus();
    } else {
        console.log('❌ MobileMessageManager 实例不存在');
    }
};

window.testWebSocketMessage = function() {
    console.log('🧪 [TEST] 测试WebSocket消息处理...');
    if (window.mobileMessageManager) {
        // 模拟一个图片消息
        const testMessage = {
            type: 'new_message',
            message: {
                id: 'test_msg_' + Date.now(),
                message: '[图片]',
                content: '[图片]',
                message_type: 'image',
                file_url: '/uploads/image/test.png',
                file_name: 'test.png',
                sender_type: 'admin',
                conversation_id: window.mobileMessageManager.currentConversation?.id || 'test_conversation',
                shop_id: 'test_shop',
                user_id: 'test_user',
                created_at: new Date().toISOString()
            }
        };
        
        console.log('🧪 [TEST] 发送测试消息:', testMessage);
        window.mobileMessageManager.handleWebSocketMessage(testMessage);
    } else {
        console.log('❌ MobileMessageManager 实例不存在');
    }
};

// 全局函数
window.previewImage = function(imageUrl) {
    // 创建图片预览模态框
    const modal = document.createElement('div');
    modal.className = 'image-preview-modal';
    modal.innerHTML = `
        <div class="image-preview-overlay" onclick="this.parentElement.remove()">
            <div class="image-preview-container">
                <img src="${imageUrl}" alt="图片预览" />
                <button class="close-preview" onclick="this.closest('.image-preview-modal').remove()">×</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
};

console.log('📦 移动端消息管理器模块已加载');
