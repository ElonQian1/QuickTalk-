/**
 * 统一的消息已读管理器
 * 整合所有已读状态管理功能，避免重复代码
 */
(function() {
    'use strict';
    
    // 防止重复加载
    if (window.UnifiedReadManager) return;

    class UnifiedReadManager {
        constructor() {
            this.debug = false;
            this.apiEndpoint = '/api/conversations';
            this.sessionIdKey = 'sessionId';
        }

        /**
         * 标记对话为已读 - 统一实现
         * @param {string} conversationId - 对话ID
         * @param {Object} options - 选项
         * @returns {Promise<boolean>} - 是否成功
         */
        async markConversationAsRead(conversationId, options = {}) {
            try {
                this._log('标记对话为已读:', conversationId);

                // 调用后端API
                const response = await fetch(`${this.apiEndpoint}/${conversationId}/read`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Id': this._getSessionId()
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                this._log('✅ 对话已标记为已读:', conversationId);

                // 触发事件
                this._dispatchReadEvent(conversationId, options);

                return true;
            } catch (error) {
                this._log('❌ 标记已读失败:', conversationId, error);
                return false;
            }
        }

        /**
         * 批量标记多个对话为已读
         * @param {string[]} conversationIds - 对话ID数组
         * @returns {Promise<Object>} - 成功和失败的统计
         */
        async markMultipleAsRead(conversationIds) {
            const results = {
                success: [],
                failed: []
            };

            for (const id of conversationIds) {
                const success = await this.markConversationAsRead(id);
                if (success) {
                    results.success.push(id);
                } else {
                    results.failed.push(id);
                }
            }

            this._log('批量标记结果:', results);
            return results;
        }

        /**
         * 更新本地对话状态
         * @param {string} conversationId - 对话ID
         * @param {Object} manager - 对话管理器实例
         */
        updateLocalConversationState(conversationId, manager) {
            if (!manager || !manager.conversations) return;

            const conversation = manager.conversations.find(c => 
                String(c.id) === String(conversationId)
            );

            if (conversation && conversation.unread_count > 0) {
                conversation.unread_count = 0;
                
                // 重新渲染列表
                if (typeof manager.renderConversationsList === 'function') {
                    manager.renderConversationsList();
                }

                // 更新徽章
                if (typeof manager.updateUnreadBadges === 'function') {
                    manager.updateUnreadBadges();
                }
            }
        }

        /**
         * 自动标记当前查看的对话为已读
         * @param {string} conversationId - 对话ID
         * @param {Object} options - 选项
         */
        async autoMarkCurrentAsRead(conversationId, options = {}) {
            if (!conversationId) return;

            // 延迟标记，避免频繁调用
            if (this._markReadTimeout) {
                clearTimeout(this._markReadTimeout);
            }

            this._markReadTimeout = setTimeout(async () => {
                await this.markConversationAsRead(conversationId, {
                    ...options,
                    auto: true
                });
            }, options.delay || 1000);
        }

        /**
         * 获取会话ID
         * @returns {string|null}
         */
        _getSessionId() {
            return localStorage.getItem(this.sessionIdKey) || 
                   sessionStorage.getItem(this.sessionIdKey) || 
                   null;
        }

        /**
         * 触发已读事件
         * @param {string} conversationId - 对话ID
         * @param {Object} options - 选项
         */
        _dispatchReadEvent(conversationId, options) {
            // 触发自定义事件
            document.dispatchEvent(new CustomEvent('conversation:read', {
                detail: {
                    conversationId,
                    timestamp: Date.now(),
                    auto: options.auto || false
                }
            }));

            // 兼容旧版本事件
            if (window.EventBus && typeof window.EventBus.emit === 'function') {
                window.EventBus.emit('message:read', { conversationId });
            }
        }

        /**
         * 调试日志
         */
        _log(...args) {
            if (this.debug) {
                console.log('[UnifiedReadManager]', ...args);
            }
        }

        /**
         * 启用调试模式
         */
        enableDebug() {
            this.debug = true;
            this._log('调试模式已启用');
        }

        /**
         * 设置自定义API端点
         * @param {string} endpoint - API端点
         */
        setApiEndpoint(endpoint) {
            this.apiEndpoint = endpoint;
            this._log('API端点已更新:', endpoint);
        }
    }

    // 创建全局实例
    window.UnifiedReadManager = new UnifiedReadManager();

    // 提供快捷方法
    window.markConversationAsRead = (id, options) => 
        window.UnifiedReadManager.markConversationAsRead(id, options);

    // 自动监听对话选择事件
    document.addEventListener('conversation:selected', (event) => {
        if (event.detail && event.detail.id) {
            window.UnifiedReadManager.autoMarkCurrentAsRead(event.detail.id);
        }
    });

    console.log('✅ UnifiedReadManager 已加载');
})();