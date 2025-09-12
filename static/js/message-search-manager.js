/**
 * 消息搜索管理器
 * 提供全文搜索、高级搜索、搜索历史等功能
 * 
 * @author QuickTalk Team
 * @version 2.0.0
 */

class MessageSearchManager {
    constructor() {
        this.searchHistory = [];
        this.currentResults = [];
        this.searchFilters = {
            dateRange: { from: '', to: '' },
            senderType: '',
            messageType: '',
            conversationId: ''
        };
        // ⚠️ 不再在构造函数中自动初始化
        console.log('🔍 消息搜索管理器已创建，等待手动初始化');
    }

    /**
     * 初始化搜索管理器
     */
    init() {
        // 再次确认用户登录状态
        const sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            console.error('🔒 无法初始化搜索管理器：用户未登录');
            return false;
        }

        try {
            this.createSearchInterface();
            this.bindEvents();
            this.loadSearchHistory();
            console.log('🔍 消息搜索管理器初始化完成');
            return true;
        } catch (error) {
            console.error('❌ 搜索管理器初始化失败:', error);
            return false;
        }
    }

    /**
     * 创建搜索界面
     */
    createSearchInterface() {
        // 检查用户登录状态
        const sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            console.warn('🔒 用户未登录，不创建搜索界面');
            return;
        }

        // 检查是否已存在搜索界面
        if (document.getElementById('searchPanel')) {
            console.log('🔍 搜索界面已存在');
            return;
        }

        // 检查是否在消息相关页面
        const messageContainer = document.querySelector('.message-container');
        const messageContent = document.getElementById('messageContent');
        
        if (!messageContainer && !messageContent) {
            console.log('⏰ 当前页面不是消息页面，搜索界面将稍后创建');
            return;
        }

        const searchPanel = document.createElement('div');
        searchPanel.id = 'searchPanel';
        searchPanel.className = 'search-panel';
        searchPanel.innerHTML = this.getSearchPanelHTML();

        // 优先插入到消息容器，否则插入到文档顶部
        const container = messageContainer || messageContent || document.body;
        container.insertBefore(searchPanel, container.firstChild);
        
        console.log('✅ 搜索界面已创建');
    }

    /**
     * 获取搜索面板HTML
     */
    getSearchPanelHTML() {
        return `
            <div class="search-header">
                <div class="search-title">
                    <h3>🔍 消息搜索</h3>
                    <button class="toggle-search-btn" id="toggleSearchBtn">
                        <span class="toggle-icon">▼</span>
                    </button>
                </div>
            </div>

            <div class="search-content" id="searchContent">
                <!-- 基础搜索 -->
                <div class="basic-search">
                    <div class="search-input-group">
                        <input type="text" id="searchInput" placeholder="搜索消息内容、发送者姓名或文件名..." class="search-input">
                        <button id="searchBtn" class="search-btn">🔍 搜索</button>
                        <button id="clearSearchBtn" class="clear-btn">✖ 清除</button>
                    </div>
                    
                    <div class="search-suggestions" id="searchSuggestions" style="display: none;">
                        <!-- 搜索建议将在这里显示 -->
                    </div>
                </div>

                <!-- 高级搜索选项 -->
                <div class="advanced-search" id="advancedSearch" style="display: none;">
                    <div class="filter-row">
                        <div class="filter-group">
                            <label>日期范围:</label>
                            <input type="date" id="dateFrom" class="date-input">
                            <span>至</span>
                            <input type="date" id="dateTo" class="date-input">
                        </div>
                        
                        <div class="filter-group">
                            <label>发送者类型:</label>
                            <select id="senderTypeFilter" class="filter-select">
                                <option value="">全部</option>
                                <option value="customer">客户</option>
                                <option value="staff">客服</option>
                                <option value="system">系统</option>
                            </select>
                        </div>
                    </div>

                    <div class="filter-row">
                        <div class="filter-group">
                            <label>消息类型:</label>
                            <select id="messageTypeFilter" class="filter-select">
                                <option value="">全部</option>
                                <option value="text">文本</option>
                                <option value="image">图片</option>
                                <option value="file">文件</option>
                                <option value="audio">音频</option>
                                <option value="video">视频</option>
                                <option value="emoji">表情</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label>对话ID:</label>
                            <input type="text" id="conversationIdFilter" placeholder="指定对话ID" class="filter-input">
                        </div>
                    </div>

                    <div class="filter-actions">
                        <button id="advancedSearchBtn" class="advanced-search-btn">🔍 高级搜索</button>
                        <button id="resetFiltersBtn" class="reset-filters-btn">🔄 重置筛选</button>
                        <button id="saveFiltersBtn" class="save-filters-btn">💾 保存筛选</button>
                    </div>
                </div>

                <!-- 搜索历史 -->
                <div class="search-history" id="searchHistoryPanel" style="display: none;">
                    <div class="history-header">
                        <h4>📝 搜索历史</h4>
                        <button id="clearHistoryBtn" class="clear-history-btn">🗑️ 清除历史</button>
                    </div>
                    <div class="history-list" id="historyList">
                        <!-- 搜索历史将在这里显示 -->
                    </div>
                </div>

                <!-- 工具栏 -->
                <div class="search-toolbar">
                    <button id="toggleAdvancedBtn" class="toolbar-btn">⚙️ 高级搜索</button>
                    <button id="toggleHistoryBtn" class="toolbar-btn">📝 搜索历史</button>
                    <button id="exportResultsBtn" class="toolbar-btn">📤 导出结果</button>
                    <button id="searchStatsBtn" class="toolbar-btn">📊 搜索统计</button>
                </div>
            </div>

            <!-- 搜索结果 -->
            <div class="search-results" id="searchResults" style="display: none;">
                <div class="results-header">
                    <h4 id="resultsTitle">搜索结果</h4>
                    <div class="results-info">
                        <span id="resultsCount">0 条结果</span>
                        <span id="searchTime">0ms</span>
                    </div>
                </div>
                <div class="results-list" id="resultsList">
                    <!-- 搜索结果将在这里显示 -->
                </div>
                <div class="results-pagination" id="resultsPagination">
                    <!-- 分页将在这里显示 -->
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 切换搜索面板
        document.getElementById('toggleSearchBtn')?.addEventListener('click', () => {
            this.toggleSearchPanel();
        });

        // 基础搜索
        document.getElementById('searchBtn')?.addEventListener('click', () => {
            this.performBasicSearch();
        });

        document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performBasicSearch();
            }
        });

        // 清除搜索
        document.getElementById('clearSearchBtn')?.addEventListener('click', () => {
            this.clearSearch();
        });

        // 搜索输入实时建议
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            this.showSearchSuggestions(e.target.value);
        });

        // 高级搜索
        document.getElementById('advancedSearchBtn')?.addEventListener('click', () => {
            this.performAdvancedSearch();
        });

        // 重置筛选
        document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
            this.resetFilters();
        });

        // 工具栏按钮
        document.getElementById('toggleAdvancedBtn')?.addEventListener('click', () => {
            this.toggleAdvancedSearch();
        });

        document.getElementById('toggleHistoryBtn')?.addEventListener('click', () => {
            this.toggleSearchHistory();
        });

        document.getElementById('exportResultsBtn')?.addEventListener('click', () => {
            this.exportSearchResults();
        });

        document.getElementById('searchStatsBtn')?.addEventListener('click', () => {
            this.showSearchStatistics();
        });

        // 清除历史
        document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
            this.clearSearchHistory();
        });
    }

    /**
     * 切换搜索面板
     */
    toggleSearchPanel() {
        const content = document.getElementById('searchContent');
        const toggleIcon = document.querySelector('.toggle-icon');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            toggleIcon.textContent = '▼';
        } else {
            content.style.display = 'none';
            toggleIcon.textContent = '▶';
        }
    }

    /**
     * 执行基础搜索
     */
    async performBasicSearch() {
        const query = document.getElementById('searchInput').value.trim();
        
        if (!query) {
            this.showMessage('请输入搜索关键词', 'warning');
            return;
        }

        try {
            this.showSearchLoading(true);
            
            const response = await fetch('/api/search/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    shopId: 'shop_1',
                    userId: 'user_1',
                    limit: 50,
                    offset: 0
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.displaySearchResults(result.data, query);
                this.addToSearchHistory(query, 'basic', result.data.total);
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error('搜索失败:', error);
            this.showMessage('搜索失败: ' + error.message, 'error');
        } finally {
            this.showSearchLoading(false);
        }
    }

    /**
     * 执行高级搜索
     */
    async performAdvancedSearch() {
        const query = document.getElementById('searchInput').value.trim();
        const filters = this.getAdvancedFilters();

        try {
            this.showSearchLoading(true);
            
            const response = await fetch('/api/search/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    shopId: 'shop_1',
                    userId: 'user_1',
                    ...filters,
                    limit: 50,
                    offset: 0
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.displaySearchResults(result.data, query, true);
                this.addToSearchHistory(query, 'advanced', result.data.total);
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error('高级搜索失败:', error);
            this.showMessage('高级搜索失败: ' + error.message, 'error');
        } finally {
            this.showSearchLoading(false);
        }
    }

    /**
     * 获取高级搜索筛选条件
     */
    getAdvancedFilters() {
        return {
            dateFrom: document.getElementById('dateFrom').value,
            dateTo: document.getElementById('dateTo').value,
            senderType: document.getElementById('senderTypeFilter').value,
            messageType: document.getElementById('messageTypeFilter').value,
            conversationId: document.getElementById('conversationIdFilter').value
        };
    }

    /**
     * 显示搜索结果
     */
    displaySearchResults(data, query, isAdvanced = false) {
        const resultsPanel = document.getElementById('searchResults');
        const resultsTitle = document.getElementById('resultsTitle');
        const resultsCount = document.getElementById('resultsCount');
        const searchTime = document.getElementById('searchTime');
        const resultsList = document.getElementById('resultsList');

        // 更新标题和统计
        resultsTitle.textContent = `"${query}" 的搜索结果${isAdvanced ? ' (高级搜索)' : ''}`;
        resultsCount.textContent = `${data.total} 条结果`;
        searchTime.textContent = `${data.searchTime}ms`;

        // 清空并填充结果列表
        resultsList.innerHTML = '';
        
        if (data.messages.length === 0) {
            resultsList.innerHTML = '<div class="no-results">😔 没有找到匹配的消息</div>';
        } else {
            data.messages.forEach(message => {
                resultsList.appendChild(this.createMessageResultItem(message, query));
            });

            // 添加分页
            if (data.totalPages > 1) {
                this.createPagination(data);
            }
        }

        // 显示结果面板
        resultsPanel.style.display = 'block';
        this.currentResults = data;
    }

    /**
     * 创建消息结果项
     */
    createMessageResultItem(message, query) {
        const item = document.createElement('div');
        item.className = 'result-item';
        
        // 高亮关键词
        const highlightedContent = this.highlightKeywords(message.highlighted_content || message.content, query);
        
        item.innerHTML = `
            <div class="result-header">
                <div class="result-meta">
                    <span class="sender-info">
                        <span class="sender-type ${message.sender_type}">${this.getSenderTypeLabel(message.sender_type)}</span>
                        <span class="sender-name">${message.sender_name || '未知'}</span>
                    </span>
                    <span class="message-time">${this.formatDate(message.created_at)}</span>
                </div>
                <div class="result-actions">
                    <button class="view-conversation-btn" data-conversation-id="${message.conversation_id}">
                        📄 查看对话
                    </button>
                    <button class="export-message-btn" data-message-id="${message.id}">
                        📤 导出
                    </button>
                </div>
            </div>
            <div class="result-content">
                <div class="message-content">
                    ${message.message_type === 'text' ? highlightedContent : this.formatNonTextMessage(message)}
                </div>
                ${message.customer_name ? `<div class="customer-info">客户: ${message.customer_name}</div>` : ''}
            </div>
        `;

        // 绑定查看对话事件
        item.querySelector('.view-conversation-btn')?.addEventListener('click', (e) => {
            const conversationId = e.target.dataset.conversationId;
            this.viewConversation(conversationId);
        });

        // 绑定导出消息事件
        item.querySelector('.export-message-btn')?.addEventListener('click', (e) => {
            const messageId = e.target.dataset.messageId;
            this.exportMessage(messageId);
        });

        return item;
    }

    /**
     * 高亮关键词
     */
    highlightKeywords(text, keywords) {
        if (!keywords || !text) return text;
        
        const keywordArray = keywords.split(' ').filter(k => k.trim());
        let highlightedText = text;
        
        keywordArray.forEach(keyword => {
            const regex = new RegExp(`(${keyword})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark class="highlight">$1</mark>');
        });
        
        return highlightedText;
    }

    /**
     * 格式化非文本消息
     */
    formatNonTextMessage(message) {
        switch (message.message_type) {
            case 'image':
                return `🖼️ 图片: ${message.file_name || '未知'}`;
            case 'file':
                return `📄 文件: ${message.file_name || '未知'}`;
            case 'audio':
                return `🎵 音频: ${message.file_name || '未知'}`;
            case 'video':
                return `🎬 视频: ${message.file_name || '未知'}`;
            case 'emoji':
                return `😊 表情: ${message.content}`;
            default:
                return message.content;
        }
    }

    /**
     * 获取发送者类型标签
     */
    getSenderTypeLabel(type) {
        const labels = {
            'customer': '客户',
            'staff': '客服',
            'system': '系统'
        };
        return labels[type] || type;
    }

    /**
     * 显示搜索建议
     */
    async showSearchSuggestions(query) {
        if (!query || query.length < 2) {
            document.getElementById('searchSuggestions').style.display = 'none';
            return;
        }

        try {
            // 从搜索历史中获取建议
            const suggestions = this.searchHistory
                .filter(item => item.search_query.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 5);

            if (suggestions.length > 0) {
                this.displaySearchSuggestions(suggestions);
            }

        } catch (error) {
            console.error('获取搜索建议失败:', error);
        }
    }

    /**
     * 显示搜索建议
     */
    displaySearchSuggestions(suggestions) {
        const suggestionsPanel = document.getElementById('searchSuggestions');
        
        suggestionsPanel.innerHTML = suggestions.map(suggestion => `
            <div class="suggestion-item" data-query="${suggestion.search_query}">
                <span class="suggestion-text">${suggestion.search_query}</span>
                <span class="suggestion-count">${suggestion.result_count} 条结果</span>
            </div>
        `).join('');

        // 绑定点击事件
        suggestionsPanel.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const query = e.currentTarget.dataset.query;
                document.getElementById('searchInput').value = query;
                this.performBasicSearch();
                suggestionsPanel.style.display = 'none';
            });
        });

        suggestionsPanel.style.display = 'block';
    }

    /**
     * 切换高级搜索
     */
    toggleAdvancedSearch() {
        const panel = document.getElementById('advancedSearch');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }

    /**
     * 切换搜索历史
     */
    toggleSearchHistory() {
        const panel = document.getElementById('searchHistoryPanel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        
        if (panel.style.display === 'block') {
            this.loadSearchHistory();
        }
    }

    /**
     * 加载搜索历史
     */
    async loadSearchHistory() {
        try {
            const sessionId = sessionStorage.getItem('sessionId') || localStorage.getItem('sessionId');
            if (!sessionId) {
                console.warn('未找到登录会话，跳过加载搜索历史');
                return;
            }

            const response = await fetch('/api/search/history/user_1/shop_1', {
                headers: { 'X-Session-Id': sessionId }
            });
            const result = await response.json();
            
            if (result.success) {
                this.searchHistory = result.data;
                this.displaySearchHistory();
            }

        } catch (error) {
            console.error('加载搜索历史失败:', error);
        }
    }

    /**
     * 显示搜索历史
     */
    displaySearchHistory() {
        const historyList = document.getElementById('historyList');
        
        if (this.searchHistory.length === 0) {
            historyList.innerHTML = '<div class="no-history">暂无搜索历史</div>';
            return;
        }

        historyList.innerHTML = this.searchHistory.map(item => `
            <div class="history-item" data-query="${item.search_query}">
                <div class="history-content">
                    <span class="history-query">${item.search_query}</span>
                    <span class="history-meta">
                        ${item.search_count} 次搜索 · ${item.result_count} 条结果 · ${this.formatDate(item.created_at)}
                    </span>
                </div>
                <button class="use-history-btn">使用</button>
            </div>
        `).join('');

        // 绑定使用历史事件
        historyList.querySelectorAll('.use-history-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const item = this.searchHistory[index];
                document.getElementById('searchInput').value = item.search_query;
                this.performBasicSearch();
            });
        });
    }

    /**
     * 添加到搜索历史
     */
    addToSearchHistory(query, type, resultCount) {
        // 本地添加，实际保存由后端API自动处理
        const historyItem = {
            search_query: query,
            search_type: type,
            result_count: resultCount,
            created_at: new Date().toISOString(),
            search_count: 1
        };

        // 检查是否已存在相同查询
        const existingIndex = this.searchHistory.findIndex(item => item.search_query === query);
        if (existingIndex !== -1) {
            this.searchHistory[existingIndex].search_count += 1;
            this.searchHistory[existingIndex].created_at = historyItem.created_at;
        } else {
            this.searchHistory.unshift(historyItem);
        }

        // 限制历史记录数量
        if (this.searchHistory.length > 50) {
            this.searchHistory = this.searchHistory.slice(0, 50);
        }
    }

    /**
     * 清除搜索
     */
    clearSearch() {
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('searchSuggestions').style.display = 'none';
        this.currentResults = [];
    }

    /**
     * 重置筛选条件
     */
    resetFilters() {
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        document.getElementById('senderTypeFilter').value = '';
        document.getElementById('messageTypeFilter').value = '';
        document.getElementById('conversationIdFilter').value = '';
    }

    /**
     * 显示搜索加载状态
     */
    showSearchLoading(isLoading) {
        const searchBtn = document.getElementById('searchBtn');
        const advancedSearchBtn = document.getElementById('advancedSearchBtn');
        
        if (isLoading) {
            searchBtn.disabled = true;
            searchBtn.textContent = '🔍 搜索中...';
            advancedSearchBtn.disabled = true;
        } else {
            searchBtn.disabled = false;
            searchBtn.textContent = '🔍 搜索';
            advancedSearchBtn.disabled = false;
        }
    }

    /**
     * 显示消息
     */
    showMessage(message, type = 'info') {
        // 创建消息提示
        const messageEl = document.createElement('div');
        messageEl.className = `search-message ${type}`;
        messageEl.textContent = message;
        
        const searchPanel = document.getElementById('searchPanel');
        searchPanel.appendChild(messageEl);
        
        // 3秒后自动移除
        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }

    /**
     * 格式化日期
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN');
    }

    /**
     * 查看对话
     */
    viewConversation(conversationId) {
        // 这里可以跳转到对话详情页面或打开对话窗口
        console.log('查看对话:', conversationId);
        this.showMessage(`正在打开对话 ${conversationId}`, 'info');
    }

    /**
     * 导出消息
     */
    exportMessage(messageId) {
        console.log('导出消息:', messageId);
        this.showMessage('消息导出功能开发中', 'info');
    }

    /**
     * 导出搜索结果
     */
    exportSearchResults() {
        if (!this.currentResults || this.currentResults.messages.length === 0) {
            this.showMessage('没有可导出的搜索结果', 'warning');
            return;
        }

        // 这里可以实现导出功能
        console.log('导出搜索结果:', this.currentResults);
        this.showMessage('搜索结果导出功能开发中', 'info');
    }

    /**
     * 显示搜索统计
     */
    async showSearchStatistics() {
        try {
            const response = await fetch('/api/search/statistics/shop_1?days=30');
            const result = await response.json();
            
            if (result.success) {
                this.displaySearchStatistics(result.data);
            }

        } catch (error) {
            console.error('获取搜索统计失败:', error);
            this.showMessage('获取搜索统计失败', 'error');
        }
    }

    /**
     * 显示搜索统计数据
     */
    displaySearchStatistics(stats) {
        const modal = document.createElement('div');
        modal.className = 'stats-modal';
        modal.innerHTML = `
            <div class="stats-modal-content">
                <div class="stats-header">
                    <h3>📊 搜索统计 (${stats.period})</h3>
                    <button class="close-stats-btn">✖</button>
                </div>
                <div class="stats-body">
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-value">${stats.totalSearches}</div>
                            <div class="stat-label">总搜索次数</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${stats.uniqueUsers}</div>
                            <div class="stat-label">活跃用户</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${stats.avgSearchTime}ms</div>
                            <div class="stat-label">平均响应时间</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${stats.avgResultCount}</div>
                            <div class="stat-label">平均结果数</div>
                        </div>
                    </div>
                    
                    <div class="top-queries">
                        <h4>🔥 热门搜索</h4>
                        ${stats.topQueries.map(query => `
                            <div class="query-item">
                                <span class="query-text">${query.search_query}</span>
                                <span class="query-count">${query.search_count} 次</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 绑定关闭事件
        modal.querySelector('.close-stats-btn').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * 清除搜索历史
     */
    async clearSearchHistory() {
        if (!confirm('确定要清除所有搜索历史吗？')) {
            return;
        }

        try {
            const response = await fetch('/api/search/history/user_1/shop_1', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ daysToKeep: 0 })
            });

            const result = await response.json();
            
            if (result.success) {
                this.searchHistory = [];
                this.displaySearchHistory();
                this.showMessage('搜索历史已清除', 'success');
            }

        } catch (error) {
            console.error('清除搜索历史失败:', error);
            this.showMessage('清除搜索历史失败', 'error');
        }
    }
}

// 全局搜索管理器实例
window.messageSearchManager = null;

// ⚠️ 搜索管理器不再自动初始化
// 需要通过 initMessageSearch() 手动初始化，确保用户已登录
function initMessageSearch() {
    // 检查用户登录状态
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
        console.warn('🔒 用户未登录，无法初始化消息搜索功能');
        return false;
    }

    // 检查是否已经初始化
    if (window.messageSearchManager) {
        console.log('🔍 消息搜索管理器已存在');
        return true;
    }

    try {
        window.messageSearchManager = new MessageSearchManager();
        const initialized = window.messageSearchManager.init();
        
        if (initialized) {
            console.log('✅ 消息搜索管理器初始化成功');
            return true;
        } else {
            console.warn('⚠️ 搜索管理器创建成功但初始化失败');
            window.messageSearchManager = null;
            return false;
        }
    } catch (error) {
        console.error('❌ 消息搜索管理器初始化失败:', error);
        window.messageSearchManager = null;
        return false;
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessageSearchManager;
}
