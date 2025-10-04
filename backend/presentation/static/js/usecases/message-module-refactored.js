/**
 * MessageModuleRefactored - 消息模块协调器 (精简重构版)
 * 职责：仅负责协调各个独立管理器，不包含具体业务逻辑
 * 依赖：ShopsManagerRefactored, ConversationsManagerRefactored, MessagesManagerRefactored
 */
(function() {
    'use strict';

    class MessageModuleRefactored {
        constructor() {
            // 管理器实例
            this.shopsManager = null;
            this.conversationsManager = null;
            this.messagesManager = null;
            this.mediaHandler = null;
            
            // 当前状态（向后兼容）
            this.currentShopId = null;
            this.currentConversationId = null;
            this.currentCustomer = null;
            
            // 数据缓存（向后兼容）
            this.shops = [];
            this.conversations = [];
            this.messages = [];
            
            // WebSocket相关
            this.websocket = null;
            this.wsAdapter = null;
            
            // 初始化
            this.initManagers();
            this.initWebSocket();
            // 滚动协调器引用（小步快跑阶段1：延迟在第一次加载消息后注入）
            this._scrollCoordinator = null;
        }

        /**
         * 初始化各个管理器
         */
        initManagers() {
            console.log('🔧 MessageModuleRefactored: 开始初始化管理器...');
            
            // 初始化店铺管理器
            if (window.ShopsManagerRefactored) {
                try {
                    console.log('📦 创建 ShopsManagerRefactored 实例');
                    this.shopsManager = new window.ShopsManagerRefactored({
                        onShopSelected: (shop, stats) => this.handleShopSelected(shop, stats),
                        onShopsLoaded: (shops) => { this.shops = shops; },
                        debug: false
                    });
                    console.log('✅ ShopsManagerRefactored 创建成功');
                } catch (e) {
                    console.error('❌ ShopsManagerRefactored 创建失败:', e);
                }
            } else {
                console.warn('⚠️ window.ShopsManagerRefactored 不存在');
            }

            // 初始化对话管理器
            if (window.ConversationsManagerRefactored) {
                this.conversationsManager = new window.ConversationsManagerRefactored({
                    onConversationSelected: (conversation, customer) => this.handleConversationSelected(conversation, customer),
                    onConversationsLoaded: (conversations) => { this.conversations = conversations; },
                    debug: false
                });
            }

            // 初始化消息管理器
            if (window.MessagesManagerRefactored) {
                this.messagesManager = new window.MessagesManagerRefactored({
                    onNewMessage: (message) => this.handleNewMessageEvent(message),
                    onMessageUpdated: (message) => this.handleMessageUpdatedEvent(message),
                    onMessageDeleted: (messageId) => this.handleMessageDeletedEvent(messageId),
                    debug: false
                });
            }

            // 初始化媒体处理器
            if (window.MediaHandler) {
                this.mediaHandler = new window.MediaHandler({
                    messagesManager: this.messagesManager,
                    debug: false
                });
            }

            console.log('✅ 消息模块管理器初始化完成');
        }

        /**
         * 初始化WebSocket
         */
        initWebSocket() {
            if (window.MessageWSAdapter) {
                this.wsAdapter = new window.MessageWSAdapter({ debug: false });
                
                // 向后兼容：暴露底层socket
                Object.defineProperty(this, 'websocket', { 
                    get: () => this.wsAdapter?._ws 
                });
                
                // 监听所有WebSocket事件
                this.wsAdapter.on('*any', (data) => {
                    this.handleWebSocketMessage(data);
                });
                
                this.wsAdapter.on('*open', () => console.log('[MessageModuleRefactored] WebSocket已连接'));
                this.wsAdapter.on('*close', (info) => console.log('[MessageModuleRefactored] WebSocket已关闭', info));
                this.wsAdapter.on('*error', (err) => console.warn('[MessageModuleRefactored] WebSocket错误', err));
            }
        }

        /**
         * 处理店铺选择
         */
        async handleShopSelected(shop, stats) {
            this.currentShopId = shop.id;
            
            // 更新导航UI
            this.updateNavigationUI(shop.name + ' - 客户对话', true);
            this.showView('conversationsListView');
            
            // 加载对话列表
            if (this.conversationsManager) {
                await this.conversationsManager.loadConversationsForShop(shop.id);
                await this.conversationsManager.renderConversationsList();
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
                await this.messagesManager.loadMessages(conversation.id, customer);
                // 初始化或复用滚动协调器
                if (!this._scrollCoordinator && window.MessageScrollCoordinator && typeof window.MessageScrollCoordinator.init === 'function') {
                    try { this._scrollCoordinator = window.MessageScrollCoordinator.init('chatMessages'); } catch(e){ console.warn('[MessageModuleRefactored] 滚动协调器初始化失败', e);}                
                }
                this.focusChatInput();
            }
            // 进入会话后清零未读
            try { if (window.UnreadSync && typeof window.UnreadSync.markCurrentAsRead === 'function') { window.UnreadSync.markCurrentAsRead(); } } catch(_){ }
        }

        /**
         * 处理WebSocket消息
         */
        handleWebSocketMessage(data) {
            if (!data) return;
            // 单一路由：所有类型统一交给 WsEventRouter；无则最小降级处理 message
            if (window.WsEventRouter && typeof window.WsEventRouter.route === 'function') {
                try { window.WsEventRouter.route(this, data); } catch(e){ console.error('[MessageModuleRefactored] WS route error', e);}            
            } else if (data.type === 'message' || data.msg_type === 'message') {
                this.handleNewMessage(data);
            }
        }

        /**
         * Typing 指示处理（供 ws-event-router 或旧路径调用）
         */
        handleTypingIndicator(evt){
            try { if (window.ChatTypingIndicator) window.ChatTypingIndicator.showTyping(evt); } catch(_){ }
        }

        /**
         * 处理新消息
         */
        handleNewMessage(messageData) {
            if (this.messagesManager) {
                this.messagesManager.handleNewMessage(messageData);
            }
        }

        /**
         * 处理领域事件
         */
        handleDomainEvent(eventType, data) {
            const unwrap = (evt) => (evt && evt.data) ? (evt.data.message || evt.data) : evt;
            const message = unwrap(data);
            
            if (eventType.endsWith('message_appended')) {
                this.handleNewMessage(message);
            } else if (eventType.endsWith('message_updated')) {
                if (this.messagesManager) {
                    this.messagesManager.handleMessageUpdated(message);
                }
            } else if (eventType.endsWith('message_deleted')) {
                if (this.messagesManager) {
                    this.messagesManager.handleMessageDeleted(message);
                }
            }
        }

        /**
         * 处理新消息事件
         */
        handleNewMessageEvent(message) {
            // 更新对话预览
            if (this.conversationsManager) {
                this.conversationsManager.updateConversationPreview(message);
            }
        }

        /**
         * 处理消息更新事件
         */
        handleMessageUpdatedEvent(message) {
            console.log('[MessageModuleRefactored] 消息已更新:', message.id);
        }

        /**
         * 处理消息删除事件
         */
        handleMessageDeletedEvent(messageId) {
            console.log('[MessageModuleRefactored] 消息已删除:', messageId);
        }

        // ===== 向后兼容的接口方法 =====

        /**
         * 显示店铺列表
         */
        async showShops() {
            console.log('🏪 MessageModuleRefactored: 开始显示店铺列表...');
            
            if (!this.shopsManager) {
                console.error('❌ shopsManager 未初始化');
                throw new Error('店铺管理器未初始化');
            }
            
            try {
                console.log('🔄 初始化店铺管理器...');
                await this.shopsManager.init();
                
                console.log('🎨 渲染店铺列表...');
                await this.shopsManager.renderShopsList();
                
                console.log('🧭 更新导航界面...');
                this.updateNavigationUI('客服消息', false);
                
                console.log('👁️ 显示店铺列表视图...');
                this.showView('shopsListView');
                
                console.log('✅ 店铺列表显示完成，店铺数量:', this.shopsManager.shops?.length || 0);
                return this.shopsManager.shops || [];
            } catch (error) {
                console.error('❌ showShops 执行失败:', error);
                throw error;
            }
        }

        /**
         * 选择店铺
         */
        async selectShop(shop) {
            if (this.shopsManager) {
                return await this.shopsManager.selectShop(shop);
            }
        }

        /**
         * 选择对话
         */
        async selectConversation(conversation) {
            if (this.conversationsManager) {
                return await this.conversationsManager.selectConversation(conversation);
            }
        }

        /**
         * 发送消息
         */
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
                return success;
            }
            return false;
        }

        /**
         * 加载消息
         */
        async loadMessages(conversationId) {
            if (this.messagesManager) {
                const messages = await this.messagesManager.loadMessages(conversationId, this.currentCustomer);
                this.messages = messages;
                return messages;
            }
            return [];
        }

        // ===== UI相关方法 =====

        /**
         * 显示指定视图
         */
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

        /**
         * 返回上一级
         */
        goBack() {
            const chatView = document.getElementById('chatView');
            const conversationsListView = document.getElementById('conversationsListView');
            
            if (chatView && chatView.style.display === 'block') {
                this.showView('conversationsListView');
                this.updateNavigationUI('客户对话', true);
            } else if (conversationsListView && conversationsListView.style.display === 'block') {
                this.showView('shopsListView');
                this.updateNavigationUI('客服消息', false);
                this.currentShopId = null;
            }
        }

        /**
         * 聚焦聊天输入框
         */
        focusChatInput() {
            setTimeout(() => {
                const input = document.getElementById('chatInput');
                if (input) input.focus();
            }, 100);
        }

        /**
         * 生成客户编号
         */
        generateCustomerNumber(customerId) {
            if (this.conversationsManager) {
                return this.conversationsManager.generateCustomerNumber(customerId);
            }
            return `客户${customerId.replace('customer_', '').substring(0, 8)}`;
        }

        // ===== 媒体处理委托方法 =====

        createMediaElement(file) {
            return this.mediaHandler ? this.mediaHandler.createMediaElement(file) : null;
        }

        openImageModal(src) {
            if (this.mediaHandler) this.mediaHandler.openImageModal(src);
        }

        async uploadFile(file) {
            if (this.mediaHandler) return this.mediaHandler.uploadFile(file);
            throw new Error('MediaHandler 不可用');
        }

        async handleFileSelection(files) {
            if (this.mediaHandler) return this.mediaHandler.handleFileSelection(files);
        }

        async toggleVoiceRecording() {
            if (this.mediaHandler) return this.mediaHandler.toggleVoiceRecording();
        }

        getFileIcon(mimeType) {
            return this.mediaHandler ? this.mediaHandler.getFileIcon(mimeType) : '📁';
        }

        formatFileSize(bytes) {
            return this.mediaHandler ? this.mediaHandler.formatFileSize(bytes) : bytes + ' bytes';
        }

        // ===== 兼容属性 =====

        get isRecording() {
            return this.mediaHandler ? this.mediaHandler.getRecordingState().isRecording : false;
        }
    }

    // 暴露到全局
    window.MessageModuleRefactored = MessageModuleRefactored;

    console.log('✅ 消息模块协调器重构版已加载 (message-module-refactored.js) - 精简版本');

})();