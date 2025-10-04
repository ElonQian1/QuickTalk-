/**
 * MessageModule - 消息模块协调器 (重构版)
 * 职责：协调各业务管理器，提供统一接口，处理视图切换
 * 依赖：ShopsManager, ConversationsManager, MessagesManager, MediaHandler
 */
(function() {
    'use strict';

    // --- Logger 注入（若 logger.js 未加载则降级） ---
    const _LogRoot = (window.Logger && window.Logger.for) ? window.Logger : {
        for: function(scope){
            return ['trace','debug','info','warn','error'].reduce((acc,l)=>{ acc[l]=function(){ try{ if(window.console && console[l]) console[l].apply(console, ['['+scope+']'].concat([].slice.call(arguments))); }catch(_){ } }; return acc; },{});
        }
    };
    const log = _LogRoot.for('MessageModule');
    // 统一日志到 QT_LOG: 代理 log.* => QT_LOG(messageModule)
    (function applyQTLogProxy(){
        try {
            const levels = ['trace','debug','info','warn','error'];
            levels.forEach(l=>{
                const orig = log[l] || function(){};
                log[l] = function(){
                    if (window.QT_LOG){
                        const fn = QT_LOG[l] || QT_LOG.debug;
                        fn('messageModule', ...arguments);
                    } else {
                        try { orig.apply(log, arguments); } catch(_){ }
                    }
                };
            });
        } catch(e){ /* 忽略代理失败 */ }
    })();

class MessageModule {
            constructor() {
                // 初始化增强特性（幂等：若骨架未加载则安全跳过）
                try {
                    if (window.ShopStatsService && typeof window.ShopStatsService.init === 'function') {
                        window.ShopStatsService.init({ ttlMs: 20000 });
                    }
                    if (window.CustomerNumbering && typeof window.CustomerNumbering.init === 'function') {
                        window.CustomerNumbering.init({ prefix: '客户', strategy: 'sequential-hash', padLength: 4 });
                    }
                } catch(e){ log.warn('增强特性初始化失败', e); }
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
                this.messages = []; // 即将由代理覆盖
                this.websocket = null;
                
                // 兼容字段（委托给MediaHandler）
                this.isRecording = false;
                this.mediaRecorder = null;
                this.recordedChunks = [];
                
                // 初始化管理器
                this.initManagers();

                // 视图控制器 (延迟创建; 仅负责导航与 DOM 切换)
                this._view = null;
                
                // 初始化 WebSocket 适配器
                this._initWSAdapter();
                
                // 移除媒体处理器初始化（已委托给MediaHandler）
                
                // 代理 messages 属性（指向 StateStore）
                try {
                    if (window.MessageStateStore && !Object.getOwnPropertyDescriptor(this,'messages')?.get) {
                        Object.defineProperty(this, 'messages', {
                            configurable: true,
                            enumerable: true,
                            get: ()=> window.MessageStateStore.getCurrentMessages(),
                            set: (v)=> { /* 丢弃外部直接写入，保持兼容不抛错 */ }
                        });
                    }
                } catch(_){ }

                // 渲染委托初始化
                setTimeout(() => {
                    // 初始化滚动协调器（若存在）
                    try {
                        if (window.ScrollCoordinator && typeof window.ScrollCoordinator.init === 'function') {
                            window.ScrollCoordinator.init({ getContainer: ()=> document.getElementById('chatMessages'), autoStick: true, stickThreshold: 80 });
                        }
                        // 媒体加载滚动校正集成尝试 (懒初始化)
                        if (window.MediaScrollIntegration && typeof window.MediaScrollIntegration.ensureInit==='function') {
                            window.MediaScrollIntegration.ensureInit();
                        }
                    } catch(e){ log.warn('ScrollCoordinator 初始化失败', e); }
                    if (window.MessageRenderer && typeof window.MessageRenderer.init === 'function') {
                        this._renderer = window.MessageRenderer.init(this);
                    }
                    // 事件驱动增量渲染适配器 (若已加载)
                    try {
                        if (window.MessageRenderAdapter && !this._renderAdapter) {
                            this._renderAdapter = window.MessageRenderAdapter.init({ sender: this._sender });
                        }
                    } catch(e){ log.warn('MessageRenderAdapter 初始化失败', e); }
                    // 新发送器初始化 (取代 MessageSendChannel - 渐进迁移)
                    try {
                        if (!this._sender && window.MessageSender) {
                            this._sender = window.MessageSender.create({
                                wsSend: (payload)=>{
                                    if (this.wsAdapter) return this.wsAdapter.send(payload);
                                    if (this.websocket && this.websocket.readyState === WebSocket.OPEN){
                                        try { this.websocket.send(JSON.stringify(payload)); return true; } catch(_){ return false; }
                                    }
                                    return false;
                                },
                                conversationResolver: ()=> this.currentConversationId
                            });
                            // 监听发送事件以触发 UI 更新 (最小侵入)
                            if (window.MessageEventBus){
                                MessageEventBus.subscribe('send.enqueued', ({tempMessage})=>{
                                    // 已由 StateStore appendMessage -> 只需渲染单条
                                    this.renderMessage(tempMessage);
                                    this._notifyNewMessageForScroll();
                                });
                                MessageEventBus.subscribe('send.ack', ({serverMessage})=>{
                                    // 全量重渲染（后续可 diff 优化）
                                    this.renderMessages();
                                });
                                MessageEventBus.subscribe('send.failed', ({tempMessage})=>{
                                    this.renderMessages();
                                    this.showToast('消息发送失败，可重试: '+ (tempMessage.content||'').slice(0,20), 'warn');
                                });
                            }
                        }
                    } catch(e){ log.warn('初始化 MessageSender 失败', e); }
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
                        log.error('加载对话失败', error);
                    }
                }
            }

            /**
             * 处理对话选择
             */
            async handleConversationSelected(conversation, customer) {
                this.currentConversationId = conversation.id;
                this.currentCustomer = customer;
                try { if (window.MessageStateStore) { MessageStateStore.setCurrentConversation(conversation.id); } } catch(_){ }
                
                // 更新聊天头部
                this.updateChatHeader(conversation, customer);
                
                // 切换到聊天视图
                this.showView('chatView');
                
                // 加载消息
                if (this.messagesManager) {
                    try {
                        const messages = await this.messagesManager.loadMessages(conversation.id, customer);
                        // 写入集中状态仓库
                        try { if (window.MessageStateStore) { MessageStateStore.setMessages(conversation.id, messages); } } catch(_){ }
                        // 进入对话后标记未读消息为已读（客户侧消息）
                        try { if (window.MessageStateStore) { MessageStateStore.markConversationRead(conversation.id); } } catch(_){ }
                        this.focusChatInput();
                    } catch (error) {
                        log.error('加载消息失败', error);
                    }
                }
            }

            /**
             * 更新导航UI
             */
            updateNavigationUI(title, showBackBtn = false) {
                this._ensureViewController();
                if (this._view) this._view.updateNavigationUI(title, showBackBtn);
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

            // 初始化 WebSocket 适配器（已抽象到 MessageWSHandler）
            _initWSAdapter(){
                if (!window.MessageWSHandler) {
                    log.warn('MessageWSHandler 未加载，保持原有逻辑（等待后续脚本）');
                    return;
                }
                this._wsHandler = window.MessageWSHandler.init({
                    debug: false,
                    onEvent: (evt)=> {
                        try {
                            // 优先统一事件路由器
                            if (window.WsEventRouter && typeof window.WsEventRouter.route === 'function') {
                                window.WsEventRouter.route(this, evt.raw);
                                return;
                            }
                            // 使用独立事件处理器 (解耦 Orchestrator)
                            this._ensureWsEventsDelegate();
                            if (this._wsEventsDelegate) {
                                this._wsEventsDelegate.route(evt.raw);
                            } else {
                                // 最后回退旧逻辑
                                this.handleWebSocketMessage(evt.raw);
                            }
                        } catch(e){ log.error('ws handler route error', e); }
                    }
                });
                // 兼容旧字段 websocket / wsAdapter (只读) 以减少外部破坏性
                Object.defineProperty(this, 'websocket', { get: ()=> (this._wsHandler && this._wsHandler._ws) || (this.wsAdapter?._ws) });
                Object.defineProperty(this, 'wsAdapter', { get: ()=> ({ send: (d)=> this._wsHandler? this._wsHandler.send(d) : false }) });
            }

            /**
             * @deprecated _legacyInitWebSocket 已由 MessageWSHandler 替代，仅保留占位防止旧代码直接调用。
             */
            _legacyInitWebSocket(){
                log.warn('_legacyInitWebSocket 已废弃，调用被忽略');
            }

            handleWebsocketDispatch(data){
                if (window.WsEventRouter && typeof window.WsEventRouter.route === 'function') {
                    window.WsEventRouter.route(this, data);
                } else {
                    this.handleWebSocketMessage(data); // 回退
                }
            }

            /**
             * @deprecated handleWebSocketMessage 旧内联处理逻辑 (保留回退)
             * 拆分后请使用独立模块 message-ws-events-handler.js
             */
            handleWebSocketMessage(data) {
                if (!data || !data.type) return;
                const t = data.type;
                if (t === 'message' || data.msg_type === 'message') return this.handleLegacyNewMessage(data);
                if (t === 'typing') return (this.handleTypingIndicator && this.handleTypingIndicator(data));
                if (t === 'conversation_update') {
                    if (this.currentShopId && this.conversationsManager) this.conversationsManager.loadConversationsForShop(this.currentShopId);
                    return;
                }
                if (t && t.startsWith('domain.event.')) {
                    if (t.endsWith('message_appended')) return this.handleDomainMessageAppended((data.data && data.data.message)||data.data||data);
                    if (t.endsWith('message_updated')) return this.handleDomainMessageUpdated((data.data && data.data.message)||data.data||data);
                    if (t.endsWith('message_deleted')) return this.handleDomainMessageDeleted((data.data && data.data.message)||data.data||data);
                }
            }

            /** 保障独立事件处理器存在 (懒加载) */
            _ensureWsEventsDelegate(){
                if (this._wsEventsDelegate || !window.MessageWSEventsHandler) return;
                this._wsEventsDelegate = window.MessageWSEventsHandler.create({
                    onDomainAppend: (msg)=> this.handleDomainMessageAppended(msg),
                    onDomainUpdate: (msg)=> this.handleDomainMessageUpdated(msg),
                    onDomainDelete: (msg)=> this.handleDomainMessageDeleted(msg),
                    onLegacyMessage: (raw)=> this.handleLegacyNewMessage(raw),
                    onTyping: (raw)=> this.handleTypingIndicator && this.handleTypingIndicator(raw),
                    refreshConversations: ()=> { if (this.currentShopId && this.conversationsManager) this.conversationsManager.loadConversationsForShop(this.currentShopId); }
                });
            }

            // 处理消息追加（委托给消息管理器）
            handleDomainMessageAppended(message) {
                if (!message) {
                    log.error('handleDomainMessageAppended 消息为空');
                    return;
                }
                // 若包含 temp_id，先尝试通过新发送器进行 ACK 替换，避免重复追加
                try {
                    if (this._sender && message.temp_id) {
                        const replaced = this._sender.handleServerMessage(message);
                        if (replaced) return; // 已处理并广播 message.updated 事件
                    }
                } catch(e){ log.warn('ACK 替换失败 (domain append)', e); }
                
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
                    // 尝试 ACK 替换 (legacy path)
                    try {
                        if (this._sender && messageData.temp_id) {
                            const replaced = this._sender.handleServerMessage(messageData);
                            if (replaced) return; // 已替换并触发更新
                        }
                    } catch(e){ log.warn('ACK 替换失败 (legacy new)', e); }
                    
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
                        this._notifyNewMessageForScroll();
                    }
                }
                
                this.updateConversationPreview(messageData);
            }

            // 原有消息加载逻辑（降级使用）
            async _legacyLoadMessages(conversationId) {
                if (!window.LegacyLoaders) {
                    log.warn('LegacyLoaders 未加载，_legacyLoadMessages 跳过');
                    return;
                }
                return window.LegacyLoaders.loadMessages({ conversationId, messageModule: this });
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
                log.debug('消息已更新', message.id);
            }

            // 处理消息删除事件
            handleMessageDeletedEvent(messageId) {
                // 如果需要额外处理，在此添加
                log.debug('消息已删除', messageId);
            }

            // 发送消息（委托给消息管理器）
            async sendMessage() {
                const input = document.getElementById('chatInput');
                const content = input ? input.value.trim() : '';
                
                if (!content) return;
                // 优先使用新发送器
                if (this._sender){
                    this._sender.enqueueText(content);
                    if (input){ input.value=''; input.focus(); }
                    return;
                }
                if (this.messagesManager && this.messagesManager.sendTextMessage) {
                    const success = await this.messagesManager.sendTextMessage(content);
                    if (success && input){ input.value=''; input.focus(); }
                    return;
                }
                // 最后降级
                this._legacySendMessage(content);
                if (input){ input.value=''; input.focus(); }
            }

            // 原有发送消息逻辑（降级使用）
            _legacySendMessage(content) {
                if (!window.LegacySenders) {
                    log.warn('LegacySenders 未加载，_legacySendMessage 跳过');
                    return;
                }
                window.LegacySenders.sendMessage({ messageModule: this, content });
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
                        log.error('显示店铺列表失败', error);
                    }
                }
                
                // 降级：使用原有逻辑
                return this._legacyShowShops();
            }

            // 原有店铺显示逻辑（降级使用）
            async _legacyShowShops() {
                if (!window.LegacyLoaders) {
                    log.warn('LegacyLoaders 未加载，_legacyShowShops 跳过');
                    return;
                }
                return window.LegacyLoaders.showShops({ messageModule: this });
            }
            /**
             * Deprecated: renderShopsList 旧实现已移除，统一改为委托 shopsManager.renderShopsList()
             * 若外部旧代码仍调用 messageModule.renderShopsList()，保持一个轻量兼容层。
             */
            async renderShopsList() {
                if (this.shopsManager && this.shopsManager.renderShopsList) {
                    return this.shopsManager.renderShopsList();
                }
                log.warn('ShopsManager 不可用，renderShopsList 跳过');
            }

            // 创建单个店铺卡片（委托 UI 组件）
            async createShopCard(shop) {
                // 使用统一统计服务（优先）+ 兜底
                let conversationCount = 0, unreadCount = 0;
                try {
                    if (window.ShopStatsService && typeof window.ShopStatsService.fetchShopStats === 'function') {
                        const stats = await window.ShopStatsService.fetchShopStats(shop.id, false);
                        conversationCount = stats.conversation_count || 0;
                        unreadCount = stats.unread_count || 0;
                    } else if (window.unifiedDataSyncManager && typeof window.unifiedDataSyncManager.fetchShopStats === 'function') {
                        const stats = await window.unifiedDataSyncManager.fetchShopStats(shop.id, true);
                        conversationCount = stats && stats.conversation_count ? stats.conversation_count : 0;
                        unreadCount = stats && stats.unread_count ? stats.unread_count : 0;
                    } else {
                        conversationCount = await this.getShopConversationCount(shop.id);
                        unreadCount = await this.getShopUnreadCount(shop.id);
                    }
                } catch(e){
                    log.warn('店铺统计获取失败 使用0兜底 id='+shop.id, e);
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
                        try { if (window.MessageStateStore) { MessageStateStore.setMessages(conversationId, messages); } } catch(_){ }
                        try { if (window.MessageStateStore) { MessageStateStore.markConversationRead(conversationId); } } catch(_){ }
                        return messages;
                    } catch (error) {
                        log.error('委托加载消息失败', error);
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
                this._notifyNewMessageForScroll();
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
                if (window.ScrollCoordinator) {
                    return window.ScrollCoordinator.scrollToEnd(true);
                }
                const container = document.getElementById('chatMessages');
                if (container) container.scrollTop = container.scrollHeight;
            }

            focusChatInput() {
                setTimeout(() => {
                    const input = document.getElementById('chatInput');
                    if (input) input.focus();
                }, 100);
            }

            // 显示指定视图
            showView(viewId) {
                this._ensureViewController();
                if (this._view) this._view.showView(viewId); else {
                    // 回退: 极简显示
                    const el = document.getElementById(viewId);
                    if (el) el.style.display='block';
                }
            }

            // 返回上一级
            goBack() {
                this._ensureViewController();
                if (this._view) {
                    const chatView = document.getElementById('chatView');
                    const convView = document.getElementById('conversationsListView');
                    this._view.goBack({
                        inChat: !!(chatView && chatView.style.display==='block'),
                        inConversations: !!(convView && convView.style.display==='block')
                    });
                }
            }

            _ensureViewController(){
                if (this._view || !window.MessageViewController) return;
                this._view = window.MessageViewController.create({
                    onBack: ()=> this.goBack(),
                    onLeaveShop: ()=> { this.currentShopId = null; }
                });
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
            /**
             * showToast
             * @deprecated 请使用 Notify.show / Notify.success 等统一通知入口
             * 保留此方法仅做向后兼容，内部已委托到 Notify 或 window.showToast
             */
            showToast(message, type = 'info') {
                try {
                    if (window.Notify && typeof window.Notify.show === 'function') {
                        return window.Notify.show(message, type);
                    }
                    if (typeof window.showToast === 'function') {
                        return window.showToast(message, type);
                    }
                } catch(e){ /* 忽略通知异常 */ }
                log.info(`[Toast ${type}] ${message}`);
            }

            // 兼容方法：加载店铺对话列表（委托给对话管理器）
            async loadConversationsForShop(shopId) {
                if (this.conversationsManager) {
                    try {
                        const conversations = await this.conversationsManager.loadConversationsForShop(shopId);
                        this.conversations = conversations;
                        return conversations;
                    } catch (error) {
                        log.error('委托加载对话失败', error);
                        throw error;
                    }
                }
                
                // 降级：使用原有逻辑
                return this._legacyLoadConversationsForShop(shopId);
            }

            // 原有对话加载逻辑（降级使用）
            async _legacyLoadConversationsForShop(shopId) {
                if (!window.LegacyLoaders) {
                    log.warn('LegacyLoaders 未加载，_legacyLoadConversationsForShop 跳过');
                    return;
                }
                return window.LegacyLoaders.loadConversationsForShop({ shopId, messageModule: this });
            }

            // 兼容方法：渲染对话列表（委托给对话管理器）
            async renderConversationsList() {
                if (this.conversationsManager) {
                    await this.conversationsManager.renderConversationsList();
                } else {
                    log.warn('ConversationsManager 不可用，跳过对话列表渲染');
                }
            }

            // 兼容方法：生成客户编号
            generateCustomerNumber(customerId) {
                // 统一策略：优先骨架 CustomerNumbering
                try {
                    if (window.CustomerNumbering && typeof window.CustomerNumbering.generateCustomerNumber === 'function') {
                        return window.CustomerNumbering.generateCustomerNumber(String(customerId));
                    }
                    if (this.conversationsManager && typeof this.conversationsManager.generateCustomerNumber === 'function') {
                        return this.conversationsManager.generateCustomerNumber(customerId);
                    }
                    if (window.generateCustomerNumber && typeof window.generateCustomerNumber === 'function') {
                        return window.generateCustomerNumber(customerId);
                    }
                } catch(e){ log.warn('生成客户编号异常，使用兜底', e); }
                const raw = (String(customerId||'').replace('customer_','')); 
                return `客户${raw.substring(0,8)}`;
            }

            // 兼容方法：获取店铺对话数量（委托给店铺管理器）
            async getShopConversationCount(shopId) {
                // @deprecated: 已由 ShopStatsService 统一，请使用 ShopStatsService.fetchShopStats
                if (this.shopsManager) {
                    return this.shopsManager.getShopConversationCount(shopId);
                }
                
                // 降级实现
                try {
                    if (!window.AuthFetch) throw new Error('AuthFetch 未加载');
                    const resp = await window.AuthFetch.safeJsonFetch(`/api/conversations?shop_id=${shopId}`);
                    const arr = resp.ok && Array.isArray(resp.data) ? resp.data : [];
                    return arr.length;
                } catch (error) {
                    log.error('降级：获取店铺对话数量失败', error);
                    return 0;
                }
            }

            // 兼容方法：获取店铺未读数量（委托给店铺管理器）
            async getShopUnreadCount(shopId) {
                // @deprecated: 已由 ShopStatsService 统一，请使用 ShopStatsService.fetchShopStats
                if (this.shopsManager) {
                    return this.shopsManager.getShopUnreadCount(shopId);
                }
                
                // 降级实现
                try {
                    if (!window.AuthFetch) throw new Error('AuthFetch 未加载');
                    const resp = await window.AuthFetch.safeJsonFetch(`/api/conversations?shop_id=${shopId}`);
                    if (resp.ok && Array.isArray(resp.data)) {
                        return resp.data.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
                    }
                    return 0;
                } catch (error) {
                    log.error('降级：获取店铺未读数量失败', error);
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
                    log.warn('分页加载失败', error);
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

            // Typing 指示（旧模块回退用）
            handleTypingIndicator(evt){
                try { if (window.ChatTypingIndicator) window.ChatTypingIndicator.showTyping(evt); } catch(_){ }
            }

            // 滚动协调器通知封装
            _notifyNewMessageForScroll(){
                if (window.ScrollCoordinator && typeof window.ScrollCoordinator.notifyNewMessage === 'function') {
                    window.ScrollCoordinator.notifyNewMessage();
                } else {
                    this.scrollToBottom();
                }
            }
        }

    // 将类暴露到全局
    window.MessageModule = MessageModule;

    log.info('消息模块已加载 (message-module.js) - 重构版');
})();
