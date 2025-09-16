/**
 * AI聊天机器人组件
 * 
 * 提供智能对话界面和交互功能
 * 
 * @author QuickTalk Team
 * @version 4.0.0
 */

class AIChatBot {
    constructor(options = {}) {
        this.shopId = options.shopId || 'default';
        this.containerId = options.containerId || 'ai-chatbot';
        this.apiEndpoint = options.apiEndpoint || '/api/ai';
        this.websocket = null;
        this.conversationId = this.generateConversationId();
        this.isConnected = false;
        this.messageHistory = [];
        this.currentContext = {};
        this.typingIndicator = null;
        this.autoReplyEnabled = options.autoReply !== false;
        this.humanHandoffThreshold = options.humanHandoffThreshold || 0.3;
        
        console.log('🤖 AI聊天机器人初始化', { shopId: this.shopId });
        this.initialize();
    }

    /**
     * 初始化聊天机器人
     */
    async initialize() {
        try {
            // 创建UI界面
            this.createChatInterface();
            
            // 连接WebSocket
            await this.connectWebSocket();
            
            // 绑定事件
            this.bindEvents();
            
            // 发送欢迎消息
            await this.sendWelcomeMessage();
            
            console.log('✅ AI聊天机器人初始化完成');
            
        } catch (error) {
            console.error('❌ AI聊天机器人初始化失败:', error);
            this.showError('聊天机器人初始化失败，请刷新页面重试。');
        }
    }

    /**
     * 创建聊天界面
     */
    createChatInterface() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            throw new Error(`容器元素 #${this.containerId} 不存在`);
        }

        container.innerHTML = `
            <div class="ai-chatbot-container">
                <!-- 聊天头部 -->
                <div class="ai-chatbot-header">
                    <div class="ai-bot-avatar">
                        <div class="bot-status-indicator" id="botStatusIndicator"></div>
                        🤖
                    </div>
                    <div class="ai-bot-info">
                        <div class="ai-bot-name">AI智能助手</div>
                        <div class="ai-bot-status" id="botStatusText">正在连接...</div>
                    </div>
                    <div class="ai-chatbot-actions">
                        <button class="btn-icon" id="aiSettingsBtn" title="设置">⚙️</button>
                        <button class="btn-icon" id="aiMinimizeBtn" title="最小化">➖</button>
                        <button class="btn-icon" id="aiCloseBtn" title="关闭">✕</button>
                    </div>
                </div>

                <!-- 聊天消息区域 -->
                <div class="ai-chatbot-messages" id="aiChatMessages">
                    <div class="ai-message-container">
                        <div class="ai-system-message">
                            🤖 AI智能客服已启动，我将为您提供专业的服务！
                        </div>
                    </div>
                </div>

                <!-- 智能建议区域 -->
                <div class="ai-suggestions-container" id="aiSuggestions" style="display: none;">
                    <div class="ai-suggestions-title">💡 智能建议：</div>
                    <div class="ai-suggestions-list" id="aiSuggestionsList"></div>
                </div>

                <!-- 快速回复区域 -->
                <div class="ai-quick-replies" id="aiQuickReplies">
                    <div class="ai-quick-reply-item" data-text="查看营业时间">🕐 营业时间</div>
                    <div class="ai-quick-reply-item" data-text="联系方式">📞 联系方式</div>
                    <div class="ai-quick-reply-item" data-text="退换货政策">🔄 退换货</div>
                    <div class="ai-quick-reply-item" data-text="转人工客服">👨‍💼 人工客服</div>
                </div>

                <!-- 输入区域 -->
                <div class="ai-chatbot-input">
                    <div class="ai-input-container">
                        <textarea 
                            id="aiMessageInput" 
                            placeholder="请输入您的问题..."
                            rows="1"
                            maxlength="500"
                        ></textarea>
                        <div class="ai-input-actions">
                            <button class="btn-icon" id="aiEmojiBtn" title="表情">😊</button>
                            <button class="btn-icon" id="aiVoiceBtn" title="语音">🎤</button>
                            <button class="btn-primary" id="aiSendBtn" title="发送">
                                <span class="btn-text">发送</span>
                                <span class="btn-icon">➤</span>
                            </button>
                        </div>
                    </div>
                    <div class="ai-input-status">
                        <span class="ai-char-count" id="aiCharCount">0/500</span>
                        <span class="ai-typing-status" id="aiTypingStatus"></span>
                    </div>
                </div>

                <!-- AI状态指示器 -->
                <div class="ai-status-bar" id="aiStatusBar">
                    <div class="ai-status-item">
                        <span class="ai-status-label">智能分析:</span>
                        <span class="ai-status-value" id="aiAnalysisStatus">待机中</span>
                    </div>
                    <div class="ai-status-item">
                        <span class="ai-status-label">置信度:</span>
                        <span class="ai-status-value" id="aiConfidenceScore">--</span>
                    </div>
                    <div class="ai-status-item">
                        <span class="ai-status-label">情感:</span>
                        <span class="ai-status-value" id="aiSentimentScore">中性</span>
                    </div>
                </div>
            </div>

            <!-- AI设置面板 -->
            <div class="ai-settings-panel" id="aiSettingsPanel" style="display: none;">
                <div class="ai-settings-header">
                    <h3>🤖 AI设置</h3>
                    <button class="btn-close" id="aiSettingsCloseBtn">✕</button>
                </div>
                <div class="ai-settings-content">
                    <div class="ai-setting-group">
                        <label class="ai-setting-label">
                            <input type="checkbox" id="autoReplyToggle" checked>
                            启用自动回复
                        </label>
                    </div>
                    <div class="ai-setting-group">
                        <label class="ai-setting-label">
                            <input type="checkbox" id="smartSuggestionsToggle" checked>
                            智能建议
                        </label>
                    </div>
                    <div class="ai-setting-group">
                        <label class="ai-setting-label">
                            <input type="checkbox" id="sentimentAnalysisToggle" checked>
                            情感分析
                        </label>
                    </div>
                    <div class="ai-setting-group">
                        <label class="ai-setting-label">响应延迟 (毫秒):</label>
                        <input type="range" id="responseDelaySlider" min="0" max="3000" value="800" step="100">
                        <span id="responseDelayValue">800ms</span>
                    </div>
                    <div class="ai-setting-group">
                        <label class="ai-setting-label">转人工阈值:</label>
                        <input type="range" id="handoffThresholdSlider" min="0" max="1" value="0.3" step="0.1">
                        <span id="handoffThresholdValue">0.3</span>
                    </div>
                </div>
            </div>
        `;

        // 添加样式
        this.addChatBotStyles();
    }

    /**
     * 添加聊天机器人样式
     */
    addChatBotStyles() {
        if (document.getElementById('ai-chatbot-styles')) return;

        const style = document.createElement('style');
        style.id = 'ai-chatbot-styles';
        style.textContent = `
            .ai-chatbot-container {
                width: 100%;
                height: 600px;
                background: #ffffff;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .ai-chatbot-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                border-radius: 12px 12px 0 0;
            }

            .ai-bot-avatar {
                width: 40px;
                height: 40px;
                background: rgba(255,255,255,0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                position: relative;
            }

            .bot-status-indicator {
                position: absolute;
                top: -2px;
                right: -2px;
                width: 12px;
                height: 12px;
                background: #4ade80;
                border: 2px solid white;
                border-radius: 50%;
                animation: pulse 2s infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            .ai-bot-info {
                flex: 1;
            }

            .ai-bot-name {
                font-weight: 600;
                font-size: 16px;
                margin-bottom: 2px;
            }

            .ai-bot-status {
                font-size: 12px;
                opacity: 0.9;
            }

            .ai-chatbot-actions {
                display: flex;
                gap: 8px;
            }

            .ai-chatbot-messages {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                background: #f8fafc;
            }

            .ai-message-container {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .ai-message {
                max-width: 80%;
                padding: 12px 16px;
                border-radius: 18px;
                word-wrap: break-word;
                position: relative;
                animation: messageSlideIn 0.3s ease-out;
            }

            @keyframes messageSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .ai-message.user {
                align-self: flex-end;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .ai-message.bot {
                align-self: flex-start;
                background: white;
                border: 1px solid #e2e8f0;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }

            .ai-message.system {
                align-self: center;
                background: #f1f5f9;
                color: #64748b;
                font-size: 14px;
                text-align: center;
                border-radius: 12px;
            }

            .ai-system-message {
                background: #eff6ff;
                color: #1d4ed8;
                padding: 12px;
                border-radius: 8px;
                text-align: center;
                font-size: 14px;
                border-left: 4px solid #3b82f6;
            }

            .ai-message-meta {
                font-size: 11px;
                opacity: 0.7;
                margin-top: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .ai-confidence-badge {
                background: rgba(0,0,0,0.1);
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 10px;
            }

            .ai-typing-indicator {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 16px;
                background: white;
                border-radius: 18px;
                border: 1px solid #e2e8f0;
                max-width: 80px;
                margin-bottom: 12px;
            }

            .ai-typing-dots {
                display: flex;
                gap: 4px;
            }

            .ai-typing-dot {
                width: 6px;
                height: 6px;
                background: #94a3b8;
                border-radius: 50%;
                animation: typingPulse 1.4s infinite;
            }

            .ai-typing-dot:nth-child(2) { animation-delay: 0.2s; }
            .ai-typing-dot:nth-child(3) { animation-delay: 0.4s; }

            @keyframes typingPulse {
                0%, 60%, 100% { opacity: 0.3; }
                30% { opacity: 1; }
            }

            .ai-suggestions-container {
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 12px;
                margin: 0 16px;
            }

            .ai-suggestions-title {
                font-weight: 600;
                font-size: 14px;
                color: #92400e;
                margin-bottom: 8px;
            }

            .ai-suggestions-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .ai-suggestion-item {
                background: white;
                border: 1px solid #f59e0b;
                color: #92400e;
                padding: 6px 12px;
                border-radius: 16px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .ai-suggestion-item:hover {
                background: #f59e0b;
                color: white;
            }

            .ai-quick-replies {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                padding: 12px 16px;
                background: white;
                border-top: 1px solid #e2e8f0;
            }

            .ai-quick-reply-item {
                background: #f1f5f9;
                border: 1px solid #cbd5e1;
                color: #475569;
                padding: 8px 12px;
                border-radius: 16px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
            }

            .ai-quick-reply-item:hover {
                background: #667eea;
                color: white;
                border-color: #667eea;
            }

            .ai-chatbot-input {
                background: white;
                border-top: 1px solid #e2e8f0;
                padding: 16px;
            }

            .ai-input-container {
                display: flex;
                align-items: flex-end;
                gap: 12px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 24px;
                padding: 8px;
                transition: all 0.2s;
            }

            .ai-input-container:focus-within {
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }

            #aiMessageInput {
                flex: 1;
                border: none;
                outline: none;
                background: transparent;
                resize: none;
                font-size: 14px;
                line-height: 1.5;
                padding: 8px 12px;
                min-height: 20px;
                max-height: 100px;
                font-family: inherit;
            }

            .ai-input-actions {
                display: flex;
                gap: 4px;
                align-items: center;
            }

            .ai-input-status {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 8px;
                font-size: 12px;
                color: #64748b;
            }

            .ai-status-bar {
                background: #f8fafc;
                border-top: 1px solid #e2e8f0;
                padding: 8px 16px;
                display: flex;
                justify-content: space-between;
                font-size: 12px;
            }

            .ai-status-item {
                display: flex;
                gap: 4px;
            }

            .ai-status-label {
                color: #64748b;
            }

            .ai-status-value {
                color: #1e293b;
                font-weight: 500;
            }

            .ai-settings-panel {
                position: absolute;
                top: 60px;
                right: 16px;
                width: 280px;
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.15);
                z-index: 1000;
            }

            .ai-settings-header {
                background: #f8fafc;
                padding: 16px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .ai-settings-content {
                padding: 16px;
            }

            .ai-setting-group {
                margin-bottom: 16px;
            }

            .ai-setting-label {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                color: #374151;
                cursor: pointer;
            }

            .btn-icon {
                background: transparent;
                border: none;
                padding: 8px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            }

            .btn-icon:hover {
                background: rgba(255,255,255,0.2);
            }

            .btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 20px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 4px;
                transition: all 0.2s;
            }

            .btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }

            .btn-primary:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }

            .btn-close {
                background: transparent;
                border: none;
                font-size: 16px;
                cursor: pointer;
                color: #64748b;
                padding: 4px;
            }

            .btn-close:hover {
                color: #dc2626;
            }

            /* 响应式设计 */
            @media (max-width: 768px) {
                .ai-chatbot-container {
                    height: 100vh;
                    border-radius: 0;
                }

                .ai-chatbot-header {
                    border-radius: 0;
                }

                .ai-quick-replies {
                    flex-direction: column;
                }

                .ai-quick-reply-item {
                    text-align: center;
                }

                .ai-settings-panel {
                    position: fixed;
                    top: 0;
                    right: 0;
                    left: 0;
                    bottom: 0;
                    width: 100%;
                    border-radius: 0;
                }
            }

            /* 深色主题支持 */
            @media (prefers-color-scheme: dark) {
                .ai-chatbot-container {
                    background: #1e293b;
                    color: #f1f5f9;
                }

                .ai-chatbot-messages {
                    background: #0f172a;
                }

                .ai-message.bot {
                    background: #334155;
                    border-color: #475569;
                }

                .ai-system-message {
                    background: #1e3a8a;
                    color: #93c5fd;
                    border-color: #3b82f6;
                }

                .ai-input-container {
                    background: #334155;
                    border-color: #475569;
                }

                .ai-status-bar {
                    background: #1e293b;
                    border-color: #475569;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * 连接WebSocket
     */
    async connectWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('🔗 AI聊天机器人WebSocket连接成功');
                this.isConnected = true;
                this.updateConnectionStatus('已连接', true);
                
                // 发送初始化消息
                this.sendWebSocketMessage({
                    type: 'ai_init',
                    conversationId: this.conversationId,
                    shopId: this.shopId
                });
            };

            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('❌ WebSocket消息解析失败:', error);
                }
            };

            this.websocket.onclose = () => {
                console.log('🔌 AI聊天机器人WebSocket连接断开');
                this.isConnected = false;
                this.updateConnectionStatus('连接断开', false);
                
                // 尝试重连
                setTimeout(() => {
                    if (!this.isConnected) {
                        this.connectWebSocket();
                    }
                }, 3000);
            };

            this.websocket.onerror = (error) => {
                console.error('❌ AI聊天机器人WebSocket错误:', error);
                this.updateConnectionStatus('连接错误', false);
            };

        } catch (error) {
            console.error('❌ WebSocket连接失败:', error);
            this.updateConnectionStatus('连接失败', false);
        }
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        const sendBtn = document.getElementById('aiSendBtn');
        const messageInput = document.getElementById('aiMessageInput');
        const settingsBtn = document.getElementById('aiSettingsBtn');
        const closeBtn = document.getElementById('aiCloseBtn');
        const quickReplies = document.querySelectorAll('.ai-quick-reply-item');

        // 发送消息
        sendBtn?.addEventListener('click', () => this.handleSendMessage());
        
        // 输入框事件
        messageInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        messageInput?.addEventListener('input', (e) => {
            this.updateCharCount(e.target.value.length);
            this.autoResizeTextarea(e.target);
        });

        // 快速回复
        quickReplies.forEach(item => {
            item.addEventListener('click', () => {
                const text = item.getAttribute('data-text');
                if (text) {
                    document.getElementById('aiMessageInput').value = text;
                    this.handleSendMessage();
                }
            });
        });

        // 设置面板
        settingsBtn?.addEventListener('click', () => this.toggleSettingsPanel());
        
        // 关闭按钮
        closeBtn?.addEventListener('click', () => this.closeChatBot());

        // 设置面板绑定
        this.bindSettingsEvents();
    }

    /**
     * 绑定设置面板事件
     */
    bindSettingsEvents() {
        const settingsCloseBtn = document.getElementById('aiSettingsCloseBtn');
        const autoReplyToggle = document.getElementById('autoReplyToggle');
        const responseDelaySlider = document.getElementById('responseDelaySlider');
        const handoffThresholdSlider = document.getElementById('handoffThresholdSlider');

        settingsCloseBtn?.addEventListener('click', () => this.toggleSettingsPanel());

        autoReplyToggle?.addEventListener('change', (e) => {
            this.autoReplyEnabled = e.target.checked;
            console.log('🤖 自动回复:', this.autoReplyEnabled ? '启用' : '禁用');
        });

        responseDelaySlider?.addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('responseDelayValue').textContent = `${value}ms`;
        });

        handoffThresholdSlider?.addEventListener('input', (e) => {
            const value = e.target.value;
            this.humanHandoffThreshold = parseFloat(value);
            document.getElementById('handoffThresholdValue').textContent = value;
        });
    }

    /**
     * 处理发送消息
     */
    async handleSendMessage() {
        const messageInput = document.getElementById('aiMessageInput');
        const message = messageInput?.value.trim();

        if (!message) return;

        try {
            // 清空输入框
            messageInput.value = '';
            this.updateCharCount(0);
            this.autoResizeTextarea(messageInput);

            // 显示用户消息
            this.displayMessage(message, 'user');

            // 显示AI思考指示器
            this.showTypingIndicator();

            // 发送到AI处理
            await this.sendToAI(message);

        } catch (error) {
            console.error('❌ 发送消息失败:', error);
            this.hideTypingIndicator();
            this.displayMessage('抱歉，消息发送失败，请稍后重试。', 'system');
        }
    }

    /**
     * 发送消息到AI
     * @param {string} message - 用户消息
     */
    async sendToAI(message) {
        try {
            // 更新状态
            this.updateAIStatus('分析中...', '--', '分析中');

            // 发送WebSocket消息
            if (this.isConnected) {
                this.sendWebSocketMessage({
                    type: 'ai_message',
                    conversationId: this.conversationId,
                    shopId: this.shopId,
                    message: message,
                    timestamp: new Date().toISOString()
                });
            } else {
                // 备用HTTP API调用
                await this.sendViaHTTP(message);
            }

        } catch (error) {
            console.error('❌ AI处理失败:', error);
            this.handleAIError(error);
        }
    }

    /**
     * 通过HTTP API发送
     * @param {string} message - 用户消息
     */
    async sendViaHTTP(message) {
        try {
            const response = await fetch(`${this.apiEndpoint}/process`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    conversationId: this.conversationId,
                    shopId: this.shopId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            this.handleAIResponse(result);

        } catch (error) {
            console.error('❌ HTTP API调用失败:', error);
            throw error;
        }
    }

    /**
     * 处理WebSocket消息
     * @param {Object} data - 消息数据
     */
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'ai_response':
                this.handleAIResponse(data);
                break;
            case 'ai_suggestions':
                this.showSuggestions(data.suggestions);
                break;
            case 'ai_context_update':
                this.updateContext(data.context);
                break;
            case 'ai_error':
                this.handleAIError(data.error);
                break;
            default:
                console.log('🤖 未知WebSocket消息类型:', data.type);
        }
    }

    /**
     * 处理AI回复
     * @param {Object} result - AI回复结果
     */
    handleAIResponse(result) {
        try {
            this.hideTypingIndicator();

            if (result.success && result.response) {
                const { response, intent, sentiment, confidence, shouldEscalate } = result;

                // 显示AI回复
                this.displayMessage(response.content, 'bot', {
                    confidence: confidence,
                    intent: intent?.name,
                    sentiment: sentiment?.sentiment_label
                });

                // 更新AI状态
                this.updateAIStatus(
                    intent?.name || '未知',
                    confidence?.toFixed(2) || '--',
                    sentiment?.sentiment_label || '中性'
                );

                // 检查是否需要转人工
                if (shouldEscalate) {
                    this.suggestHumanHandoff(sentiment);
                }

                // 显示智能建议
                if (result.suggestions) {
                    this.showSuggestions(result.suggestions);
                }

            } else {
                this.displayMessage('抱歉，我遇到了一些问题，请稍后重试或联系人工客服。', 'system');
            }

        } catch (error) {
            console.error('❌ 处理AI回复失败:', error);
            this.handleAIError(error);
        }
    }

    /**
     * 显示消息
     * @param {string} content - 消息内容
     * @param {string} type - 消息类型 (user/bot/system)
     * @param {Object} meta - 元数据
     */
    displayMessage(content, type = 'bot', meta = {}) {
        const messagesContainer = document.getElementById('aiChatMessages');
        const messageContainer = messagesContainer?.querySelector('.ai-message-container');
        
        if (!messageContainer) return;

        const messageElement = document.createElement('div');
        messageElement.className = `ai-message ${type}`;
        
        // 消息内容
        const contentElement = document.createElement('div');
        contentElement.className = 'ai-message-content';
        contentElement.textContent = content;
        messageElement.appendChild(contentElement);

        // 元数据 (仅对bot消息显示)
        if (type === 'bot' && (meta.confidence || meta.intent || meta.sentiment)) {
            const metaElement = document.createElement('div');
            metaElement.className = 'ai-message-meta';
            
            let metaText = new Date().toLocaleTimeString();
            if (meta.confidence) {
                metaText += ` • 置信度: ${(meta.confidence * 100).toFixed(0)}%`;
            }
            if (meta.intent) {
                metaText += ` • 意图: ${meta.intent}`;
            }
            
            metaElement.textContent = metaText;
            messageElement.appendChild(metaElement);

            if (meta.confidence) {
                const badge = document.createElement('span');
                badge.className = 'ai-confidence-badge';
                badge.textContent = `${(meta.confidence * 100).toFixed(0)}%`;
                metaElement.appendChild(badge);
            }
        }

        messageContainer.appendChild(messageElement);
        
        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 添加到历史记录
        this.messageHistory.push({
            content,
            type,
            meta,
            timestamp: new Date()
        });
    }

    /**
     * 显示AI思考指示器
     */
    showTypingIndicator() {
        if (this.typingIndicator) return;

        const messagesContainer = document.getElementById('aiChatMessages');
        const messageContainer = messagesContainer?.querySelector('.ai-message-container');
        
        if (!messageContainer) return;

        this.typingIndicator = document.createElement('div');
        this.typingIndicator.className = 'ai-typing-indicator';
        this.typingIndicator.innerHTML = `
            <div class="ai-typing-dots">
                <div class="ai-typing-dot"></div>
                <div class="ai-typing-dot"></div>
                <div class="ai-typing-dot"></div>
            </div>
            <span>AI正在思考...</span>
        `;

        messageContainer.appendChild(this.typingIndicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * 隐藏AI思考指示器
     */
    hideTypingIndicator() {
        if (this.typingIndicator) {
            this.typingIndicator.remove();
            this.typingIndicator = null;
        }
    }

    /**
     * 显示智能建议
     * @param {Array} suggestions - 建议列表
     */
    showSuggestions(suggestions) {
        if (!suggestions || suggestions.length === 0) return;

        const suggestionsContainer = document.getElementById('aiSuggestions');
        const suggestionsList = document.getElementById('aiSuggestionsList');
        
        if (!suggestionsContainer || !suggestionsList) return;

        suggestionsList.innerHTML = '';
        
        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'ai-suggestion-item';
            item.textContent = suggestion.text || suggestion;
            item.addEventListener('click', () => {
                document.getElementById('aiMessageInput').value = suggestion.text || suggestion;
                this.handleSendMessage();
                suggestionsContainer.style.display = 'none';
            });
            suggestionsList.appendChild(item);
        });

        suggestionsContainer.style.display = 'block';

        // 自动隐藏
        setTimeout(() => {
            suggestionsContainer.style.display = 'none';
        }, 10000);
    }

    /**
     * 建议转人工客服
     * @param {Object} sentiment - 情感分析结果
     */
    suggestHumanHandoff(sentiment) {
        const urgencyText = sentiment.urgency_level >= 4 ? '紧急' : '重要';
        this.displayMessage(
            `检测到${urgencyText}情况，建议转接人工客服获得更好的帮助。是否需要转接？`,
            'system'
        );

        // 显示转接按钮
        this.showHandoffButton();
    }

    /**
     * 显示转接按钮
     */
    showHandoffButton() {
        const quickRepliesContainer = document.getElementById('aiQuickReplies');
        if (!quickRepliesContainer) return;

        // 移除现有的转接按钮
        const existingButton = quickRepliesContainer.querySelector('.ai-handoff-button');
        if (existingButton) {
            existingButton.remove();
        }

        const handoffButton = document.createElement('div');
        handoffButton.className = 'ai-quick-reply-item ai-handoff-button';
        handoffButton.style.background = '#dc2626';
        handoffButton.style.color = 'white';
        handoffButton.style.borderColor = '#dc2626';
        handoffButton.textContent = '🆘 转接人工客服';
        
        handoffButton.addEventListener('click', () => {
            this.initiateHumanHandoff();
        });

        quickRepliesContainer.insertBefore(handoffButton, quickRepliesContainer.firstChild);
    }

    /**
     * 启动人工转接
     */
    initiateHumanHandoff() {
        this.displayMessage('正在为您转接人工客服，请稍候...', 'system');
        
        // 发送转接请求
        if (this.isConnected) {
            this.sendWebSocketMessage({
                type: 'request_human_handoff',
                conversationId: this.conversationId,
                shopId: this.shopId,
                reason: 'ai_escalation',
                context: this.currentContext
            });
        }

        // 移除转接按钮
        const handoffButton = document.querySelector('.ai-handoff-button');
        if (handoffButton) {
            handoffButton.remove();
        }
    }

    /**
     * 更新连接状态
     * @param {string} status - 状态文本
     * @param {boolean} connected - 是否连接
     */
    updateConnectionStatus(status, connected) {
        const statusText = document.getElementById('botStatusText');
        const statusIndicator = document.getElementById('botStatusIndicator');
        
        if (statusText) {
            statusText.textContent = status;
        }
        
        if (statusIndicator) {
            statusIndicator.style.background = connected ? '#4ade80' : '#ef4444';
        }
    }

    /**
     * 更新AI状态
     * @param {string} analysis - 分析状态
     * @param {string} confidence - 置信度
     * @param {string} sentiment - 情感状态
     */
    updateAIStatus(analysis, confidence, sentiment) {
        const analysisElement = document.getElementById('aiAnalysisStatus');
        const confidenceElement = document.getElementById('aiConfidenceScore');
        const sentimentElement = document.getElementById('aiSentimentScore');

        if (analysisElement) analysisElement.textContent = analysis;
        if (confidenceElement) confidenceElement.textContent = confidence;
        if (sentimentElement) {
            sentimentElement.textContent = sentiment;
            // 根据情感设置颜色
            sentimentElement.style.color = this.getSentimentColor(sentiment);
        }
    }

    /**
     * 获取情感颜色
     * @param {string} sentiment - 情感标签
     * @returns {string} 颜色代码
     */
    getSentimentColor(sentiment) {
        switch (sentiment) {
            case 'very_positive':
            case 'positive':
                return '#059669';
            case 'very_negative':
            case 'negative':
                return '#dc2626';
            default:
                return '#64748b';
        }
    }

    /**
     * 更新字符计数
     * @param {number} count - 字符数
     */
    updateCharCount(count) {
        const charCountElement = document.getElementById('aiCharCount');
        if (charCountElement) {
            charCountElement.textContent = `${count}/500`;
            charCountElement.style.color = count > 450 ? '#dc2626' : '#64748b';
        }
    }

    /**
     * 自动调整文本框高度
     * @param {HTMLElement} textarea - 文本框元素
     */
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    }

    /**
     * 发送WebSocket消息
     * @param {Object} data - 消息数据
     */
    sendWebSocketMessage(data) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(data));
        }
    }

    /**
     * 发送欢迎消息
     */
    async sendWelcomeMessage() {
        setTimeout(() => {
            this.displayMessage(
                '您好！我是AI智能客服助手，很高兴为您服务！\n\n我可以帮助您：\n• 回答常见问题\n• 提供产品信息\n• 处理售后咨询\n• 解决技术问题\n\n请输入您的问题，或点击下方快速回复开始对话。',
                'bot',
                { confidence: 1.0, intent: 'greeting' }
            );
        }, 500);
    }

    /**
     * 切换设置面板
     */
    toggleSettingsPanel() {
        const panel = document.getElementById('aiSettingsPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }

    /**
     * 关闭聊天机器人
     */
    closeChatBot() {
        if (confirm('确定要关闭AI聊天机器人吗？')) {
            // 断开WebSocket连接
            if (this.websocket) {
                this.websocket.close();
            }
            
            // 隐藏容器
            const container = document.getElementById(this.containerId);
            if (container) {
                container.style.display = 'none';
            }
        }
    }

    /**
     * 处理AI错误
     * @param {Error|string} error - 错误信息
     */
    handleAIError(error) {
        console.error('❌ AI处理错误:', error);
        this.hideTypingIndicator();
        this.updateAIStatus('错误', '--', '未知');
        this.displayMessage(
            '抱歉，AI服务暂时不可用。您可以稍后重试，或直接联系人工客服。',
            'system'
        );
    }

    /**
     * 更新上下文
     * @param {Object} context - 上下文数据
     */
    updateContext(context) {
        this.currentContext = { ...this.currentContext, ...context };
    }

    /**
     * 生成对话ID
     * @returns {string} 对话ID
     */
    generateConversationId() {
        return 'ai_conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 获取消息历史
     * @returns {Array} 消息历史
     */
    getMessageHistory() {
        return this.messageHistory;
    }

    /**
     * 清空消息历史
     */
    clearMessageHistory() {
        this.messageHistory = [];
        const messageContainer = document.querySelector('.ai-message-container');
        if (messageContainer) {
            messageContainer.innerHTML = '<div class="ai-system-message">🤖 AI智能客服已启动，我将为您提供专业的服务！</div>';
        }
    }

    /**
     * 导出对话记录
     * @returns {string} 对话记录JSON
     */
    exportConversation() {
        const data = {
            conversationId: this.conversationId,
            shopId: this.shopId,
            messages: this.messageHistory,
            context: this.currentContext,
            exportTime: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIChatBot;
}

// 全局注册
if (typeof window !== 'undefined') {
    window.AIChatBot = AIChatBot;
}
