/**
 * MessageCoordinator - 消息模块核心协调器
 * 职责：协调各业务管理器，提供统一接口，处理视图切换
 * 特点：轻量、职责单一、无Legacy负担
 * 
 * 设计原则：
 * - 单一职责：仅负责协调，不包含具体业务逻辑
 * - 依赖注入：通过构造函数注入依赖
 * - 事件驱动：通过事件总线进行模块间通信
 * - 可测试：纯函数式设计，易于单元测试
 */
(function() {
    'use strict';

    const LOG_PREFIX = '[MessageCoordinator]';
    
    class MessageCoordinator {
        constructor(options = {}) {
            this.options = {
                debug: false,
                autoInit: true,
                ...options
            };
            
            // 核心状态
            this.state = {
                currentShopId: null,
                currentConversationId: null,
                currentCustomer: null,
                initialized: false
            };
            
            // 依赖注入的管理器
            this.managers = {
                shops: null,
                conversations: null,
                messages: null,
                media: null
            };
            
            // 事件总线
            this.eventBus = options.eventBus || window.MessageEventBus || null;
            
            if (this.options.autoInit) {
                this.init();
            }
        }
        
        /**
         * 初始化协调器
         */
        init() {
            if (this.state.initialized) return;
            
            this.log('初始化消息协调器...');
            
            // 注入依赖管理器
            this.injectManagers();
            
            // 设置事件监听
            this.setupEventListeners();
            
            this.state.initialized = true;
            this.log('消息协调器初始化完成');
        }
        
        /**
         * 注入依赖管理器
         */
        injectManagers() {
            // 店铺管理器
            if (window.ShopsManager) {
                this.managers.shops = new window.ShopsManager({
                    onShopSelected: (shop, stats) => this.handleShopSelected(shop, stats),
                    debug: this.options.debug
                });
            }
            
            // 对话管理器
            if (window.ConversationsManager) {
                this.managers.conversations = new window.ConversationsManager({
                    onConversationSelected: (conversation, customer) => this.handleConversationSelected(conversation, customer),
                    debug: this.options.debug
                });
            }
            
            // 消息管理器
            if (window.MessagesManager) {
                this.managers.messages = new window.MessagesManager({
                    onNewMessage: (message) => this.handleNewMessage(message),
                    onMessageUpdated: (message) => this.handleMessageUpdated(message),
                    onMessageDeleted: (messageId) => this.handleMessageDeleted(messageId),
                    debug: this.options.debug
                });
            }
            
            // 媒体处理器
            if (window.MediaHandler) {
                this.managers.media = new window.MediaHandler({
                    messagesManager: this.managers.messages,
                    debug: this.options.debug
                });
            }
            
            this.log('依赖管理器注入完成', Object.keys(this.managers).filter(k => this.managers[k]));
        }
        
        /**
         * 设置事件监听
         */
        setupEventListeners() {
            if (!this.eventBus) return;
            
            // 监听领域事件
            this.eventBus.subscribe('shop.selected', this.handleShopSelected.bind(this));
            this.eventBus.subscribe('conversation.selected', this.handleConversationSelected.bind(this));
            this.eventBus.subscribe('message.sent', this.handleMessageSent.bind(this));
            this.eventBus.subscribe('message.received', this.handleMessageReceived.bind(this));
        }
        
        /**
         * 处理店铺选择
         */
        async handleShopSelected(shop, stats = {}) {
            this.log('处理店铺选择', shop.id, shop.name);
            
            this.state.currentShopId = shop.id;
            this.state.currentConversationId = null;
            this.state.currentCustomer = null;
            
            // 更新导航UI
            this.updateNavigationUI(`${shop.name} - 客户对话`, true);
            
            // 显示对话列表视图
            this.showView('conversationsListView');
            
            // 加载对话列表
            if (this.managers.conversations) {
                try {
                    await this.managers.conversations.loadConversationsForShop(shop.id);
                } catch (error) {
                    this.error('加载对话失败', error);
                    this.showError('加载对话列表失败，请重试');
                }
            }
            
            // 发布事件
            this.publish('coordinator.shop.selected', { shop, stats });
        }
        
        /**
         * 处理对话选择
         */
        async handleConversationSelected(conversation, customer) {
            this.log('处理对话选择', conversation.id, customer.name);
            
            this.state.currentConversationId = conversation.id;
            this.state.currentCustomer = customer;
            
            // 更新聊天头部
            this.updateChatHeader(conversation, customer);
            
            // 切换到聊天视图
            this.showView('chatView');
            
            // 加载消息
            if (this.managers.messages) {
                try {
                    await this.managers.messages.loadMessages(conversation.id, customer);
                    
                    // 标记为已读
                    if (window.MessageStateStore) {
                        window.MessageStateStore.markConversationRead(conversation.id);
                    }
                    
                    // 聚焦输入框
                    this.focusChatInput();
                } catch (error) {
                    this.error('加载消息失败', error);
                    this.showError('加载消息失败，请重试');
                }
            }
            
            // 发布事件
            this.publish('coordinator.conversation.selected', { conversation, customer });
        }
        
        /**
         * 处理新消息
         */
        handleNewMessage(message) {
            this.log('处理新消息', message.id);
            
            // 更新对话预览
            if (this.managers.conversations) {
                this.managers.conversations.updateConversationPreview(message);
            }
            
            // 发布事件
            this.publish('coordinator.message.new', { message });
        }
        
        /**
         * 处理消息更新
         */
        handleMessageUpdated(message) {
            this.log('处理消息更新', message.id);
            this.publish('coordinator.message.updated', { message });
        }
        
        /**
         * 处理消息删除
         */
        handleMessageDeleted(messageId) {
            this.log('处理消息删除', messageId);
            this.publish('coordinator.message.deleted', { messageId });
        }
        
        /**
         * 处理消息发送
         */
        handleMessageSent(data) {
            this.log('处理消息发送', data);
            this.publish('coordinator.message.sent', data);
        }
        
        /**
         * 处理消息接收
         */
        handleMessageReceived(data) {
            this.log('处理消息接收', data);
            this.publish('coordinator.message.received', data);
        }
        
        /**
         * 发送文本消息
         */
        async sendTextMessage(content) {
            if (!content?.trim()) {
                this.warn('尝试发送空消息');
                return false;
            }
            
            if (!this.state.currentConversationId) {
                this.warn('未选择对话，无法发送消息');
                this.showError('请先选择一个对话');
                return false;
            }
            
            if (this.managers.messages) {
                try {
                    return await this.managers.messages.sendTextMessage(content);
                } catch (error) {
                    this.error('发送消息失败', error);
                    this.showError('发送失败，请重试');
                    return false;
                }
            }
            
            this.warn('消息管理器不可用');
            return false;
        }
        
        /**
         * 上传文件
         */
        async uploadFile(file) {
            if (!this.managers.media) {
                this.warn('媒体处理器不可用');
                this.showError('文件上传功能暂时不可用');
                return null;
            }
            
            try {
                return await this.managers.media.uploadFile(file);
            } catch (error) {
                this.error('文件上传失败', error);
                this.showError('文件上传失败，请重试');
                return null;
            }
        }
        
        /**
         * 显示店铺列表
         */
        async showShops() {
            this.log('显示店铺列表');
            
            if (this.managers.shops) {
                try {
                    await this.managers.shops.loadAndShowShops();
                    this.updateNavigationUI('客服消息', false);
                    this.showView('shopsListView');
                } catch (error) {
                    this.error('显示店铺列表失败', error);
                    this.showError('加载店铺列表失败，请重试');
                }
            }
        }
        
        /**
         * 返回上一级
         */
        goBack() {
            if (this.state.currentConversationId) {
                // 从聊天返回对话列表
                this.state.currentConversationId = null;
                this.state.currentCustomer = null;
                this.showView('conversationsListView');
                this.updateNavigationUI('客户对话', true);
            } else if (this.state.currentShopId) {
                // 从对话列表返回店铺列表
                this.state.currentShopId = null;
                this.showShops();
            }
        }
        
        /**
         * 获取当前状态
         */
        getState() {
            return { ...this.state };
        }
        
        /**
         * 获取管理器
         */
        getManager(type) {
            return this.managers[type];
        }
        
        // ===================== UI辅助方法 =====================
        
        updateNavigationUI(title, showBackBtn = false) {
            // 委托给导航管理器
            if (window.MessageNavigation) {
                window.MessageNavigation.updateNavigationUI(title, showBackBtn);
            }
        }
        
        updateChatHeader(conversation, customer) {
            // 委托给聊天头部UI
            if (window.ChatHeaderUI) {
                window.ChatHeaderUI.updateForConversation(conversation, { customerName: customer.name });
            }
        }
        
        showView(viewId) {
            // 委托给视图管理器
            if (window.MessageNavigation) {
                window.MessageNavigation.showView(viewId);
            }
        }
        
        focusChatInput() {
            setTimeout(() => {
                const input = document.getElementById('chatInput');
                if (input) input.focus();
            }, 100);
        }
        
        showError(message) {
            if (window.Feedback) {
                window.Feedback.show(message, 'error');
            }
        }
        
        // ===================== 工具方法 =====================
        
        publish(event, data) {
            if (this.eventBus) {
                this.eventBus.publish(event, data);
            }
        }
        
        log(...args) {
            if (this.options.debug) {
                console.log(LOG_PREFIX, ...args);
            }
        }
        
        warn(...args) {
            console.warn(LOG_PREFIX, ...args);
        }
        
        error(...args) {
            console.error(LOG_PREFIX, ...args);
        }
    }
    
    // 暴露到全局
    window.MessageCoordinator = MessageCoordinator;
    
    // 提供工厂方法
    window.createMessageCoordinator = function(options) {
        return new MessageCoordinator(options);
    };
    
})();