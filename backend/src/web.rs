use axum::{
    extract::Query,
    http::StatusCode,
    response::{Html, Response},
};
use std::collections::HashMap;

pub async fn serve_index() -> Html<String> {
    if let Ok(content) = tokio::fs::read_to_string("../presentation/static/index.html").await {
        Html(content)
    } else {
        Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>QuickTalk Customer Service</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
    <h1>🦀 QuickTalk Customer Service - Pure Rust Edition</h1>
    <p>Welcome to QuickTalk - 纯Rust客服系统</p>
    <p><a href="/admin">管理后台</a> | <a href="/api/health">系统状态</a></p>
    <p>服务器只允许Rust程序 - 这是完全纯Rust实现的客服系统</p>
</body>
</html>
        "#.to_string())
    }
}

pub async fn serve_admin() -> Html<String> {
    if let Ok(content) = tokio::fs::read_to_string("../presentation/static/admin-new.html").await {
        Html(content)
    } else {
        Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>QuickTalk Admin</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; margin: 0; padding: 20px; color: #2c3e50; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; }
        .title { font-size: 32px; color: #667eea; margin-bottom: 10px; }
        .subtitle { font-size: 18px; color: #6c757d; }
        .nav-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 40px; }
        .nav-link { display: block; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 12px; text-align: center; font-weight: 600; transition: transform 0.3s ease; }
        .nav-link:hover { transform: translateY(-4px); }
        .api-list { margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 12px; }
        .api-item { margin: 10px 0; }
        .api-item a { color: #667eea; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">🦀 QuickTalk Admin</h1>
            <p class="subtitle">管理界面 - 纯Rust客服系统</p>
        </div>
        
        <div class="nav-links">
            <a href="/mobile/login" class="nav-link">📱 移动端登录</a>
            <a href="/mobile/dashboard" class="nav-link">📊 移动端仪表板</a>
            <a href="/mobile/admin" class="nav-link">💬 移动端聊天</a>
            <a href="/" class="nav-link">👥 客户界面</a>
        </div>
        
        <div class="api-list">
            <h3>API 端点</h3>
            <div class="api-item"><a href="/api/health">🔍 健康检查</a></div>
            <div class="api-item"><a href="/api/shops">🏪 商店列表</a></div>
            <div class="api-item"><a href="/api/conversations">💬 对话列表</a></div>
            <div class="api-item"><a href="/api/files">📁 文件列表</a></div>
        </div>
    </div>
</body>
</html>
        "#.to_string())
    }
}

pub async fn serve_mobile_admin() -> Html<String> {
    if let Ok(content) = tokio::fs::read_to_string("../presentation/static/admin-mobile.html").await {
        Html(content)
    } else {
        Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>QuickTalk Mobile Admin</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
    <h1>📱 QuickTalk Mobile Admin</h1>
    <p>移动端聊天管理系统加载失败，请检查文件路径</p>
    <p><a href="/mobile/dashboard">返回移动端仪表板</a></p>
    <p><a href="/admin">返回管理后台</a></p>
</body>
</html>
        "#.to_string())
    }
}

pub async fn serve_mobile_dashboard() -> Html<String> {
    if let Ok(content) = tokio::fs::read_to_string("../presentation/static/mobile-dashboard.html").await {
        Html(content)
    } else {
        Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>QuickTalk Mobile Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
    <h1>📱 QuickTalk Mobile Dashboard</h1>
    <p>移动端仪表板加载失败，请检查文件路径</p>
    <p><a href="/admin">返回管理后台</a></p>
</body>
</html>
        "#.to_string())
    }
}

pub async fn serve_mobile_login() -> Html<String> {
    if let Ok(content) = tokio::fs::read_to_string("../presentation/static/mobile-login.html").await {
        Html(content)
    } else {
        Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>QuickTalk Mobile Login</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
    <h1>📱 QuickTalk Mobile Login</h1>
    <p>移动端登录页面加载失败，请检查文件路径</p>
    <p><a href="/admin">返回管理后台</a></p>
</body>
</html>
        "#.to_string())
    }
}

pub async fn serve_embed_service(
    Query(params): Query<HashMap<String, String>>,
) -> Result<Response, StatusCode> {
    let cache_breaker = params.get("v").unwrap_or(&"1".to_string()).clone();
    let js_content = format!(r#"
// QuickTalk客服系统 - 动态服务模块 v2.0.0
// 缓存版本: {}

class QuickTalkService {{
    constructor(config) {{
        this.config = config;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnected = false;
        this.messageQueue = [];
        this.ui = null;
        
        this.init();
    }}
    
    async init() {{
        try {{
            await this.validateConfig();
            await this.createUI();
            await this.connectWebSocket();
            this.bindEvents();
            console.log('✅ QuickTalk服务初始化完成');
        }} catch (error) {{
            console.error('❌ QuickTalk服务初始化失败:', error);
            this.fallbackToBasicMode();
        }}
    }}
    
    async validateConfig() {{
        if (!this.config.shopId) {{
            throw new Error('shopId is required');
        }}
        
        const currentDomain = window.location.hostname;
        if (this.config.security?.domain_whitelist) {{
            const allowed = this.config.security.domain_whitelist.some(domain => 
                currentDomain === domain || 
                currentDomain.endsWith('.' + domain) ||
                currentDomain === 'localhost'
            );
            if (!allowed) {{
                throw new Error(`Domain not authorized: ${{currentDomain}}`);
            }}
        }}
    }}
    
    async createUI() {{
        this.ui = new QuickTalkUI(this.config, this);
        await this.ui.render();
    }}
    
    async connectWebSocket() {{
        if (this.ws) {{
            this.ws.close();
        }}
        
        try {{
            this.ws = new WebSocket(`${{this.config.websocket_url}}?shop_id=${{this.config.shopId}}`);
            
            this.ws.onopen = () => {{
                console.log('🔗 WebSocket连接已建立');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.flushMessageQueue();
                this.ui?.updateConnectionStatus(true);
            }};
            
            this.ws.onmessage = (event) => {{
                this.handleMessage(JSON.parse(event.data));
            }};
            
            this.ws.onclose = () => {{
                console.log('🔌 WebSocket连接已断开');
                this.isConnected = false;
                this.ui?.updateConnectionStatus(false);
                this.scheduleReconnect();
            }};
            
            this.ws.onerror = (error) => {{
                console.error('❌ WebSocket错误:', error);
                this.ui?.showError('连接错误，正在重试...');
            }};
            
        }} catch (error) {{
            console.error('❌ WebSocket连接失败:', error);
            this.scheduleReconnect();
        }}
    }}
    
    scheduleReconnect() {{
        if (this.reconnectAttempts < this.maxReconnectAttempts) {{
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`🔄 ${{delay}}ms后重连 (第${{this.reconnectAttempts}}次尝试)`);
            
            setTimeout(() => {{
                this.connectWebSocket();
            }}, delay);
        }} else {{
            console.error('❌ 达到最大重连次数，切换到降级模式');
            this.fallbackToBasicMode();
        }}
    }}
    
    fallbackToBasicMode() {{
        console.log('🔄 启用基础模式');
        if (this.ui) {{
            this.ui.enableBasicMode();
        }}
    }}
    
    sendMessage(message) {{
        if (this.isConnected && this.ws) {{
            this.ws.send(JSON.stringify(message));
        }} else {{
            this.messageQueue.push(message);
            console.log('📤 消息已加入队列，等待连接');
        }}
    }}
    
    flushMessageQueue() {{
        while (this.messageQueue.length > 0) {{
            const message = this.messageQueue.shift();
            this.sendMessage(message);
        }}
    }}
    
    handleMessage(message) {{
        console.log('📨 收到消息:', message);
        if (this.ui) {{
            this.ui.displayMessage(message);
        }}
    }}
    
    bindEvents() {{
        window.addEventListener('beforeunload', () => {{
            if (this.ws) {{
                this.ws.close();
            }}
        }});
    }}
}}

class QuickTalkUI {{
    constructor(config, service) {{
        this.config = config;
        this.service = service;
        this.isOpen = false;
        this.isMinimized = false;
        this.container = null;
        this.messageContainer = null;
        this.inputElement = null;
    }}
    
    async render() {{
        this.container = document.createElement('div');
        this.container.id = 'quicktalk-widget';
        this.container.innerHTML = `
            <div class="qt-floating-button" onclick="window.QuickTalkInstance.toggleChat()">
                <span class="qt-button-icon">💬</span>
                <span class="qt-button-text">客服咨询</span>
            </div>
            <div class="qt-chat-window" style="display: none;">
                <div class="qt-header">
                    <h3>${{this.config.shop_name || '在线客服'}}</h3>
                    <div class="qt-controls">
                        <button onclick="window.QuickTalkInstance.minimizeChat()" title="最小化">−</button>
                        <button onclick="window.QuickTalkInstance.closeChat()" title="关闭">×</button>
                    </div>
                </div>
                <div class="qt-status">
                    <span class="qt-connection-status">连接中...</span>
                </div>
                <div class="qt-messages"></div>
                <div class="qt-input-area">
                    <input type="text" placeholder="输入消息..." class="qt-message-input">
                    <button class="qt-send-button">发送</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        this.messageContainer = this.container.querySelector('.qt-messages');
        this.inputElement = this.container.querySelector('.qt-message-input');
        this.bindUIEvents();
        this.displaySystemMessage('欢迎使用在线客服！我们将尽快为您服务。');
    }}
    
    bindUIEvents() {{
        this.container.querySelector('.qt-send-button').addEventListener('click', () => {{
            this.sendUserMessage();
        }});
        
        this.inputElement.addEventListener('keypress', (e) => {{
            if (e.key === 'Enter') {{
                this.sendUserMessage();
            }}
        }});
    }}
    
    sendUserMessage() {{
        const text = this.inputElement.value.trim();
        if (!text) return;
        
        this.displayUserMessage(text);
        
        this.service.sendMessage({{
            type: 'customer_message',
            shop_id: this.config.shopId,
            content: text,
            timestamp: new Date().toISOString()
        }});
        
        this.inputElement.value = '';
    }}
    
    toggleChat() {{
        const chatWindow = this.container.querySelector('.qt-chat-window');
        if (this.isOpen) {{
            chatWindow.style.display = 'none';
            this.isOpen = false;
        }} else {{
            chatWindow.style.display = 'block';
            this.isOpen = true;
            this.isMinimized = false;
            this.inputElement.focus();
        }}
    }}
    
    closeChat() {{
        this.toggleChat();
    }}
    
    minimizeChat() {{
        const chatWindow = this.container.querySelector('.qt-chat-window');
        if (this.isMinimized) {{
            chatWindow.classList.remove('minimized');
            this.isMinimized = false;
        }} else {{
            chatWindow.classList.add('minimized');
            this.isMinimized = true;
        }}
    }}
    
    displayMessage(message) {{
        if (message.type === 'agent_message') {{
            this.displayAgentMessage(message.content);
        }} else if (message.type === 'system_message') {{
            this.displaySystemMessage(message.content);
        }}
    }}
    
    displayUserMessage(content) {{
        this.addMessage('user', content);
    }}
    
    displayAgentMessage(content) {{
        this.addMessage('agent', content);
    }}
    
    displaySystemMessage(content) {{
        this.addMessage('system', content);
    }}
    
    addMessage(type, content) {{
        const messageDiv = document.createElement('div');
        messageDiv.className = `qt-message qt-${{type}}`;
        messageDiv.innerHTML = `
            <div class="qt-message-content">${{this.escapeHtml(content)}}</div>
            <div class="qt-message-time">${{new Date().toLocaleTimeString()}}</div>
        `;
        
        this.messageContainer.appendChild(messageDiv);
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }}
    
    updateConnectionStatus(connected) {{
        const statusElement = this.container.querySelector('.qt-connection-status');
        if (connected) {{
            statusElement.textContent = '● 已连接';
            statusElement.style.color = '#28a745';
        }} else {{
            statusElement.textContent = '● 连接中断';
            statusElement.style.color = '#dc3545';
        }}
    }}
    
    showError(message) {{
        this.displaySystemMessage(`错误: ${{message}}`);
    }}
    
    enableBasicMode() {{
        this.displaySystemMessage('当前为基础模式，功能有限。请刷新页面重试。');
    }}
    
    escapeHtml(text) {{
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }}
}}

window.QuickTalkCustomerService = {{
    init: function(config) {{
        fetch(`${{config.serverUrl}}/embed/config/${{config.shopId}}`)
            .then(response => response.json())
            .then(result => {{
                if (result.success && result.data) {{
                    const mergedConfig = {{ ...config, ...result.data }};
                    window.QuickTalkInstance = new QuickTalkService(mergedConfig);
                }} else {{
                    throw new Error(result.message || '配置加载失败');
                }}
            }})
            .catch(error => {{
                console.error('❌ 配置加载失败，使用基础配置:', error);
                window.QuickTalkInstance = new QuickTalkService(config);
            }});
    }}
}};

console.log('📦 QuickTalk Service v2.0.0 已加载');
"#, cache_breaker);

    let response = Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/javascript; charset=utf-8")
        .header("Cache-Control", "public, max-age=300")
        .header("Access-Control-Allow-Origin", "*")
        .body(js_content.into())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(response)
}

pub async fn serve_embed_styles(
    Query(params): Query<HashMap<String, String>>,
) -> Result<Response, StatusCode> {
    let cache_breaker = params.get("v").unwrap_or(&"1".to_string()).clone();
    let css_content = format!(r#"
/* QuickTalk客服系统样式 v2.0.0 - 缓存版本: {} */

#quicktalk-widget {{
    position: fixed;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    z-index: 999999;
    bottom: 20px;
    right: 20px;
}}

.qt-floating-button {{
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 50px;
    padding: 15px 20px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
}}

.qt-floating-button:hover {{
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
}}

.qt-button-icon {{
    font-size: 18px;
}}

.qt-chat-window {{
    position: absolute;
    bottom: 70px;
    right: 0;
    width: 380px;
    height: 500px;
    background: white;
    border-radius: 15px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform-origin: bottom right;
    animation: slideInUp 0.3s ease;
}}

.qt-chat-window.minimized {{
    height: 60px;
}}

.qt-chat-window.minimized .qt-messages,
.qt-chat-window.minimized .qt-input-area,
.qt-chat-window.minimized .qt-status {{
    display: none;
}}

@keyframes slideInUp {{
    from {{
        opacity: 0;
        transform: scale(0.8) translateY(20px);
    }}
    to {{
        opacity: 1;
        transform: scale(1) translateY(0);
    }}
}}

.qt-header {{
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}}

.qt-header h3 {{
    margin: 0;
    font-size: 16px;
    font-weight: 600;
}}

.qt-controls {{
    display: flex;
    gap: 8px;
}}

.qt-controls button {{
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
}}

.qt-controls button:hover {{
    background: rgba(255, 255, 255, 0.3);
}}

.qt-status {{
    background: #f8f9fa;
    padding: 8px 20px;
    border-bottom: 1px solid #e9ecef;
    font-size: 12px;
}}

.qt-connection-status {{
    color: #6c757d;
}}

.qt-messages {{
    flex: 1;
    padding: 15px;
    overflow-y: auto;
    background: #fafbfc;
}}

.qt-message {{
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
}}

.qt-message-content {{
    padding: 10px 15px;
    border-radius: 18px;
    max-width: 85%;
    word-wrap: break-word;
    line-height: 1.4;
}}

.qt-message-time {{
    font-size: 11px;
    color: #999;
    margin-top: 5px;
}}

.qt-user {{
    align-items: flex-end;
}}

.qt-user .qt-message-content {{
    background: #667eea;
    color: white;
    align-self: flex-end;
}}

.qt-user .qt-message-time {{
    text-align: right;
}}

.qt-agent {{
    align-items: flex-start;
}}

.qt-agent .qt-message-content {{
    background: white;
    color: #333;
    border: 1px solid #e9ecef;
    align-self: flex-start;
}}

.qt-agent .qt-message-time {{
    text-align: left;
}}

.qt-system {{
    align-items: center;
}}

.qt-system .qt-message-content {{
    background: #f0f0f0;
    color: #666;
    font-size: 13px;
    text-align: center;
    align-self: center;
}}

.qt-input-area {{
    padding: 15px;
    border-top: 1px solid #e9ecef;
    display: flex;
    gap: 10px;
    background: white;
}}

.qt-message-input {{
    flex: 1;
    border: 1px solid #e9ecef;
    border-radius: 20px;
    padding: 10px 15px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s ease;
}}

.qt-message-input:focus {{
    border-color: #667eea;
}}

.qt-send-button {{
    background: #667eea;
    color: white;
    border: none;
    border-radius: 20px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
}}

.qt-send-button:hover {{
    background: #5a6fd8;
}}

@media (max-width: 480px) {{
    #quicktalk-widget {{
        bottom: 10px;
        right: 10px;
        left: 10px;
    }}
    
    .qt-chat-window {{
        width: 100%;
        height: 60vh;
        position: fixed;
        bottom: 80px;
        right: 10px;
        left: 10px;
    }}
    
    .qt-floating-button {{
        width: 100%;
        border-radius: 25px;
        justify-content: center;
    }}
}}

.qt-messages::-webkit-scrollbar {{
    width: 6px;
}}

.qt-messages::-webkit-scrollbar-track {{
    background: #f1f1f1;
    border-radius: 3px;
}}

.qt-messages::-webkit-scrollbar-thumb {{
    background: #c1c1c1;
    border-radius: 3px;
}}

.qt-messages::-webkit-scrollbar-thumb:hover {{
    background: #a8a8a8;
}}
"#, cache_breaker);

    let response = Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/css; charset=utf-8")
        .header("Cache-Control", "public, max-age=300")
        .header("Access-Control-Allow-Origin", "*")
        .body(css_content.into())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(response)
}
