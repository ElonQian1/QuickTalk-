/**
 * MessagesManager - 消息业务管理器
 * 职责：消息加载、消息发送、消息接收处理、消息历史管理
 * 依赖：AuthHelper, Notify, UIStates, MessageRenderer
 */
(function() {
    'use strict';

    class MessagesManager {
        constructor(options = {}) {
            this.messages = []; // 将被代理
            this.currentConversationId = null;
            this.currentCustomer = null;
            this.debug = options.debug || false;
            
            // 加载状态管理
            this._loadingMessagesFor = null;
            
            // 事件处理器
            this.onNewMessage = options.onNewMessage || ((message) => {});
            this.onMessageUpdated = options.onMessageUpdated || ((message) => {});
            this.onMessageDeleted = options.onMessageDeleted || ((messageId) => {});
        }

        /**
         * 统一鉴权头，优先 AuthHelper
         */
        _authHeaders(extra){
            try { if (window.AuthHelper && typeof window.AuthHelper.getHeaders === 'function') { return Object.assign({}, window.AuthHelper.getHeaders(), extra||{}); } } catch(_){ }
            const token = (window.getAuthToken ? window.getAuthToken() : '');
            const base = token ? { 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json' } : { 'Content-Type':'application/json' };
            return Object.assign({}, base, extra||{});
        }

        /**
         * 为指定对话加载消息
         */
        async loadMessages(conversationId, customer = null) {
            // 重入保护
            if (this._loadingMessagesFor === conversationId) {
                return this.messages;
            }

            try {
                this._loadingMessagesFor = conversationId;
                this.currentConversationId = conversationId;
                this.currentCustomer = customer;

                if (this.debug) {
                    console.log('[MessagesManager] 加载消息:', conversationId);
                }

                // 显示加载状态 (StatusView 优先)
                try {
                    const container = document.getElementById('chatMessages');
                    if (container && window.StatusView) {
                        StatusView.loading(container, '正在加载消息...');
                    } else {
                        this.showLoadingState(); // 回退
                    }
                } catch(_){ this.showLoadingState(); }

                const messages = await this.fetchMessages(conversationId);
                // 写入集中状态仓库
                if (window.MessageStateStore) {
                    try { MessageStateStore.setMessages(conversationId, messages); } catch(_){ }
                } else {
                    this.messages = messages; // 回退
                }
                // 清除状态视图
                try { const c = document.getElementById('chatMessages'); if (c && window.StatusView) StatusView.clear(c); } catch(_){ }
                
                return messages;
            } catch (error) {
                console.error('[MessagesManager] 加载消息失败:', error);
                // 错误态 (StatusView 优先)
                try {
                    const container = document.getElementById('chatMessages');
                    if (container && window.StatusView) {
                        StatusView.error(container, '加载消息失败', error.message || '请稍后重试', { label: '重试', onClick: ()=> this.loadMessages(conversationId, customer) });
                    } else {
                        this.showErrorState(error); // 回退
                    }
                } catch(_){ this.showErrorState(error); }
                throw error;
            } finally {
                if (this._loadingMessagesFor === conversationId) {
                    this._loadingMessagesFor = null;
                }
            }
        }

        /**
         * 获取消息数据
         */
        async fetchMessages(conversationId) {
            if (window.AuthHelper && window.AuthHelper.safeJson){
                const r = await window.AuthHelper.safeJson(`/api/conversations/${conversationId}/messages`);
                if (r.ok && Array.isArray(r.data)) return r.data;
                throw new Error(r.error || '获取消息数据失败');
            }
            const response = await fetch(`/api/conversations/${conversationId}/messages`, { headers: this._authHeaders() });
            const data = await response.json();
            if (data.success && data.data) return Array.isArray(data.data)? data.data: [];
            throw new Error(data.error || '获取消息数据失败');
        }

        /**
         * 显示加载状态
         */
        showLoadingState() { // 回退兼容
            const container = document.getElementById('chatMessages');
            if (!container) return;

            container.innerHTML = '';
            
            if (window.UIStates && window.UIStates.showLoading) {
                window.UIStates.showLoading(container, '正在加载消息...');
            } else if (window.LoadingStatesUI && 
                       typeof window.LoadingStatesUI.spinner === 'function') {
                container.appendChild(window.LoadingStatesUI.spinner('正在加载消息...'));
            }
        }

        /**
         * 显示错误状态
         */
        showErrorState(error) { // 回退兼容
            const container = document.getElementById('chatMessages');
            if (!container) return;

            container.innerHTML = '';
            // 统一 EmptyState.error 优先
            try {
                if (window.EmptyState && typeof window.EmptyState.error === 'function') {
                    window.EmptyState.error(container, '加载消息失败', error.message || '请稍后重试');
                    return;
                }
                if (window.UIStates && window.UIStates.showError) {
                    window.UIStates.showError(container, '加载消息失败', error.message || '请稍后重试'); return;
                }
                if (window.ErrorStatesUI && typeof window.ErrorStatesUI.errorBlock === 'function') {
                    container.appendChild(window.ErrorStatesUI.errorBlock('加载消息失败', error.message || '请稍后重试')); return;
                }
            } catch(_){}
            container.textContent = error.message || '加载消息失败';
        }

        /**
         * 渲染所有消息
         */
        renderMessages() {
            // 优先使用渲染器
            if (window.MessageRenderer && window.MessageRenderer.renderMessages) {
                return window.MessageRenderer.renderMessages();
            }

            // 降级实现
            const container = document.getElementById('chatMessages');
            if (!container) return;

            container.innerHTML = '';
            const list = (window.MessageStateStore && this.currentConversationId) ? (MessageStateStore.getMessages(this.currentConversationId) || []) : this.messages;
            if (!list || list.length === 0){
                try { if (window.StatusView) { StatusView.empty(container, 'messages'); return; } } catch(_){ }
                try { if (window.EmptyState && typeof window.EmptyState.messages === 'function') { window.EmptyState.messages(container); return; } } catch(_){ }
                container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3>暂无消息</h3><p>开始发送第一条消息吧</p></div>';
                return;
            }
            list.forEach(message => this.renderMessage(message));
            this.scrollToBottom();
        }

        /**
         * 渲染单条消息
         */
        renderMessage(message) {
            // 优先使用渲染器
            if (window.MessageRenderer && window.MessageRenderer.renderMessage) {
                return window.MessageRenderer.renderMessage(message);
            }

            // 降级实现
            const container = document.getElementById('chatMessages');
            if (!container) return;

            const messageEl = document.createElement('div');
            messageEl.className = 'chat-message';
            messageEl.setAttribute('data-message-id', message.id);
            messageEl.textContent = (message.content || '').slice(0, 200);
            
            container.appendChild(messageEl);
        }

        /**
         * 发送文本消息
         */
        async sendTextMessage(content) {
            // 新实现：统一委托 MessageSendChannel
            if (!content || !content.trim()) { window.Notify && window.Notify.warning('请输入消息内容'); return false; }
            if (!this.currentConversationId) { window.Notify && window.Notify.error('请先选择一个对话'); return false; }
            if (window.MessageSendChannelInstance && window.MessageSendChannelInstance.sendText) {
                const tempId = window.MessageSendChannelInstance.sendText(content.trim());
                return !!tempId;
            }
            // 回退：旧逻辑（保持最小兼容，不再主动维护）
            if (this.debug) console.warn('[MessagesManager] 统一发送通道未加载，使用降级发送路径');
            const ok = this._deprecatedDirectSend(content.trim());
            return ok;
        }

        /**
         * 发送文件消息
         */
        async sendFileMessage(fileInfo) {
            if (!fileInfo) { window.Notify && window.Notify.error('文件信息无效'); return false; }
            if (!this.currentConversationId) { window.Notify && window.Notify.error('请先选择一个对话'); return false; }
            if (window.MessageSendChannelInstance && window.MessageSendChannelInstance.sendFile) {
                try { const tempId = await window.MessageSendChannelInstance.sendFile(fileInfo._rawFile || fileInfo.file || fileInfo); return !!tempId; } catch(e){ window.Notify && window.Notify.error('文件发送失败'); return false; }
            }
            if (this.debug) console.warn('[MessagesManager] 统一发送通道未加载，文件走降级发送');
            return this._deprecatedDirectSend('', fileInfo);
        }

        /**
         * 发送WebSocket消息
         */
        sendWebSocketMessage(messageData) {
            // @deprecated: 已由 MessageSendChannel 统一；此方法仅用于降级路径
            if (window.MessageWSAdapter && window.messageModule && window.messageModule.wsAdapter) {
                try { return window.messageModule.wsAdapter.send(messageData); } catch(_){ }
            }
            if (window.messageModule && window.messageModule.websocket && window.messageModule.websocket.readyState === WebSocket.OPEN) {
                try { window.messageModule.websocket.send(JSON.stringify(messageData)); return true; } catch(_){ }
            }
            window.Notify && window.Notify.error('WebSocket连接不可用');
            return false;
        }

        /**
         * @deprecated 旧直接发送逻辑（无回流去重、无队列重试），仅在统一发送通道缺失时兜底
         */
        _deprecatedDirectSend(content, fileInfo){
            const payload = {
                type: 'message',
                conversation_id: this.currentConversationId,
                content: content || '',
                files: fileInfo ? [fileInfo] : [],
                sender_type: 'agent',
                timestamp: Date.now()
            };
            return this.sendWebSocketMessage(payload);
        }

        /**
         * 处理新消息事件（来自WebSocket）
         */
        handleNewMessage(messageData) {
            if (!messageData || !messageData.conversation_id) {
                if (this.debug) {
                    console.warn('[MessagesManager] 无效消息数据:', messageData);
                }
                return;
            }

            if (this.debug) {
                console.log('[MessagesManager] 处理新消息:', messageData);
            }

            // 只处理当前对话的消息渲染
            if (window.MessageStateStore && this.currentConversationId && String(messageData.conversation_id) === String(this.currentConversationId)) {
                // 状态仓库 append (去重交由上游或后续可增强)
                MessageStateStore.appendMessage(this.currentConversationId, messageData);
            } else if (!window.MessageStateStore) {
                if (this.currentConversationId && String(messageData.conversation_id) === String(this.currentConversationId)) {
                    if (!this.isDuplicateMessage(messageData)) {
                        this.messages.push(messageData);
                        this.renderMessage(messageData);
                        this.scrollToBottom();
                    }
                }
            }

            // 触发事件
            try {
                this.onNewMessage(messageData);
            } catch (error) {
                console.error('[MessagesManager] 新消息事件处理错误:', error);
            }
        }

        /**
         * 处理消息更新事件
         */
        handleMessageUpdated(messageData) {
            if (!messageData || !messageData.id) return;

            if (this.debug) {
                console.log('[MessagesManager] 处理消息更新:', messageData);
            }

            // 更新内存中的消息
            if (window.MessageStateStore && this.currentConversationId) {
                MessageStateStore.updateMessage(this.currentConversationId, messageData);
            } else {
                const index = this.messages.findIndex(m => m.id === messageData.id);
                if (index >= 0) {
                    this.messages[index] = { ...this.messages[index], ...messageData };
                    if (this.currentConversationId && String(messageData.conversation_id) === String(this.currentConversationId)) {
                        this.renderMessages();
                    }
                }
            }

            // 触发事件
            try {
                this.onMessageUpdated(messageData);
            } catch (error) {
                console.error('[MessagesManager] 消息更新事件处理错误:', error);
            }
        }

        /**
         * 处理消息删除事件
         */
        handleMessageDeleted(payload) {
            if (!payload || !payload.id) return;

            if (this.debug) {
                console.log('[MessagesManager] 处理消息删除:', payload);
            }

            const { id, conversation_id } = payload;
            
            // 从内存中移除
            if (window.MessageStateStore && this.currentConversationId) {
                MessageStateStore.removeMessage(this.currentConversationId, id);
            } else {
                const beforeCount = this.messages.length;
                this.messages = this.messages.filter(m => m.id !== id);
                if (this.currentConversationId && String(conversation_id) === String(this.currentConversationId) && this.messages.length !== beforeCount) {
                    this.renderMessages();
                }
            }

            // 触发事件
            try {
                this.onMessageDeleted(id);
            } catch (error) {
                console.error('[MessagesManager] 消息删除事件处理错误:', error);
            }
        }

        /**
         * 检查是否为重复消息
         */
        isDuplicateMessage(messageData) {
            return this.messages.some(m => {
                // 优先按ID比较
                if (messageData.id && m.id) {
                    return String(m.id) === String(messageData.id);
                }
                
                // 降级：按内容和时间戳比较
                const sameSender = m.sender_type === messageData.sender_type;
                const sameContent = (m.content || '').trim() === (messageData.content || '').trim();
                const t1 = m.timestamp || m.sent_at || m.created_at;
                const t2 = messageData.timestamp || messageData.sent_at || messageData.created_at;
                const sameTime = t1 && t2 && String(t1) === String(t2);
                
                return sameSender && sameContent && sameTime;
            });
        }

        /**
         * 滚动到底部
         */
        scrollToBottom() {
            const container = document.getElementById('chatMessages');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }

        /**
         * 分页加载更多消息
         */
        async loadMoreMessages(page = 1) {
            try {
                if (window.MessagesPagination && 
                    typeof window.MessagesPagination.loadMore === 'function') {
                    await window.MessagesPagination.loadMore();
                }
            } catch (error) {
                console.warn('[MessagesManager] 分页加载失败:', error);
            }
        }

        /**
         * 获取当前对话ID
         */
        getCurrentConversationId() {
            return this.currentConversationId;
        }

        /**
         * 获取当前客户信息
         */
        getCurrentCustomer() {
            return this.currentCustomer;
        }

        /**
         * 获取消息列表
         */
        getMessages() {
            if (window.MessageStateStore && this.currentConversationId) return MessageStateStore.getMessages(this.currentConversationId).slice();
            return [...this.messages];
        }

        /**
         * 重置状态
         */
        reset() {
            if (window.MessageStateStore) {
                // 清空当前对话消息仅在切换时由上层 setMessages 决定，这里不强行改 store
            } else {
                this.messages = [];
            }
            this.currentConversationId = null;
            this.currentCustomer = null;
            this._loadingMessagesFor = null;
        }

        /**
         * 销毁管理器
         */
        destroy() {
            this.reset();
            this.onNewMessage = null;
            this.onMessageUpdated = null;
            this.onMessageDeleted = null;
        }
    }

    // 暴露到全局
    window.MessagesManager = MessagesManager;

    // 属性代理：若 StateStore 存在，将 messages getter 指向 Store
    try {
        if (window.MessageStateStore && !Object.getOwnPropertyDescriptor(MessagesManager.prototype, 'messages')?.get) {
            Object.defineProperty(MessagesManager.prototype, 'messages', {
                configurable: true,
                get(){
                    if (window.MessageStateStore && this.currentConversationId) return MessageStateStore.getMessages(this.currentConversationId);
                    return this._fallbackMessages || [];
                },
                set(v){ this._fallbackMessages = Array.isArray(v)? v: []; }
            });
        }
    } catch(_){ }
    
    console.log('✅ 消息管理器已加载 (messages-manager.js)');
})();