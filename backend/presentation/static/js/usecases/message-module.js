/**
 * MessageModule - 消息模块
 * 管理三层结构的消息系统：店铺 → 对话 → 消息
 * 负责 WebSocket 连接、消息收发、媒体处理
 */
(function() {
    'use strict';

class MessageModule {
            constructor() {
                this.currentShopId = null;
                this.currentConversationId = null;
                this.currentCustomer = null;
                this.shops = [];
                this.conversations = [];
                this.messages = [];
                this.websocket = null;
                this.isRecording = false;
                this.mediaRecorder = null;
                this.recordedChunks = [];
                this.initWebSocket();
                this.initMediaHandlers();
            }

            // 初始化WebSocket连接
            initWebSocket() {
                if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                    return;
                }

                const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
                
                this.websocket = new WebSocket(wsUrl);
                
                this.websocket.onopen = () => {
                    console.log('WebSocket连接已建立');
                };
                
                this.websocket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleWebSocketMessage(data);
                    } catch (error) {
                        console.error('WebSocket消息解析错误:', error);
                    }
                };
                
                this.websocket.onclose = () => {
                    console.log('WebSocket连接已关闭');
                    // 3秒后尝试重连
                    setTimeout(() => this.initWebSocket(), 3000);
                };
                
                this.websocket.onerror = (error) => {
                    console.error('WebSocket错误:', error);
                };
            }

            // 处理WebSocket消息（兼容新版领域事件与旧版格式）
            handleWebSocketMessage(data) {
                const t = data && data.type;
                if (!t) return;

                if (t === 'system.welcome' || t === 'Pong') return; // 心跳/欢迎

                // 旧版
                if (t === 'message' || (data.msg_type === 'message')) {
                    this.handleNewMessage(data);
                    return;
                }
                if (t === 'typing') {
                    this.handleTypingIndicator(data);
                    return;
                }
                if (t === 'conversation_update') {
                    if (this.currentShopId) this.loadConversationsForShop(this.currentShopId);
                    return;
                }

                // 新版领域事件
                if (t.startsWith('domain.event.')) {
                    const unwrap = (evt) => {
                        if (!evt) return null;
                        if (evt.data) {
                            if (evt.data.message) return evt.data.message;
                            return evt.data;
                        }
                        return evt;
                    };
                    if (t === 'domain.event.message_appended') {
                        const msg = unwrap(data);
                        this.handleDomainMessageAppended(msg);
                        return;
                    }
                    if (t === 'domain.event.message_updated') {
                        const msg = unwrap(data);
                        this.handleDomainMessageUpdated(msg);
                        return;
                    }
                    if (t === 'domain.event.message_deleted') {
                        const payload = unwrap(data);
                        this.handleDomainMessageDeleted(payload);
                        return;
                    }
                }
            }

            // 新版事件：追加
            handleDomainMessageAppended(message) {
                if (!message) {
                    console.error('❌ handleDomainMessageAppended: 消息为空');
                    return;
                }
                
                console.log('🔔 MessageModule收到新消息事件:', message);
                console.log('📍 当前会话ID:', this.currentConversationId);
                console.log('📨 消息会话ID:', message.conversation_id);
                console.log('👤 消息发送者类型:', message.sender_type);
                console.log('📝 消息内容:', message.content);
                console.log('🏪 消息店铺ID:', message.shop_id);
                
                // 如果在当前会话，直接渲染
                if (this.currentConversationId && String(message.conversation_id) === String(this.currentConversationId)) {
                    // 检查是否重复消息
                    const existingMessage = this.messages.find(m => m.id === message.id);
                    if (!existingMessage) {
                        console.log('✅ 添加新消息到当前会话');
                        this.messages.push(message);
                        this.renderMessage(message);
                        this.scrollToBottom();
                    } else {
                        console.log('⚠️ 消息已存在，跳过重复添加');
                    }
                } else {
                    console.log('📝 消息不属于当前会话，仅更新预览');
                }
                
                // 刷新会话列表预览（无论是否在当前会话）
                this.updateConversationPreview({
                    conversation_id: message.conversation_id,
                    content: message.content,
                    sent_at: message.sent_at || message.created_at || new Date().toISOString(),
                });
                
                // 刷新会话列表以显示新消息
                if (!this.currentConversationId) {
                    console.log('🔄 当前未在特定会话中，刷新会话列表');
                    if (this.currentShopId) {
                        this.loadConversationsForShop(this.currentShopId);
                    }
                }
            }

            // 新版事件：更新
            handleDomainMessageUpdated(message) {
                if (!message) return;
                // 更新内存中的消息
                const idx = this.messages.findIndex(m => m.id === message.id);
                if (idx >= 0) {
                    this.messages[idx] = { ...this.messages[idx], ...message };
                    this.renderMessages();
                }
            }

            // 新版事件：删除
            handleDomainMessageDeleted(payload) {
                if (!payload) return;
                const { id, conversation_id } = payload;
                const before = this.messages.length;
                this.messages = this.messages.filter(m => m.id !== id);
                if (this.messages.length !== before && this.currentConversationId === conversation_id) {
                    this.renderMessages();
                }
            }

            // 处理新消息
            handleNewMessage(messageData) {
                if (this.currentConversationId && 
                    messageData.conversation_id === this.currentConversationId) {
                    this.messages.push(messageData);
                    this.renderMessage(messageData);
                    this.scrollToBottom();
                }
                
                // 更新对话列表中的最后消息
                this.updateConversationPreview(messageData);
            }

            // 显示店铺列表
            async showShops() {
                try {
                    // 复用统一的获取逻辑，避免两处实现不一致（确保未审核店铺也能显示在消息页网格）
                    const shops = await fetchShops();
                    // 仅消息页：只展示已通过/活跃店铺（未审核店铺不能使用消息功能）
                    const list = Array.isArray(shops) ? shops : [];
                    this.shops = list.filter(s => {
                        const st = (s && (s.approvalStatus || s.status)) || 'pending';
                        return st === 'approved' || st === 'active';
                    });
                    if (!Array.isArray(shops)) {
                        console.warn('fetchShops 返回的非数组结果，已回退为空数组:', shops);
                    }
                    this.renderShopsList();
                } catch (error) {
                    console.error('网络错误: 获取店铺列表失败', error);
                    this.shops = [];
                    this.renderShopsList();
                }
            }

            // 渲染店铺列表
            async renderShopsList() {
                const container = document.getElementById('shopsListView');
                container.innerHTML = '';

                if (this.shops.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon">🏪</div>
                            <h3>暂无可用店铺</h3>
                            <p>只有审核通过的店铺才会在此显示；请在店铺通过审核后再来处理客服消息</p>
                        </div>
                    `;
                    return;
                }

                const shopsGrid = document.createElement('div');
                shopsGrid.className = 'shop-grid';

                // 为每个店铺异步获取对话统计
                for (const shop of this.shops) {
                    const shopCard = await this.createShopCard(shop);
                    shopsGrid.appendChild(shopCard);
                }

                container.appendChild(shopsGrid);
            }

            // 创建单个店铺卡片
            async createShopCard(shop) {
                // 获取店铺的对话统计
                const conversationCount = await this.getShopConversationCount(shop.id);
                const unreadCount = await this.getShopUnreadCount(shop.id);
                const hasConversations = conversationCount > 0;
                
                const shopCard = document.createElement('div');
                shopCard.className = `shop-card ${!hasConversations ? 'shop-card-inactive' : ''}`;
                shopCard.setAttribute('data-shop-id', shop.id); // 重要：设置data属性
                
                shopCard.innerHTML = `
                    <div class="shop-header">
                        <div class="shop-icon">${shop.name.charAt(0)}</div>
                        <div class="shop-status ${hasConversations ? 'status-active' : 'status-inactive'}" data-shop-id="${shop.id}">
                            <span class="shop-status-text" style="display:none"></span>
                            <span class="unread-badge" data-unread-count="${unreadCount || 0}" style="display: ${unreadCount > 0 ? 'flex' : 'none'};">${unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : ''}</span>
                        </div>
                    </div>
                    <div class="shop-name">
                        ${shop.name}
                        <span class="unread-count" data-unread="${unreadCount || 0}" style="display: ${unreadCount > 0 ? 'inline' : 'none'};">
                            ${unreadCount > 0 ? `(${unreadCount})` : ''}
                        </span>
                    </div>
                    <div class="shop-domain">${shop.domain || '未设置域名'}</div>
                    ${!hasConversations ? `<div class="shop-empty-hint">点击查看详情</div>` : ''}
                `;
                
                // 增强DOM结构
                if (window.DOMEnhancer) {
                    window.DOMEnhancer.enhanceShopCard(shopCard, {
                        ...shop,
                        conversation_count: conversationCount,
                        unread_count: unreadCount
                    });
                }
                
                // 强制刷新数据显示
                setTimeout(() => {
                    if (window.DataSyncManager) {
                        window.DataSyncManager.forceRefreshShopStats(shop.id).then(() => {
                            console.log(`✅ 店铺 ${shop.id} 数据刷新完成`);
                        }).catch(error => {
                            console.error(`❌ 店铺 ${shop.id} 数据刷新失败:`, error);
                        });
                    }
                }, 500);
                
                shopCard.addEventListener('click', async () => {
                    if (hasConversations) {
                        this.selectShop(shop);
                    } else {
                        // 显示提示信息，但仍然允许进入查看空状态
                        this.showToast(`店铺 "${shop.name}" 暂无客户对话，等待客户发起对话`, 'info');
                        this.selectShop(shop); // 仍然可以进入查看空状态
                    }
                });
                
                return shopCard;
            }

            // 获取店铺对话数量
            async getShopConversationCount(shopId) {
                try {
                    const response = await fetch(`/api/conversations?shop_id=${shopId}`, {
                        headers: {
                            'Authorization': `Bearer ${getAuthToken()}`
                        }
                    });
                    const data = await response.json();
                    
                    if (data.success && data.data) {
                        return data.data.length;
                    }
                    return 0;
                } catch (error) {
                    console.error('获取店铺对话数量失败:', error);
                    return 0;
                }
            }

            // 获取店铺未读数量
            async getShopUnreadCount(shopId) {
                try {
                    const response = await fetch(`/api/conversations?shop_id=${shopId}`, {
                        headers: {
                            'Authorization': `Bearer ${getAuthToken()}`
                        }
                    });
                    const data = await response.json();
                    
                    if (data.success && data.data) {
                        const conversations = data.data;
                        const totalUnread = conversations.reduce((sum, conv) => {
                            return sum + (conv.unread_count || 0);
                        }, 0);
                        console.log(`店铺 ${shopId} 未读数量: ${totalUnread}`);
                        return totalUnread;
                    }
                    return 0;
                } catch (error) {
                    console.error('获取店铺未读数量失败:', error);
                    return 0;
                }
            }

            // 选择店铺，显示对话列表
            async selectShop(shop) {
                this.currentShopId = shop.id;
                
                // 安全地更新DOM元素
                const backBtn = document.getElementById('messagesBackBtn');
                const titleElement = document.getElementById('messagesTitle');
                
                if (backBtn) {
                    backBtn.textContent = '←'; // 只保留箭头
                    backBtn.style.display = 'inline-block';
                }
                
                if (titleElement) {
                    titleElement.textContent = shop.name + ' - 客户对话';
                }
                
                this.showView('conversationsListView');
                await this.loadConversationsForShop(shop.id);
            }

            // 生成客户编号（使用模块化系统）
            generateCustomerNumber(customerId) {
                // 优先使用模块化系统
                if (window.CustomerNumbering && window.CustomerNumbering.generateCustomerNumber) {
                    return window.CustomerNumbering.generateCustomerNumber(customerId);
                }
                
                // 降级处理：使用向后兼容的全局函数
                if (window.generateCustomerNumber && window.generateCustomerNumber !== this.generateCustomerNumber) {
                    return window.generateCustomerNumber(customerId);
                }
                
                // 最终降级：简单格式化
                console.warn('客户编号模块未加载，使用降级处理');
                return `客户${customerId.replace('customer_', '').substring(0, 8)}`;
            }

            // 加载店铺的对话列表
            async loadConversationsForShop(shopId) {
                try {
                    const response = await fetch(`/api/conversations?shop_id=${shopId}`, {
                        headers: {
                            'Authorization': `Bearer ${getAuthToken()}`
                        }
                    });
                    const data = await response.json();
                    
                    if (data.success && data.data) {
                        this.conversations = data.data;
                        this.renderConversationsList();
                    } else {
                        console.error('获取对话列表失败:', data.error);
                    }
                } catch (error) {
                    console.error('网络错误:', error);
                }
            }

            // 渲染对话列表
            renderConversationsList() {
                const container = document.getElementById('conversationsListView');
                container.innerHTML = '';

                if (this.conversations.length === 0) {
                    const tpl = document.getElementById('emptyConversationsTemplate');
                    if (tpl && tpl.content) {
                        container.innerHTML = '';
                        const node = tpl.content.firstElementChild.cloneNode(true);
                        container.appendChild(node);
                    } else {
                        container.innerHTML = `
                            <div class="empty-state">
                                <div class="empty-icon">💬</div>
                                <h3>暂无对话</h3>
                                <p>等待客户发起对话</p>
                            </div>
                        `;
                    }
                    return;
                }

                const list = document.createElement('div');
                list.className = 'conversation-list';

                this.conversations.forEach(conversation => {
                    const conversationItem = document.createElement('div');
                    conversationItem.className = 'conversation-item';
                    conversationItem.setAttribute('data-conversation-id', conversation.id); // 重要：设置data属性
                    conversationItem.setAttribute('data-shop-id', conversation.shop_id || this.currentShopId);
                    
                    const lastMessageTime = conversation.last_message_time ? 
                        new Date(conversation.last_message_time).toLocaleString() : '暂无消息';
                    
                    const customerDisplayName = conversation.customer_name || this.generateCustomerNumber(conversation.customer_id);
                    
                    console.log(`渲染对话 ${conversation.id}:`, {
                        customer: customerDisplayName,
                        lastMessage: conversation.last_message,
                        lastTime: lastMessageTime,
                        unreadCount: conversation.unread_count
                    });
                    
                    // 使用 ConversationUtils 生成增强的头像和红点
                    if (window.ConversationUtils) {
                        conversationItem.innerHTML = `
                            ${window.ConversationUtils.generateAvatarHTML({
                                customerId: conversation.customer_id,
                                customerName: conversation.customer_name,
                                unreadCount: conversation.unread_count || 0
                            })}
                            <div class="conversation-content">
                                <div class="conversation-header">
                                    <span class="customer-name">${window.ConversationUtils.formatCustomerName(conversation.customer_id, conversation.customer_name)}</span>
                                    <span class="message-time" data-conversation-id="${conversation.id}">${lastMessageTime}</span>
                                </div>
                                <div class="last-message" data-conversation-id="${conversation.id}">${conversation.last_message || '等待客户消息...'}</div>
                            </div>
                        `;
                        
                        // 添加未读状态类
                        if (conversation.unread_count > 0) {
                            conversationItem.classList.add('has-unread');
                        }
                    } else {
                        // 回退到原始模板（如果工具库未加载）
                        const avatarInitial = customerDisplayName.charAt(customerDisplayName.length - 3) || 'C';
                        conversationItem.innerHTML = `
                            <div class="conversation-avatar">${avatarInitial}</div>
                            <div class="conversation-content">
                                <div class="conversation-header">
                                    <span class="customer-name">${customerDisplayName}</span>
                                    <span class="message-time" data-conversation-id="${conversation.id}">${lastMessageTime}</span>
                                </div>
                                <div class="last-message" data-conversation-id="${conversation.id}">${conversation.last_message || '等待客户消息...'}</div>
                            </div>
                            ${conversation.unread_count > 0 ? `<div class="unread-badge" data-conversation-id="${conversation.id}">${conversation.unread_count}</div>` : ''}
                        `;
                    }
                    
                    // 增强DOM结构
                    if (window.DOMEnhancer) {
                        window.DOMEnhancer.enhanceConversationItem(conversationItem, conversation);
                    }
                    
                    // 强制刷新对话数据显示
                    setTimeout(() => {
                        if (window.DataSyncManager) {
                            window.DataSyncManager.updateConversationDOM(conversation.id, conversation);
                        }
                        if (window.DisplayFixer) {
                            window.DisplayFixer.fixSingleLastMessage(conversationItem.querySelector('.last-message'), conversation.id);
                            window.DisplayFixer.fixSingleMessageTime(conversationItem.querySelector('.message-time'), conversation.id);
                        }
                    }, 100);
                    
                    conversationItem.addEventListener('click', () => {
                        this.selectConversation(conversation);
                    });
                    
                    list.appendChild(conversationItem);
                });

                container.appendChild(list);
            }

            // 选择对话，进入聊天界面
            async selectConversation(conversation) {
                this.currentConversationId = conversation.id;
                this.currentCustomer = {
                    id: conversation.customer_id,
                    name: conversation.customer_name || this.generateCustomerNumber(conversation.customer_id)
                };
                
                // 清除相关的红点（这时用户确实在查看对话）
                if (window.navBadgeManager) {
                    window.navBadgeManager.clearRelevantBadges(conversation.id, conversation.shop_id);
                    console.log(`🧭 用户查看对话 ${conversation.id}，清除相关红点`);
                }
                
                // 安全地更新DOM元素
                const backBtn = document.getElementById('messagesBackBtn');
                const titleElement = document.getElementById('messagesTitle');
                const customerAvatarElement = document.getElementById('customerAvatar');
                const customerNameElement = document.getElementById('customerName');
                
                if (backBtn) {
                    backBtn.textContent = '← 对话列表';
                }
                
                if (titleElement) {
                    titleElement.textContent = this.currentCustomer.name;
                }
                
                // 使用 ConversationUtils 更新客户头像
                if (customerAvatarElement && window.ConversationUtils) {
                    const avatarInitial = window.ConversationUtils.generateAvatarInitial(conversation.customer_id, conversation.customer_name);
                    const theme = window.ConversationUtils.generateAvatarTheme(conversation.customer_id);
                    customerAvatarElement.textContent = avatarInitial;
                    customerAvatarElement.className = `customer-avatar ${theme}`;
                }
                
                // 更新客户名称显示
                if (customerNameElement && window.ConversationUtils) {
                    customerNameElement.textContent = window.ConversationUtils.formatCustomerName(conversation.customer_id, conversation.customer_name);
                }
                
                this.showView('chatView');
                await this.loadMessages(conversation.id);
                this.focusChatInput();
            }

            // 加载聊天消息
            async loadMessages(conversationId) {
                try {
                    const response = await fetch(`/api/conversations/${conversationId}/messages`, {
                        headers: {
                            'Authorization': `Bearer ${getAuthToken()}`
                        }
                    });
                    const data = await response.json();
                    
                    if (data.success && data.data) {
                        this.messages = data.data;
                        this.renderMessages();
                    } else {
                        console.error('获取消息失败:', data.error);
                    }
                } catch (error) {
                    console.error('网络错误:', error);
                }
            }

            // 渲染聊天消息
            renderMessages() {
                const container = document.getElementById('chatMessages');
                container.innerHTML = '';

                this.messages.forEach(message => {
                    this.renderMessage(message);
                });

                this.scrollToBottom();
            }

            // 渲染单条消息
            renderMessage(message) {
                const container = document.getElementById('chatMessages');
                const messageDiv = document.createElement('div');
                messageDiv.className = `chat-message ${message.sender_type}`;
                
                const avatar = message.sender_type === 'customer' ? 
                    this.currentCustomer.name.charAt(0) : 'A';
                
                // 基本消息结构
                const messageContent = document.createElement('div');
                messageContent.className = 'message-bubble';
                
                // 添加文本内容
                if (message.content && message.content.trim()) {
                    const textContent = document.createElement('div');
                    textContent.textContent = message.content;
                    messageContent.appendChild(textContent);
                }
                
                // 添加文件内容
                if (message.files && message.files.length > 0) {
                    message.files.forEach(file => {
                        const mediaContent = this.createMediaElement(file);
                        messageContent.appendChild(mediaContent);
                    });
                }
                
                messageDiv.innerHTML = `
                    <div class="message-avatar">${avatar}</div>
                `;
                messageDiv.appendChild(messageContent);
                
                container.appendChild(messageDiv);
            }

            // 创建媒体元素
            createMediaElement(file) {
                console.log('创建媒体元素:', file);
                const mediaDiv = document.createElement('div');
                
                // 验证URL
                if (!file.url || file.url === 'undefined') {
                    console.error('文件URL无效:', file);
                    mediaDiv.innerHTML = '<p>文件URL无效</p>';
                    return mediaDiv;
                }
                
                if (file.type.startsWith('image/')) {
                    // 图片显示
                    mediaDiv.className = 'message-media';
                    const img = document.createElement('img');
                    img.src = file.url;
                    img.alt = file.name || '图片';
                    img.onclick = () => this.openImageModal(file.url);
                    console.log('设置图片src:', file.url);
                    
                    // 添加错误处理
                    img.onerror = () => {
                        console.error('图片加载失败:', file.url);
                        img.alt = '图片加载失败';
                    };
                    
                    mediaDiv.appendChild(img);
                    
                } else if (file.type.startsWith('audio/')) {
                    // 音频播放器
                    mediaDiv.className = 'message-audio';
                    const audio = document.createElement('audio');
                    audio.controls = true;
                    audio.src = file.url;
                    audio.preload = 'metadata';
                    mediaDiv.appendChild(audio);
                    
                } else if (file.type.startsWith('video/')) {
                    // 视频播放器
                    mediaDiv.className = 'message-media';
                    const video = document.createElement('video');
                    video.controls = true;
                    video.src = file.url;
                    video.style.maxWidth = '100%';
                    video.style.borderRadius = '8px';
                    mediaDiv.appendChild(video);
                    
                } else {
                    // 其他文件类型显示为下载链接
                    mediaDiv.className = 'message-file';
                    mediaDiv.innerHTML = `
                        <div class="file-icon">${this.getFileIcon(file.type)}</div>
                        <div class="file-details">
                            <div class="file-name">${file.name}</div>
                            <div class="file-size">${this.formatFileSize(file.size)}</div>
                        </div>
                    `;
                    mediaDiv.onclick = () => window.open(file.url, '_blank');
                }
                
                return mediaDiv;
            }

            // 打开图片模态框
            openImageModal(imageSrc) {
                // 创建模态框
                const modal = document.createElement('div');
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                `;
                
                const img = document.createElement('img');
                img.src = imageSrc;
                img.style.cssText = `
                    max-width: 90%;
                    max-height: 90%;
                    object-fit: contain;
                `;
                
                const closeBtn = document.createElement('button');
                closeBtn.textContent = '×';
                closeBtn.style.cssText = `
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: rgba(255,255,255,0.8);
                    border: none;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    font-size: 24px;
                    cursor: pointer;
                `;
                
                closeBtn.onclick = () => document.body.removeChild(modal);
                modal.onclick = (e) => {
                    if (e.target === modal) document.body.removeChild(modal);
                };
                
                modal.appendChild(img);
                modal.appendChild(closeBtn);
                document.body.appendChild(modal);
            }

            // 发送消息 - 仅处理文本消息
            async sendMessage() {
                const input = document.getElementById('chatInput');
                const content = input.value.trim();
                
                // 只处理文本消息
                if (!content) return;
                if (!this.currentConversationId) return;

                const messageData = {
                    type: 'message',
                    conversation_id: this.currentConversationId,
                    content: content,
                    files: [], // 文本消息不包含文件
                    sender_type: 'agent',
                    timestamp: Date.now()
                };

                console.log('📤 准备发送消息:', messageData);
                
                // 发送WebSocket消息 - 使用全局 websocket 变量
                if (websocket && websocket.readyState === WebSocket.OPEN) {
                    console.log('✅ WebSocket连接正常，发送消息');
                    websocket.send(JSON.stringify(messageData));
                } else {
                    console.error('❌ WebSocket连接不可用:', websocket ? websocket.readyState : 'websocket is null');
                }

                // 不再在本地立即添加消息，等待WebSocket广播回来
                // 这样可以避免重复显示消息
                
                // 清空输入
                input.value = '';
                input.focus();
            }

            // 上传文件
            async uploadFile(file) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('conversation_id', this.currentConversationId);

                try {
                    console.log('正在上传文件:', file.name);
                    const response = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });

                    const result = await response.json();
                    console.log('上传API响应:', result);
                    
                    if (result.success && result.data && result.data.files && result.data.files.length > 0) {
                        // 提取第一个文件的URL
                        const fileInfo = result.data.files[0];
                        console.log('提取的文件信息:', fileInfo);
                        return {
                            success: true,
                            url: fileInfo.url
                        };
                    } else {
                        console.error('上传失败，响应格式不正确:', result);
                        throw new Error(result.error || result.message || '上传失败');
                    }
                } catch (error) {
                    console.error('文件上传错误:', error);
                    return { success: false, error: error.message };
                }
            }

            // 显示指定视图
            showView(viewId) {
                const views = ['shopsListView', 'conversationsListView', 'chatView'];
                const bottomNav = document.querySelector('.bottom-nav');
                
                views.forEach(id => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.style.display = id === viewId ? 'block' : 'none';
                    }
                });

                // 控制底部导航栏的显示/隐藏
                if (bottomNav) {
                    if (viewId === 'chatView') {
                        // 进入聊天界面时隐藏导航栏
                        bottomNav.classList.add('hidden');
                    } else {
                        // 其他界面显示导航栏
                        bottomNav.classList.remove('hidden');
                    }
                }
            }

            // 返回上一级
            goBack() {
                const chatView = document.getElementById('chatView');
                const conversationsListView = document.getElementById('conversationsListView');
                const backBtn = document.getElementById('messagesBackBtn');
                const titleElement = document.getElementById('messagesTitle');
                
                if (chatView && chatView.style.display === 'block') {
                    // 从聊天界面返回对话列表
                    this.showView('conversationsListView');
                    if (backBtn) {
                        backBtn.textContent = '←'; // 只保留箭头
                        backBtn.style.display = 'inline-block';
                    }
                    if (titleElement) {
                        titleElement.textContent = '客户对话';
                    }
                } else if (conversationsListView && conversationsListView.style.display === 'block') {
                    // 从对话列表返回店铺列表
                    this.showView('shopsListView');
                    if (backBtn) {
                        backBtn.style.display = 'none'; // 隐藏返回按钮
                    }
                    if (titleElement) {
                        titleElement.textContent = '客服消息'; // 恢复原标题
                    }
                    this.currentShopId = null;
                }
            }

            // 辅助方法
            scrollToBottom() {
                const container = document.getElementById('chatMessages');
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            }

            focusChatInput() {
                setTimeout(() => {
                    const input = document.getElementById('chatInput');
                    if (input) input.focus();
                }, 100);
            }

            // 初始化多媒体处理器
            initMediaHandlers() {
                // 文件选择按钮
                const mediaBtn = document.getElementById('mediaBtn');
                const fileInput = document.getElementById('fileInput');
                const voiceBtn = document.getElementById('voiceBtn');

                if (mediaBtn) {
                    mediaBtn.addEventListener('click', () => {
                        if (fileInput) fileInput.click();
                    });
                }

                if (fileInput) {
                    fileInput.addEventListener('change', (e) => {
                        this.handleFileSelection(e.target.files);
                        // 重置文件输入，允许重复选择相同文件
                        e.target.value = '';
                    });
                }

                if (voiceBtn) {
                    voiceBtn.addEventListener('click', () => {
                        this.toggleVoiceRecording();
                    });
                }
            }

            // 处理文件选择 - 直接发送
            async handleFileSelection(files) {
                if (!files || files.length === 0) return;
                if (!this.currentConversationId) {
                    this.showToast('请先选择一个对话', 'error');
                    return;
                }

                this.showToast('正在发送文件...', 'info');

                const fileArray = Array.from(files);
                
                // 逐个发送文件
                for (const file of fileArray) {
                    await this.sendFileDirectly(file);
                }
            }

            // 直接发送单个文件
            async sendFileDirectly(file) {
                try {
                    // 上传文件
                    const uploadResult = await this.uploadFile(file);
                    if (!uploadResult.success) {
                        this.showToast(`${file.name} 上传失败`, 'error');
                        return;
                    }

                    // 构建文件消息数据
                    const fileInfo = {
                        url: uploadResult.url,
                        type: file.type,
                        name: file.name,
                        size: file.size
                    };

                    // 调试输出
                    console.log('发送文件信息:', fileInfo);

                    const messageData = {
                        type: 'message',
                        conversation_id: this.currentConversationId,
                        content: '', // 纯文件消息，内容为空
                        files: [fileInfo],
                        sender_type: 'agent',
                        timestamp: Date.now()
                    };

                    // 发送WebSocket消息
                    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                        this.websocket.send(JSON.stringify(messageData));
                    }

                    // 本地添加消息
                    this.messages.push({
                        ...messageData,
                        id: Date.now() + Math.random() // 避免ID冲突
                    });
                    
                    this.renderMessage(messageData);
                    this.scrollToBottom();
                    
                    this.showToast(`${file.name} 发送成功`, 'success');
                } catch (error) {
                    console.error('文件发送失败:', error);
                    this.showToast(`${file.name} 发送失败`, 'error');
                }
            }

            // 获取文件图标
            getFileIcon(mimeType) {
                if (mimeType.startsWith('image/')) return '🖼️';
                if (mimeType.startsWith('audio/')) return '🎵';
                if (mimeType.startsWith('video/')) return '🎥';
                if (mimeType.includes('pdf')) return '📄';
                if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
                if (mimeType.includes('text')) return '📃';
                return '📁';
            }

            // 格式化文件大小
            formatFileSize(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }

            // 切换语音录制
            async toggleVoiceRecording() {
                const voiceBtn = document.getElementById('voiceBtn');
                const voiceIcon = voiceBtn?.querySelector('.voice-icon');

                if (!this.isRecording) {
                    await this.startVoiceRecording();
                    if (voiceBtn) voiceBtn.classList.add('recording');
                    if (voiceIcon) voiceIcon.textContent = '⏹️';
                } else {
                    this.stopVoiceRecording();
                    if (voiceBtn) voiceBtn.classList.remove('recording');
                    if (voiceIcon) voiceIcon.textContent = '🎤';
                }
            }

            // 开始语音录制
            async startVoiceRecording() {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    this.mediaRecorder = new MediaRecorder(stream);
                    this.recordedChunks = [];

                    this.mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            this.recordedChunks.push(event.data);
                        }
                    };

                    this.mediaRecorder.onstop = async () => {
                        const blob = new Blob(this.recordedChunks, { type: 'audio/wav' });
                        const file = new File([blob], `语音消息_${Date.now()}.wav`, { type: 'audio/wav' });
                        
                        // 直接发送语音文件
                        await this.sendFileDirectly(file);
                        
                        // 停止所有音轨
                        stream.getTracks().forEach(track => track.stop());
                    };

                    this.mediaRecorder.start();
                    this.isRecording = true;
                    this.showToast('开始录音...', 'info');
                } catch (error) {
                    console.error('录音启动失败:', error);
                    this.showToast('录音功能不可用', 'error');
                }
            }

            // 停止语音录制
            stopVoiceRecording() {
                if (this.mediaRecorder && this.isRecording) {
                    this.mediaRecorder.stop();
                    this.isRecording = false;
                    this.showToast('录音完成', 'success');
                }
            }

            // 显示提示消息
            showToast(message, type = 'info') {
                // 创建toast元素
                const toast = document.createElement('div');
                toast.className = `toast toast-${type}`;
                toast.textContent = message;
                
                // 添加样式
                Object.assign(toast.style, {
                    position: 'fixed',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: type === 'info' ? '#17a2b8' : type === 'error' ? '#dc3545' : '#28a745',
                    color: 'white',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    zIndex: '9999',
                    fontSize: '14px',
                    fontWeight: '500',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    opacity: '0',
                    transition: 'opacity 0.3s ease'
                });
                
                document.body.appendChild(toast);
                
                // 显示动画
                setTimeout(() => {
                    toast.style.opacity = '1';
                }, 100);
                
                // 3秒后自动消失
                setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => {
                        if (toast.parentNode) {
                            toast.parentNode.removeChild(toast);
                        }
                    }, 300);
                }, 3000);
            }

            updateConversationPreview(messageData) {
                // 更新对话列表中的预览信息
                if (this.conversations.length > 0) {
                    this.loadConversationsForShop(this.currentShopId);
                }
            }
        }

    // 将类暴露到全局
    window.MessageModule = MessageModule;

    console.log('✅ 消息模块已加载 (message-module.js)');
})();
