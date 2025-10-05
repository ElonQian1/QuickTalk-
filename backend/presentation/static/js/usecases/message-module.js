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
                // Legacy 使用监控 (后续用于安全移除判断)
                this._legacyUsage = {
                    loadMessages: 0,
                    sendMessage: 0,
                    showShops: 0,
                    loadConversationsForShop: 0,
                    wsInlineHandler: 0
                };
                
                // legacy 兼容层
                this._legacyCompat = null;
                // 暴露调试接口（幂等）：window.__MessageLegacyUsage.get()
                try {
                    if (!window.__MessageLegacyUsage) {
                        window.__MessageLegacyUsage = {
                            get: ()=> ({ ...(this._legacyUsage||{}) }),
                            print: ()=> { try { console.table(this._legacyUsage); } catch(_){ console.log('LegacyUsage', this._legacyUsage); } },
                            reset: ()=> { Object.keys(this._legacyUsage).forEach(k=> this._legacyUsage[k]=0); }
                        };
                    }
                } catch(_){ }
                // 增强特性初始化迁移至 message-boot.js (保留空位防重复调用)
                try { if (window.__MessageBootInfo && window.__MessageBootInfo.get) { /* 已由 boot 处理 */ } } catch(_){ }
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

                // 导航/视图控制器 (重构后由 MessageNavigation 管理)
                this._nav = null; // 延迟创建
                
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

                // 渲染 / 发送器 等初始化已迁移至 message-boot.js (延迟装配) 
                // 保留兼容：如外部未加载 boot，可按需 fallback (轻量兜底)
                setTimeout(()=>{
                    if (!window.MessageBoot || !window.__MessageBootInfo){
                        try {
                            if (window.ScrollCoordinator && typeof window.ScrollCoordinator.init === 'function') {
                                window.ScrollCoordinator.init({ getContainer: ()=> document.getElementById('chatMessages'), autoStick: true, stickThreshold: 80 });
                            }
                        } catch(_){ }
                        try {
                            if (window.MessageRenderer && typeof window.MessageRenderer.init === 'function' && !this._renderer){
                                this._renderer = window.MessageRenderer.init(this);
                            }
                        } catch(_){ }
                        try {
                            if (!this._sender && window.MessageSender){
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
                            }
                        } catch(_){ }
                    }
                },0);
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
                this._ensureNavigation();
                if (this._nav) this._nav.updateNavigationUI(title, showBackBtn);
            }

            /**
             * 更新聊天头部
             */
            updateChatHeader(conversation, customer) {
                this._ensureNavigation();
                if (this._nav) return this._nav.updateChatHeader(conversation, customer);
                // 回退旧逻辑
                if (window.ChatHeaderUI && typeof window.ChatHeaderUI.updateForConversation === 'function') {
                    try { window.ChatHeaderUI.updateForConversation(conversation, { customerName: customer.name }); return; } catch(_){ }
                }
                const titleElement = document.getElementById('messagesTitle');
                if (titleElement) titleElement.textContent = customer.name;
            }

            // 初始化 WebSocket 适配器（已抽象到 MessageWSHandler）
            _initWSAdapter(){
                // 优先主处理器；缺席则使用 WSFallback
                if (window.MessageWSHandler) {
                    this._wsHandler = window.MessageWSHandler.init({
                        debug: false,
                        onEvent: (evt)=> {
                            try {
                                if (window.__WsEventsMetrics && window.__WsEventsMetrics.record){
                                    window.__WsEventsMetrics.record(evt.raw, { path: 'router' });
                                }
                                if (window.WsEventRouter && typeof window.WsEventRouter.route === 'function') {
                                    window.WsEventRouter.route(this, evt.raw); return; }
                                // 仅保留最小回退 (legacy inline)
                                if (window.__WsEventsMetrics && window.__WsEventsMetrics.record){
                                    window.__WsEventsMetrics.record(evt.raw, { path: 'inline' });
                                }
                                this.handleWebSocketMessage(evt.raw);
                            } catch(e){ log.error('ws handler route error', e); }
                        }
                    });
                    Object.defineProperty(this, 'websocket', { get: ()=> (this._wsHandler && this._wsHandler._ws) || null });
                    Object.defineProperty(this, 'wsAdapter', { get: ()=> ({ send: (d)=> this._wsHandler? this._wsHandler.send(d) : false }) });
                    return;
                }
                // Fallback 分支
                if (window.WSFallback && typeof window.WSFallback.ensureWS === 'function') {
                    const routeEvent = (raw)=>{
                        try {
                            if (window.__WsEventsMetrics && window.__WsEventsMetrics.record){
                                window.__WsEventsMetrics.record(raw, { path: 'router-fallback' });
                            }
                            if (window.WsEventRouter && typeof window.WsEventRouter.route === 'function') { window.WsEventRouter.route(this, raw); return; }
                            if (window.__WsEventsMetrics && window.__WsEventsMetrics.record){
                                window.__WsEventsMetrics.record(raw, { path: 'inline' });
                            }
                            this.handleWebSocketMessage(raw);
                        } catch(e){ log.error('fallback ws route error', e); }
                    };
                    const feedback = (lvl, msg)=>{ try { if (window.Feedback) Feedback.show(msg, lvl); } catch(_){ log.info(msg); } };
                    this._wsFallback = window.WSFallback.ensureWS({
                        urlBuilder: ()=> (window.WS_BASE_URL || (location.protocol === 'https:' ? `wss://${location.host}/ws` : `ws://${location.host}/ws`)),
                        onEvent: routeEvent,
                        onStatus: (s, meta)=>{
                            // 简单状态提示（节流 + 去重）
                            if (!this._lastWsStatus || this._lastWsStatus !== s){
                                this._lastWsStatus = s;
                                if (s === 'open') feedback('success','实时连接已建立');
                                else if (s === 'reconnecting') feedback('warn','实时连接已断开，正在重连...');
                                else if (s === 'degraded') feedback('warn','实时连接不稳定 (degraded)');
                                else if (s === 'closed' && !meta?.manual) feedback('error','实时连接已关闭');
                            }
                        },
                        onDegraded: ()=>{},
                        heartbeatSec: 25,
                        maxBackoff: 15000
                    });
                    // 兼容旧字段
                    Object.defineProperty(this, 'websocket', { get: ()=> null });
                    Object.defineProperty(this, 'wsAdapter', { get: ()=> ({ send: (d)=> this._wsFallback? this._wsFallback.send(d) : false }) });
                    log.warn('已使用 WSFallback 作为临时 WebSocket 管理器');
                } else {
                    log.error('没有可用的 WebSocket 处理器 (MessageWSHandler 与 WSFallback 均缺失)');
                }
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
             * @deprecated handleWebSocketMessage 旧内联处理逻辑（委托调用）
             * 拆分后请使用独立模块 message-ws-events-handler.js
             */
            handleWebSocketMessage(data) {
                if (!this._legacyCompat) this._ensureLegacyCompat();
                return this._legacyCompat.handleWebSocketMessage(data);
            }

            // _ensureWsEventsDelegate 已合并进 WsEventRouter 统一路径 (2025-10) — 保留占位以防外部调用
            _ensureWsEventsDelegate(){ /* deprecated noop */ }

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

            /**
             * 确保 legacy 兼容层已加载
             */
            _ensureLegacyCompat() {
                if (window.MessageLegacyCompat && !this._legacyCompat) {
                    this._legacyCompat = window.MessageLegacyCompat.create(this);
                }
            }

            /**
             * @deprecated 原有消息加载逻辑（委托调用）
             */
            async _legacyLoadMessages(conversationId) {
                if (!this._legacyCompat) this._ensureLegacyCompat();
                return this._legacyCompat.loadMessages(conversationId);
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

            /**
             * @deprecated 原有发送消息逻辑（委托调用）
             */
            _legacySendMessage(content) {
                if (!this._legacyCompat) this._ensureLegacyCompat();
                return this._legacyCompat.sendMessage(content);
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

            /**
             * @deprecated 原有店铺显示逻辑（委托调用）
             */
            async _legacyShowShops() {
                if (!this._legacyCompat) this._ensureLegacyCompat();
                return this._legacyCompat.showShops();
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
                const { conversationCount, unreadCount } = await this._fetchShopStatsSafe(shop.id);
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
                // 优先使用外部渲染器
                if (this._renderer && this._renderer.renderMessages) {
                    const r = this._renderer.renderMessages();
                    this._notifyNewMessageForScroll();
                    return r;
                }
                // Fallback: 最小安全逻辑（保持旧体验）
                try {
                    const container = document.getElementById('chatMessages');
                    if (!container) return;
                    container.innerHTML = '';
                    (this.messages || []).forEach(m => {
                        const div = document.createElement('div');
                        div.className = 'chat-message';
                        div.textContent = (m.content || '').slice(0, 200);
                        container.appendChild(div);
                    });
                    this._notifyNewMessageForScroll();
                } catch(e){ log.warn('fallback renderMessages error', e); }
            }

            // 渲染单条消息（委托给渲染器）
            renderMessage(message) {
                if (this._renderer && this._renderer.renderMessage) {
                    return this._renderer.renderMessage(message);
                }
                // Fallback: 最小单条渲染
                try {
                    const container = document.getElementById('chatMessages');
                    if (!container) return;
                    const div = document.createElement('div');
                    div.className = 'chat-message';
                    div.textContent = (message.content || '').slice(0, 200);
                    container.appendChild(div);
                } catch(e){ log.warn('fallback renderMessage error', e); }
            }

            // (重复 sendMessage 定义已移除，统一使用前方兼容实现)

            // 辅助方法
            scrollToBottom() {
                // 统一委托 ScrollCoordinator, 若缺席则回退
                if (window.ScrollCoordinator && typeof window.ScrollCoordinator.scrollToEnd === 'function') {
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
                this._ensureNavigation();
                if (this._nav) return this._nav.showView(viewId);
                const el = document.getElementById(viewId); if (el) el.style.display='block';
            }

            // 返回上一级
            goBack() {
                this._ensureNavigation();
                if (this._nav) return this._nav.goBack();
            }

            _ensureNavigation(){
                if (this._nav) return;
                if (window.MessageNavigation && typeof window.MessageNavigation.create === 'function') {
                    try { this._nav = window.MessageNavigation.create(this); } catch(_){ }
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
            /**
             * showToast
             * @deprecated 请使用 Notify.show / Notify.success 等统一通知入口
             * 保留此方法仅做向后兼容，内部已委托到 Notify 或 window.showToast
             */
            showToast(message, type = 'info') {
                // 新统一入口: Feedback.show 内部已适配 Notify/Toast/showToast 并做重复抑制
                try {
                    if (window.Feedback && typeof window.Feedback.show === 'function') {
                        return window.Feedback.show(message, type);
                    }
                    if (window.Notify && typeof window.Notify.show === 'function') {
                        return window.Notify.show(message, type);
                    }
                    if (typeof window.showToast === 'function') {
                        return window.showToast(message, type);
                    }
                } catch(e){ /* 忽略通知异常 */ }
                log.info(`[ToastFallback ${type}] ${message}`);
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

            /**
             * @deprecated 原有对话加载逻辑（委托调用）
             */
            async _legacyLoadConversationsForShop(shopId) {
                if (!this._legacyCompat) this._ensureLegacyCompat();
                return this._legacyCompat.loadConversationsForShop(shopId);
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
                try {
                    if (window.CustomerNumbering && typeof window.CustomerNumbering.generateCustomerNumber === 'function') {
                        return window.CustomerNumbering.generateCustomerNumber(customerId);
                    }
                } catch(e){ log.warn('CustomerNumbering 调用异常', e); }
                // 最终兜底
                const raw = String(customerId||'').replace('customer_','');
                return '客户'+ raw.substring(0,8 || 3);
            }

            // 兼容方法：获取店铺对话数量（委托给店铺管理器）
            async getShopConversationCount(shopId) {
                log.warn('[deprecated] getShopConversationCount 请改用 _fetchShopStatsSafe');
                const stats = await this._fetchShopStatsSafe(shopId);
                return stats.conversationCount;
            }

            // 兼容方法：获取店铺未读数量（委托给店铺管理器）
            async getShopUnreadCount(shopId) {
                log.warn('[deprecated] getShopUnreadCount 请改用 _fetchShopStatsSafe');
                const stats = await this._fetchShopStatsSafe(shopId);
                return stats.unreadCount;
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
                try {
                    if (window.ScrollCoordinator && typeof window.ScrollCoordinator.notifyNewMessage === 'function') {
                        window.ScrollCoordinator.notifyNewMessage();
                        return;
                    }
                } catch(_){}
                // 回退
                this.scrollToBottom();
            }

            // 统一店铺统计获取（集中入口）
            async _fetchShopStatsSafe(shopId){
                const result = { conversationCount:0, unreadCount:0 };
                if (!shopId){ return result; }
                try {
                    if (window.ShopStatsService && typeof window.ShopStatsService.fetchShopStats === 'function'){
                        const stats = await window.ShopStatsService.fetchShopStats(shopId, false);
                        result.conversationCount = stats.conversation_count || 0;
                        result.unreadCount = stats.unread_count || 0;
                        return result;
                    }
                    // 次级来源（旧同步管理器）
                    if (window.unifiedDataSyncManager && typeof window.unifiedDataSyncManager.fetchShopStats === 'function'){
                        const stats = await window.unifiedDataSyncManager.fetchShopStats(shopId, true);
                        result.conversationCount = (stats && stats.conversation_count) || 0;
                        result.unreadCount = (stats && stats.unread_count) || 0;
                        return result;
                    }
                    // 兜底：直接 API (一次性，不建议常用)
                    if (window.AuthFetch && typeof window.AuthFetch.safeJsonFetch === 'function'){
                        const resp = await window.AuthFetch.safeJsonFetch(`/api/conversations?shop_id=${shopId}`);
                        if (resp.ok && Array.isArray(resp.data)){
                            result.conversationCount = resp.data.length;
                            result.unreadCount = resp.data.reduce((sum,c)=> sum + (c.unread_count||0),0);
                        }
                        return result;
                    }
                    // 最终再兜底 fetch (可能无鉴权头)
                    const r = await fetch(`/api/conversations?shop_id=${shopId}`);
                    try {
                        const j = await r.json();
                        const arr = Array.isArray(j)? j : (j.data||[]);
                        result.conversationCount = arr.length;
                        result.unreadCount = arr.reduce((s,c)=> s + (c.unread_count||0),0);
                    } catch(_){}
                } catch(err){
                    log.warn('获取店铺统计失败 (统一入口)', err);
                }
                return result;
            }
        }

    // 将类暴露到全局
    window.MessageModule = MessageModule;

    log.info('消息模块已加载 (message-module.js) - 重构版');
})();
