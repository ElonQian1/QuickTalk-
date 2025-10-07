/**
 * MessagesManager - 消息管理器 (深度优化版)
 * 继承自BaseManager，专门处理消息相关的业务逻辑
 * 
 * 优化内容 (2025-10-07):
 * - ✅ 移除重复的API调用代码
 * - ✅ 使用BaseManager提供的统一接口
 * - ✅ 统一错误处理和状态管理
 * - ✅ 优化消息渲染性能
 * - 🔧 第一轮：合并过滤方法，提供统一filterMessages接口
 * - 🔧 第一轮：优化统计计算，单次遍历获取所有数据
 * - 🔧 第一轮：统一日期时间处理，减少重复的Date转换逻辑
 * - 🔧 第一轮：保留向后兼容性，旧方法委托给新统一接口
 * - 🚀 第二轮：消除双重通知冗余，使用BaseManager统一事件机制
 * - 🚀 第二轮：移除冗余回调配置，简化初始化逻辑
 */
(function() {
    'use strict';

    // 本地文本助手：兼容全局 getText 渐进替换阶段，统一获取文案
    function T(key, fallback) {
        if (typeof window !== 'undefined' && typeof window.getText === 'function') {
            return window.getText(key, fallback || key);
        }
        return (window.StateTexts && window.StateTexts[key]) || fallback || key;
    }

    class MessagesManager extends BaseManager {
        constructor(options = {}) {
            super('MessagesManager', {
                debug: false,
                cacheTimeout: 120000, // 2分钟缓存
                ...options
            });

            // 消息数据状态
            this.messages = [];
            this.currentConversationId = null;
            this.currentCustomer = null;
            this.messageContainer = null;

            // 分页和加载
            this.pagination = {
                page: 1,
                limit: 50,
                hasMore: true,
                total: 0
            };

            // 🔧 优化：移除冗余回调配置，使用BaseManager统一事件机制
            // WebSocket依赖注入
            this.wsSend = options.wsSend || null;

            this.log('info', '消息管理器初始化完成');

            // 注册到状态协调器
            this.registerToStateCoordinator();
        }

        /**
         * 🔧 优化：统一的日期时间处理工具方法
         */
        getMessageTime(message) {
            return new Date(message.created_at).getTime();
        }

        /**
         * 🔧 优化：消息时间比较器
         */
        compareMessageTime(a, b) {
            return this.getMessageTime(a) - this.getMessageTime(b);
        }

        /**
         * 注册到状态协调器
         */
        registerToStateCoordinator() {
            if (typeof window.stateCoordinator !== 'undefined') {
                window.stateCoordinator.registerManager('messages', this);
                this.log('debug', '已注册到状态协调器');
            }
        }

        /**
         * 设置消息容器
         */
        setMessageContainer(container) {
            if (typeof container === 'string') {
                this.messageContainer = document.querySelector(container);
            } else if (container instanceof Element) {
                this.messageContainer = container;
            }

            if (!this.messageContainer) {
                this.log('error', '消息容器设置失败');
                return false;
            }

            this.log('debug', '消息容器已设置');
            return true;
        }

        /**
         * 加载消息
         */
        async loadMessages(conversationId, page = 1, limit = 50) {
            if (!conversationId) {
                this.log('warn', '未提供对话ID');
                return [];
            }

            if (this.state.loading) {
                this.log('debug', '消息加载中，跳过重复请求');
                return this.messages;
            }

            this.log('info', `开始加载对话${conversationId}的消息，页码: ${page}`);

            try {
                const data = await this.apiCall(`/api/conversations/${conversationId}/messages?page=${page}&limit=${limit}`, {
                    method: 'GET'
                });

                if (data.success && Array.isArray(data.data)) {
                    if (page === 1) {
                        // 新对话，重置消息
                        this.messages = data.data;
                        this.currentConversationId = conversationId;
                    } else {
                        // 分页加载，追加消息
                        this.messages = [...data.data, ...this.messages];
                    }

                    // 更新分页信息
                    this.pagination = {
                        page: page,
                        limit: limit,
                        hasMore: data.pagination?.hasMore || false,
                        total: data.pagination?.total || this.messages.length
                    };

                    this.log('info', `消息加载成功，数量: ${data.data.length}，总计: ${this.messages.length}`);

                    // 🔧 优化：使用BaseManager统一通知机制，消除双重回调冗余
                    this.emit('messagesLoaded', { 
                        messages: this.messages, 
                        conversationId,
                        pagination: this.pagination,
                        page, 
                        isNewConversation: page === 1 
                    });

                    // 自动渲染消息
                    if (this.messageContainer) {
                        this.renderMessages(page === 1);
                    }

                } else {
                    throw new Error(data.message || '消息数据格式错误');
                }

                return this.messages;

            } catch (error) {
                this.log('error', '加载消息失败:', error.message);
                this.emit('messagesError', { error: error.message, conversationId });
                throw error;
            }
        }

        /**
         * 发送消息
         */
        async sendMessage(content, type = 'text', extra = {}) {
            if (!this.currentConversationId) {
                this.log('error', '未选择对话，无法发送消息');
                return false;
            }

            if (!content || content.trim() === '') {
                this.log('warn', '消息内容为空');
                return false;
            }

            const messageData = {
                conversation_id: this.currentConversationId,
                content: content.trim(),
                type: type,
                sender_type: 'agent',
                ...extra
            };

            this.log('info', '发送消息:', messageData);

            try {
                // 1. 先通过WebSocket发送（实时性）
                if (this.wsSend && typeof this.wsSend === 'function') {
                    this.wsSend({
                        type: 'send_message',
                        data: messageData
                    });
                }

                // 2. 通过API发送（持久化）
                const data = await this.apiCall('/api/messages', {
                    method: 'POST',
                    body: JSON.stringify(messageData)
                });

                if (data.success && data.data) {
                    const message = data.data;
                    
                    // 添加到本地消息列表
                    this.addMessage(message);

                    this.log('info', '消息发送成功:', message.id);

                    // 🔧 优化：使用BaseManager统一通知机制
                    this.emit('messageSent', { message, conversationId: this.currentConversationId });

                    return message;
                } else {
                    const failMsg = data.message || T('SEND_MESSAGE_FAIL', '消息发送失败');
                    throw new Error(failMsg);
                }

            } catch (error) {
                const txt = T('SEND_MESSAGE_FAIL', '发送消息失败');
                this.log('error', txt + ':', error.message);
                this.emit('messageSendError', { error: error.message, messageData });
                throw error;
            }
        }

        /**
         * 🔧 优化：添加新消息到列表，使用统一时间处理
         */
        addMessage(message) {
            if (!message || !message.id) {
                this.log('warn', '无效的消息数据');
                return false;
            }

            // 检查消息是否已存在
            const existingIndex = this.messages.findIndex(m => m.id === message.id);
            if (existingIndex !== -1) {
                // 更新现有消息
                this.messages[existingIndex] = message;
                this.log('debug', '消息已更新:', message.id);
            } else {
                // 添加新消息（按时间顺序插入）
                const messageTime = this.getMessageTime(message);
                const insertIndex = this.messages.findIndex(m => 
                    this.getMessageTime(m) > messageTime
                );
                
                if (insertIndex === -1) {
                    this.messages.push(message);
                } else {
                    this.messages.splice(insertIndex, 0, message);
                }
                
                this.log('debug', '新消息已添加:', message.id);
            }

            // 🔧 优化：使用BaseManager统一通知机制
            this.emit('messageAdded', { message });

            // 自动渲染
            if (this.messageContainer) {
                this.renderNewMessage(message);
            }

            return true;
        }

        /**
         * 🔧 优化：渲染消息列表，使用统一时间排序
         */
        renderMessages(clearContainer = true) {
            if (!this.messageContainer) {
                this.log('warn', '消息容器未设置，无法渲染');
                return false;
            }

            // 按时间排序，使用统一比较器
            const sortedMessages = [...this.messages].sort(this.compareMessageTime.bind(this));

            // 使用TemplateRenderer渲染列表
            if (window.TemplateRenderer) {
                const messagesHTML = this.renderList(sortedMessages, this._getMessageTemplate(), {
                    wrapper: '<div class="messages-list">{{content}}</div>'
                });
                
                this.renderToContainer(this.messageContainer, messagesHTML, {
                    clearFirst: clearContainer,
                    append: !clearContainer
                });
            } else {
                // 回退到原始渲染
                if (clearContainer) {
                    this.messageContainer.innerHTML = '';
                }
                
                const messagesHTML = sortedMessages.map(message => 
                    this.createMessageElement(message)
                ).join('');
                
                if (clearContainer) {
                    this.messageContainer.innerHTML = messagesHTML;
                } else {
                    this.messageContainer.insertAdjacentHTML('beforeend', messagesHTML);
                }
            }

            // 滚动到底部
            this.scrollToBottom();

            this.log('debug', `消息渲染完成，数量: ${sortedMessages.length}`);
            return true;
        }

        /**
         * 渲染单条新消息
         */
        renderNewMessage(message) {
            if (!this.messageContainer) {
                return false;
            }

            const messageHTML = this.createMessageElement(message);
            this.messageContainer.insertAdjacentHTML('beforeend', messageHTML);
            
            // 滚动到新消息
            this.scrollToBottom();
            
            return true;
        }

        /**
         * 创建消息元素HTML
         */
        createMessageElement(message) {
            const isAgent = message.sender_type === 'agent';
            const senderClass = isAgent ? 'agent' : 'customer';
            const alignClass = isAgent ? 'right' : 'left';
            
            const formatTime = (timeStr) => {
                // 使用统一工具库进行时间格式化
                return window.UnifiedUtils ? 
                    window.UnifiedUtils.formatTime(timeStr, 'HH:mm') : 
                    new Date(timeStr).toLocaleTimeString('zh-CN', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
            };

            const messageContent = this.formatMessageContent(message);

            return `
                <div class="message ${senderClass} ${alignClass}" data-message-id="${message.id}">
                    <div class="message-info">
                        <span class="sender">${isAgent ? '客服' : (message.sender_name || '客户')}</span>
                        <span class="time">${formatTime(message.created_at)}</span>
                    </div>
                    <div class="message-content">
                        ${messageContent}
                    </div>
                </div>
            `;
        }

        /**
         * 格式化消息内容
         */
        formatMessageContent(message) {
            switch (message.type) {
                case 'text':
                    return `<div class="text-message">${this.escapeHtml(message.content)}</div>`;
                
                case 'image':
                    return `<div class="image-message">
                        <img src="${message.content}" alt="图片消息" style="max-width: 200px; border-radius: 8px;">
                    </div>`;
                
                case 'file':
                    return `<div class="file-message">
                        <a href="${message.content}" target="_blank" class="file-link">
                            📎 ${message.filename || '文件'}
                        </a>
                    </div>`;
                
                default:
                    return `<div class="unknown-message">${this.escapeHtml(message.content)}</div>`;
            }
        }

        /**
         * 获取消息模板 (为TemplateRenderer设计)
         */
        _getMessageTemplate() {
            return `
                <div class="message {{_senderClass}} {{_alignClass}}" data-message-id="{{id}}">
                    <div class="message-info">
                        <span class="sender">{{#if _isAgent}}客服{{else}}{{sender_name}}或客户{{/if}}</span>
                        <span class="time">{{_formatTime created_at}}</span>
                    </div>
                    <div class="message-content">
                        {{#if type === 'text'}}
                            <div class="text-message">{{content}}</div>
                        {{else if type === 'image'}}
                            <div class="image-message">
                                <img src="{{content}}" alt="图片消息" style="max-width: 200px; border-radius: 8px;">
                            </div>
                        {{else if type === 'file'}}
                            <div class="file-message">
                                <a href="{{content}}" target="_blank" class="file-link">
                                    📎 {{filename}}或文件
                                </a>
                            </div>
                        {{else}}
                            <div class="unknown-message">{{content}}</div>
                        {{/if}}
                    </div>
                </div>
            `;
        }

        /**
         * 渲染列表的便捷方法
         */
        renderList(items, template, options = {}) {
            return this.constructor.prototype.renderList?.call(this, items, template, options) || 
                   items.map(item => this.renderTemplate(template, item)).join('');
        }

        /**
         * 渲染模板的便捷方法
         */
        renderTemplate(template, data = {}) {
            return this.constructor.prototype.renderTemplate?.call(this, template, data) || 
                   template.replace(/\{\{(\w+)\}\}/g, (match, key) => data[key] || match);
        }

        /**
         * 渲染到容器的便捷方法
         */
        renderToContainer(container, content, options = {}) {
            if (window.TemplateRenderer) {
                return window.TemplateRenderer.renderToContainer(container, content, options);
            }
            
            // 简单回退
            if (options.clearFirst && !options.append) {
                container.innerHTML = '';
            }
            
            if (typeof content === 'string') {
                if (options.append) {
                    container.insertAdjacentHTML(options.position || 'beforeend', content);
                } else {
                    container.innerHTML = content;
                }
            }
        }

        /**
         * HTML转义
         */
        escapeHtml(text) {
            if (window.TemplateRenderer && window.TemplateRenderer._escapeHtmlInData) {
                return window.TemplateRenderer._escapeHtmlInData(text, {});
            }
            
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * 滚动到底部
         */
        scrollToBottom() {
            if (!this.messageContainer) return;
            
            setTimeout(() => {
                this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
            }, 10);
        }

        /**
         * 加载更多消息（历史消息）
         */
        async loadMoreMessages() {
            if (!this.pagination.hasMore || this.state.loading) {
                return false;
            }

            const nextPage = this.pagination.page + 1;
            return this.loadMessages(this.currentConversationId, nextPage, this.pagination.limit);
        }

        /**
         * 🔧 优化：统一的消息过滤接口，替代多个过滤方法
         * @param {Object} filters - 过滤条件
         * @param {string} filters.keyword - 搜索关键词
         * @param {string} filters.type - 消息类型 ('text', 'image', 'file', 'all')
         * @param {string} filters.senderType - 发送者类型 ('customer', 'agent', 'all')
         * @returns {Array} 过滤后的消息列表
         */
        filterMessages(filters = {}) {
            let filtered = [...this.messages];

            // 关键词搜索
            if (filters.keyword) {
                const searchTerm = filters.keyword.toLowerCase();
                filtered = filtered.filter(message => 
                    message.content.toLowerCase().includes(searchTerm) ||
                    message.sender_name?.toLowerCase().includes(searchTerm)
                );
            }

            // 类型过滤
            if (filters.type && filters.type !== 'all') {
                filtered = filtered.filter(message => message.type === filters.type);
            }

            // 发送者过滤
            if (filters.senderType && filters.senderType !== 'all') {
                filtered = filtered.filter(message => message.sender_type === filters.senderType);
            }

            return filtered;
        }

        /**
         * 🔧 优化：单次遍历获取所有消息统计数据
         * @returns {Object} 消息统计信息
         */
        getMessagesStats() {
            const stats = {
                total: this.messages.length,
                customerMessages: 0,
                agentMessages: 0,
                textMessages: 0,
                imageMessages: 0,
                fileMessages: 0
            };

            // 单次遍历获取所有统计
            this.messages.forEach(message => {
                // 按发送者统计
                if (message.sender_type === 'customer') {
                    stats.customerMessages++;
                } else if (message.sender_type === 'agent') {
                    stats.agentMessages++;
                }

                // 按类型统计
                switch (message.type) {
                    case 'text':
                        stats.textMessages++;
                        break;
                    case 'image':
                        stats.imageMessages++;
                        break;
                    case 'file':
                        stats.fileMessages++;
                        break;
                }
            });

            return stats;
        }

        /**
         * 🔧 保留兼容性：传统搜索方法 (委托给统一过滤接口)
         */
        searchMessages(keyword) {
            return this.filterMessages({ keyword });
        }

        /**
         * 🔧 保留兼容性：按类型过滤 (委托给统一过滤接口)
         */
        filterByType(type) {
            return this.filterMessages({ type });
        }

        /**
         * 🔧 保留兼容性：按发送者过滤 (委托给统一过滤接口)
         */
        filterBySender(senderType) {
            return this.filterMessages({ senderType });
        }

        /**
         * 清空消息 (使用TemplateRenderer优化)
         */
        clearMessages() {
            this.messages = [];
            this.currentConversationId = null;
            this.pagination = {
                page: 1,
                limit: 50,
                hasMore: true,
                total: 0
            };

            if (this.messageContainer) {
                // 使用TemplateRenderer清空容器
                if (window.TemplateRenderer) {
                    this.renderToContainer(this.messageContainer, '', { clearFirst: true });
                } else {
                    this.messageContainer.innerHTML = '';
                }
            }

            this.log('debug', '消息已清空');
        }

        /**
         * 切换对话
         */
        async switchConversation(conversationId) {
            if (conversationId === this.currentConversationId) {
                this.log('debug', '对话未发生变化:', conversationId);
                return this.messages;
            }

            this.log('info', '切换对话:', conversationId);
            
            // 清空当前消息
            this.clearMessages();
            
            // 加载新对话的消息
            return this.loadMessages(conversationId);
        }

        /**
         * 重置状态
         */
        reset() {
            this.clearMessages();
            this.currentCustomer = null;
            this.clearCache();
            this.log('info', '消息管理器状态已重置');
        }

        /**
         * 获取管理器状态
         */
        getStatus() {
            return {
                ...super.getStatus(),
                messagesCount: this.messages.length,
                currentConversationId: this.currentConversationId,
                pagination: this.pagination,
                hasContainer: !!this.messageContainer
            };
        }

        /**
         * 销毁管理器
         */
        destroy() {
            this.reset();
            this.messageContainer = null;
            super.destroy();
            this.log('info', '消息管理器已销毁');
        }
    }

    // 暴露到全局
    window.MessagesManager = MessagesManager;

    console.log('✅ 优化的消息管理器已加载 (深度优化：消除双重通知冗余)');

})();