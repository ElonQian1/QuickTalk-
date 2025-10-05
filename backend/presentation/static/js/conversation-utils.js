/**
 * 对话工具模块
 * 提供对话相关的工具函数
 */

window.ConversationUtils = {
    /**
     * 格式化时间戳
     */
    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // 今天
        if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
            return date.toLocaleTimeString('zh-CN', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
        
        // 昨天
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.getDate() === yesterday.getDate()) {
            return '昨天 ' + date.toLocaleTimeString('zh-CN', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
        
        // 一周内
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            return weekdays[date.getDay()] + ' ' + date.toLocaleTimeString('zh-CN', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
        
        // 超过一周
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    },

    /**
     * 生成对话摘要
     */
    generateSummary(messages, maxLength = 50) {
        if (!messages || messages.length === 0) {
            return (window.Formatters && window.Formatters.placeholders.lastMessage) || '暂无消息';
        }
        
        const lastMessage = messages[messages.length - 1];
        let content = lastMessage.content || '';
        
        // 处理特殊消息类型
        if (lastMessage.type === 'image') {
            content = '[图片]';
        } else if (lastMessage.type === 'file') {
            content = '[文件]';
        } else if (lastMessage.type === 'audio') {
            content = '[语音]';
        }
        
        // 截断长文本
        if (content.length > maxLength) {
            content = content.substring(0, maxLength) + '...';
        }
        
        return content;
    },

    /**
     * 获取对话状态
     */
    getConversationStatus(conversation) {
        if (!conversation) return 'unknown';
        
        if (conversation.status === 'closed') return 'closed';
        if (conversation.status === 'resolved') return 'resolved';
        if (conversation.unread_count > 0) return 'unread';
        
        const lastActivity = new Date(conversation.last_message_at);
        const now = new Date();
        const diff = now - lastActivity;
        
        // 超过24小时无活动
        if (diff > 24 * 60 * 60 * 1000) {
            return 'inactive';
        }
        
        return 'active';
    },

    /**
     * 获取参与者信息
     */
    getParticipants(conversation) {
        if (!conversation) return [];
        
        const participants = [];
        
        // 添加客户
        if (conversation.customer_id) {
            participants.push({
                id: conversation.customer_id,
                type: 'customer',
                name: conversation.customer_name || `客户 ${conversation.customer_id.slice(-6)}`,
                avatar: null
            });
        }
        
        // 添加代理
        if (conversation.agent_id) {
            participants.push({
                id: conversation.agent_id,
                type: 'agent',
                name: conversation.agent_name || '客服代表',
                avatar: null
            });
        }
        
        return participants;
    },

    /**
     * 计算未读消息数
     */
    countUnreadMessages(messages, lastReadTimestamp) {
        if (!messages || messages.length === 0) return 0;
        if (!lastReadTimestamp) return messages.length;
        
        const lastRead = new Date(lastReadTimestamp);
        return messages.filter(msg => new Date(msg.created_at) > lastRead).length;
    },

    /**
     * 检查是否可以发送消息
     */
    canSendMessage(conversation) {
        if (!conversation) return false;
        
        return conversation.status !== 'closed' && 
               conversation.status !== 'archived';
    },

    /**
     * 获取消息发送者类型
     */
    getSenderType(message) {
        if (!message) return 'unknown';
        
        return message.sender_type || 
               (message.sender === 'user' ? 'customer' : 'agent');
    },

    /**
     * 检查消息是否为当前用户发送
     */
    isOwnMessage(message, currentUserId) {
        if (!message || !currentUserId) return false;
        
        return message.sender_id === currentUserId ||
               message.user_id === currentUserId;
    },

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    },

    /**
     * 检查文件类型
     */
    getFileType(filename) {
        if (!filename) return 'unknown';
        
        const ext = filename.split('.').pop().toLowerCase();
        
        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        const documentTypes = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
        const audioTypes = ['mp3', 'wav', 'ogg', 'm4a'];
        const videoTypes = ['mp4', 'webm', 'ogg', 'avi'];
        
        if (imageTypes.includes(ext)) return 'image';
        if (documentTypes.includes(ext)) return 'document';
        if (audioTypes.includes(ext)) return 'audio';
        if (videoTypes.includes(ext)) return 'video';
        
        return 'file';
    },

    /**
     * 生成对话链接
     */
    generateConversationUrl(conversationId, shopId) {
        const baseUrl = window.location.origin;
        return `${baseUrl}/mobile/dashboard?shop=${shopId}&conversation=${conversationId}`;
    },

    /**
     * 解析提及内容
     */
    parseMentions(content) {
        if (!content) return content;
        
        // 简单的@提及解析
        return content.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
    },

    /**
     * 清理HTML内容
     */
    sanitizeContent(content) {
        if (!content) return '';
        
        // 简单的HTML标签清理
        return content
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }
};

console.log('📞 对话工具模块已加载');