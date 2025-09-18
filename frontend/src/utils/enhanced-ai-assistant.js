/**
 * 增强版AI智能客服助手 - 前端组件
 * 
 * 功能特性：
 * - 智能回复建议UI
 * - 实时情感分析显示
 * - 意图识别结果展示
 * - 关键词高亮显示
 * - 自动回复配置界面
 * - 知识库管理
 * - AI助手设置面板
 * - 实时学习反馈
 * 
 * @author QuickTalk Team
 * @version 5.0.0
 */

class EnhancedAIAssistantUI {
    constructor(options = {}) {
        this.options = {
            containerId: 'ai-assistant-container',
            enableRealTime: true,
            showAnalysis: true,
            maxSuggestions: 5,
            autoRefresh: 10000, // 10秒自动刷新
            ...options
        };
        
        this.isEnabled = false;
        this.currentConversationId = null;
        this.suggestionCache = new Map();
        this.analysisResults = {};
        this.refreshInterval = null;
        
        console.log('🤖 增强版AI助手UI初始化');
        this.init();
    }

    /**
     * 初始化AI助手UI
     */
    async init() {
        try {
            // 创建UI界面
            this.createAIInterface();
            
            // 绑定事件监听器
            this.bindEventListeners();
            
            // 启动实时功能
            if (this.options.enableRealTime) {
                this.startRealTimeFeatures();
            }
            
            console.log('✅ AI助手UI初始化完成');
            
        } catch (error) {
            console.error('❌ AI助手UI初始化失败:', error);
            this.showError('AI助手初始化失败');
        }
    }

    /**
     * 创建AI助手界面
     */
    createAIInterface() {
        const container = document.getElementById(this.options.containerId) || document.body;
        
        const aiInterface = document.createElement('div');
        aiInterface.className = 'ai-assistant-interface';
        aiInterface.innerHTML = `
            <div class="ai-assistant-header">
                <div class="ai-assistant-title">
                    <i class="fas fa-robot"></i>
                    <span>AI智能助手</span>
                    <div class="ai-status-indicator" id="ai-status">
                        <span class="status-dot"></span>
                        <span class="status-text">就绪</span>
                    </div>
                </div>
                <div class="ai-assistant-controls">
                    <button class="ai-toggle-btn" id="ai-toggle">
                        <i class="fas fa-power-off"></i>
                    </button>
                    <button class="ai-settings-btn" id="ai-settings">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
            </div>
            
            <div class="ai-assistant-content" id="ai-content">
                <!-- 回复建议面板 -->
                <div class="ai-panel reply-suggestions-panel">
                    <div class="panel-header">
                        <h4><i class="fas fa-lightbulb"></i> 智能回复建议</h4>
                        <button class="refresh-btn" id="refresh-suggestions">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                    <div class="panel-content">
                        <div class="suggestions-container" id="suggestions-container">
                            <div class="no-suggestions">
                                <i class="fas fa-comment-dots"></i>
                                <p>选择对话以获取智能回复建议</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 消息分析面板 -->
                <div class="ai-panel message-analysis-panel" style="display: ${this.options.showAnalysis ? 'block' : 'none'};">
                    <div class="panel-header">
                        <h4><i class="fas fa-analytics"></i> 消息分析</h4>
                        <button class="toggle-analysis-btn" id="toggle-analysis">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                    <div class="panel-content">
                        <div class="analysis-container" id="analysis-container">
                            <!-- 意图识别 -->
                            <div class="analysis-item">
                                <label>意图识别:</label>
                                <div class="intent-result" id="intent-result">
                                    <span class="intent-label">未知</span>
                                    <span class="confidence-score">0%</span>
                                </div>
                            </div>
                            
                            <!-- 情感分析 -->
                            <div class="analysis-item">
                                <label>情感分析:</label>
                                <div class="sentiment-result" id="sentiment-result">
                                    <span class="sentiment-label neutral">中性</span>
                                    <div class="sentiment-meter">
                                        <div class="sentiment-bar" id="sentiment-bar"></div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 关键词 -->
                            <div class="analysis-item">
                                <label>关键词:</label>
                                <div class="keywords-container" id="keywords-container">
                                    <span class="no-keywords">暂无关键词</span>
                                </div>
                            </div>
                            
                            <!-- 实体识别 -->
                            <div class="analysis-item">
                                <label>实体识别:</label>
                                <div class="entities-container" id="entities-container">
                                    <span class="no-entities">暂无实体</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 自动回复面板 -->
                <div class="ai-panel auto-reply-panel">
                    <div class="panel-header">
                        <h4><i class="fas fa-magic"></i> 自动回复</h4>
                        <div class="auto-reply-toggle">
                            <input type="checkbox" id="auto-reply-enabled" class="toggle-switch">
                            <label for="auto-reply-enabled"></label>
                        </div>
                    </div>
                    <div class="panel-content">
                        <div class="auto-reply-result" id="auto-reply-result">
                            <div class="no-auto-reply">
                                <i class="fas fa-robot"></i>
                                <p>暂无自动回复建议</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 知识库快速搜索 -->
                <div class="ai-panel knowledge-search-panel">
                    <div class="panel-header">
                        <h4><i class="fas fa-search"></i> 知识库搜索</h4>
                    </div>
                    <div class="panel-content">
                        <div class="search-input-container">
                            <input type="text" id="kb-search-input" placeholder="搜索知识库..." class="search-input">
                            <button class="search-btn" id="kb-search-btn">
                                <i class="fas fa-search"></i>
                            </button>
                        </div>
                        <div class="search-results" id="kb-search-results">
                            <!-- 搜索结果将在这里显示 -->
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- AI设置模态框 -->
            <div class="ai-settings-modal" id="ai-settings-modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>AI助手设置</h3>
                        <button class="close-btn" id="close-settings">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="settings-section">
                            <h4>基本设置</h4>
                            <div class="setting-item">
                                <label>置信度阈值:</label>
                                <input type="range" id="confidence-threshold" min="0.1" max="1" step="0.1" value="0.7">
                                <span class="threshold-value">0.7</span>
                            </div>
                            <div class="setting-item">
                                <label>最大建议数量:</label>
                                <input type="number" id="max-suggestions" min="1" max="10" value="5">
                            </div>
                            <div class="setting-item">
                                <label>自动刷新间隔(秒):</label>
                                <input type="number" id="refresh-interval" min="5" max="60" value="10">
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <h4>显示设置</h4>
                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="show-analysis" checked>
                                    显示消息分析
                                </label>
                            </div>
                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="show-confidence" checked>
                                    显示置信度
                                </label>
                            </div>
                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="enable-sound" checked>
                                    启用声音提示
                                </label>
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <h4>学习设置</h4>
                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="enable-learning" checked>
                                    启用智能学习
                                </label>
                            </div>
                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" id="auto-improve" checked>
                                    自动改进建议
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="reset-settings">重置</button>
                        <button class="btn btn-primary" id="save-settings">保存设置</button>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(aiInterface);
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        // AI开关
        const toggleBtn = document.getElementById('ai-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleAI());
        }
        
        // 设置按钮
        const settingsBtn = document.getElementById('ai-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }
        
        // 刷新建议
        const refreshBtn = document.getElementById('refresh-suggestions');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshSuggestions());
        }
        
        // 分析面板切换
        const toggleAnalysisBtn = document.getElementById('toggle-analysis');
        if (toggleAnalysisBtn) {
            toggleAnalysisBtn.addEventListener('click', () => this.toggleAnalysisPanel());
        }
        
        // 自动回复开关
        const autoReplyToggle = document.getElementById('auto-reply-enabled');
        if (autoReplyToggle) {
            autoReplyToggle.addEventListener('change', (e) => this.toggleAutoReply(e.target.checked));
        }
        
        // 知识库搜索
        const searchInput = document.getElementById('kb-search-input');
        const searchBtn = document.getElementById('kb-search-btn');
        if (searchInput && searchBtn) {
            searchBtn.addEventListener('click', () => this.searchKnowledgeBase());
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchKnowledgeBase();
                }
            });
        }
        
        // 设置模态框
        this.bindSettingsModalEvents();
        
        // 监听消息输入变化
        this.observeMessageInput();
    }

    /**
     * 绑定设置模态框事件
     */
    bindSettingsModalEvents() {
        const closeBtn = document.getElementById('close-settings');
        const saveBtn = document.getElementById('save-settings');
        const resetBtn = document.getElementById('reset-settings');
        const modal = document.getElementById('ai-settings-modal');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeSettings());
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }
        
        // 点击模态框外部关闭
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeSettings();
                }
            });
        }
        
        // 置信度阈值滑块
        const thresholdSlider = document.getElementById('confidence-threshold');
        if (thresholdSlider) {
            thresholdSlider.addEventListener('input', (e) => {
                const valueSpan = document.querySelector('.threshold-value');
                if (valueSpan) {
                    valueSpan.textContent = e.target.value;
                }
            });
        }
    }

    /**
     * 启动实时功能
     */
    startRealTimeFeatures() {
        // 定期刷新建议
        this.refreshInterval = setInterval(() => {
            if (this.isEnabled && this.currentConversationId) {
                this.refreshSuggestions();
            }
        }, this.options.autoRefresh);
        
        console.log('🔄 实时功能已启动');
    }

    /**
     * 监听消息输入变化
     */
    observeMessageInput() {
        // 查找消息输入框
        const messageInput = document.querySelector('input[placeholder*="消息"], textarea[placeholder*="消息"], #message-input, .message-input');
        
        if (messageInput) {
            let debounceTimer;
            
            messageInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    if (this.isEnabled && e.target.value.trim()) {
                        this.analyzeCurrentMessage(e.target.value);
                    }
                }, 500); // 500ms 防抖
            });
            
            console.log('👂 消息输入监听已启动');
        }
    }

    /**
     * 切换AI助手状态
     */
    async toggleAI() {
        try {
            this.isEnabled = !this.isEnabled;
            
            const toggleBtn = document.getElementById('ai-toggle');
            const statusIndicator = document.getElementById('ai-status');
            const content = document.getElementById('ai-content');
            
            if (this.isEnabled) {
                toggleBtn.classList.add('active');
                statusIndicator.querySelector('.status-text').textContent = '已启用';
                statusIndicator.querySelector('.status-dot').className = 'status-dot active';
                content.style.display = 'block';
                
                // 启动AI功能
                await this.startAIFeatures();
                
                this.showNotification('AI助手已启用', 'success');
            } else {
                toggleBtn.classList.remove('active');
                statusIndicator.querySelector('.status-text').textContent = '已禁用';
                statusIndicator.querySelector('.status-dot').className = 'status-dot inactive';
                content.style.display = 'none';
                
                // 停止AI功能
                this.stopAIFeatures();
                
                this.showNotification('AI助手已禁用', 'info');
            }
            
        } catch (error) {
            console.error('❌ 切换AI助手状态失败:', error);
            this.showError('切换AI助手状态失败');
        }
    }

    /**
     * 启动AI功能
     */
    async startAIFeatures() {
        // 获取当前对话ID
        await this.getCurrentConversationId();
        
        // 加载初始建议
        if (this.currentConversationId) {
            await this.loadSuggestions();
        }
    }

    /**
     * 停止AI功能
     */
    stopAIFeatures() {
        // 清理建议
        this.clearSuggestions();
        
        // 清理分析结果
        this.clearAnalysis();
    }

    /**
     * 获取当前对话ID
     */
    async getCurrentConversationId() {
        try {
            // 从URL或全局变量获取对话ID
            const urlParams = new URLSearchParams(window.location.search);
            this.currentConversationId = urlParams.get('conversationId') || 
                                        window.currentConversationId || 
                                        'default';
            
            console.log('💬 当前对话ID:', this.currentConversationId);
        } catch (error) {
            console.error('❌ 获取对话ID失败:', error);
        }
    }

    /**
     * 分析当前消息
     */
    async analyzeCurrentMessage(messageText) {
        try {
            const response = await fetch('/api/ai/analyze-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    conversationId: this.currentConversationId,
                    messageText: messageText
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.updateAnalysisDisplay(result.analysis);
                
                // 生成实时建议
                await this.generateRealTimeSuggestions(messageText);
            }
            
        } catch (error) {
            console.error('❌ 分析消息失败:', error);
        }
    }

    /**
     * 生成实时建议
     */
    async generateRealTimeSuggestions(messageText) {
        try {
            const response = await fetch('/api/ai/smart-reply-suggestions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    conversationId: this.currentConversationId,
                    messageText: messageText,
                    maxSuggestions: this.options.maxSuggestions
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.displaySuggestions(result.suggestions);
            }
            
        } catch (error) {
            console.error('❌ 生成实时建议失败:', error);
        }
    }

    /**
     * 加载建议
     */
    async loadSuggestions() {
        try {
            // 获取最新消息
            const lastMessage = await this.getLastMessage();
            
            if (lastMessage && lastMessage.text) {
                await this.generateRealTimeSuggestions(lastMessage.text);
            }
            
        } catch (error) {
            console.error('❌ 加载建议失败:', error);
        }
    }

    /**
     * 获取最后一条消息
     */
    async getLastMessage() {
        try {
            // 从DOM中获取最后一条消息
            const messageElements = document.querySelectorAll('.message, .chat-message');
            if (messageElements.length > 0) {
                const lastElement = messageElements[messageElements.length - 1];
                const textElement = lastElement.querySelector('.message-text, .text-content, .content');
                
                if (textElement) {
                    return {
                        text: textElement.textContent.trim(),
                        timestamp: Date.now()
                    };
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ 获取最后消息失败:', error);
            return null;
        }
    }

    /**
     * 显示建议
     */
    displaySuggestions(suggestions) {
        const container = document.getElementById('suggestions-container');
        if (!container) return;
        
        if (!suggestions || suggestions.length === 0) {
            container.innerHTML = `
                <div class="no-suggestions">
                    <i class="fas fa-comment-dots"></i>
                    <p>暂无智能回复建议</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = suggestions.map((suggestion, index) => `
            <div class="suggestion-item" data-index="${index}">
                <div class="suggestion-content">
                    <div class="suggestion-text">${this.escapeHtml(suggestion.text)}</div>
                    <div class="suggestion-meta">
                        <span class="suggestion-type">${this.getSuggestionTypeText(suggestion.type)}</span>
                        <span class="confidence-score" style="display: ${this.options.showConfidence ? 'inline' : 'none'};">
                            置信度: ${Math.round(suggestion.confidence * 100)}%
                        </span>
                    </div>
                </div>
                <div class="suggestion-actions">
                    <button class="use-suggestion-btn" onclick="aiAssistant.useSuggestion(${index})">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="edit-suggestion-btn" onclick="aiAssistant.editSuggestion(${index})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="feedback-btn positive" onclick="aiAssistant.giveFeedback(${index}, 'positive')">
                        <i class="fas fa-thumbs-up"></i>
                    </button>
                    <button class="feedback-btn negative" onclick="aiAssistant.giveFeedback(${index}, 'negative')">
                        <i class="fas fa-thumbs-down"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // 缓存建议
        this.currentSuggestions = suggestions;
    }

    /**
     * 更新分析显示
     */
    updateAnalysisDisplay(analysis) {
        if (!analysis) return;
        
        // 更新意图识别
        if (analysis.intent) {
            const intentResult = document.getElementById('intent-result');
            if (intentResult) {
                const label = intentResult.querySelector('.intent-label');
                const confidence = intentResult.querySelector('.confidence-score');
                
                if (label) label.textContent = this.getIntentText(analysis.intent.intent);
                if (confidence) confidence.textContent = `${Math.round(analysis.intent.confidence * 100)}%`;
            }
        }
        
        // 更新情感分析
        if (analysis.sentiment) {
            const sentimentResult = document.getElementById('sentiment-result');
            if (sentimentResult) {
                const label = sentimentResult.querySelector('.sentiment-label');
                const bar = document.getElementById('sentiment-bar');
                
                if (label) {
                    label.textContent = this.getSentimentText(analysis.sentiment.label);
                    label.className = `sentiment-label ${analysis.sentiment.label}`;
                }
                
                if (bar) {
                    const percentage = Math.abs(analysis.sentiment.score) * 100;
                    bar.style.width = `${percentage}%`;
                    bar.className = `sentiment-bar ${analysis.sentiment.label}`;
                }
            }
        }
        
        // 更新关键词
        if (analysis.keywords) {
            const keywordsContainer = document.getElementById('keywords-container');
            if (keywordsContainer) {
                if (analysis.keywords.length > 0) {
                    keywordsContainer.innerHTML = analysis.keywords.map(keyword => `
                        <span class="keyword-tag">${this.escapeHtml(keyword.word)}</span>
                    `).join('');
                } else {
                    keywordsContainer.innerHTML = '<span class="no-keywords">暂无关键词</span>';
                }
            }
        }
        
        // 更新实体识别
        if (analysis.entities) {
            const entitiesContainer = document.getElementById('entities-container');
            if (entitiesContainer) {
                if (analysis.entities.length > 0) {
                    entitiesContainer.innerHTML = analysis.entities.map(entity => `
                        <span class="entity-tag entity-${entity.type}">${this.escapeHtml(entity.value)}</span>
                    `).join('');
                } else {
                    entitiesContainer.innerHTML = '<span class="no-entities">暂无实体</span>';
                }
            }
        }
    }

    /**
     * 使用建议
     */
    useSuggestion(index) {
        if (!this.currentSuggestions || !this.currentSuggestions[index]) return;
        
        const suggestion = this.currentSuggestions[index];
        
        // 找到消息输入框并填入建议文本
        const messageInput = document.querySelector('input[placeholder*="消息"], textarea[placeholder*="消息"], #message-input, .message-input');
        
        if (messageInput) {
            messageInput.value = suggestion.text;
            messageInput.focus();
            
            // 触发输入事件
            messageInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            this.showNotification('建议已应用', 'success');
            
            // 记录使用情况
            this.recordSuggestionUsage(index, 'used');
        }
    }

    /**
     * 编辑建议
     */
    editSuggestion(index) {
        if (!this.currentSuggestions || !this.currentSuggestions[index]) return;
        
        const suggestion = this.currentSuggestions[index];
        const newText = prompt('编辑建议:', suggestion.text);
        
        if (newText && newText.trim() !== suggestion.text) {
            suggestion.text = newText.trim();
            this.displaySuggestions(this.currentSuggestions);
            
            this.showNotification('建议已更新', 'success');
            
            // 记录编辑情况
            this.recordSuggestionUsage(index, 'edited');
        }
    }

    /**
     * 给予反馈
     */
    giveFeedback(index, feedbackType) {
        if (!this.currentSuggestions || !this.currentSuggestions[index]) return;
        
        const suggestion = this.currentSuggestions[index];
        
        // 发送反馈到服务器
        this.sendFeedback(suggestion, feedbackType);
        
        // 更新UI反馈状态
        const suggestionElement = document.querySelector(`[data-index="${index}"]`);
        if (suggestionElement) {
            const buttons = suggestionElement.querySelectorAll('.feedback-btn');
            buttons.forEach(btn => btn.classList.remove('active'));
            
            const activeButton = suggestionElement.querySelector(`.feedback-btn.${feedbackType}`);
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }
        
        this.showNotification(`已记录${feedbackType === 'positive' ? '正面' : '负面'}反馈`, 'info');
    }

    /**
     * 发送反馈到服务器
     */
    async sendFeedback(suggestion, feedbackType) {
        try {
            await fetch('/api/ai/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    conversationId: this.currentConversationId,
                    suggestion: suggestion,
                    feedbackType: feedbackType,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (error) {
            console.error('❌ 发送反馈失败:', error);
        }
    }

    /**
     * 记录建议使用情况
     */
    recordSuggestionUsage(index, action) {
        // 记录建议使用情况用于学习改进
        console.log(`📊 建议使用记录: 索引${index}, 动作${action}`);
    }

    /**
     * 搜索知识库
     */
    async searchKnowledgeBase() {
        const searchInput = document.getElementById('kb-search-input');
        const resultsContainer = document.getElementById('kb-search-results');
        
        if (!searchInput || !resultsContainer) return;
        
        const query = searchInput.value.trim();
        if (!query) return;
        
        try {
            resultsContainer.innerHTML = '<div class="loading">搜索中...</div>';
            
            const response = await fetch('/api/ai/search-knowledge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: query,
                    shopId: this.getShopId()
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.displaySearchResults(result.results);
            } else {
                resultsContainer.innerHTML = '<div class="error">搜索失败</div>';
            }
            
        } catch (error) {
            console.error('❌ 搜索知识库失败:', error);
            resultsContainer.innerHTML = '<div class="error">搜索出错</div>';
        }
    }

    /**
     * 显示搜索结果
     */
    displaySearchResults(results) {
        const resultsContainer = document.getElementById('kb-search-results');
        if (!resultsContainer) return;
        
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">没有找到相关结果</div>';
            return;
        }
        
        resultsContainer.innerHTML = results.map(result => `
            <div class="search-result-item">
                <div class="result-question">${this.escapeHtml(result.question)}</div>
                <div class="result-answer">${this.escapeHtml(result.answer)}</div>
                <div class="result-meta">
                    <span class="result-category">${result.category}</span>
                    <span class="result-confidence">匹配度: ${Math.round(result.confidence * 100)}%</span>
                </div>
                <div class="result-actions">
                    <button class="use-answer-btn" onclick="aiAssistant.useKnowledgeAnswer('${this.escapeHtml(result.answer)}')">
                        使用答案
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * 使用知识库答案
     */
    useKnowledgeAnswer(answer) {
        const messageInput = document.querySelector('input[placeholder*="消息"], textarea[placeholder*="消息"], #message-input, .message-input');
        
        if (messageInput) {
            messageInput.value = answer;
            messageInput.focus();
            messageInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            this.showNotification('知识库答案已应用', 'success');
        }
    }

    /**
     * 刷新建议
     */
    async refreshSuggestions() {
        if (!this.currentConversationId) return;
        
        const refreshBtn = document.getElementById('refresh-suggestions');
        if (refreshBtn) {
            refreshBtn.classList.add('spinning');
            setTimeout(() => refreshBtn.classList.remove('spinning'), 1000);
        }
        
        await this.loadSuggestions();
    }

    /**
     * 切换分析面板
     */
    toggleAnalysisPanel() {
        const panel = document.querySelector('.message-analysis-panel');
        const btn = document.getElementById('toggle-analysis');
        
        if (panel && btn) {
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'block';
            btn.querySelector('i').className = isVisible ? 'fas fa-eye-slash' : 'fas fa-eye';
        }
    }

    /**
     * 切换自动回复
     */
    async toggleAutoReply(enabled) {
        try {
            const response = await fetch('/api/ai/auto-reply-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    shopId: this.getShopId(),
                    enabled: enabled
                })
            });
            
            if (response.ok) {
                this.showNotification(`自动回复已${enabled ? '启用' : '禁用'}`, 'success');
            }
            
        } catch (error) {
            console.error('❌ 切换自动回复失败:', error);
        }
    }

    /**
     * 打开设置
     */
    openSettings() {
        const modal = document.getElementById('ai-settings-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * 关闭设置
     */
    closeSettings() {
        const modal = document.getElementById('ai-settings-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 保存设置
     */
    saveSettings() {
        const settings = {
            confidenceThreshold: document.getElementById('confidence-threshold')?.value,
            maxSuggestions: document.getElementById('max-suggestions')?.value,
            refreshInterval: document.getElementById('refresh-interval')?.value,
            showAnalysis: document.getElementById('show-analysis')?.checked,
            showConfidence: document.getElementById('show-confidence')?.checked,
            enableSound: document.getElementById('enable-sound')?.checked,
            enableLearning: document.getElementById('enable-learning')?.checked,
            autoImprove: document.getElementById('auto-improve')?.checked
        };
        
        // 保存到本地存储
        localStorage.setItem('ai-assistant-settings', JSON.stringify(settings));
        
        // 应用设置
        this.applySettings(settings);
        
        this.closeSettings();
        this.showNotification('设置已保存', 'success');
    }

    /**
     * 重置设置
     */
    resetSettings() {
        if (confirm('确定要重置所有设置吗？')) {
            localStorage.removeItem('ai-assistant-settings');
            this.loadDefaultSettings();
            this.showNotification('设置已重置', 'info');
        }
    }

    /**
     * 加载默认设置
     */
    loadDefaultSettings() {
        const defaultSettings = {
            confidenceThreshold: 0.7,
            maxSuggestions: 5,
            refreshInterval: 10,
            showAnalysis: true,
            showConfidence: true,
            enableSound: true,
            enableLearning: true,
            autoImprove: true
        };
        
        this.applySettings(defaultSettings);
    }

    /**
     * 应用设置
     */
    applySettings(settings) {
        // 更新配置
        this.options.maxSuggestions = parseInt(settings.maxSuggestions) || 5;
        this.options.autoRefresh = parseInt(settings.refreshInterval) * 1000 || 10000;
        this.options.showAnalysis = settings.showAnalysis !== false;
        this.options.showConfidence = settings.showConfidence !== false;
        
        // 更新UI
        const analysisPanel = document.querySelector('.message-analysis-panel');
        if (analysisPanel) {
            analysisPanel.style.display = this.options.showAnalysis ? 'block' : 'none';
        }
        
        // 重启定时器
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.startRealTimeFeatures();
        }
    }

    /**
     * 获取店铺ID
     */
    getShopId() {
        return window.shopId || 'default';
    }

    /**
     * 清理建议
     */
    clearSuggestions() {
        const container = document.getElementById('suggestions-container');
        if (container) {
            container.innerHTML = `
                <div class="no-suggestions">
                    <i class="fas fa-comment-dots"></i>
                    <p>选择对话以获取智能回复建议</p>
                </div>
            `;
        }
        this.currentSuggestions = null;
    }

    /**
     * 清理分析结果
     */
    clearAnalysis() {
        // 重置意图识别
        const intentResult = document.getElementById('intent-result');
        if (intentResult) {
            intentResult.querySelector('.intent-label').textContent = '未知';
            intentResult.querySelector('.confidence-score').textContent = '0%';
        }
        
        // 重置情感分析
        const sentimentResult = document.getElementById('sentiment-result');
        if (sentimentResult) {
            const label = sentimentResult.querySelector('.sentiment-label');
            label.textContent = '中性';
            label.className = 'sentiment-label neutral';
        }
        
        // 重置关键词
        const keywordsContainer = document.getElementById('keywords-container');
        if (keywordsContainer) {
            keywordsContainer.innerHTML = '<span class="no-keywords">暂无关键词</span>';
        }
        
        // 重置实体
        const entitiesContainer = document.getElementById('entities-container');
        if (entitiesContainer) {
            entitiesContainer.innerHTML = '<span class="no-entities">暂无实体</span>';
        }
    }

    /**
     * 工具方法
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getSuggestionTypeText(type) {
        const typeMap = {
            'intent_based': '意图建议',
            'knowledge_based': '知识库',
            'sentiment_based': '情感建议',
            'context_based': '上下文',
            'default': '默认'
        };
        return typeMap[type] || type;
    }

    getIntentText(intent) {
        const intentMap = {
            'greeting': '问候',
            'question': '提问',
            'complaint': '投诉',
            'compliment': '赞扬',
            'request': '请求',
            'booking': '预订',
            'cancellation': '取消',
            'unknown': '未知'
        };
        return intentMap[intent] || intent;
    }

    getSentimentText(sentiment) {
        const sentimentMap = {
            'very_positive': '非常积极',
            'positive': '积极',
            'neutral': '中性',
            'negative': '消极',
            'very_negative': '非常消极'
        };
        return sentimentMap[sentiment] || sentiment;
    }

    showNotification(message, type = 'info') {
        // 简单的通知实现
        const notification = document.createElement('div');
        notification.className = `ai-notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * 销毁实例
     */
    destroy() {
        // 清理定时器
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // 清理事件监听器
        // 清理DOM元素
        const container = document.querySelector('.ai-assistant-interface');
        if (container) {
            container.remove();
        }
        
        console.log('🗑️ AI助手UI已销毁');
    }
}

// 创建全局实例
window.aiAssistant = new EnhancedAIAssistantUI();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedAIAssistantUI;
}