// 消息发送调试工具
window.debugMessageSending = function() {
    console.log('=== 消息发送调试 ===');
    
    // 检查MessageSendChannel
    console.log('MessageSendChannel类:', window.MessageSendChannel);
    console.log('MessageSendChannelInstance:', window.MessageSendChannelInstance);
    
    // 检查MessageModule
    const messageModule = window.messageModule || window.MessageModuleInstance;
    console.log('MessageModule:', messageModule);
    
    if (messageModule) {
        console.log('当前对话ID:', messageModule.currentConversationId);
        console.log('MessagesManager:', messageModule.messagesManager);
    }
    
    // 检查认证信息
    if (window.authHelper) {
        console.log('认证令牌:', window.authHelper.getAuthToken());
        console.log('会话ID:', window.authHelper.getSessionId());
    }
    
    // 测试发送消息
    const testMessage = '测试消息 - ' + new Date().toLocaleTimeString();
    console.log('尝试发送测试消息:', testMessage);
    
    if (window.MessageSendChannelInstance) {
        const tempId = window.MessageSendChannelInstance.sendText(testMessage);
        console.log('发送tempId:', tempId);
        
        // 查看队列状态
        setTimeout(() => {
            console.log('队列快照:', window.MessageSendChannelInstance.getQueueSnapshot());
        }, 1000);
    } else {
        console.warn('MessageSendChannelInstance 未初始化');
    }
    
    return {
        sendChannel: window.MessageSendChannelInstance,
        messageModule: messageModule,
        hasAuth: !!window.authHelper
    };
};

// 强制发送消息测试
window.forceSendMessage = function(content = '强制测试消息') {
    if (!window.MessageSendChannelInstance) {
        console.error('MessageSendChannelInstance 未初始化');
        return false;
    }
    
    const messageModule = window.messageModule || window.MessageModuleInstance;
    if (!messageModule || !messageModule.currentConversationId) {
        console.error('无当前对话，请先选择对话');
        return false;
    }
    
    console.log('强制发送消息:', content);
    const tempId = window.MessageSendChannelInstance.sendText(content);
    console.log('返回tempId:', tempId);
    
    return tempId;
};

// 检查API发送
window.testAPISend = async function(conversationId, content = 'API测试消息') {
    if (!conversationId) {
        const messageModule = window.messageModule || window.MessageModuleInstance;
        conversationId = messageModule?.currentConversationId;
    }
    
    if (!conversationId) {
        console.error('无对话ID');
        return false;
    }
    
    const authToken = window.authHelper?.getAuthToken() || 'dummy-token';
    const sessionId = window.authHelper?.getSessionId() || 'admin-session';
    
    try {
        console.log('发送API请求...', { conversationId, content, authToken: authToken.substring(0, 10) + '...' });
        
        const response = await fetch(`/api/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({
                conversation_id: conversationId,
                content: content,
                sender_type: 'agent',
                sender_id: 'admin-test',
                message_type: 'text'
            })
        });
        
        console.log('API响应状态:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API错误:', errorText);
            return false;
        }
        
        const result = await response.json();
        console.log('API响应:', result);
        
        return result.success;
    } catch (error) {
        console.error('API请求异常:', error);
        return false;
    }
};

// 页面加载完成后注册调试工具
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            console.log('📱 消息发送调试工具已加载');
            console.log('使用 debugMessageSending() 检查发送状态');
            console.log('使用 forceSendMessage("内容") 强制发送消息');
            console.log('使用 testAPISend("对话ID", "内容") 测试API发送');
        }, 2000);
    });
} else {
    setTimeout(() => {
        console.log('📱 消息发送调试工具已加载');
        console.log('使用 debugMessageSending() 检查发送状态');
        console.log('使用 forceSendMessage("内容") 强制发送消息');
        console.log('使用 testAPISend("对话ID", "内容") 测试API发送');
    }, 2000);
}