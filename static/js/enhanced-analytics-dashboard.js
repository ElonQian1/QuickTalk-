/**
 * 增强型数据分析仪表板 - 前端界面
 * 
 * 功能特性：
 * - 实时数据监控和可视化
 * - 交互式图表和仪表板
 * - 多维度数据分析
 * - 自定义报表生成
 * - 移动端响应式设计
 * - 数据导出和分享
 * - 实时通知和警报
 * - 高级筛选和搜索
 * 
 * @author QuickTalk Team
 * @version 4.0.0
 */

class EnhancedAnalyticsDashboard {
    constructor() {
        this.shopId = null;
        this.currentUser = null;
        this.charts = new Map();
        this.refreshInterval = null;
        this.currentTimeRange = '24h';
        this.dashboardMode = 'overview'; // overview, kpi, performance, satisfaction, revenue
        this.isRealTimeEnabled = true;
        this.notifications = [];
        this.filters = {};
        
        // 初始化统一WebSocket客户端 - 桌面端模式
        this.websocketClient = UnifiedWebSocketClient.createDesktop({
            debug: true,
            reconnect: true,
            heartbeat: true
        });
        
        this.setupWebSocketHandlers();
        
        console.log('📊 增强型数据分析仪表板初始化...');
        this.init();
    }

    /**
     * 初始化仪表板
     */
    async init() {
        try {
            // 创建仪表板容器
            this.createDashboardContainer();
            
            // 加载用户信息和店铺信息
            await this.loadUserAndShopInfo();
            
            // 创建导航和工具栏
            this.createNavigationAndToolbar();
            
            // 创建仪表板内容区域
            this.createDashboardContent();
            
            // 初始化WebSocket连接 - 使用统一客户端
            this.initializeWebSocket();
            
            // 加载初始数据
            await this.loadInitialData();
            
            // 启动实时更新
            this.startRealTimeUpdates();
            
            // 设置事件监听器
            this.setupEventListeners();
            
            console.log('✅ 增强型数据分析仪表板初始化完成');
            
        } catch (error) {
            console.error('❌ 增强型仪表板初始化失败:', error);
            this.showErrorMessage('仪表板初始化失败，请刷新页面重试');
        }
    }

    /**
     * 创建仪表板容器
     */
    createDashboardContainer() {
        const container = document.getElementById('enhanced-analytics-container') || document.body;
        
        container.innerHTML = `
            <div id="enhanced-analytics-dashboard" class="enhanced-analytics-dashboard">
                <!-- 顶部导航栏 -->
                <nav class="dashboard-nav">
                    <div class="nav-brand">
                        <h1><i class="fas fa-chart-line"></i> 数据分析中心</h1>
                        <div class="nav-status">
                            <span class="status-indicator" id="connection-status"></span>
                            <span class="status-text">实时连接</span>
                        </div>
                    </div>
                    
                    <div class="nav-controls">
                        <div class="time-range-selector">
                            <select id="time-range-select">
                                <option value="1h">最近1小时</option>
                                <option value="24h" selected>最近24小时</option>
                                <option value="7d">最近7天</option>
                                <option value="30d">最近30天</option>
                                <option value="90d">最近90天</option>
                            </select>
                        </div>
                        
                        <div class="dashboard-modes">
                            <button class="mode-btn active" data-mode="overview">
                                <i class="fas fa-tachometer-alt"></i> 概览
                            </button>
                            <button class="mode-btn" data-mode="kpi">
                                <i class="fas fa-chart-bar"></i> KPI
                            </button>
                            <button class="mode-btn" data-mode="performance">
                                <i class="fas fa-users"></i> 绩效
                            </button>
                            <button class="mode-btn" data-mode="satisfaction">
                                <i class="fas fa-smile"></i> 满意度
                            </button>
                            <button class="mode-btn" data-mode="revenue">
                                <i class="fas fa-dollar-sign"></i> 收入
                            </button>
                        </div>
                        
                        <div class="action-buttons">
                            <button id="refresh-btn" class="action-btn" title="刷新数据">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                            <button id="export-btn" class="action-btn" title="导出数据">
                                <i class="fas fa-download"></i>
                            </button>
                            <button id="settings-btn" class="action-btn" title="设置">
                                <i class="fas fa-cog"></i>
                            </button>
                            <button id="fullscreen-btn" class="action-btn" title="全屏">
                                <i class="fas fa-expand"></i>
                            </button>
                        </div>
                    </div>
                </nav>

                <!-- 主要内容区域 -->
                <main class="dashboard-main">
                    <!-- 侧边栏筛选器 -->
                    <aside class="dashboard-sidebar" id="dashboard-sidebar">
                        <div class="sidebar-section">
                            <h3><i class="fas fa-filter"></i> 筛选器</h3>
                            <div class="filter-group">
                                <label>员工</label>
                                <select id="employee-filter" multiple>
                                    <option value="all">全部员工</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label>客户类型</label>
                                <select id="customer-type-filter">
                                    <option value="all">全部客户</option>
                                    <option value="new">新客户</option>
                                    <option value="returning">老客户</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label>对话状态</label>
                                <select id="conversation-status-filter">
                                    <option value="all">全部状态</option>
                                    <option value="active">进行中</option>
                                    <option value="closed">已结束</option>
                                </select>
                            </div>
                        </div>

                        <div class="sidebar-section">
                            <h3><i class="fas fa-bell"></i> 实时警报</h3>
                            <div id="alerts-container" class="alerts-container">
                                <!-- 动态警报内容 -->
                            </div>
                        </div>

                        <div class="sidebar-section">
                            <h3><i class="fas fa-star"></i> 快速指标</h3>
                            <div id="quick-metrics" class="quick-metrics">
                                <!-- 快速指标内容 -->
                            </div>
                        </div>
                    </aside>

                    <!-- 仪表板内容 -->
                    <section class="dashboard-content" id="dashboard-content">
                        <!-- 动态内容区域 -->
                    </section>
                </main>

                <!-- 加载遮罩 -->
                <div id="loading-overlay" class="loading-overlay hidden">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>加载数据中...</p>
                    </div>
                </div>

                <!-- 模态对话框 -->
                <div id="modal-overlay" class="modal-overlay hidden">
                    <div class="modal-container">
                        <div class="modal-header">
                            <h3 id="modal-title">标题</h3>
                            <button id="modal-close" class="modal-close">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body" id="modal-body">
                            <!-- 模态内容 -->
                        </div>
                        <div class="modal-footer" id="modal-footer">
                            <button id="modal-cancel" class="btn btn-secondary">取消</button>
                            <button id="modal-confirm" class="btn btn-primary">确认</button>
                        </div>
                    </div>
                </div>

                <!-- 通知容器 -->
                <div id="notifications-container" class="notifications-container">
                    <!-- 通知消息 -->
                </div>
            </div>
        `;

        this.container = document.getElementById('enhanced-analytics-dashboard');
    }

    /**
     * 加载用户和店铺信息
     */
    async loadUserAndShopInfo() {
        try {
            // 从localStorage或API获取用户信息
            const userInfo = localStorage.getItem('currentUser');
            if (userInfo) {
                this.currentUser = JSON.parse(userInfo);
                this.shopId = this.currentUser.shopId;
            }

            if (!this.shopId) {
                // 如果没有店铺ID，尝试从URL参数获取
                const urlParams = new URLSearchParams(window.location.search);
                this.shopId = urlParams.get('shopId');
            }

            if (!this.shopId) {
                throw new Error('无法获取店铺信息');
            }

            console.log('📋 用户和店铺信息加载完成:', { user: this.currentUser, shopId: this.shopId });

        } catch (error) {
            console.error('❌ 加载用户和店铺信息失败:', error);
            throw error;
        }
    }

    /**
     * 创建导航和工具栏
     */
    createNavigationAndToolbar() {
        // 设置连接状态指示器
        this.updateConnectionStatus('connected');
        
        // 设置时间范围选择器事件
        const timeRangeSelect = document.getElementById('time-range-select');
        timeRangeSelect.addEventListener('change', (e) => {
            this.currentTimeRange = e.target.value;
            this.refreshDashboard();
        });

        // 设置模式切换按钮事件
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.switchDashboardMode(mode);
            });
        });

        // 设置操作按钮事件
        document.getElementById('refresh-btn').addEventListener('click', () => this.refreshDashboard());
        document.getElementById('export-btn').addEventListener('click', () => this.showExportModal());
        document.getElementById('settings-btn').addEventListener('click', () => this.showSettingsModal());
        document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());
    }

    /**
     * 创建仪表板内容
     */
    createDashboardContent() {
        const contentArea = document.getElementById('dashboard-content');
        
        // 根据当前模式创建内容
        switch (this.dashboardMode) {
            case 'overview':
                this.createOverviewDashboard(contentArea);
                break;
            case 'kpi':
                this.createKPIDashboard(contentArea);
                break;
            case 'performance':
                this.createPerformanceDashboard(contentArea);
                break;
            case 'satisfaction':
                this.createSatisfactionDashboard(contentArea);
                break;
            case 'revenue':
                this.createRevenueDashboard(contentArea);
                break;
        }
    }

    /**
     * 创建概览仪表板
     */
    createOverviewDashboard(container) {
        container.innerHTML = `
            <div class="overview-dashboard">
                <!-- 关键指标卡片 -->
                <div class="metrics-grid">
                    <div class="metric-card" id="conversations-card">
                        <div class="metric-header">
                            <h3>对话总数</h3>
                            <i class="fas fa-comments metric-icon"></i>
                        </div>
                        <div class="metric-value" id="total-conversations">-</div>
                        <div class="metric-change" id="conversations-change">-</div>
                    </div>

                    <div class="metric-card" id="response-time-card">
                        <div class="metric-header">
                            <h3>平均响应时间</h3>
                            <i class="fas fa-clock metric-icon"></i>
                        </div>
                        <div class="metric-value" id="avg-response-time">-</div>
                        <div class="metric-change" id="response-time-change">-</div>
                    </div>

                    <div class="metric-card" id="satisfaction-card">
                        <div class="metric-header">
                            <h3>客户满意度</h3>
                            <i class="fas fa-smile metric-icon"></i>
                        </div>
                        <div class="metric-value" id="avg-satisfaction">-</div>
                        <div class="metric-change" id="satisfaction-change">-</div>
                    </div>

                    <div class="metric-card" id="revenue-card">
                        <div class="metric-header">
                            <h3>总收入</h3>
                            <i class="fas fa-dollar-sign metric-icon"></i>
                        </div>
                        <div class="metric-value" id="total-revenue">-</div>
                        <div class="metric-change" id="revenue-change">-</div>
                    </div>
                </div>

                <!-- 图表区域 -->
                <div class="charts-grid">
                    <div class="chart-container">
                        <div class="chart-header">
                            <h3>对话趋势</h3>
                            <div class="chart-controls">
                                <select class="chart-type-select">
                                    <option value="line">线图</option>
                                    <option value="bar">柱图</option>
                                    <option value="area">面积图</option>
                                </select>
                            </div>
                        </div>
                        <div class="chart-content">
                            <canvas id="conversations-trend-chart"></canvas>
                        </div>
                    </div>

                    <div class="chart-container">
                        <div class="chart-header">
                            <h3>响应时间分布</h3>
                        </div>
                        <div class="chart-content">
                            <canvas id="response-time-chart"></canvas>
                        </div>
                    </div>

                    <div class="chart-container">
                        <div class="chart-header">
                            <h3>员工绩效排名</h3>
                        </div>
                        <div class="chart-content">
                            <canvas id="employee-ranking-chart"></canvas>
                        </div>
                    </div>

                    <div class="chart-container">
                        <div class="chart-header">
                            <h3>客户满意度分布</h3>
                        </div>
                        <div class="chart-content">
                            <canvas id="satisfaction-distribution-chart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- 详细数据表格 -->
                <div class="data-tables">
                    <div class="table-container">
                        <div class="table-header">
                            <h3>最新对话</h3>
                            <button class="btn btn-sm btn-primary">查看全部</button>
                        </div>
                        <div class="table-content">
                            <table id="recent-conversations-table" class="data-table">
                                <thead>
                                    <tr>
                                        <th>客户</th>
                                        <th>员工</th>
                                        <th>开始时间</th>
                                        <th>状态</th>
                                        <th>消息数</th>
                                        <th>满意度</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <!-- 动态数据 -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 初始化图表
        this.initializeOverviewCharts();
    }

    /**
     * 创建KPI仪表板
     */
    createKPIDashboard(container) {
        container.innerHTML = `
            <div class="kpi-dashboard">
                <div class="kpi-categories">
                    <div class="category-tabs">
                        <button class="tab-btn active" data-category="all">全部</button>
                        <button class="tab-btn" data-category="performance">性能</button>
                        <button class="tab-btn" data-category="customer">客户</button>
                        <button class="tab-btn" data-category="business">业务</button>
                        <button class="tab-btn" data-category="employee">员工</button>
                        <button class="tab-btn" data-category="system">系统</button>
                    </div>
                </div>

                <div class="kpi-grid" id="kpi-grid">
                    <!-- 动态KPI卡片 -->
                </div>

                <div class="kpi-analytics">
                    <div class="analytics-section">
                        <h3>KPI趋势分析</h3>
                        <canvas id="kpi-trends-chart"></canvas>
                    </div>
                </div>
            </div>
        `;

        this.initializeKPIDashboard();
    }

    /**
     * 创建绩效仪表板
     */
    createPerformanceDashboard(container) {
        container.innerHTML = `
            <div class="performance-dashboard">
                <div class="performance-summary">
                    <div class="summary-cards">
                        <div class="summary-card">
                            <h3>总员工数</h3>
                            <div class="summary-value" id="total-employees">-</div>
                        </div>
                        <div class="summary-card">
                            <h3>活跃员工</h3>
                            <div class="summary-value" id="active-employees">-</div>
                        </div>
                        <div class="summary-card">
                            <h3>平均生产力</h3>
                            <div class="summary-value" id="avg-productivity">-</div>
                        </div>
                        <div class="summary-card">
                            <h3>平均质量分</h3>
                            <div class="summary-value" id="avg-quality">-</div>
                        </div>
                    </div>
                </div>

                <div class="performance-charts">
                    <div class="chart-container">
                        <h3>员工绩效排名</h3>
                        <canvas id="employee-performance-chart"></canvas>
                    </div>
                    <div class="chart-container">
                        <h3>绩效趋势</h3>
                        <canvas id="performance-trend-chart"></canvas>
                    </div>
                </div>

                <div class="performance-table">
                    <h3>详细绩效数据</h3>
                    <table id="performance-data-table" class="data-table">
                        <thead>
                            <tr>
                                <th>员工</th>
                                <th>对话数</th>
                                <th>响应时间</th>
                                <th>满意度</th>
                                <th>生产力分</th>
                                <th>质量分</th>
                                <th>排名</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- 动态数据 -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        this.initializePerformanceDashboard();
    }

    /**
     * 创建满意度仪表板
     */
    createSatisfactionDashboard(container) {
        container.innerHTML = `
            <div class="satisfaction-dashboard">
                <div class="satisfaction-overview">
                    <div class="satisfaction-gauge">
                        <h3>整体满意度</h3>
                        <canvas id="satisfaction-gauge-chart"></canvas>
                    </div>
                    <div class="satisfaction-distribution">
                        <h3>满意度分布</h3>
                        <canvas id="satisfaction-pie-chart"></canvas>
                    </div>
                </div>

                <div class="satisfaction-details">
                    <div class="details-section">
                        <h3>满意度趋势</h3>
                        <canvas id="satisfaction-trend-chart"></canvas>
                    </div>
                    <div class="details-section">
                        <h3>各维度评分</h3>
                        <canvas id="satisfaction-radar-chart"></canvas>
                    </div>
                </div>

                <div class="feedback-analysis">
                    <h3>客户反馈分析</h3>
                    <div id="feedback-table-container">
                        <table id="feedback-table" class="data-table">
                            <thead>
                                <tr>
                                    <th>客户</th>
                                    <th>评分</th>
                                    <th>反馈内容</th>
                                    <th>情感</th>
                                    <th>时间</th>
                                    <th>处理员工</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- 动态反馈数据 -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        this.initializeSatisfactionDashboard();
    }

    /**
     * 创建收入仪表板
     */
    createRevenueDashboard(container) {
        container.innerHTML = `
            <div class="revenue-dashboard">
                <div class="revenue-summary">
                    <div class="revenue-cards">
                        <div class="revenue-card">
                            <h3>总收入</h3>
                            <div class="revenue-value" id="total-revenue-display">-</div>
                            <div class="revenue-change" id="revenue-growth">-</div>
                        </div>
                        <div class="revenue-card">
                            <h3>月度经常性收入(MRR)</h3>
                            <div class="revenue-value" id="mrr-display">-</div>
                        </div>
                        <div class="revenue-card">
                            <h3>年度经常性收入(ARR)</h3>
                            <div class="revenue-value" id="arr-display">-</div>
                        </div>
                        <div class="revenue-card">
                            <h3>客户生命周期价值(LTV)</h3>
                            <div class="revenue-value" id="ltv-display">-</div>
                        </div>
                    </div>
                </div>

                <div class="revenue-charts">
                    <div class="chart-container">
                        <h3>收入趋势</h3>
                        <canvas id="revenue-trend-chart"></canvas>
                    </div>
                    <div class="chart-container">
                        <h3>订阅类型分布</h3>
                        <canvas id="subscription-chart"></canvas>
                    </div>
                </div>

                <div class="revenue-analysis">
                    <div class="analysis-section">
                        <h3>收入预测</h3>
                        <canvas id="revenue-forecast-chart"></canvas>
                    </div>
                    <div class="analysis-section">
                        <h3>客户获取与流失</h3>
                        <canvas id="churn-retention-chart"></canvas>
                    </div>
                </div>
            </div>
        `;

        this.initializeRevenueDashboard();
    }

    /**
     * 设置WebSocket处理器
     */
    setupWebSocketHandlers() {
        this.websocketClient
            .onOpen(() => {
                console.log('📡 WebSocket连接已建立');
                this.updateConnectionStatus('connected');
                
                // 订阅分析数据更新
                this.websocketClient.send({
                    type: 'subscribe',
                    channel: 'analytics',
                    shopId: this.shopId
                });
            })
            .onMessage((data) => {
                this.handleWebSocketMessage(data);
            })
            .onClose(() => {
                console.log('📡 WebSocket连接已断开');
                this.updateConnectionStatus('disconnected');
            })
            .onError((error) => {
                console.error('❌ WebSocket连接错误:', error);
                this.updateConnectionStatus('error');
            })
            .onReconnect((attemptCount) => {
                console.log(`🔄 WebSocket重连中... (第${attemptCount}次)`);
            });
    }

    /**
     * 初始化WebSocket连接 (保留API兼容性)
     */
    initializeWebSocket() {
        return this.websocketClient.connect();
    }

    /**
     * 处理WebSocket消息
     */
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'analytics_update':
                this.handleAnalyticsUpdate(data.payload);
                break;
            case 'kpi_alert':
                this.handleKPIAlert(data.payload);
                break;
            case 'real_time_metric':
                this.handleRealTimeMetric(data.payload);
                break;
            default:
                console.log('📨 收到未知类型的WebSocket消息:', data);
        }
    }

    /**
     * 处理分析数据更新
     */
    handleAnalyticsUpdate(payload) {
        console.log('📊 收到分析数据更新:', payload);
        
        // 更新相应的图表和指标
        if (payload.metrics) {
            this.updateMetricCards(payload.metrics);
        }
        
        if (payload.charts) {
            this.updateCharts(payload.charts);
        }
        
        // 显示更新通知
        this.showNotification('数据已更新', 'success');
    }

    /**
     * 处理KPI警报
     */
    handleKPIAlert(payload) {
        console.log('🚨 收到KPI警报:', payload);
        
        // 显示警报通知
        this.showAlert(payload);
        
        // 更新警报列表
        this.updateAlertsList(payload);
    }

    /**
     * 处理实时指标
     */
    handleRealTimeMetric(payload) {
        // 更新实时指标显示
        this.updateRealTimeMetrics(payload);
    }

    /**
     * 加载初始数据
     */
    async loadInitialData() {
        try {
            this.showLoading(true);
            
            console.log('📊 开始加载仪表板数据...');
            
            // 并行加载各类数据
            const [
                dashboardData,
                employeeList,
                alerts
            ] = await Promise.all([
                this.fetchDashboardData(),
                this.fetchEmployeeList(),
                this.fetchAlerts()
            ]);

            // 更新UI
            this.updateDashboardData(dashboardData);
            this.updateEmployeeFilter(employeeList);
            this.updateAlerts(alerts);
            
            console.log('✅ 仪表板数据加载完成');
            
        } catch (error) {
            console.error('❌ 加载仪表板数据失败:', error);
            this.showErrorMessage('数据加载失败，请刷新页面重试');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 获取仪表板数据
     */
    async fetchDashboardData() {
        const response = await fetch(`/api/analytics/enhanced-dashboard/${this.shopId}?timeRange=${this.currentTimeRange}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
            }
        });

        if (!response.ok) {
            throw new Error(`获取仪表板数据失败: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * 获取员工列表
     */
    async fetchEmployeeList() {
        const response = await fetch(`/api/employees/${this.shopId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
            }
        });

        if (!response.ok) {
            throw new Error(`获取员工列表失败: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * 获取警报
     */
    async fetchAlerts() {
        const response = await fetch(`/api/analytics/alerts/${this.shopId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
            }
        });

        if (!response.ok) {
            // 警报获取失败不阻塞主流程
            console.warn('获取警报失败:', response.status);
            return [];
        }

        return await response.json();
    }

    /**
     * 更新仪表板数据
     */
    updateDashboardData(data) {
        try {
            console.log('🔄 更新仪表板数据...', data);
            
            // 更新指标卡片
            if (data.business && data.business.summary) {
                this.updateMetricCards(data.business.summary);
            }
            
            // 更新图表
            this.updateChartsWithData(data);
            
            // 更新表格
            this.updateTablesWithData(data);
            
        } catch (error) {
            console.error('❌ 更新仪表板数据失败:', error);
        }
    }

    /**
     * 更新指标卡片
     */
    updateMetricCards(metrics) {
        // 更新对话总数
        if (metrics.totalConversations !== undefined) {
            const element = document.getElementById('total-conversations');
            if (element) {
                element.textContent = this.formatNumber(metrics.totalConversations);
            }
        }
        
        // 更新平均响应时间
        if (metrics.avgResponseTime !== undefined) {
            const element = document.getElementById('avg-response-time');
            if (element) {
                element.textContent = this.formatTime(metrics.avgResponseTime);
            }
        }
        
        // 更新客户满意度
        if (metrics.avgSatisfaction !== undefined) {
            const element = document.getElementById('avg-satisfaction');
            if (element) {
                element.textContent = metrics.avgSatisfaction.toFixed(1) + '/5.0';
            }
        }
        
        // 更新总收入
        if (metrics.totalRevenue !== undefined) {
            const element = document.getElementById('total-revenue');
            if (element) {
                element.textContent = this.formatCurrency(metrics.totalRevenue);
            }
        }
        
        // 更新变化趋势
        this.updateMetricChanges(metrics);
    }

    /**
     * 更新指标变化
     */
    updateMetricChanges(metrics) {
        if (metrics.trend) {
            // 根据趋势更新变化指示器
            const changeElements = {
                'conversations-change': metrics.trend.conversations,
                'response-time-change': metrics.trend.responseTime,
                'satisfaction-change': metrics.trend.satisfaction,
                'revenue-change': metrics.trend.revenue
            };
            
            Object.entries(changeElements).forEach(([elementId, trend]) => {
                const element = document.getElementById(elementId);
                if (element && trend) {
                    const icon = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→';
                    const className = trend === 'up' ? 'positive' : trend === 'down' ? 'negative' : 'neutral';
                    element.innerHTML = `<span class="trend-${className}">${icon}</span>`;
                }
            });
        }
    }

    /**
     * 初始化概览图表
     */
    initializeOverviewCharts() {
        // 对话趋势图表
        const conversationsTrendCtx = document.getElementById('conversations-trend-chart');
        if (conversationsTrendCtx) {
            this.charts.set('conversations-trend', new Chart(conversationsTrendCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: '对话数量',
                        data: [],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        fill: true
                    }]
                },
                options: this.getDefaultChartOptions()
            }));
        }
        
        // 响应时间图表
        const responseTimeCtx = document.getElementById('response-time-chart');
        if (responseTimeCtx) {
            this.charts.set('response-time', new Chart(responseTimeCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: '响应时间(分钟)',
                        data: [],
                        backgroundColor: '#764ba2'
                    }]
                },
                options: this.getDefaultChartOptions()
            }));
        }
        
        // 员工排名图表
        const employeeRankingCtx = document.getElementById('employee-ranking-chart');
        if (employeeRankingCtx) {
            this.charts.set('employee-ranking', new Chart(employeeRankingCtx, {
                type: 'horizontalBar',
                data: {
                    labels: [],
                    datasets: [{
                        label: '绩效分数',
                        data: [],
                        backgroundColor: '#f093fb'
                    }]
                },
                options: this.getDefaultChartOptions()
            }));
        }
        
        // 满意度分布图表
        const satisfactionDistCtx = document.getElementById('satisfaction-distribution-chart');
        if (satisfactionDistCtx) {
            this.charts.set('satisfaction-distribution', new Chart(satisfactionDistCtx, {
                type: 'doughnut',
                data: {
                    labels: ['非常满意', '满意', '一般', '不满意', '非常不满意'],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#4caf50',
                            '#8bc34a',
                            '#ffc107',
                            '#ff9800',
                            '#f44336'
                        ]
                    }]
                },
                options: this.getDefaultChartOptions()
            }));
        }
    }

    /**
     * 获取默认图表配置
     */
    getDefaultChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                }
            }
        };
    }

    /**
     * 更新图表数据
     */
    updateChartsWithData(data) {
        // 更新对话趋势图表
        if (data.business && data.business.daily) {
            this.updateConversationsTrendChart(data.business.daily);
        }
        
        // 更新员工绩效图表
        if (data.employees && data.employees.rankings) {
            this.updateEmployeeRankingChart(data.employees.rankings);
        }
        
        // 更新满意度分布图表
        if (data.satisfaction && data.satisfaction.summary) {
            this.updateSatisfactionDistributionChart(data.satisfaction.summary);
        }
    }

    /**
     * 更新对话趋势图表
     */
    updateConversationsTrendChart(dailyData) {
        const chart = this.charts.get('conversations-trend');
        if (chart && dailyData) {
            const labels = dailyData.map(d => this.formatDate(d.metric_date));
            const data = dailyData.map(d => d.total_conversations || 0);
            
            chart.data.labels = labels;
            chart.data.datasets[0].data = data;
            chart.update();
        }
    }

    /**
     * 更新员工排名图表
     */
    updateEmployeeRankingChart(rankings) {
        const chart = this.charts.get('employee-ranking');
        if (chart && rankings) {
            const topEmployees = rankings.slice(0, 10); // 显示前10名
            const labels = topEmployees.map(e => e.employee_name || '未知');
            const data = topEmployees.map(e => e.productivity_score || 0);
            
            chart.data.labels = labels;
            chart.data.datasets[0].data = data;
            chart.update();
        }
    }

    /**
     * 更新满意度分布图表
     */
    updateSatisfactionDistributionChart(summary) {
        const chart = this.charts.get('satisfaction-distribution');
        if (chart && summary && summary.distribution) {
            const dist = summary.distribution;
            const data = [
                dist.excellent || 0,
                dist.good || 0,
                dist.neutral || 0,
                dist.poor || 0,
                dist.terrible || 0
            ];
            
            chart.data.datasets[0].data = data;
            chart.update();
        }
    }

    /**
     * 更新表格数据
     */
    updateTablesWithData(data) {
        // 这里可以添加表格数据更新逻辑
        console.log('🔄 更新表格数据', data);
    }

    /**
     * 切换仪表板模式
     */
    switchDashboardMode(mode) {
        if (this.dashboardMode === mode) return;
        
        // 更新UI状态
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
        
        this.dashboardMode = mode;
        this.createDashboardContent();
        this.loadModeSpecificData(mode);
    }

    /**
     * 加载特定模式数据
     */
    async loadModeSpecificData(mode) {
        try {
            this.showLoading(true);
            
            let data;
            switch (mode) {
                case 'kpi':
                    data = await this.fetchKPIData();
                    this.updateKPIDashboard(data);
                    break;
                case 'performance':
                    data = await this.fetchPerformanceData();
                    this.updatePerformanceDashboard(data);
                    break;
                case 'satisfaction':
                    data = await this.fetchSatisfactionData();
                    this.updateSatisfactionDashboard(data);
                    break;
                case 'revenue':
                    data = await this.fetchRevenueData();
                    this.updateRevenueDashboard(data);
                    break;
            }
            
        } catch (error) {
            console.error(`❌ 加载${mode}数据失败:`, error);
            this.showErrorMessage('数据加载失败');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 刷新仪表板
     */
    async refreshDashboard() {
        try {
            console.log('🔄 刷新仪表板数据...');
            
            // 清除缓存
            this.clearCache();
            
            // 重新加载数据
            await this.loadInitialData();
            
            this.showNotification('数据已刷新', 'success');
            
        } catch (error) {
            console.error('❌ 刷新仪表板失败:', error);
            this.showNotification('数据刷新失败', 'error');
        }
    }

    /**
     * 启动实时更新
     */
    startRealTimeUpdates() {
        if (this.isRealTimeEnabled) {
            // 每30秒自动刷新一次
            this.refreshInterval = setInterval(() => {
                this.refreshQuickMetrics();
            }, 30000);
        }
    }

    /**
     * 刷新快速指标
     */
    async refreshQuickMetrics() {
        try {
            const metrics = await this.fetchQuickMetrics();
            this.updateQuickMetrics(metrics);
        } catch (error) {
            console.error('❌ 刷新快速指标失败:', error);
        }
    }

    /**
     * 获取快速指标
     */
    async fetchQuickMetrics() {
        const response = await fetch(`/api/analytics/quick-metrics/${this.shopId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
            }
        });

        if (!response.ok) {
            throw new Error(`获取快速指标失败: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * 更新快速指标
     */
    updateQuickMetrics(metrics) {
        const container = document.getElementById('quick-metrics');
        if (!container || !metrics) return;
        
        container.innerHTML = `
            <div class="quick-metric">
                <span class="metric-label">活跃对话</span>
                <span class="metric-value">${metrics.activeConversations || 0}</span>
            </div>
            <div class="quick-metric">
                <span class="metric-label">在线员工</span>
                <span class="metric-value">${metrics.onlineEmployees || 0}</span>
            </div>
            <div class="quick-metric">
                <span class="metric-label">响应时间</span>
                <span class="metric-value">${this.formatTime(metrics.avgResponseTime || 0)}</span>
            </div>
            <div class="quick-metric">
                <span class="metric-label">今日收入</span>
                <span class="metric-value">${this.formatCurrency(metrics.todayRevenue || 0)}</span>
            </div>
        `;
    }

    /**
     * 显示导出模态框
     */
    showExportModal() {
        const modal = document.getElementById('modal-overlay');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        const confirmBtn = document.getElementById('modal-confirm');
        
        title.textContent = '导出数据';
        body.innerHTML = `
            <form id="export-form">
                <div class="form-group">
                    <label>导出类型</label>
                    <select name="reportType" required>
                        <option value="dashboard">完整仪表板</option>
                        <option value="kpi">KPI指标</option>
                        <option value="performance">员工绩效</option>
                        <option value="satisfaction">客户满意度</option>
                        <option value="revenue">收入分析</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>导出格式</label>
                    <select name="format" required>
                        <option value="json">JSON</option>
                        <option value="csv">CSV</option>
                        <option value="excel">Excel</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>时间范围</label>
                    <select name="timeRange" required>
                        <option value="24h">最近24小时</option>
                        <option value="7d">最近7天</option>
                        <option value="30d">最近30天</option>
                        <option value="90d">最近90天</option>
                    </select>
                </div>
            </form>
        `;
        
        confirmBtn.textContent = '导出';
        confirmBtn.onclick = () => this.handleExport();
        
        modal.classList.remove('hidden');
    }

    /**
     * 处理导出
     */
    async handleExport() {
        try {
            const form = document.getElementById('export-form');
            const formData = new FormData(form);
            const exportOptions = Object.fromEntries(formData);
            
            console.log('📄 开始导出数据...', exportOptions);
            
            const response = await fetch(`/api/analytics/export/${this.shopId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
                },
                body: JSON.stringify(exportOptions)
            });
            
            if (!response.ok) {
                throw new Error(`导出失败: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // 下载文件
                this.downloadExportedData(result.data, exportOptions.format, exportOptions.reportType);
                this.showNotification('数据导出成功', 'success');
            } else {
                throw new Error(result.message || '导出失败');
            }
            
            this.hideModal();
            
        } catch (error) {
            console.error('❌ 导出数据失败:', error);
            this.showNotification('数据导出失败', 'error');
        }
    }

    /**
     * 下载导出的数据
     */
    downloadExportedData(data, format, reportType) {
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `${reportType}_${timestamp}.${format}`;
        
        const blob = new Blob([data], { 
            type: format === 'json' ? 'application/json' : 'text/plain' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 显示设置模态框
     */
    showSettingsModal() {
        const modal = document.getElementById('modal-overlay');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        const confirmBtn = document.getElementById('modal-confirm');
        
        title.textContent = '仪表板设置';
        body.innerHTML = `
            <form id="settings-form">
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="realTimeEnabled" ${this.isRealTimeEnabled ? 'checked' : ''}>
                        启用实时更新
                    </label>
                </div>
                <div class="form-group">
                    <label>自动刷新间隔(秒)</label>
                    <input type="number" name="refreshInterval" value="30" min="10" max="300">
                </div>
                <div class="form-group">
                    <label>默认时间范围</label>
                    <select name="defaultTimeRange">
                        <option value="1h">1小时</option>
                        <option value="24h" selected>24小时</option>
                        <option value="7d">7天</option>
                        <option value="30d">30天</option>
                    </select>
                </div>
            </form>
        `;
        
        confirmBtn.textContent = '保存';
        confirmBtn.onclick = () => this.saveSettings();
        
        modal.classList.remove('hidden');
    }

    /**
     * 保存设置
     */
    saveSettings() {
        try {
            const form = document.getElementById('settings-form');
            const formData = new FormData(form);
            const settings = Object.fromEntries(formData);
            
            // 更新设置
            this.isRealTimeEnabled = settings.realTimeEnabled === 'on';
            this.currentTimeRange = settings.defaultTimeRange || '24h';
            
            // 保存到localStorage
            localStorage.setItem('analyticsSettings', JSON.stringify(settings));
            
            this.showNotification('设置已保存', 'success');
            this.hideModal();
            
            // 重新启动实时更新
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
            this.startRealTimeUpdates();
            
        } catch (error) {
            console.error('❌ 保存设置失败:', error);
            this.showNotification('设置保存失败', 'error');
        }
    }

    /**
     * 切换全屏
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.container.requestFullscreen().catch(err => {
                console.error('❌ 进入全屏失败:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * 更新连接状态
     */
    updateConnectionStatus(status) {
        const indicator = document.getElementById('connection-status');
        const statusText = document.querySelector('.status-text');
        
        if (indicator && statusText) {
            indicator.className = `status-indicator ${status}`;
            
            switch (status) {
                case 'connected':
                    statusText.textContent = '实时连接';
                    break;
                case 'disconnected':
                    statusText.textContent = '连接断开';
                    break;
                case 'error':
                    statusText.textContent = '连接错误';
                    break;
            }
        }
    }

    /**
     * 显示加载状态
     */
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            if (show) {
                overlay.classList.remove('hidden');
            } else {
                overlay.classList.add('hidden');
            }
        }
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications-container');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        container.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * 显示错误消息
     */
    showErrorMessage(message) {
        this.showNotification(message, 'error');
    }

    /**
     * 隐藏模态框
     */
    hideModal() {
        const modal = document.getElementById('modal-overlay');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 模态框关闭事件
        document.getElementById('modal-close').addEventListener('click', () => this.hideModal());
        document.getElementById('modal-cancel').addEventListener('click', () => this.hideModal());
        
        // 点击模态框外部关闭
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                this.hideModal();
            }
        });
        
        // 筛选器事件
        document.getElementById('employee-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('customer-type-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('conversation-status-filter').addEventListener('change', () => this.applyFilters());
    }

    /**
     * 应用筛选器
     */
    applyFilters() {
        const employeeFilter = document.getElementById('employee-filter').value;
        const customerTypeFilter = document.getElementById('customer-type-filter').value;
        const conversationStatusFilter = document.getElementById('conversation-status-filter').value;
        
        this.filters = {
            employee: employeeFilter,
            customerType: customerTypeFilter,
            conversationStatus: conversationStatusFilter
        };
        
        console.log('🔍 应用筛选器:', this.filters);
        
        // 重新加载数据
        this.refreshDashboard();
    }

    /**
     * 格式化数字
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    /**
     * 格式化时间
     */
    formatTime(minutes) {
        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return `${hours}小时${mins}分钟`;
        }
        return `${Math.round(minutes)}分钟`;
    }

    /**
     * 格式化货币
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: 'CNY'
        }).format(amount);
    }

    /**
     * 格式化日期
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * 清除缓存
     */
    clearCache() {
        // 这里可以清除相关缓存
        console.log('🧹 清除缓存');
    }

    /**
     * 销毁实例
     */
    destroy() {
        try {
            console.log('🔄 销毁增强型分析仪表板实例...');
            
            // 清理WebSocket连接
            if (this.websocket) {
                this.websocket.close();
            }
            
            // 清理定时器
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
            
            // 清理图表
            this.charts.forEach(chart => {
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            });
            this.charts.clear();
            
            // 清理事件监听器
            // 这里可以添加更多的事件监听器清理
            
            console.log('✅ 增强型分析仪表板实例销毁完成');
            
        } catch (error) {
            console.error('❌ 销毁增强型分析仪表板实例失败:', error);
        }
    }
}

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 页面加载完成，初始化增强型数据分析仪表板...');
    window.enhancedAnalyticsDashboard = new EnhancedAnalyticsDashboard();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (window.enhancedAnalyticsDashboard) {
        window.enhancedAnalyticsDashboard.destroy();
    }
});

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedAnalyticsDashboard;
}