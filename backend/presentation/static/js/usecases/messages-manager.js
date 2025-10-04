/**
 * MessagesManager - 消息业务管理器
 * 职责：消息加载、消息发送、消息接收处理、消息历史管理
 * 依赖：AuthHelper, Notify, UIStates, MessageRenderer
 */
(function() {
    'use strict';

    class MessagesManager {
        constructor(options = {}) {
            this.messages = [];
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

                // 显示加载状态
                this.showLoadingState();

                const messages = await this.fetchMessages(conversationId);
                this.messages = messages;
                
                this.renderMessages();
                this.scrollToBottom();
                
                return messages;
            } catch (error) {
                console.error('[MessagesManager] 加载消息失败:', error);
                this.showErrorState(error);
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
            const response = await fetch(`/api/conversations/${conversationId}/messages`, {
                headers: window.AuthHelper ? window.AuthHelper.getHeaders() : {
                    'Authorization': `Bearer ${window.getAuthToken ? window.getAuthToken() : ''}`
                }
            });

            const data = await response.json();
            if (data.success && data.data) {
                return Array.isArray(data.data) ? data.data : [];
            }

            throw new Error(data.error || '获取消息数据失败');
        }

        /**
         * 显示加载状态
         */
        showLoadingState() {
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
        showErrorState(error) {
            const container = document.getElementById('chatMessages');
            if (!container) return;

            container.innerHTML = '';
            
            if (window.UIStates && window.UIStates.showError) {
                window.UIStates.showError(container, '加载消息失败', error.message || '请稍后重试');
            } else if (window.ErrorStatesUI && 
                       typeof window.ErrorStatesUI.errorBlock === 'function') {
                container.appendChild(window.ErrorStatesUI.errorBlock(
                    '加载消息失败', error.message || '请稍后重试'));
            } else {
                container.textContent = error.message || '加载消息失败';
            }
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
            this.messages.forEach(message => this.renderMessage(message));
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
            if (!content || !content.trim()) {
                if (window.Notify) {
                    window.Notify.warning('请输入消息内容');
                }
                return false;
            }

            if (!this.currentConversationId) {
                if (window.Notify) {
                    window.Notify.error('请先选择一个对话');
                }
                return false;
            }

            const messageData = {
                type: 'message',
                conversation_id: this.currentConversationId,
                content: content.trim(),
                files: [],
                sender_type: 'agent',
                timestamp: Date.now()
            };

            if (this.debug) {
                console.log('[MessagesManager] 发送文本消息:', messageData);
            }

            return this.sendWebSocketMessage(messageData);
        }

        /**
         * 发送文件消息
         */
        async sendFileMessage(fileInfo) {
            if (!fileInfo || !fileInfo.url) {
                if (window.Notify) {
                    window.Notify.error('文件信息无效');
                }
                return false;
            }

            if (!this.currentConversationId) {
                if (window.Notify) {
                    window.Notify.error('请先选择一个对话');
                }
                return false;
            }

            const messageData = {
                type: 'message',
                conversation_id: this.currentConversationId,
                content: '',
                files: [fileInfo],
                sender_type: 'agent',
                timestamp: Date.now()
            };

            if (this.debug) {
                console.log('[MessagesManager] 发送文件消息:', messageData);
            }

            return this.sendWebSocketMessage(messageData);
        }

        /**
         * 发送WebSocket消息
         */
        sendWebSocketMessage(messageData) {
            // 优先使用WebSocket适配器
            if (window.MessageWSAdapter && window.messageModule && window.messageModule.wsAdapter) {
                return window.messageModule.wsAdapter.send(messageData);
            }

            // 降级：直接使用WebSocket
            if (window.messageModule && window.messageModule.websocket && 
                window.messageModule.websocket.readyState === WebSocket.OPEN) {
                window.messageModule.websocket.send(JSON.stringify(messageData));
                return true;
            }

            if (window.Notify) {
                window.Notify.error('WebSocket连接不可用');
            }
            return false;
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
            if (this.currentConversationId && 
                String(messageData.conversation_id) === String(this.currentConversationId)) {
                
                // 去重检查
                if (!this.isDuplicateMessage(messageData)) {
                    this.messages.push(messageData);
                    this.renderMessage(messageData);
                    this.scrollToBottom();
                } else if (this.debug) {
                    console.log('[MessagesManager] 跳过重复消息');
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
            const index = this.messages.findIndex(m => m.id === messageData.id);
            if (index >= 0) {
                this.messages[index] = { ...this.messages[index], ...messageData };
                
                // 如果是当前对话，重新渲染
                if (this.currentConversationId && 
                    String(messageData.conversation_id) === String(this.currentConversationId)) {
                    this.renderMessages();
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
            const beforeCount = this.messages.length;
            this.messages = this.messages.filter(m => m.id !== id);
            
            // 如果是当前对话且确实删除了消息，重新渲染
            if (this.currentConversationId && 
                String(conversation_id) === String(this.currentConversationId) &&
                this.messages.length !== beforeCount) {
                this.renderMessages();
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
            return [...this.messages];
        }

        /**
         * 重置状态
         */
        reset() {
            this.messages = [];
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
    
    console.log('✅ 消息管理器已加载 (messages-manager.js)');
})();