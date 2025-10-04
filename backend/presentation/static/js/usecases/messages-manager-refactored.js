/**
 * MessagesManagerRefactored - 消息管理器重构版
 * 职责：专门处理消息相关的业务逻辑，包括加载、发送、渲染等
 * 独立模块，可重用于不同页面
 */
(function() {
    'use strict';

    class MessagesManagerRefactored {
        constructor(options = {}) {
            this.options = {
                onNewMessage: options.onNewMessage || (() => {}),
                onMessageUpdated: options.onMessageUpdated || (() => {}),
                onMessageDeleted: options.onMessageDeleted || (() => {}),
                debug: options.debug || false,
                // 依赖注入：WS 发送函数（便于测试 / 去除对全局 messageModule 的硬编码）
                wsSend: options.wsSend || null,
                ...options
            };
            
            this.messages = [];
            this.currentConversationId = null;
            this.currentCustomer = null;
            this.loading = false;
            this.error = null;
            this._loadingMessagesFor = null;
        }

        /**
         * 初始化消息管理器
         */
        async init() {
            if (this.options.debug) {
                console.log('[MessagesManagerRefactored] 初始化消息管理器');
            }
        }

        /**
         * 加载指定对话的消息
         */
        async loadMessages(conversationId, customer = null) {
            if (this.loading && this._loadingMessagesFor === conversationId) {
                return this.messages;
            }
            
            this.loading = true;
            this.error = null;
            this.currentConversationId = conversationId;
            this.currentCustomer = customer;
            this._loadingMessagesFor = conversationId;
            
            // 清空容器并显示加载状态
            const container = document.getElementById('chatMessages');
            if (container) {
                container.innerHTML = '';
                if (window.LoadingStatesUI && typeof window.LoadingStatesUI.spinner === 'function') {
                    container.appendChild(window.LoadingStatesUI.spinner('正在加载消息...'));
                } else {
                    container.innerHTML = '<div class="loading-state">正在加载消息...</div>';
                }
            }
            
            try {
                if (this.options.debug) {
                    console.log('[MessagesManagerRefactored] 加载消息:', conversationId);
                }

                const response = await fetch(`/api/conversations/${conversationId}/messages`, {
                    headers: this.getAuthHeaders()
                });
                
                const data = await response.json();
                
                if (data.success && Array.isArray(data.data)) {
                    this.messages = data.data;
                    this.renderMessages();
                    this.scrollToBottom();
                    
                    if (this.options.debug) {
                        console.log('[MessagesManagerRefactored] 消息加载成功:', this.messages.length);
                    }
                } else {
                    this.error = data.error || '获取消息失败';
                    console.error('[MessagesManagerRefactored] 获取消息失败:', this.error);
                    this.messages = [];
                    
                    if (container) {
                        container.innerHTML = this.renderErrorState();
                    }
                }
            } catch (error) {
                this.error = '网络错误';
                console.error('[MessagesManagerRefactored] 网络错误:', error);
                this.messages = [];
                
                if (container) {
                    container.innerHTML = this.renderErrorState();
                }
            } finally {
                this.loading = false;
                this._loadingMessagesFor = null;
            }
            
            return this.messages;
        }

        /**
         * 发送文本消息
         */
        async sendTextMessage(content) {
            if (!content || !content.trim()) { console.warn('[MessagesManagerRefactored] 空消息'); return false; }
            if (!this.currentConversationId) { console.warn('[MessagesManagerRefactored] 无当前对话'); return false; }
            if (window.MessageSendChannelInstance && window.MessageSendChannelInstance.sendText) {
                try { return !!window.MessageSendChannelInstance.sendText(content.trim()); } catch(e){ console.warn('[MessagesManagerRefactored] sendChannel 发送失败', e); return false; }
            }
            console.warn('[MessagesManagerRefactored] sendChannel 未加载，降级不再支持旧独立路径');
            return false;
        }

        /**
         * 通过WebSocket发送消息
         */
        sendViaWebSocket(){ console.warn('[MessagesManagerRefactored] sendViaWebSocket 已废弃，统一由 MessageSendChannel 处理'); return false; }

        /**
         * 通过API发送消息
         */
        async sendViaAPI(){ console.warn('[MessagesManagerRefactored] sendViaAPI 已废弃，统一由 MessageSendChannel 处理'); return false; }

        /**
         * 处理新消息事件
         */
        handleNewMessage(messageData) {
            if (!messageData) {
                console.error('[MessagesManagerRefactored] 新消息数据为空');
                return;
            }

            // 若统一发送通道已存在并且消息包含 temp_id 或已通过回流覆盖，对应本地 pending 已在通道 finalize 中处理，这里尝试跳过重复合并
            if (window.MessageSendChannelInstance && messageData.temp_id) {
                const already = this.messages.find(m => m.temp_id && m.temp_id === messageData.temp_id && m.status === 'sent');
                if (already) {
                    if (this.options.debug) console.log('[MessagesManagerRefactored] 跳过重复回流合并 (sendChannel 已处理)', messageData.temp_id);
                    this.options.onNewMessage(messageData); // 仍触发外部回调（如未读统计）
                    return;
                }
            }
            
            // 检查是否属于当前对话
            if (this.currentConversationId && 
                String(messageData.conversation_id) === String(this.currentConversationId)) {
                
                // 检查是否已存在（防重复）
                const exists = this.messages.some(m => {
                    if (messageData.id && m.id) return String(m.id) === String(messageData.id);
                    
                    // 基于内容和时间戳判断
                    const sameSender = m.sender_type === messageData.sender_type;
                    const sameContent = (m.content || '').trim() === (messageData.content || '').trim();
                    const t1 = m.timestamp || m.sent_at || m.created_at;
                    const t2 = messageData.timestamp || messageData.sent_at || messageData.created_at;
                    const sameTime = t1 && t2 && String(t1) === String(t2);
                    
                    return sameSender && sameContent && sameTime;
                });
                
                if (!exists) {
                    // 回流合并：若存在 temp pending 匹配（通过 sender_type + content + timestamp +- 3s）则替换
                    const optimisticIndex = this.messages.findIndex(m => !m.id && m.temp_id && m.status === 'pending' && m.sender_type === 'agent' && (m.content||'').trim() === (messageData.content||'').trim());
                    if (optimisticIndex >= 0) {
                        this.messages[optimisticIndex] = { ...this.messages[optimisticIndex], ...messageData, status: 'sent' };
                        // 重新渲染整条（简化处理）
                        this.renderMessages();
                    } else {
                        this.messages.push({ ...messageData, status: 'sent' });
                        this.renderMessage(messageData);
                    }
                    this.scrollToBottom();
                    
                    if (this.options.debug) {
                        console.log('[MessagesManagerRefactored] 新消息已添加到当前对话');
                    }
                }
            }
            
            // 触发回调
            this.options.onNewMessage(messageData);
            // 未读同步（如果不是当前会话，会在 UnreadSync 内部 +1）
            try { if (window.UnreadSync && typeof window.UnreadSync.onIncomingMessage === 'function') { window.UnreadSync.onIncomingMessage(messageData); } } catch(_){ }
        }

        /**
         * 处理消息更新事件
         */
        handleMessageUpdated(messageData) {
            if (!messageData || !messageData.id) return;
            
            const index = this.messages.findIndex(m => String(m.id) === String(messageData.id));
            if (index >= 0) {
                this.messages[index] = { ...this.messages[index], ...messageData };
                this.renderMessages();
                
                if (this.options.debug) {
                    console.log('[MessagesManagerRefactored] 消息已更新:', messageData.id);
                }
            }
            
            // 触发回调
            this.options.onMessageUpdated(messageData);
        }

        /**
         * 处理消息删除事件
         */
        handleMessageDeleted(payload) {
            if (!payload) return;
            
            const { id, conversation_id } = payload;
            const beforeLength = this.messages.length;
            
            this.messages = this.messages.filter(m => String(m.id) !== String(id));
            
            if (this.messages.length !== beforeLength && 
                this.currentConversationId === conversation_id) {
                this.renderMessages();
                
                if (this.options.debug) {
                    console.log('[MessagesManagerRefactored] 消息已删除:', id);
                }
            }
            
            // 触发回调
            this.options.onMessageDeleted(id);
        }

        /**
         * 渲染所有消息
         */
        renderMessages() {
            const container = document.getElementById('chatMessages');
            if (!container) return;
            
            container.innerHTML = '';
            
            if (this.messages.length === 0) {
                container.innerHTML = this.renderEmptyState();
                return;
            }
            
            this.messages.forEach(message => {
                this.renderMessage(message);
            });
            
            this.scrollToBottom();
        }

        /**
         * 渲染单条消息
         */
        renderMessage(message) {
            const container = document.getElementById('chatMessages');
            if (!container) return;
            
            // 优先使用组件化消息渲染器
            if (window.MessageRenderer && typeof window.MessageRenderer.renderMessage === 'function') {
                const messageElement = window.MessageRenderer.renderMessage(message);
                if (messageElement) {
                    container.appendChild(messageElement);
                    return;
                }
            }
            
            // 降级：简单消息渲染
            const messageDiv = document.createElement('div');
            let stateClass = '';
            if (message.status === 'pending') stateClass = 'pending';
            else if (message.status === 'failed') stateClass = 'failed';
            messageDiv.className = `chat-message ${message.sender_type === 'agent' ? 'sent' : 'received'} ${stateClass}`.trim();
            messageDiv.setAttribute('data-message-id', message.id || '');
            
            const content = message.content || '';
            const time = this.formatTime(message.timestamp || message.sent_at || message.created_at);
            
            messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="message-text">${this.escapeHtml(content)}${this._renderStatusAdornment(message)}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
            // 失败重试绑定
            if (message.status === 'failed') {
                const retryBtn = messageDiv.querySelector('.msg-retry-btn');
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => this._retrySend(message));
                }
            }
            
            container.appendChild(messageDiv);
        }

        // 渲染状态附加元素
        _renderStatusAdornment(message){
            if (message.status === 'pending') return '<span class="msg-status-dot" title="发送中">⏳</span>';
            if (message.status === 'failed') return '<button class="msg-retry-btn" title="重试发送">重试</button>';
            return '';
        }

        // 启动 pending 超时
        _armPendingTimeout(){ /* 已交由 MessageSendChannel 处理 ack/回流 逻辑（未来扩展） */ }

        // 标记失败
        _markMessageFailed(){ /* 失败状态交由发送通道回流 patch 处理 */ }

        // 重试发送
        async _retrySend(){ console.warn('[MessagesManagerRefactored] _retrySend 已废弃，统一使用 MessageSendChannel.retry'); }

        /**
         * 滚动到底部
         */
        scrollToBottom() {
            // 优先使用滚动协调器
            if (window.MessageModuleRef && window.MessageModuleRef._scrollCoordinator) {
                window.MessageModuleRef._scrollCoordinator.scrollToEnd();
                return;
            }
            const container = document.getElementById('chatMessages');
            if (container) container.scrollTop = container.scrollHeight;
        }

        /**
         * 格式化时间
         */
        formatTime(timestamp) {
            return window.formatTime(timestamp);
        }

        /**
         * HTML转义
         */
        escapeHtml(text) {
            return window.globalUtils.escapeHtml(text);
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
                    <h3>暂无消息</h3>
                    <p>开始与客户对话吧</p>
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
         * 显示提示消息
         */
        showToast(message, type = 'info') {
            window.showToast(message, type);
        }

        /**
         * 销毁管理器
         */
        destroy() {
            this.messages = [];
            this.currentConversationId = null;
            this.currentCustomer = null;
            this.loading = false;
            this.error = null;
            this._loadingMessagesFor = null;
        }
    }

    // 暴露到全局
    window.MessagesManagerRefactored = MessagesManagerRefactored;

    console.log('✅ 消息管理器重构版已加载 (messages-manager-refactored.js)');

})();