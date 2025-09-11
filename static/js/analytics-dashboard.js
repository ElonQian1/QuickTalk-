/**
 * 数据分析仪表板管理器 - 前端组件
 * 
 * 功能包括：
 * - 实时监控面板
 * - 可视化图表
 * - KPI指标展示
 * - 数据导出
 * - 自动刷新
 * 
 * @author QuickTalk Team
 * @version 3.0.0
 */

class AnalyticsDashboard {
    constructor() {
        this.shopId = null;
        this.refreshInterval = null;
        this.charts = {};
        this.currentTimeRange = '24h';
        
        console.log('📊 数据分析仪表板初始化');
        this.init();
    }

    /**
     * 初始化仪表板
     */
    async init() {
        try {
            // 获取店铺信息
            await this.loadShopInfo();
            
            // 创建仪表板界面
            this.createDashboardInterface();
            
            // 加载初始数据
            await this.loadAllData();
            
            // 设置自动刷新
            this.startAutoRefresh();
            
            console.log('✅ 数据分析仪表板初始化完成');
            
        } catch (error) {
            console.error('❌ 仪表板初始化失败:', error);
            this.showError('仪表板初始化失败');
        }
    }

    /**
     * 获取店铺信息
     */
    async loadShopInfo() {
        try {
            // 从URL或本地存储获取店铺ID
            const urlParams = new URLSearchParams(window.location.search);
            this.shopId = urlParams.get('shopId') || localStorage.getItem('currentShopId') || 'default_shop';
            
            console.log('📍 当前店铺ID:', this.shopId);
            
        } catch (error) {
            console.error('❌ 获取店铺信息失败:', error);
            this.shopId = 'default_shop';
        }
    }

    /**
     * 创建仪表板界面
     */
    createDashboardInterface() {
        const container = document.getElementById('analytics-dashboard') || document.body;
        
        container.innerHTML = `
            <div class="analytics-dashboard">
                <!-- 头部控制区域 -->
                <div class="dashboard-header">
                    <div class="header-title">
                        <h2>📊 数据分析仪表板</h2>
                        <span class="last-updated">最后更新: <span id="last-updated-time">--</span></span>
                    </div>
                    <div class="header-controls">
                        <select id="time-range-select" class="time-range-select">
                            <option value="1h">过去1小时</option>
                            <option value="24h" selected>过去24小时</option>
                            <option value="7d">过去7天</option>
                            <option value="30d">过去30天</option>
                        </select>
                        <button class="refresh-btn" onclick="dashboard.refreshData()">
                            🔄 刷新
                        </button>
                        <button class="export-btn" onclick="dashboard.exportReport()">
                            📥 导出报告
                        </button>
                    </div>
                </div>

                <!-- 实时监控卡片区域 -->
                <div class="metrics-cards">
                    <div class="metric-card">
                        <div class="metric-icon">💬</div>
                        <div class="metric-content">
                            <div class="metric-title">对话总数</div>
                            <div class="metric-value" id="total-conversations">--</div>
                            <div class="metric-change" id="conversations-change">--</div>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-icon">📨</div>
                        <div class="metric-content">
                            <div class="metric-title">消息总数</div>
                            <div class="metric-value" id="total-messages">--</div>
                            <div class="metric-change" id="messages-change">--</div>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-icon">⚡</div>
                        <div class="metric-content">
                            <div class="metric-title">平均响应时间</div>
                            <div class="metric-value" id="avg-response-time">--</div>
                            <div class="metric-change" id="response-time-change">--</div>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-icon">😊</div>
                        <div class="metric-content">
                            <div class="metric-title">客户满意度</div>
                            <div class="metric-value" id="customer-satisfaction">--</div>
                            <div class="metric-change" id="satisfaction-change">--</div>
                        </div>
                    </div>
                </div>

                <!-- 图表区域 -->
                <div class="charts-container">
                    <div class="chart-row">
                        <div class="chart-card">
                            <div class="chart-header">
                                <h3>📈 对话趋势</h3>
                                <div class="chart-controls">
                                    <button class="chart-btn" onclick="dashboard.toggleChartType('conversations')">切换视图</button>
                                </div>
                            </div>
                            <div class="chart-content">
                                <canvas id="conversations-chart"></canvas>
                            </div>
                        </div>
                        
                        <div class="chart-card">
                            <div class="chart-header">
                                <h3>⏰ 工作负载分布</h3>
                                <div class="chart-controls">
                                    <button class="chart-btn" onclick="dashboard.toggleChartType('workload')">切换视图</button>
                                </div>
                            </div>
                            <div class="chart-content">
                                <canvas id="workload-chart"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <div class="chart-row">
                        <div class="chart-card">
                            <div class="chart-header">
                                <h3>👥 客服效率排行</h3>
                                <div class="chart-controls">
                                    <button class="chart-btn" onclick="dashboard.showStaffDetails()">详细信息</button>
                                </div>
                            </div>
                            <div class="chart-content">
                                <div id="staff-efficiency-list" class="staff-list"></div>
                            </div>
                        </div>
                        
                        <div class="chart-card">
                            <div class="chart-header">
                                <h3>⭐ 满意度分布</h3>
                                <div class="chart-controls">
                                    <button class="chart-btn" onclick="dashboard.showSatisfactionDetails()">详细分析</button>
                                </div>
                            </div>
                            <div class="chart-content">
                                <canvas id="satisfaction-chart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- KPI指标区域 -->
                <div class="kpi-section">
                    <div class="section-header">
                        <h3>🎯 KPI指标</h3>
                        <button class="kpi-report-btn" onclick="dashboard.generateKpiReport()">生成完整报告</button>
                    </div>
                    <div class="kpi-grid">
                        <div class="kpi-item">
                            <div class="kpi-title">响应时间得分</div>
                            <div class="kpi-score" id="response-time-score">--</div>
                            <div class="kpi-progress">
                                <div class="progress-bar" id="response-time-progress"></div>
                            </div>
                        </div>
                        
                        <div class="kpi-item">
                            <div class="kpi-title">客户满意度得分</div>
                            <div class="kpi-score" id="satisfaction-score">--</div>
                            <div class="kpi-progress">
                                <div class="progress-bar" id="satisfaction-progress"></div>
                            </div>
                        </div>
                        
                        <div class="kpi-item">
                            <div class="kpi-title">客服效率得分</div>
                            <div class="kpi-score" id="efficiency-score">--</div>
                            <div class="kpi-progress">
                                <div class="progress-bar" id="efficiency-progress"></div>
                            </div>
                        </div>
                        
                        <div class="kpi-item">
                            <div class="kpi-title">系统性能得分</div>
                            <div class="kpi-score" id="performance-score">--</div>
                            <div class="kpi-progress">
                                <div class="progress-bar" id="performance-progress"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 加载遮罩 -->
                <div id="dashboard-loading" class="loading-overlay" style="display: none;">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">正在加载数据...</div>
                </div>
            </div>
        `;

        // 绑定事件
        this.bindEvents();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 时间范围选择
        const timeRangeSelect = document.getElementById('time-range-select');
        if (timeRangeSelect) {
            timeRangeSelect.addEventListener('change', (e) => {
                this.currentTimeRange = e.target.value;
                this.loadAllData();
            });
        }

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'r':
                        e.preventDefault();
                        this.refreshData();
                        break;
                    case 'e':
                        e.preventDefault();
                        this.exportReport();
                        break;
                }
            }
        });
    }

    /**
     * 加载所有数据
     */
    async loadAllData() {
        this.showLoading(true);
        
        try {
            const [
                realtimeData,
                staffEfficiency,
                customerSatisfaction,
                workloadData
            ] = await Promise.all([
                this.loadRealtimeMetrics(),
                this.loadStaffEfficiency(),
                this.loadCustomerSatisfaction(),
                this.loadWorkloadAnalysis()
            ]);

            // 更新界面
            this.updateMetricCards(realtimeData);
            this.updateCharts({
                realtime: realtimeData,
                staff: staffEfficiency,
                satisfaction: customerSatisfaction,
                workload: workloadData
            });
            this.updateKpiScores(realtimeData);
            
            // 更新最后更新时间
            document.getElementById('last-updated-time').textContent = 
                new Date().toLocaleTimeString();

        } catch (error) {
            console.error('❌ 加载数据失败:', error);
            this.showError('数据加载失败');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 加载实时监控数据
     */
    async loadRealtimeMetrics() {
        try {
            const response = await fetch(
                `/api/analytics/realtime/${this.shopId}?timeRange=${this.currentTimeRange}`
            );
            
            if (!response.ok) {
                throw new Error('网络请求失败');
            }
            
            const result = await response.json();
            return result.data;
            
        } catch (error) {
            console.error('❌ 加载实时数据失败:', error);
            throw error;
        }
    }

    /**
     * 加载客服效率数据
     */
    async loadStaffEfficiency() {
        try {
            const response = await fetch(
                `/api/analytics/staff-efficiency/${this.shopId}?timeRange=${this.currentTimeRange}`
            );
            
            if (!response.ok) {
                throw new Error('网络请求失败');
            }
            
            const result = await response.json();
            return result.data;
            
        } catch (error) {
            console.error('❌ 加载客服效率数据失败:', error);
            throw error;
        }
    }

    /**
     * 加载客户满意度数据
     */
    async loadCustomerSatisfaction() {
        try {
            const response = await fetch(
                `/api/analytics/customer-satisfaction/${this.shopId}?timeRange=${this.currentTimeRange}`
            );
            
            if (!response.ok) {
                throw new Error('网络请求失败');
            }
            
            const result = await response.json();
            return result.data;
            
        } catch (error) {
            console.error('❌ 加载客户满意度数据失败:', error);
            throw error;
        }
    }

    /**
     * 加载工作负载分析数据
     */
    async loadWorkloadAnalysis() {
        try {
            const response = await fetch(
                `/api/analytics/workload/${this.shopId}?timeRange=${this.currentTimeRange}`
            );
            
            if (!response.ok) {
                throw new Error('网络请求失败');
            }
            
            const result = await response.json();
            return result.data;
            
        } catch (error) {
            console.error('❌ 加载工作负载数据失败:', error);
            throw error;
        }
    }

    /**
     * 更新指标卡片
     */
    updateMetricCards(data) {
        try {
            // 对话数据
            const totalConversations = document.getElementById('total-conversations');
            const conversationsChange = document.getElementById('conversations-change');
            if (totalConversations) {
                totalConversations.textContent = data.conversations.total.toLocaleString();
            }
            if (conversationsChange) {
                conversationsChange.textContent = `+${data.conversations.new} 新增`;
                conversationsChange.className = 'metric-change positive';
            }

            // 消息数据
            const totalMessages = document.getElementById('total-messages');
            const messagesChange = document.getElementById('messages-change');
            if (totalMessages) {
                totalMessages.textContent = data.messages.total.toLocaleString();
            }
            if (messagesChange) {
                messagesChange.textContent = `+${data.messages.new} 新增`;
                messagesChange.className = 'metric-change positive';
            }

            // 响应时间
            const avgResponseTime = document.getElementById('avg-response-time');
            const responseTimeChange = document.getElementById('response-time-change');
            if (avgResponseTime) {
                avgResponseTime.textContent = `${data.responseTime.average}分钟`;
            }
            if (responseTimeChange) {
                const isImprovement = data.responseTime.average < 5;
                responseTimeChange.textContent = isImprovement ? '表现良好' : '需要改善';
                responseTimeChange.className = `metric-change ${isImprovement ? 'positive' : 'negative'}`;
            }

            // 客户满意度 - 模拟数据
            const customerSatisfaction = document.getElementById('customer-satisfaction');
            const satisfactionChange = document.getElementById('satisfaction-change');
            if (customerSatisfaction) {
                customerSatisfaction.textContent = '4.3/5.0';
            }
            if (satisfactionChange) {
                satisfactionChange.textContent = '+0.1 提升';
                satisfactionChange.className = 'metric-change positive';
            }

        } catch (error) {
            console.error('❌ 更新指标卡片失败:', error);
        }
    }

    /**
     * 更新图表
     */
    updateCharts(data) {
        try {
            this.updateConversationChart(data.realtime);
            this.updateWorkloadChart(data.workload);
            this.updateStaffEfficiencyList(data.staff);
            this.updateSatisfactionChart(data.satisfaction);
            
        } catch (error) {
            console.error('❌ 更新图表失败:', error);
        }
    }

    /**
     * 更新对话趋势图表
     */
    updateConversationChart(data) {
        const canvas = document.getElementById('conversations-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // 销毁现有图表
        if (this.charts.conversations) {
            this.charts.conversations.destroy();
        }

        // 模拟时间序列数据
        const timeLabels = this.generateTimeLabels();
        const conversationData = this.generateTrendData(data.conversations.total);

        this.charts.conversations = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: [{
                    label: '对话数量',
                    data: conversationData,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
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
            }
        });
    }

    /**
     * 更新工作负载图表
     */
    updateWorkloadChart(data) {
        const canvas = document.getElementById('workload-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // 销毁现有图表
        if (this.charts.workload) {
            this.charts.workload.destroy();
        }

        // 使用24小时数据
        const hourLabels = Array.from({length: 24}, (_, i) => `${i}:00`);
        const workloadData = data.hourlyDistribution ? 
            data.hourlyDistribution.map(item => item.messageCount) :
            this.generateWorkloadData();

        this.charts.workload = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hourLabels,
                datasets: [{
                    label: '消息数量',
                    data: workloadData,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
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
            }
        });
    }

    /**
     * 更新客服效率列表
     */
    updateStaffEfficiencyList(data) {
        const container = document.getElementById('staff-efficiency-list');
        if (!container) return;

        const staffList = data.staffDetails || [
            { staffName: '客服小王', efficiency: 92, conversationsHandled: 45, avgResponseTime: 2.3 },
            { staffName: '客服小李', efficiency: 85, conversationsHandled: 38, avgResponseTime: 3.1 },
            { staffName: '客服小张', efficiency: 96, conversationsHandled: 52, avgResponseTime: 1.9 }
        ];

        container.innerHTML = staffList.map((staff, index) => `
            <div class="staff-item">
                <div class="staff-rank">#${index + 1}</div>
                <div class="staff-info">
                    <div class="staff-name">${staff.staffName}</div>
                    <div class="staff-stats">
                        处理对话: ${staff.conversationsHandled} | 平均响应: ${staff.avgResponseTime}分钟
                    </div>
                </div>
                <div class="staff-efficiency">
                    <div class="efficiency-score">${staff.efficiency}%</div>
                    <div class="efficiency-bar">
                        <div class="efficiency-fill" style="width: ${staff.efficiency}%"></div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * 更新满意度图表
     */
    updateSatisfactionChart(data) {
        const canvas = document.getElementById('satisfaction-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // 销毁现有图表
        if (this.charts.satisfaction) {
            this.charts.satisfaction.destroy();
        }

        const ratingDistribution = data.ratingDistribution || {
            5: 68, 4: 52, 3: 24, 2: 8, 1: 4
        };

        this.charts.satisfaction = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['5星', '4星', '3星', '2星', '1星'],
                datasets: [{
                    data: [
                        ratingDistribution[5],
                        ratingDistribution[4],
                        ratingDistribution[3],
                        ratingDistribution[2],
                        ratingDistribution[1]
                    ],
                    backgroundColor: [
                        '#4CAF50',
                        '#8BC34A',
                        '#FFC107',
                        '#FF9800',
                        '#F44336'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    /**
     * 更新KPI得分
     */
    updateKpiScores(data) {
        try {
            // 模拟KPI得分计算
            const responseTimeScore = Math.max(0, Math.min(100, (10 - data.responseTime.average) * 10));
            const satisfactionScore = 86; // 4.3/5 * 100 * 0.2 + 80
            const efficiencyScore = 91;
            const performanceScore = Math.max(0, Math.min(100, (300 - data.performance.avgResponseTime) / 2));

            this.updateKpiItem('response-time-score', 'response-time-progress', responseTimeScore);
            this.updateKpiItem('satisfaction-score', 'satisfaction-progress', satisfactionScore);
            this.updateKpiItem('efficiency-score', 'efficiency-progress', efficiencyScore);
            this.updateKpiItem('performance-score', 'performance-progress', performanceScore);

        } catch (error) {
            console.error('❌ 更新KPI得分失败:', error);
        }
    }

    /**
     * 更新单个KPI项目
     */
    updateKpiItem(scoreId, progressId, score) {
        const scoreElement = document.getElementById(scoreId);
        const progressElement = document.getElementById(progressId);
        
        if (scoreElement) {
            scoreElement.textContent = `${Math.round(score)}分`;
        }
        
        if (progressElement) {
            progressElement.style.width = `${score}%`;
            
            // 根据得分设置颜色
            if (score >= 80) {
                progressElement.style.backgroundColor = '#4CAF50';
            } else if (score >= 60) {
                progressElement.style.backgroundColor = '#FF9800';
            } else {
                progressElement.style.backgroundColor = '#F44336';
            }
        }
    }

    /**
     * 生成时间标签
     */
    generateTimeLabels() {
        const labels = [];
        const now = new Date();
        
        for (let i = 11; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 2 * 60 * 60 * 1000); // 每2小时一个点
            labels.push(time.getHours() + ':00');
        }
        
        return labels;
    }

    /**
     * 生成趋势数据
     */
    generateTrendData(total) {
        const data = [];
        const baseValue = Math.floor(total / 12);
        
        for (let i = 0; i < 12; i++) {
            const variation = Math.floor(Math.random() * baseValue * 0.4) - baseValue * 0.2;
            data.push(Math.max(0, baseValue + variation));
        }
        
        return data;
    }

    /**
     * 生成工作负载数据
     */
    generateWorkloadData() {
        const data = [];
        
        for (let hour = 0; hour < 24; hour++) {
            let value;
            if (hour >= 9 && hour <= 17) {
                // 工作时间高峰
                value = Math.floor(Math.random() * 30) + 20;
            } else if (hour >= 19 && hour <= 22) {
                // 晚间次高峰
                value = Math.floor(Math.random() * 20) + 15;
            } else {
                // 其他时间
                value = Math.floor(Math.random() * 10) + 5;
            }
            data.push(value);
        }
        
        return data;
    }

    /**
     * 刷新数据
     */
    async refreshData() {
        console.log('🔄 刷新仪表板数据');
        await this.loadAllData();
    }

    /**
     * 开始自动刷新
     */
    startAutoRefresh() {
        // 每5分钟自动刷新一次
        this.refreshInterval = setInterval(() => {
            this.loadAllData();
        }, 5 * 60 * 1000);
        
        console.log('⏰ 自动刷新已启动 (5分钟间隔)');
    }

    /**
     * 停止自动刷新
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('⏹️ 自动刷新已停止');
        }
    }

    /**
     * 显示/隐藏加载状态
     */
    showLoading(show) {
        const loadingOverlay = document.getElementById('dashboard-loading');
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        // 这里可以使用更复杂的错误显示组件
        alert('错误: ' + message);
    }

    /**
     * 生成KPI报告
     */
    async generateKpiReport() {
        try {
            this.showLoading(true);
            
            const response = await fetch(`/api/analytics/kpi-report/${this.shopId}?reportType=weekly`);
            
            if (!response.ok) {
                throw new Error('网络请求失败');
            }
            
            const result = await response.json();
            
            // 显示报告模态框或下载报告
            this.showKpiReportModal(result.data);
            
        } catch (error) {
            console.error('❌ 生成KPI报告失败:', error);
            this.showError('生成KPI报告失败');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 显示KPI报告模态框
     */
    showKpiReportModal(reportData) {
        // 创建模态框显示详细报告
        const modal = document.createElement('div');
        modal.className = 'kpi-report-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📊 KPI报告</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="report-summary">
                        <h4>报告摘要</h4>
                        <p>报告类型: ${reportData.reportType}</p>
                        <p>生成时间: ${new Date(reportData.generatedAt).toLocaleString()}</p>
                        <p>总体得分: ${Math.round(reportData.kpiScores.overall)}分</p>
                    </div>
                    <div class="report-metrics">
                        <h4>详细指标</h4>
                        <ul>
                            <li>对话总数: ${reportData.summary.totalConversations}</li>
                            <li>消息总数: ${reportData.summary.totalMessages}</li>
                            <li>平均评分: ${reportData.summary.averageRating}</li>
                            <li>客服人员: ${reportData.summary.staffCount}人</li>
                        </ul>
                    </div>
                    <div class="report-recommendations">
                        <h4>改进建议</h4>
                        <ul>
                            ${reportData.recommendations.map(rec => 
                                `<li><strong>${rec.title}:</strong> ${rec.description}</li>`
                            ).join('')}
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="dashboard.downloadReport()">下载完整报告</button>
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">关闭</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * 导出报告
     */
    async exportReport() {
        try {
            const reportData = await fetch(`/api/analytics/kpi-report/${this.shopId}?reportType=weekly`);
            const result = await reportData.json();
            
            // 创建CSV格式的报告
            const csvContent = this.generateCsvReport(result.data);
            
            // 下载文件
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `KPI报告_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('📥 报告导出成功');
            
        } catch (error) {
            console.error('❌ 导出报告失败:', error);
            this.showError('导出报告失败');
        }
    }

    /**
     * 生成CSV报告
     */
    generateCsvReport(data) {
        const csv = [];
        
        // 头部信息
        csv.push('QuickTalk 客服系统 KPI 报告');
        csv.push(`生成时间,${new Date(data.generatedAt).toLocaleString()}`);
        csv.push(`报告类型,${data.reportType}`);
        csv.push('');
        
        // 摘要数据
        csv.push('指标名称,数值');
        csv.push(`对话总数,${data.summary.totalConversations}`);
        csv.push(`消息总数,${data.summary.totalMessages}`);
        csv.push(`平均评分,${data.summary.averageRating}`);
        csv.push(`客服人员,${data.summary.staffCount}`);
        csv.push('');
        
        // KPI得分
        csv.push('KPI指标,得分');
        csv.push(`响应时间得分,${Math.round(data.kpiScores.responseTime)}`);
        csv.push(`客户满意度得分,${Math.round(data.kpiScores.customerSatisfaction)}`);
        csv.push(`客服效率得分,${Math.round(data.kpiScores.staffEfficiency)}`);
        csv.push(`系统性能得分,${Math.round(data.kpiScores.systemPerformance)}`);
        csv.push(`总体得分,${Math.round(data.kpiScores.overall)}`);
        
        return csv.join('\n');
    }

    /**
     * 销毁仪表板
     */
    destroy() {
        this.stopAutoRefresh();
        
        // 销毁所有图表
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        
        console.log('🗑️ 数据分析仪表板已销毁');
    }
}

// 全局实例
let dashboard = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new AnalyticsDashboard();
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (dashboard) {
        dashboard.destroy();
    }
});
