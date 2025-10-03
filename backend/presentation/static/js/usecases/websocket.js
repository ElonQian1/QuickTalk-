// websocket.js — WebSocket 连接与事件处理（从 mobile-dashboard.html 拆分）
// 依赖：updateConnectionStatus, handleWebSocketMessage

// WebSocket 相关函数
// 依赖：user-utils.js, message-and-conversation.js

function initializeWebSocket() {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${location.host}/ws`;
    window.websocket = new WebSocket(wsUrl);
    window.websocket.onopen = function() {
        console.log('🔗 WebSocket连接已建立');
        updateConnectionStatus(true);
    };
    window.websocket.onclose = function() {
        console.log('🔌 WebSocket连接已断开');
        updateConnectionStatus(false);
        setTimeout(initializeWebSocket, 5000);
    };
    window.websocket.onerror = function(error) {
        console.error('❌ WebSocket连接错误:', error);
        updateConnectionStatus(false);
    };
    window.websocket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            if (typeof handleWebSocketMessage === 'function') {
                handleWebSocketMessage(data);
            } else {
                // 兜底：识别常见消息事件并更新导航红点
                const t = data && data.type;
                if (t === 'domain.event.message_appended' || t === 'new_message') {
                    const badge = document.getElementById('messagesBadge');
                    if (badge) {
                        const cur = parseInt(badge.textContent) || 0;
                        const next = cur + 1;
                        badge.textContent = next > 99 ? '99+' : String(next);
                        badge.classList.remove('hidden');
                        badge.style.display = 'block';
                    }
                }
            }
        } catch (error) {
            console.error('❌ 解析WebSocket消息失败:', error);
        }
    };
};

function updateConnectionStatus(isConnected) {
    const statusDot = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionText');
    if (isConnected) {
        statusDot.classList.remove('disconnected');
        statusText.textContent = '已连接';
    } else {
        statusDot.classList.add('disconnected');
        statusText.textContent = '未连接';
    }
}

function extractMessageFromEnvelope(evt) {
    // ...原实现代码...
}
