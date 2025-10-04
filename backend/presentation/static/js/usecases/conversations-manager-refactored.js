/**
 * ConversationsManagerRefactored - 对话管理器重构版
 * 职责：专门处理对话相关的业务逻辑，包括加载、选择、预览更新等
 * 独立模块，可重用于不同页面
 */
(function() {
    'use strict';

    class ConversationsManagerRefactored {
        constructor(options = {}) {
            this.options = {
                onConversationSelected: options.onConversationSelected || (() => {}),
                onConversationsLoaded: options.onConversationsLoaded || (() => {}),
                debug: options.debug || false,
                ...options
            };
            
            this.conversations = [];
            this.currentConversationId = null;
            this.currentShopId = null;
            this.loading = false;
            this.error = null;
        }

        /**
         * 初始化对话管理器
         */
        async init() {
            if (this.options.debug) {
                console.log('[ConversationsManagerRefactored] 初始化对话管理器');
            }
        }

        /**
         * 为指定店铺加载对话列表
         */
        async loadConversationsForShop(shopId) {
            if (this.loading && this.currentShopId === shopId) {
                return this.conversations;
            }
            
            this.loading = true;
            this.error = null;
            this.currentShopId = shopId;
            
            try {
                if (this.options.debug) {
                    console.log('[ConversationsManagerRefactored] 加载店铺对话:', shopId);
                }

                const response = await fetch(`/api/conversations?shop_id=${shopId}`, {
                    headers: this.getAuthHeaders()
                });
                
                const data = await response.json();
                
                if (data.success && Array.isArray(data.data)) {
                    this.conversations = data.data;
                    this.options.onConversationsLoaded(this.conversations);
                    
                    if (this.options.debug) {
                        console.log('[ConversationsManagerRefactored] 对话加载成功:', this.conversations.length);
                    }
                } else {
                    this.error = data.error || '获取对话列表失败';
                    console.error('[ConversationsManagerRefactored] 获取对话失败:', this.error);
                    this.conversations = [];
                }
            } catch (error) {
                this.error = '网络错误';
                console.error('[ConversationsManagerRefactored] 网络错误:', error);
                this.conversations = [];
            } finally {
                this.loading = false;
            }
            
            return this.conversations;
        }

        /**
         * 选择对话
         */
        async selectConversation(conversation) {
            if (!conversation || !conversation.id) {
                console.warn('[ConversationsManagerRefactored] 无效的对话对象');
                return;
            }
            
            this.currentConversationId = conversation.id;
            
            try {
                // 获取或生成客户信息
                const customer = this.getCustomerInfo(conversation);
                
                if (this.options.debug) {
                    console.log('[ConversationsManagerRefactored] 对话选择:', conversation.id, customer);
                }
                
                // 触发回调
                this.options.onConversationSelected(conversation, customer);
                
                return { conversation, customer };
            } catch (error) {
                console.error('[ConversationsManagerRefactored] 选择对话失败:', error);
                throw error;
            }
        }

        /**
         * 获取客户信息
         */
        getCustomerInfo(conversation) {
            return {
                id: conversation.customer_id,
                name: conversation.customer_name || this.generateCustomerNumber(conversation.customer_id),
                avatar: conversation.customer_avatar || null,
                lastSeen: conversation.last_message_time || null
            };
        }

        /**
         * 生成客户编号
         */
        generateCustomerNumber(customerId) {
            // 优先使用模块化系统
            if (window.CustomerNumbering && window.CustomerNumbering.generateCustomerNumber) {
                return window.CustomerNumbering.generateCustomerNumber(customerId);
            }
            
            // 降级处理：使用全局函数
            if (window.generateCustomerNumber && typeof window.generateCustomerNumber === 'function') {
                return window.generateCustomerNumber(customerId);
            }
            
            // 最终降级：简单格式化
            console.warn('[ConversationsManagerRefactored] 客户编号模块未加载，使用降级处理');
            return `客户${customerId.replace('customer_', '').substring(0, 8)}`;
        }

        /**
         * 渲染对话列表
         */
        async renderConversationsList() {
            // 确保片段已加载
            try {
                if (window.PartialsLoader && typeof window.PartialsLoader.loadPartials === 'function') {
                    await window.PartialsLoader.loadPartials();
                }
            } catch(e) {
                console.warn('[ConversationsManagerRefactored] 片段加载器不可用');
            }

            let container = document.getElementById('conversationsListView');
            if (!container) {
                // 延迟重试
                await new Promise(r => setTimeout(r, 100));
                container = document.getElementById('conversationsListView');
            }
            
            if (!container) {
                console.warn('[ConversationsManagerRefactored] conversationsListView 容器未找到');
                return;
            }

            container.innerHTML = '';

            if (this.loading) {
                container.innerHTML = this.renderLoadingState();
                return;
            }

            if (this.error) {
                container.innerHTML = this.renderErrorState();
                return;
            }

            if (this.conversations.length === 0) {
                container.innerHTML = this.renderEmptyState();
                return;
            }

            const conversationsList = document.createElement('div');
            conversationsList.className = 'conversations-list';

            // 创建对话项
            this.conversations.forEach(conversation => {
                const conversationItem = this.createConversationItem(conversation);
                conversationsList.appendChild(conversationItem);
            });

            container.appendChild(conversationsList);
        }

        /**
         * 创建单个对话项
         */
        createConversationItem(conversation) {
            const customer = this.getCustomerInfo(conversation);
            const hasUnread = (conversation.unread_count || 0) > 0;
            
            const onClick = () => {
                this.selectConversation(conversation);
            };

            // 优先使用组件化对话项
            if (window.ConversationItemUI && typeof window.ConversationItemUI.build === 'function') {
                return window.ConversationItemUI.build(conversation, customer, { onClick });
            }

            // 降级：简单实现
            const item = document.createElement('div');
            item.className = `conversation-item ${hasUnread ? 'unread' : ''}`;
            item.setAttribute('data-conversation-id', conversation.id);
            
            const lastMessage = conversation.last_message_content || '暂无消息';
            const lastTime = this.formatTime(conversation.last_message_time);
            
            item.innerHTML = `
                <div class="conversation-avatar">
                    <div class="avatar-circle">${customer.name.charAt(0)}</div>
                    ${hasUnread ? '<div class="unread-dot"></div>' : ''}
                </div>
                <div class="conversation-content">
                    <div class="conversation-header">
                        <div class="customer-name">${customer.name}</div>
                        <div class="conversation-time">${lastTime}</div>
                    </div>
                    <div class="conversation-preview">
                        <div class="last-message">${lastMessage}</div>
                        ${hasUnread ? `<div class="unread-count">${conversation.unread_count}</div>` : ''}
                    </div>
                </div>
            `;
            
            item.addEventListener('click', onClick);
            
            return item;
        }

        /**
         * 更新对话预览
         */
        updateConversationPreview(messageData) {
            if (!messageData || !messageData.conversation_id) return;
            
            // 查找对应的对话
            const conversation = this.conversations.find(c => 
                String(c.id) === String(messageData.conversation_id)
            );
            
            if (conversation) {
                // 更新对话信息
                conversation.last_message_content = messageData.content || '新消息';
                conversation.last_message_time = messageData.timestamp || messageData.sent_at || Date.now();
                
                // 如果是客户消息，增加未读计数
                if (messageData.sender_type === 'customer') {
                    conversation.unread_count = (conversation.unread_count || 0) + 1;
                }
                
                // 重新渲染对话列表
                this.renderConversationsList();
                
                if (this.options.debug) {
                    console.log('[ConversationsManagerRefactored] 对话预览已更新:', conversation.id);
                }
            }
        }

        /**
         * 标记对话为已读
         */
        markConversationAsRead(conversationId) {
            const conversation = this.conversations.find(c => 
                String(c.id) === String(conversationId)
            );
            
            if (conversation && conversation.unread_count > 0) {
                conversation.unread_count = 0;
                this.renderConversationsList();
            }
        }

        /**
         * 格式化时间
         */
        formatTime(timestamp) {
            return window.formatRelativeTime(timestamp);
        }

        /**
         * 渲染加载状态
         */
        renderLoadingState() {
            if (window.LoadingStatesUI && typeof window.LoadingStatesUI.spinner === 'function') {
                return window.LoadingStatesUI.spinner('正在加载对话...').outerHTML;
            }
            return '<div class="loading-state">正在加载对话...</div>';
        }

        /**
         * 渲染错误状态
         */
        renderErrorState() {
            if (window.ErrorStatesUI && typeof window.ErrorStatesUI.error === 'function') {
                return window.ErrorStatesUI.error('加载失败', this.error).outerHTML;
            }
            return `<div class="error-state">加载失败: ${this.error}</div>`;
        }

        /**
         * 渲染空状态
         */
        renderEmptyState() {
            return `
                <div class="empty-state">
                    <div class="empty-icon">💬</div>
                    <h3>暂无客户对话</h3>
                    <p>当有客户发起对话时，将会在这里显示</p>
                </div>
            `;
        }

        /**
         * 获取认证头部
         */
        getAuthHeaders() {
            return window.getAuthHeaders();
        }

        /**
         * 获取认证token
         */
        getAuthToken() {
            return window.getAuthToken();
        }

        /**
         * 刷新对话数据
         */
        async refresh() {
            if (this.currentShopId) {
                await this.loadConversationsForShop(this.currentShopId);
                await this.renderConversationsList();
            }
        }

        /**
         * 销毁管理器
         */
        destroy() {
            this.conversations = [];
            this.currentConversationId = null;
            this.currentShopId = null;
            this.loading = false;
            this.error = null;
        }
    }

    // 暴露到全局
    window.ConversationsManagerRefactored = ConversationsManagerRefactored;

    console.log('✅ 对话管理器重构版已加载 (conversations-manager-refactored.js)');

})();