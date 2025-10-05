/**
 * ConversationsManager - 对话业务管理器
 * 职责：对话列表加载、对话选择、对话预览更新、对话过滤
 * 依赖：AuthHelper, Notify, UIStates
 */
(function() {
    'use strict';

    class ConversationsManager {
        constructor(options = {}) {
            this.conversations = [];
            this.currentShopId = null;
            this.currentConversation = null;
            this.onConversationSelected = options.onConversationSelected || ((conversation) => {});
            this.debug = options.debug || false;
            
            // 加载状态管理
            this._loading = false;
            this._loadingShopId = null;
        }

        /**
         * 内部统一获取鉴权请求头，优先 AuthHelper，避免重复 token 逻辑
         */
        _authHeaders(extra){
            try {
                if (window.AuthHelper && typeof window.AuthHelper.getHeaders === 'function') {
                    return Object.assign({}, window.AuthHelper.getHeaders(), extra||{});
                }
            } catch(_){ }
            const token = (window.getAuthToken ? window.getAuthToken() : '');
            const base = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json' } : { 'Content-Type':'application/json' };
            return Object.assign({}, base, extra||{});
        }

        /**
         * 为指定店铺加载对话列表
         */
        async loadConversationsForShop(shopId) {
            // 防止重复加载
            if (this._loading && this._loadingShopId === shopId) {
                return this.conversations;
            }

            try {
                this._loading = true;
                this._loadingShopId = shopId;
                this.currentShopId = shopId;

                if (this.debug) {
                    console.log('[ConversationsManager] 加载店铺对话:', shopId);
                }

                // 显示加载状态 (StatusView 优先)
                try {
                    const container = document.getElementById('conversationsListView');
                    if (container && window.StatusView) {
                        StatusView.loading(container, '正在加载对话...');
                    } else {
                        this.showLoadingSkeleton(); // 回退
                    }
                } catch(_){ this.showLoadingSkeleton(); }

                const conversations = await this.fetchConversations(shopId);
                this.conversations = conversations;

                // 渲染列表前清除状态视图
                try { const c = document.getElementById('conversationsListView'); if (c && window.StatusView) StatusView.clear(c); } catch(_){ }
                await this.renderConversationsList();
                
                return conversations;
            } catch (error) {
                console.error('[ConversationsManager] 加载对话失败:', error);
                this.conversations = [];
                // 错误状态提示 (StatusView 优先)
                try {
                    const container = document.getElementById('conversationsListView');
                    if (container && window.StatusView) {
                        StatusView.error(container, '加载对话失败', error.message || '请稍后重试', { label: '重试', onClick: ()=> this.loadConversationsForShop(shopId) });
                    } else {
                        await this.renderConversationsList();
                    }
                } catch(_){ await this.renderConversationsList(); }
                if (window.Notify) { window.Notify.error('加载对话列表失败', error.message); }
                
                throw error;
            } finally {
                this._loading = false;
                this._loadingShopId = null;
            }
        }

        /**
         * 获取对话数据
         */
        async fetchConversations(shopId) {
            if (window.AuthHelper && window.AuthHelper.safeJson){
                const r = await window.AuthHelper.safeJson(`/api/conversations?shop_id=${shopId}`);
                if (r.ok && Array.isArray(r.data)) return r.data;
                throw new Error(r.error || '获取对话数据失败');
            }
            const response = await fetch(`/api/conversations?shop_id=${shopId}`, { headers: this._authHeaders() });
            const data = await response.json();
            if (data.success && data.data) return Array.isArray(data.data)? data.data: [];
            throw new Error(data.error || '获取对话数据失败');
        }

        /**
         * 显示加载骨架屏
         */
        showLoadingSkeleton() { // 保留回退兼容
            try {
                const container = document.getElementById('conversationsListView');
                if (container && window.SkeletonListUI && 
                    typeof window.SkeletonListUI.buildConversationsSkeleton === 'function') {
                    container.innerHTML = '';
                    container.appendChild(window.SkeletonListUI.buildConversationsSkeleton(6));
                }
            } catch(e) {
                // 忽略骨架屏错误
            }
        }

        /**
         * 渲染对话列表
         */
        async renderConversationsList() {
            const container = document.getElementById('conversationsListView');
            if (!container) {
                console.warn('[ConversationsManager] conversationsListView 容器不存在');
                return;
            }

            container.innerHTML = '';

            if (this.conversations.length === 0) {
                // StatusView 空态优先
                try { if (window.StatusView) { StatusView.empty(container, 'conversations'); return; } } catch(_){ }
                this.renderEmptyState(container); // 回退
                return;
            }

            const list = document.createElement('div');
            list.className = 'conversation-list';

            for (const conversation of this.conversations) {
                const item = this.createConversationItem(conversation);
                list.appendChild(item);
            }

            container.appendChild(list);

            // 更新会话统计头部
            this.updateConversationsHeader();
        }

        /**
         * 渲染空状态
         */
        renderEmptyState(container) {
            // 统一 EmptyState 优先
            try {
                if (window.EmptyState && typeof window.EmptyState.conversations === 'function') {
                    window.EmptyState.conversations(container); return;
                }
                if (window.EmptyStatesUI && typeof window.EmptyStatesUI.conversations === 'function') {
                    container.appendChild(window.EmptyStatesUI.conversations());
                    return;
                }
                const template = document.getElementById('emptyConversationsTemplate');
                if (template && template.content) {
                    const node = template.content.firstElementChild.cloneNode(true);
                    container.appendChild(node); return;
                }
            } catch(_){}
            // 最终降级
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><h3>暂无对话</h3><p>等待客户发起对话</p></div>';
        }

        /**
         * 创建对话列表项
         */
        createConversationItem(conversation) {
            // 优先使用UI组件
            if (window.ConversationItemUI && typeof window.ConversationItemUI.create === 'function') {
                return window.ConversationItemUI.create(conversation, {
                    onClick: (conv) => this.selectConversation(conv)
                });
            }

            // 降级：手动创建
            return this.createFallbackConversationItem(conversation);
        }

        /**
         * 创建降级对话列表项
         */
        createFallbackConversationItem(conversation) {
            const item = document.createElement('div');
            item.className = 'conversation-item';
            item.setAttribute('data-conversation-id', conversation.id);
            item.setAttribute('data-shop-id', conversation.shop_id || this.currentShopId);

            const lastMessageTime = conversation.last_message_time 
                ? new Date(conversation.last_message_time).toLocaleString() 
                : '暂无消息';
            
            const customerDisplayName = conversation.customer_name || 
                this.generateCustomerNumber(conversation.customer_id);
            
            const avatarInitial = customerDisplayName.trim().charAt(0).toUpperCase() || 'C';

            item.innerHTML = `
                <div class="conversation-avatar">${avatarInitial}</div>
                <div class="conversation-content">
                    <div class="conversation-header">
                        <span class="customer-name">${customerDisplayName}</span>
                        <span class="message-time" data-conversation-id="${conversation.id}">${lastMessageTime}</span>
                    </div>
                    <div class="last-message" data-conversation-id="${conversation.id}">
                        ${conversation.last_message || '等待客户消息...'}
                    </div>
                </div>
                ${conversation.unread_count > 0 ? 
                    `<div class="unread-badge" data-conversation-id="${conversation.id}">${conversation.unread_count}</div>` : 
                    ''}
            `;

            // DOM增强
            this.enhanceConversationItem(item, conversation);
            
            item.addEventListener('click', () => this.selectConversation(conversation));
            return item;
        }

        /**
         * 增强对话列表项DOM
         */
        enhanceConversationItem(item, conversation) {
            // 使用DOM增强器
            if (window.DOMEnhancer) {
                try {
                    window.DOMEnhancer.enhanceConversationItem(item, conversation);
                } catch(e) {
                    // 忽略增强错误
                }
            }

            // 异步更新显示
            setTimeout(() => {
                if (window.DataSyncManager) {
                    window.DataSyncManager.updateConversationDOM(conversation.id, conversation);
                }
                
                if (window.DisplayFixer) {
                    const lastMsgEl = item.querySelector('.last-message');
                    const timeEl = item.querySelector('.message-time');
                    
                    if (lastMsgEl) {
                        window.DisplayFixer.fixSingleLastMessage(lastMsgEl, conversation.id);
                    }
                    if (timeEl) {
                        window.DisplayFixer.fixSingleMessageTime(timeEl, conversation.id);
                    }
                }
            }, 100);
        }

        /**
         * 生成客户编号
         */
        generateCustomerNumber(customerId) {
            try {
                if (window.CustomerNumbering && window.CustomerNumbering.generateCustomerNumber) {
                    return window.CustomerNumbering.generateCustomerNumber(customerId);
                }
            } catch(_){ }
            return '客户' + customerId.replace('customer_','').substring(0,8);
        }

        /**
         * 选择对话
         */
        async selectConversation(conversation) {
            if (this.debug) {
                console.log('[ConversationsManager] 选择对话:', conversation.id);
            }

            this.currentConversation = conversation;

            // 准备客户信息
            const customer = {
                id: conversation.customer_id,
                name: conversation.customer_name || this.generateCustomerNumber(conversation.customer_id)
            };

            try {
                await this.onConversationSelected(conversation, customer);
            } catch (error) {
                console.error('[ConversationsManager] 对话选择回调错误:', error);
            }
        }

        /**
         * 更新对话预览信息
         */
        updateConversationPreview(messageData) {
            if (!messageData || !messageData.conversation_id) return;

            // 更新内存中的对话数据
            const conversation = this.conversations.find(c => 
                String(c.id) === String(messageData.conversation_id));
            
            if (conversation) {
                conversation.last_message = messageData.content || '';
                conversation.last_message_time = messageData.sent_at || 
                    messageData.created_at || new Date().toISOString();
            }

            // 更新DOM中的预览
            this.updateConversationPreviewDOM(messageData);

            // 如果当前在对话列表视图，重新排序
            if (this.isConversationListVisible()) {
                this.reorderConversations();
            }
        }

        /**
         * 更新DOM中的对话预览
         */
        updateConversationPreviewDOM(messageData) {
            const conversationId = messageData.conversation_id;
            
            // 更新最后消息内容
            const lastMsgEl = document.querySelector(
                `.last-message[data-conversation-id="${conversationId}"]`);
            if (lastMsgEl) {
                lastMsgEl.textContent = messageData.content || '';
            }

            // 更新时间
            const timeEl = document.querySelector(
                `.message-time[data-conversation-id="${conversationId}"]`);
            if (timeEl) {
                const time = messageData.sent_at || messageData.created_at;
                if (time) {
                    timeEl.textContent = new Date(time).toLocaleString();
                }
            }
        }

        /**
         * 检查是否在对话列表视图
         */
        isConversationListVisible() {
            const view = document.getElementById('conversationsListView');
            return view && view.style.display !== 'none';
        }

        /**
         * 重新排序对话（最新消息在前）
         */
        reorderConversations() {
            this.conversations.sort((a, b) => {
                const timeA = new Date(a.last_message_time || 0).getTime();
                const timeB = new Date(b.last_message_time || 0).getTime();
                return timeB - timeA;
            });

            // 重新渲染
            this.renderConversationsList();
        }

        /**
         * 更新会话统计头部
         */
        updateConversationsHeader() {
            try {
                if (window.ConversationsHeader && 
                    typeof window.ConversationsHeader.refresh === 'function') {
                    window.ConversationsHeader.refresh();
                }
            } catch(e) {
                // 忽略头部更新错误
            }
        }

        /**
         * 获取当前对话
         */
        getCurrentConversation() {
            return this.currentConversation;
        }

        /**
         * 获取当前店铺ID
         */
        getCurrentShopId() {
            return this.currentShopId;
        }

        /**
         * 获取对话列表
         */
        getConversations() {
            return [...this.conversations];
        }

        /**
         * 重置状态
         */
        reset() {
            this.conversations = [];
            this.currentShopId = null;
            this.currentConversation = null;
            this._loading = false;
            this._loadingShopId = null;
        }

        /**
         * 销毁管理器
         */
        destroy() {
            this.reset();
            this.onConversationSelected = null;
        }
    }

    // 暴露到全局
    window.ConversationsManager = ConversationsManager;
    
    console.log('✅ 对话管理器已加载 (conversations-manager.js)');
})();