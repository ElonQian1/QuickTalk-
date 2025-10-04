/**
 * MessageModule - 消息模块协调器 (重构版)
 * 职责：协调各业务管理器，提供统一接口，处理视图切换
 * 依赖：ShopsManager, ConversationsManager, MessagesManager, MediaHandler
 */
(function() {
    'use strict';

class MessageModule {
            constructor() {
                // 业务管理器
                this.shopsManager = null;
                this.conversationsManager = null;
                this.messagesManager = null;
                
                // 媒体处理器
                this.mediaHandler = null;
                
                // 兼容性字段（向后兼容）
                this.currentShopId = null;
                this.currentConversationId = null;
                this.currentCustomer = null;
                this.shops = [];
                this.conversations = [];
                this.messages = [];
                this.websocket = null;
                
                // 兼容字段（委托给MediaHandler）
                this.isRecording = false;
                this.mediaRecorder = null;
                this.recordedChunks = [];
                
                // 初始化管理器
                this.initManagers();
                
                // 初始化 WebSocket 适配器
                this._initWSAdapter();
                
                // 移除媒体处理器初始化（已委托给MediaHandler）
                
                // 渲染委托初始化
                setTimeout(() => {
                    if (window.MessageRenderer && typeof window.MessageRenderer.init === 'function') {
                        this._renderer = window.MessageRenderer.init(this);
                    }
                }, 0);
            }

            /**
             * 初始化业务管理器
             */
            initManagers() {
                // 店铺管理器
                if (window.ShopsManager) {
                    this.shopsManager = new window.ShopsManager({
                        onShopSelected: (shop, stats) => this.handleShopSelected(shop, stats),
                        debug: false
                    });
                }

                // 对话管理器
                if (window.ConversationsManager) {
                    this.conversationsManager = new window.ConversationsManager({
                        onConversationSelected: (conversation, customer) => this.handleConversationSelected(conversation, customer),
                        debug: false
                    });
                }

                // 消息管理器
                if (window.MessagesManager) {
                    this.messagesManager = new window.MessagesManager({
                        onNewMessage: (message) => this.handleNewMessageEvent(message),
                        onMessageUpdated: (message) => this.handleMessageUpdatedEvent(message),
                        onMessageDeleted: (messageId) => this.handleMessageDeletedEvent(messageId),
                        debug: false
                    });
                }

                // 媒体处理器
                if (window.MediaHandler) {
                    this.mediaHandler = new window.MediaHandler({
                        messagesManager: this.messagesManager,
                        debug: false
                    });
                    
                    // 同步兼容字段
                    Object.defineProperty(this, 'isRecording', {
                        get: () => this.mediaHandler ? this.mediaHandler.getRecordingState().isRecording : false
                    });
                }
            }

            /**
             * 处理店铺选择
             */
            async handleShopSelected(shop, stats) {
                this.currentShopId = shop.id;
                this.shops = this.shopsManager ? this.shopsManager.shops : [];
                
                // 更新UI
                this.updateNavigationUI(shop.name + ' - 客户对话', true);
                this.showView('conversationsListView');
                
                // 加载对话列表
                if (this.conversationsManager) {
                    try {
                        const conversations = await this.conversationsManager.loadConversationsForShop(shop.id);
                        this.conversations = conversations;
                    } catch (error) {
                        console.error('[MessageModule] 加载对话失败:', error);
                    }
                }
            }

            /**
             * 处理对话选择
             */
            async handleConversationSelected(conversation, customer) {
                this.currentConversationId = conversation.id;
                this.currentCustomer = customer;
                
                // 更新聊天头部
                this.updateChatHeader(conversation, customer);
                
                // 切换到聊天视图
                this.showView('chatView');
                
                // 加载消息
                if (this.messagesManager) {
                    try {
                        const messages = await this.messagesManager.loadMessages(conversation.id, customer);
                        this.messages = messages;
                        this.focusChatInput();
                    } catch (error) {
                        console.error('[MessageModule] 加载消息失败:', error);
                    }
                }
            }

            /**
             * 更新导航UI
             */
            updateNavigationUI(title, showBackBtn = false) {
                const backBtn = document.getElementById('messagesBackBtn');
                const titleElement = document.getElementById('messagesTitle');
                
                if (titleElement) {
                    titleElement.textContent = title;
                }
                
                if (backBtn) {
                    if (showBackBtn) {
                        backBtn.textContent = '←';
                        backBtn.style.display = 'inline-block';
                    } else {
                        backBtn.style.display = 'none';
                    }
                }
            }

            /**
             * 更新聊天头部
             */
            updateChatHeader(conversation, customer) {
                if (window.ChatHeaderUI && typeof window.ChatHeaderUI.updateForConversation === 'function') {
                    window.ChatHeaderUI.updateForConversation(conversation, { customerName: customer.name });
                } else {
                    const titleElement = document.getElementById('messagesTitle');
                    if (titleElement) titleElement.textContent = customer.name;
                }
            }

            // 初始化 WebSocket 适配器
            _initWSAdapter(){
                if (window.MessageWSAdapter) {
                    this.wsAdapter = new window.MessageWSAdapter({ debug: false });
                    // 兼容旧字段：暴露当前底层 socket（只读用途）
                    Object.defineProperty(this, 'websocket', { get: ()=> this.wsAdapter?._ws });
                    // 订阅所有消息
                    this.wsAdapter.on('*any', (data)=>{
                        try {
                            if (window.WsEventRouter && typeof window.WsEventRouter.route === 'function') {
                                window.WsEventRouter.route(this, data);
                            } else {
                                this.handleWebSocketMessage(data); // 回退
                            }
                        } catch(e){ console.error('Ws route error', e); }
                    });
                    this.wsAdapter.on('*open', ()=> console.log('[MessageModule] WebSocket已连接')); 
                    this.wsAdapter.on('*close', (info)=> console.log('[MessageModule] WebSocket已关闭', info));
                    this.wsAdapter.on('*error', (err)=> console.warn('[MessageModule] WebSocket错误', err));
                } else {
                    console.warn('MessageWSAdapter 未加载，使用旧 initWebSocket 回退');
                    this._legacyInitWebSocket();
                }
            }

            // 旧版回退（仅在适配器缺失时使用）
            _legacyInitWebSocket(){
                if (this.websocket && this.websocket.readyState === WebSocket.OPEN) return;
                const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
                this.websocket = new WebSocket(wsUrl);
                this.websocket.onopen = ()=> console.log('[legacy] WebSocket连接已建立');
                this.websocket.onmessage = (event)=>{
                    try { const data = JSON.parse(event.data); this.handleWebsocketDispatch(data); } catch(e){ console.error('legacy WS解析失败', e);} };
                this.websocket.onclose = ()=>{ console.log('[legacy] WebSocket关闭，3s后重连'); setTimeout(()=> this._legacyInitWebSocket(), 3000); };
                this.websocket.onerror = (err)=> console.error('[legacy] WebSocket错误', err);
            }

            handleWebsocketDispatch(data){
                if (window.WsEventRouter && typeof window.WsEventRouter.route === 'function') {
                    window.WsEventRouter.route(this, data);
                } else {
                    this.handleWebSocketMessage(data); // 回退
                }
            }

            // WebSocket 事件处理（委托给管理器）
            handleWebSocketMessage(data) {
                if (!data || !data.type) return;
                
                // 优先使用路由器
                if (window.WsEventRouter && typeof window.WsEventRouter.route === 'function') {
                    return window.WsEventRouter.route(this, data);
                }
                
                // 降级：处理核心事件
                const t = data.type;
                
                if (t === 'message' || data.msg_type === 'message') {
                    this.handleLegacyNewMessage(data);
                    return;
                }
                
                if (t === 'typing') {
                    if (this.handleTypingIndicator) this.handleTypingIndicator(data);
                    return;
                }
                
                if (t === 'conversation_update') {
                    if (this.currentShopId && this.conversationsManager) {
                        this.conversationsManager.loadConversationsForShop(this.currentShopId);
                    }
                    return;
                }
                
                // 领域事件处理
                if (t && t.startsWith('domain.event.')) {
                    this.handleDomainEvent(t, data);
                }
            }

            // 处理领域事件
            handleDomainEvent(eventType, data) {
                const unwrap = (evt) => (evt && evt.data) ? (evt.data.message || evt.data) : evt;
                const message = unwrap(data);
                
                if (eventType.endsWith('message_appended')) {
                    this.handleDomainMessageAppended(message);
                } else if (eventType.endsWith('message_updated')) {
                    this.handleDomainMessageUpdated(message);
                } else if (eventType.endsWith('message_deleted')) {
                    this.handleDomainMessageDeleted(message);
                }
            }

            // 处理消息追加（委托给消息管理器）
            handleDomainMessageAppended(message) {
                if (!message) {
                    console.error('❌ handleDomainMessageAppended: 消息为空');
                    return;
                }
                
                if (this.messagesManager) {
                    this.messagesManager.handleNewMessage(message);
                } else {
                    this.handleLegacyNewMessage(message);
                }
            }

            // 处理消息更新（委托给消息管理器）
            handleDomainMessageUpdated(message) {
                if (!message) return;
                
                if (this.messagesManager) {
                    this.messagesManager.handleMessageUpdated(message);
                } else {
                    // 降级：更新内存中的消息
                    const idx = this.messages.findIndex(m => m.id === message.id);
                    if (idx >= 0) {
                        this.messages[idx] = { ...this.messages[idx], ...message };
                        this.renderMessages();
                    }
                }
            }

            // 处理消息删除（委托给消息管理器）
            handleDomainMessageDeleted(payload) {
                if (!payload) return;
                
                if (this.messagesManager) {
                    this.messagesManager.handleMessageDeleted(payload);
                } else {
                    // 降级：从内存中删除
                    const { id, conversation_id } = payload;
                    const before = this.messages.length;
                    this.messages = this.messages.filter(m => m.id !== id);
                    if (this.messages.length !== before && this.currentConversationId === conversation_id) {
                        this.renderMessages();
                    }
                }
            }

            // 兼容处理新消息（降级使用）
            handleLegacyNewMessage(messageData) {
                if (this.currentConversationId && 
                    String(messageData.conversation_id) === String(this.currentConversationId)) {
                    
                    const exists = this.messages.some(m => {
                        if (messageData.id && m.id) return String(m.id) === String(messageData.id);
                        const sameSender = m.sender_type === messageData.sender_type;
                        const sameContent = (m.content || '').trim() === (messageData.content || '').trim();
                        const t1 = m.timestamp || m.sent_at || m.created_at;
                        const t2 = messageData.timestamp || messageData.sent_at || messageData.created_at;
                        const sameTime = t1 && t2 && String(t1) === String(t2);
                        return sameSender && sameContent && sameTime;
                    });
                    
                    if (!exists) {
                        this.messages.push(messageData);
                        this.renderMessage(messageData);
                        this.scrollToBottom();
                    }
                }
                
                this.updateConversationPreview(messageData);
            }

            // 原有消息加载逻辑（降级使用）
            async _legacyLoadMessages(conversationId) {
                if (this.messagesManager && this.messagesManager._loadingMessagesFor === conversationId) {
                    return;
                }
                
                const container = document.getElementById('chatMessages');
                if (container) {
                    container.innerHTML = '';
                    if (window.UIStates && window.UIStates.showLoading) {
                        window.UIStates.showLoading(container, '正在加载消息...');
                    } else if (window.LoadingStatesUI && typeof window.LoadingStatesUI.spinner === 'function') {
                        container.appendChild(window.LoadingStatesUI.spinner('正在加载消息...'));
                    }
                }
                
                try {
                    const response = await fetch(`/api/conversations/${conversationId}/messages`, {
                        headers: window.AuthHelper ? window.AuthHelper.getHeaders() : {
                            'Authorization': `Bearer ${window.getAuthToken ? window.getAuthToken() : ''}`
                        }
                    });
                    const data = await response.json();
                    
                    if (data.success && data.data) {
                        this.messages = data.data;
                        this.renderMessages();
                        return this.messages;
                    } else {
                        console.error('[MessageModule] 降级：获取消息失败:', data.error);
                        if (container) {
                            if (window.UIStates && window.UIStates.showError) {
                                window.UIStates.showError(container, '加载消息失败', data.error || '请稍后重试');
                            } else {
                                container.textContent = data.error || '加载消息失败';
                            }
                        }
                    }
                } catch (error) {
                    console.error('[MessageModule] 降级：网络错误:', error);
                    if (container && window.UIStates && window.UIStates.showError) {
                        window.UIStates.showError(container, '网络错误', '无法获取消息，请检查网络连接');
                    }
                }
            }

            // 处理新消息事件（来自管理器）
            handleNewMessageEvent(message) {
                // 更新对话预览
                if (this.conversationsManager) {
                    this.conversationsManager.updateConversationPreview(message);
                } else {
                    this.updateConversationPreview(message);
                }
            }

            // 处理消息更新事件
            handleMessageUpdatedEvent(message) {
                // 如果需要额外处理，在此添加
                console.log('[MessageModule] 消息已更新:', message.id);
            }

            // 处理消息删除事件
            handleMessageDeletedEvent(messageId) {
                // 如果需要额外处理，在此添加
                console.log('[MessageModule] 消息已删除:', messageId);
            }

            // 发送消息（委托给消息管理器）
            async sendMessage() {
                const input = document.getElementById('chatInput');
                const content = input ? input.value.trim() : '';
                
                if (!content) return;

                if (this.messagesManager) {
                    const success = await this.messagesManager.sendTextMessage(content);
                    if (success && input) {
                        input.value = '';
                        input.focus();
                    }
                } else {
                    // 降级：使用原有逻辑
                    this._legacySendMessage(content);
                    if (input) {
                        input.value = '';
                        input.focus();
                    }
                }
            }

            // 原有发送消息逻辑（降级使用）
            _legacySendMessage(content) {
                if (!this.currentConversationId) return;

                const messageData = {
                    type: 'message',
                    conversation_id: this.currentConversationId,
                    content: content,
                    files: [],
                    sender_type: 'agent',
                    timestamp: Date.now()
                };

                const sent = this.wsAdapter 
                    ? this.wsAdapter.send(messageData) 
                    : (this.websocket && this.websocket.readyState === WebSocket.OPEN && 
                       this.websocket.send(JSON.stringify(messageData)) === undefined);
                
                if (!sent) {
                    console.error('[MessageModule] 降级：WebSocket发送失败');
                }
            }

            // 显示店铺列表（委托给店铺管理器）
            async showShops() {
                if (this.shopsManager) {
                    try {
                        const shops = await this.shopsManager.loadAndShowShops();
                        this.shops = shops;
                        this.updateNavigationUI('客服消息', false);
                        this.showView('shopsListView');
                        return shops;
                    } catch (error) {
                        console.error('[MessageModule] 显示店铺列表失败:', error);
                    }
                }
                
                // 降级：使用原有逻辑
                return this._legacyShowShops();
            }

            // 原有店铺显示逻辑（降级使用）
            async _legacyShowShops() {
                try {
                    const shops = await fetchShops();
                    const arr = Array.isArray(shops) ? shops : [];
                    const filterFn = (typeof window.getActiveShops === 'function') ? window.getActiveShops : (a) => a;
                    this.shops = filterFn(arr);
                    this.renderShopsList();
                } catch (error) {
                    console.error('[MessageModule] 降级：获取店铺列表失败', error);
                    this.shops = [];
                    this.renderShopsList();
                }
            }

            // 渲染店铺列表
            async renderShopsList() {
                // 确保片段已注入（messages/page -> shops-list-view.html）
                try {
                    if (window.PartialsLoader && typeof window.PartialsLoader.loadPartials === 'function') {
                        await window.PartialsLoader.loadPartials();
                    }
                } catch(_) {}

                let container = document.getElementById('shopsListView');
                if (!container) {
                    // 延迟重试一次，兼容慢速片段注入
                    await new Promise(r => setTimeout(r, 60));
                    container = document.getElementById('shopsListView');
                }
                if (!container) {
                    console.warn('renderShopsList: shopsListView 未就绪，放弃本次渲染');
                    return;
                }
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

            // 创建单个店铺卡片（委托 UI 组件）
            async createShopCard(shop) {
                let conversationCount = 0;
                let unreadCount = 0;
                // 优先使用统一数据同步管理器获取统计，避免重复 N 次对话列表请求
                try {
                    if (window.unifiedDataSyncManager && typeof window.unifiedDataSyncManager.fetchShopStats === 'function') {
                        const stats = await window.unifiedDataSyncManager.fetchShopStats(shop.id, true);
                        conversationCount = stats && stats.conversation_count ? stats.conversation_count : 0;
                        unreadCount = stats && stats.unread_count ? stats.unread_count : 0;
                    } else {
                        // 兜底：使用原有 API 方式
                        conversationCount = await this.getShopConversationCount(shop.id);
                        unreadCount = await this.getShopUnreadCount(shop.id);
                    }
                } catch (e) {
                    console.warn('获取店铺统计失败，使用兜底为 0:', shop.id, e);
                    conversationCount = conversationCount || 0;
                    unreadCount = unreadCount || 0;
                }
                const hasConversations = conversationCount > 0;
                const onCardClick = async () => {
                    if (hasConversations) {
                        this.selectShop(shop);
                    } else {
                        this.showToast(`店铺 "${shop.name}" 暂无客户对话，等待客户发起对话`, 'info');
                        this.selectShop(shop);
                    }
                };
                if (window.ShopCardUI && typeof window.ShopCardUI.build === 'function') {
                    const actionsHTML = '';
                    const card = window.ShopCardUI.build({ ...shop, unreadCount }, { hasConversations, onClick: onCardClick, actionsHTML });
                    setTimeout(() => {
                        if (window.DataSyncManager) {
                            window.DataSyncManager.forceRefreshShopStats(shop.id).catch(()=>{});
                        }
                    }, 500);
                    return card;
                }
                // 回退：原实现（简化版）
                const shopCard = document.createElement('div');
                shopCard.className = `shop-card ${!hasConversations ? 'shop-card-inactive' : ''}`;
                shopCard.setAttribute('data-shop-id', shop.id);
                shopCard.innerHTML = `
                    <div class="shop-header">
                        <div class="shop-icon">${shop.name.charAt(0)}</div>
                    </div>
                    <div class="shop-name">
                        ${shop.name}
                        <span class="unread-count" data-unread="${unreadCount || 0}" style="display: ${unreadCount > 0 ? 'inline' : 'none'};">
                            ${unreadCount > 0 ? `(${unreadCount})` : ''}
                        </span>
                    </div>
                    <div class="shop-domain">${shop.domain || '未设置域名'}</div>
                `;
                shopCard.addEventListener('click', onCardClick);
                return shopCard;
            }



            // 选择店铺（委托给店铺管理器）
            async selectShop(shop) {
                if (this.shopsManager) {
                    await this.shopsManager.selectShop(shop);
                } else {
                    // 降级：直接处理
                    await this.handleShopSelected(shop, { conversationCount: 0, unreadCount: 0 });
                }
            }

            // 选择对话（委托给对话管理器）
            async selectConversation(conversation) {
                if (this.conversationsManager) {
                    await this.conversationsManager.selectConversation(conversation);
                } else {
                    // 降级：直接处理
                    const customer = {
                        id: conversation.customer_id,
                        name: conversation.customer_name || this.generateCustomerNumber(conversation.customer_id)
                    };
                    await this.handleConversationSelected(conversation, customer);
                }
            }

            // 加载消息（委托给消息管理器）
            async loadMessages(conversationId) {
                if (this.messagesManager) {
                    try {
                        const messages = await this.messagesManager.loadMessages(conversationId, this.currentCustomer);
                        this.messages = messages;
                        return messages;
                    } catch (error) {
                        console.error('[MessageModule] 委托加载消息失败:', error);
                        throw error;
                    }
                }
                
                // 降级：使用原有逻辑
                return this._legacyLoadMessages(conversationId);
            }

            // (移除重复 generateCustomerNumber 定义，统一使用后方兼容方法版本)



            // 渲染消息（委托给渲染器）
            renderMessages() {
                if (this._renderer && this._renderer.renderMessages) {
                    return this._renderer.renderMessages();
                }
                // 降级：简单实现
                const container = document.getElementById('chatMessages');
                if (!container) return;
                container.innerHTML = '';
                (this.messages || []).forEach(m => this.renderMessage(m));
                this.scrollToBottom();
            }

            // 渲染单条消息（委托给渲染器）
            renderMessage(message) {
                if (this._renderer && this._renderer.renderMessage) {
                    return this._renderer.renderMessage(message);
                }
                // 降级：最小实现
                const container = document.getElementById('chatMessages');
                if (!container) return;
                const div = document.createElement('div');
                div.className = 'chat-message';
                div.textContent = (message.content || '').slice(0, 200);
                container.appendChild(div);
            }

            // (重复 sendMessage 定义已移除，统一使用前方兼容实现)

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

            // 显示指定视图
            showView(viewId) {
                if (window.MessagesViews && typeof window.MessagesViews.show === 'function') {
                    window.MessagesViews.show(viewId);
                    return;
                }
                
                // 降级实现
                const views = ['shopsListView', 'conversationsListView', 'chatView'];
                const bottomNav = document.querySelector('.bottom-nav');
                
                views.forEach(id => {
                    const element = document.getElementById(id);
                    if (element) element.style.display = id === viewId ? 'block' : 'none';
                });
                
                if (bottomNav) {
                    if (viewId === 'chatView') {
                        bottomNav.classList.add('hidden');
                    } else {
                        bottomNav.classList.remove('hidden');
                    }
                }
            }

            // 返回上一级
            goBack() {
                const chatView = document.getElementById('chatView');
                const conversationsListView = document.getElementById('conversationsListView');
                
                if (chatView && chatView.style.display === 'block') {
                    // 从聊天界面返回对话列表
                    this.showView('conversationsListView');
                    this.updateNavigationUI('客户对话', true);
                } else if (conversationsListView && conversationsListView.style.display === 'block') {
                    // 从对话列表返回店铺列表
                    this.showView('shopsListView');
                    this.updateNavigationUI('客服消息', false);
                    this.currentShopId = null;
                }
            }





            // 媒体处理方法（委托给MediaHandler）
            
            // 创建媒体元素（委托）
            createMediaElement(file) {
                if (this.mediaHandler && this.mediaHandler.createMediaElement) {
                    return this.mediaHandler.createMediaElement(file);
                }
                // 降级
                const div = document.createElement('div');
                div.textContent = file?.name || 'file';
                return div;
            }

            // 打开图片模态框（委托）
            openImageModal(src) {
                if (this.mediaHandler && this.mediaHandler.openImageModal) {
                    return this.mediaHandler.openImageModal(src);
                }
            }

            // 上传文件（委托给MediaHandler）
            async uploadFile(file) {
                if (this.mediaHandler && this.mediaHandler.uploadFile) {
                    return this.mediaHandler.uploadFile(file);
                }
                throw new Error('MediaHandler 不可用');
            }

            // 文件选择处理（委托）
            async handleFileSelection(files) {
                if (this.mediaHandler && this.mediaHandler.handleFileSelection) {
                    return this.mediaHandler.handleFileSelection(files);
                }
            }

            // 语音录制切换（委托）
            async toggleVoiceRecording() {
                if (this.mediaHandler && this.mediaHandler.toggleVoiceRecording) {
                    return this.mediaHandler.toggleVoiceRecording();
                }
            }

            // 直接发送文件（委托）
            async sendFileDirectly(file) {
                if (this.mediaHandler && this.mediaHandler.sendFileDirectly) {
                    return this.mediaHandler.sendFileDirectly(file);
                }
            }

            // 获取文件图标（委托）
            getFileIcon(mimeType) {
                if (this.mediaHandler && this.mediaHandler.getFileIcon) {
                    return this.mediaHandler.getFileIcon(mimeType);
                }
                return '📁';
            }

            // 格式化文件大小（委托）
            formatFileSize(bytes) {
                if (this.mediaHandler && this.mediaHandler.formatFileSize) {
                    return this.mediaHandler.formatFileSize(bytes);
                }
                return bytes + ' bytes';
            }

            // 显示提示消息
            showToast(message, type = 'info') {
                // 统一委托 global-utils
                if (typeof window.showToast === 'function') {
                    window.showToast(message, type);
                } else {
                    console.log(`[Toast ${type}] ${message}`);
                }
            }

            // 兼容方法：渲染店铺列表（委托给店铺管理器）
            async renderShopsList() {
                if (this.shopsManager) {
                    await this.shopsManager.renderShopsList();
                } else {
                    console.warn('[MessageModule] ShopsManager 不可用，跳过店铺列表渲染');
                }
            }

            // 兼容方法：加载店铺对话列表（委托给对话管理器）
            async loadConversationsForShop(shopId) {
                if (this.conversationsManager) {
                    try {
                        const conversations = await this.conversationsManager.loadConversationsForShop(shopId);
                        this.conversations = conversations;
                        return conversations;
                    } catch (error) {
                        console.error('[MessageModule] 委托加载对话失败:', error);
                        throw error;
                    }
                }
                
                // 降级：使用原有逻辑
                return this._legacyLoadConversationsForShop(shopId);
            }

            // 原有对话加载逻辑（降级使用）
            async _legacyLoadConversationsForShop(shopId) {
                if (this.conversationsManager && this.conversationsManager._loading && 
                    this.conversationsManager._loadingShopId === shopId) {
                    return;
                }
                
                try {
                    const response = await fetch(`/api/conversations?shop_id=${shopId}`, {
                        headers: window.AuthHelper ? window.AuthHelper.getHeaders() : {
                            'Authorization': `Bearer ${window.getAuthToken ? window.getAuthToken() : ''}`
                        }
                    });
                    const data = await response.json();
                    
                    if (data.success && data.data) {
                        this.conversations = data.data;
                        this.renderConversationsList();
                        return this.conversations;
                    } else {
                        console.error('[MessageModule] 降级：获取对话列表失败:', data.error);
                    }
                } catch (error) {
                    console.error('[MessageModule] 降级：网络错误:', error);
                }
            }

            // 兼容方法：渲染对话列表（委托给对话管理器）
            async renderConversationsList() {
                if (this.conversationsManager) {
                    await this.conversationsManager.renderConversationsList();
                } else {
                    console.warn('[MessageModule] ConversationsManager 不可用，跳过对话列表渲染');
                }
            }

            // 兼容方法：生成客户编号
            generateCustomerNumber(customerId) {
                if (this.conversationsManager) {
                    return this.conversationsManager.generateCustomerNumber(customerId);
                }
                
                // 降级处理
                if (window.CustomerNumbering && window.CustomerNumbering.generateCustomerNumber) {
                    return window.CustomerNumbering.generateCustomerNumber(customerId);
                }
                
                if (window.generateCustomerNumber && 
                    typeof window.generateCustomerNumber === 'function') {
                    return window.generateCustomerNumber(customerId);
                }
                
                return `客户${customerId.replace('customer_', '').substring(0, 8)}`;
            }

            // 兼容方法：获取店铺对话数量（委托给店铺管理器）
            async getShopConversationCount(shopId) {
                if (this.shopsManager) {
                    return this.shopsManager.getShopConversationCount(shopId);
                }
                
                // 降级实现
                try {
                    const response = await fetch(`/api/conversations?shop_id=${shopId}`, {
                        headers: window.AuthHelper ? window.AuthHelper.getHeaders() : {
                            'Authorization': `Bearer ${window.getAuthToken ? window.getAuthToken() : ''}`
                        }
                    });
                    const data = await response.json();
                    return (data.success && data.data) ? data.data.length : 0;
                } catch (error) {
                    console.error('[MessageModule] 降级：获取店铺对话数量失败:', error);
                    return 0;
                }
            }

            // 兼容方法：获取店铺未读数量（委托给店铺管理器）
            async getShopUnreadCount(shopId) {
                if (this.shopsManager) {
                    return this.shopsManager.getShopUnreadCount(shopId);
                }
                
                // 降级实现
                try {
                    const response = await fetch(`/api/conversations?shop_id=${shopId}`, {
                        headers: window.AuthHelper ? window.AuthHelper.getHeaders() : {
                            'Authorization': `Bearer ${window.getAuthToken ? window.getAuthToken() : ''}`
                        }
                    });
                    const data = await response.json();
                    if (data.success && data.data) {
                        return data.data.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
                    }
                    return 0;
                } catch (error) {
                    console.error('[MessageModule] 降级：获取店铺未读数量失败:', error);
                    return 0;
                }
            }

            // 兼容方法：分页加载更多消息
            async loadMoreMessages(page = 1) {
                try {
                    if (window.MessagesPagination && 
                        typeof window.MessagesPagination.loadMore === 'function') {
                        await window.MessagesPagination.loadMore();
                    }
                } catch (error) {
                    console.warn('[MessageModule] 分页加载失败:', error);
                }
            }

            // 更新对话预览
            updateConversationPreview(messageData) {
                if (this.conversationsManager) {
                    this.conversationsManager.updateConversationPreview(messageData);
                } else if (this.conversations.length > 0 && this.currentShopId) {
                    // 降级：重新加载对话列表
                    this.loadConversationsForShop(this.currentShopId);
                }
            }
        }

    // 将类暴露到全局
    window.MessageModule = MessageModule;

    console.log('✅ 消息模块已加载 (message-module.js) - 重构版');
})();
