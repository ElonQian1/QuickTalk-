// QuickTalk 消息过滤和路由模块
// 确保消息能正确路由到对应的接收方
(function(global) {
    // 消息过滤器
    const MessageFilter = {
        // 客户端应该接收的消息类型
        shouldReceiveByCustomer(message) {
            if (!message) return false;
            
            // 客户端接收管理员发送的消息
            return message.senderType === 'agent' || 
                   message.sender_type === 'agent' || 
                   message.sender === 'agent';
        },
        
        // 管理端应该接收的消息类型
        shouldReceiveByAdmin(message) {
            if (!message) return false;
            
            // 管理端接收客户发送的消息
            return message.senderType === 'customer' || 
                   message.sender_type === 'customer' || 
                   message.sender === 'customer' ||
                   message.senderType === 'user' ||
                   message.sender_type === 'user' ||
                   message.sender === 'user';
        }
    };
    
    // 消息路由器
    const MessageRouter = {
        routeMessage(message, currentRole) {
            if (!message) return false;
            
            switch (currentRole) {
                case 'customer':
                    return MessageFilter.shouldReceiveByCustomer(message);
                case 'admin':
                case 'agent':
                    return MessageFilter.shouldReceiveByAdmin(message);
                default:
                    // 默认显示所有消息
                    return true;
            }
        }
    };
    
    // 增强现有的消息处理
    if (global.QuickTalk) {
        global.QuickTalk.MessageFilter = MessageFilter;
        global.QuickTalk.MessageRouter = MessageRouter;
        
        // 增强 Protocol.adapt 方法
        const originalAdapt = global.QuickTalk.Protocol.adapt;
        global.QuickTalk.Protocol.adapt = function(raw) {
            const result = originalAdapt(raw);
            
            // 为消息添加调试信息
            if (result && result.kind === 'message.appended' && result.payload) {
                console.log('[MessageRouter] 接收到消息:', {
                    id: result.payload.id,
                    senderType: result.payload.senderType,
                    content: result.payload.content,
                    conversationId: result.payload.conversationId
                });
            }
            
            return result;
        };
    }
    
    // 客户端消息显示增强
    if (global.MobileMessageManager && global.MobileMessageManager.prototype.handleNewMessage) {
        const originalHandleNewMessage = global.MobileMessageManager.prototype.handleNewMessage;
        global.MobileMessageManager.prototype.handleNewMessage = function(message) {
            console.log('[客户端] 收到新消息:', message);
            
            // 确保客户端能接收管理员消息
            if (MessageFilter.shouldReceiveByCustomer(message)) {
                console.log('[客户端] 显示管理员消息:', message.content);
                return originalHandleNewMessage.call(this, message);
            } else {
                console.log('[客户端] 过滤掉消息 (非管理员发送):', message);
                return;
            }
        };
    }
    
})(window);