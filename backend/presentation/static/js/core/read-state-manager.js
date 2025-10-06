/**
 * 统一已读状态管理器
 * 核心模块，管理消息已读状态、未读计数、红点显示
 */
(function() {
    'use strict';

    class ReadStateManager {
        constructor() {
            this.unreadCounts = new Map(); // conversationId -> unreadCount
            this.readStates = new Map();   // messageId -> isRead
            this.listeners = new Set();
            this.debug = window.QT_CONFIG?.features?.debug || false;
        }

        /**
         * 设置对话未读数量
         */
        setUnreadCount(conversationId, count) {
            const oldCount = this.unreadCounts.get(conversationId) || 0;
            this.unreadCounts.set(conversationId, Math.max(0, count));
            
            if (oldCount !== count) {
                this.notifyListeners('unreadCountChanged', {
                    conversationId,
                    oldCount,
                    newCount: count
                });
            }
        }

        /**
         * 增加未读数量
         */
        incrementUnread(conversationId, delta = 1) {
            const current = this.unreadCounts.get(conversationId) || 0;
            this.setUnreadCount(conversationId, current + delta);
        }

        /**
         * 减少未读数量
         */
        decrementUnread(conversationId, delta = 1) {
            const current = this.unreadCounts.get(conversationId) || 0;
            this.setUnreadCount(conversationId, Math.max(0, current - delta));
        }

        /**
         * 获取对话未读数量
         */
        getUnreadCount(conversationId) {
            return this.unreadCounts.get(conversationId) || 0;
        }

        /**
         * 清除对话未读数量
         */
        clearUnreadCount(conversationId) {
            this.setUnreadCount(conversationId, 0);
        }

        /**
         * 设置消息已读状态
         */
        setMessageRead(messageId, isRead = true) {
            const oldState = this.readStates.get(messageId);
            this.readStates.set(messageId, isRead);
            
            if (oldState !== isRead) {
                this.notifyListeners('messageReadStateChanged', {
                    messageId,
                    isRead,
                    oldState
                });
            }
        }

        /**
         * 批量设置消息已读状态
         */
        setMessagesRead(messageIds, isRead = true) {
            const changes = [];
            messageIds.forEach(messageId => {
                const oldState = this.readStates.get(messageId);
                if (oldState !== isRead) {
                    this.readStates.set(messageId, isRead);
                    changes.push({ messageId, isRead, oldState });
                }
            });

            if (changes.length > 0) {
                this.notifyListeners('batchMessageReadStateChanged', { changes });
            }
        }

        /**
         * 检查消息是否已读
         */
        isMessageRead(messageId) {
            return this.readStates.get(messageId) || false;
        }

        /**
         * 获取所有未读计数总和
         */
        getTotalUnreadCount() {
            let total = 0;
            for (const count of this.unreadCounts.values()) {
                total += count;
            }
            return total;
        }

        /**
         * 添加状态变化监听器
         */
        addListener(callback) {
            this.listeners.add(callback);
        }

        /**
         * 移除状态变化监听器
         */
        removeListener(callback) {
            this.listeners.delete(callback);
        }

        /**
         * 通知所有监听器
         */
        notifyListeners(event, data) {
            this.listeners.forEach(callback => {
                try {
                    callback(event, data);
                } catch (error) {
                    if (this.debug) {
                        console.error('[ReadStateManager] 监听器回调错误:', error);
                    }
                }
            });
        }

        /**
         * 获取调试信息
         */
        getDebugInfo() {
            return {
                unreadCounts: Object.fromEntries(this.unreadCounts),
                readStatesCount: this.readStates.size,
                listenersCount: this.listeners.size,
                totalUnread: this.getTotalUnreadCount()
            };
        }

        /**
         * 清除所有状态
         */
        clear() {
            this.unreadCounts.clear();
            this.readStates.clear();
            this.notifyListeners('stateCleared', {});
        }

        /**
         * 销毁管理器
         */
        destroy() {
            this.clear();
            this.listeners.clear();
        }
    }

    // 全局注册
    window.ReadStateManager = ReadStateManager;
    // 模块注册
    if (typeof window.ModuleLoader?.registerModule === 'function') {
        window.ModuleLoader.registerModule('read-state-manager', 'core', 'ReadStateManager 已加载');
    } else {
        console.log('✅ ReadStateManager 已加载');
    }

})();