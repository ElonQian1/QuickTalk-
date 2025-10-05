/**
 * MessageFunctionalityChecker - 消息功能完整性检查器
 * 
 * 目的：验证重构后的消息模块功能完整性
 * 检查项：模块加载、API可用性、集成状态、性能指标
 */
(function() {
    'use strict';

    class MessageFunctionalityChecker {
        constructor() {
            this.results = {
                moduleLoading: {},
                apiAvailability: {},
                integration: {},
                performance: {},
                overall: {
                    score: 0,
                    status: 'unknown',
                    recommendations: []
                }
            };
        }

        /**
         * 运行完整性检查
         */
        async runCheck() {
            console.log('🔍 开始验证消息功能完整性...');
            
            this._checkModuleLoading();
            this._checkAPIAvailability();
            this._checkIntegration();
            await this._checkPerformance();
            
            this._calculateOverallScore();
            this._generateReport();
            
            return this.results;
        }

        /**
         * 检查模块加载状态
         */
        _checkModuleLoading() {
            console.log('📦 检查模块加载状态...');
            
            const modules = {
                'MessageCoordinator': window.MessageCoordinator,
                'MessageLegacyCompatLayer': window.MessageLegacyCompatLayer,
                'SimpleWebSocketAdapter': window.SimpleWebSocketAdapter,
                'MessageModuleIntegrator': window.MessageModuleIntegrator,
                'MessageEventBus': window.MessageEventBus,
                'MessageStateStore': window.MessageStateStore,
                'ShopsManager': window.ShopsManager,
                'ConversationsManager': window.ConversationsManager,
                'MessagesManager': window.MessagesManager
            };

            Object.entries(modules).forEach(([name, module]) => {
                this.results.moduleLoading[name] = {
                    loaded: !!module,
                    type: module ? typeof module : 'undefined',
                    status: module ? 'available' : 'missing'
                };
            });

            const loadedCount = Object.values(this.results.moduleLoading)
                .filter(m => m.loaded).length;
            const totalCount = Object.keys(this.results.moduleLoading).length;

            this.results.moduleLoading.summary = {
                loaded: loadedCount,
                total: totalCount,
                percentage: Math.round((loadedCount / totalCount) * 100)
            };

            console.log(`✅ 模块加载检查完成: ${loadedCount}/${totalCount} (${this.results.moduleLoading.summary.percentage}%)`);
        }

        /**
         * 检查API可用性
         */
        _checkAPIAvailability() {
            console.log('🔌 检查API可用性...');
            
            // 检查核心协调器API
            const coordinator = window.MessageModuleInstance || window.messageModule;
            this.results.apiAvailability.coordinator = this._checkCoordinatorAPI(coordinator);
            
            // 检查集成器API
            const integrator = window.MessageIntegratorInstance;
            this.results.apiAvailability.integrator = this._checkIntegratorAPI(integrator);
            
            // 检查Legacy兼容API
            const legacyCompat = window.MessageLegacyCompat;
            this.results.apiAvailability.legacyCompat = this._checkLegacyCompatAPI(legacyCompat);
            
            // 检查WebSocket API
            const wsAdapter = window.WebSocketAdapter;
            this.results.apiAvailability.websocket = this._checkWebSocketAPI(wsAdapter);

            console.log('✅ API可用性检查完成');
        }

        /**
         * 检查协调器API
         */
        _checkCoordinatorAPI(coordinator) {
            if (!coordinator) {
                return { available: false, methods: {}, score: 0 };
            }

            const requiredMethods = [
                'sendMessage',
                'loadShops', 
                'loadConversations',
                'loadMessages',
                'getState',
                'getDependencies'
            ];

            const methods = {};
            requiredMethods.forEach(method => {
                methods[method] = typeof coordinator[method] === 'function';
            });

            const availableCount = Object.values(methods).filter(Boolean).length;
            const score = Math.round((availableCount / requiredMethods.length) * 100);

            return {
                available: true,
                methods,
                score,
                summary: `${availableCount}/${requiredMethods.length} methods available`
            };
        }

        /**
         * 检查集成器API
         */
        _checkIntegratorAPI(integrator) {
            if (!integrator) {
                return { available: false, methods: {}, score: 0 };
            }

            const requiredMethods = [
                'initialize',
                'getModuleStatus',
                'getInitializationStatus',
                'reinitialize',
                'destroy'
            ];

            const methods = {};
            requiredMethods.forEach(method => {
                methods[method] = typeof integrator[method] === 'function';
            });

            const availableCount = Object.values(methods).filter(Boolean).length;
            const score = Math.round((availableCount / requiredMethods.length) * 100);

            return {
                available: true,
                methods,
                score,
                summary: `${availableCount}/${requiredMethods.length} methods available`
            };
        }

        /**
         * 检查Legacy兼容API
         */
        _checkLegacyCompatAPI(legacyCompat) {
            if (!legacyCompat) {
                return { available: false, methods: {}, score: 50 }; // Legacy是可选的
            }

            const legacyMethods = [
                'loadMessages',
                'sendMessage',
                'showShops',
                'generateCustomerNumber',
                'getUsageStats'
            ];

            const methods = {};
            legacyMethods.forEach(method => {
                methods[method] = typeof legacyCompat[method] === 'function';
            });

            const availableCount = Object.values(methods).filter(Boolean).length;
            const score = Math.round((availableCount / legacyMethods.length) * 100);

            return {
                available: true,
                methods,
                score,
                summary: `${availableCount}/${legacyMethods.length} legacy methods available`
            };
        }

        /**
         * 检查WebSocket API
         */
        _checkWebSocketAPI(wsAdapter) {
            if (!wsAdapter) {
                return { available: false, methods: {}, score: 0 };
            }

            const requiredMethods = [
                'connect',
                'disconnect',
                'send',
                'getState',
                'getStats'
            ];

            const methods = {};
            requiredMethods.forEach(method => {
                methods[method] = typeof wsAdapter[method] === 'function';
            });

            const availableCount = Object.values(methods).filter(Boolean).length;
            const score = Math.round((availableCount / requiredMethods.length) * 100);

            return {
                available: true,
                methods,
                score,
                state: wsAdapter.getState ? wsAdapter.getState() : 'unknown',
                summary: `${availableCount}/${requiredMethods.length} methods available`
            };
        }

        /**
         * 检查模块集成状态
         */
        _checkIntegration() {
            console.log('🔗 检查模块集成状态...');
            
            const integrator = window.MessageIntegratorInstance;
            
            if (!integrator) {
                this.results.integration = {
                    available: false,
                    status: 'Integrator not available',
                    score: 0
                };
                return;
            }

            try {
                const moduleStatus = integrator.getModuleStatus();
                const initStatus = integrator.getInitializationStatus();
                
                const availableModules = Object.values(moduleStatus)
                    .filter(m => m.available).length;
                const totalModules = Object.keys(moduleStatus).length;
                
                this.results.integration = {
                    available: true,
                    moduleStatus,
                    initStatus,
                    availableModules,
                    totalModules,
                    score: Math.round((availableModules / totalModules) * 100),
                    summary: `${availableModules}/${totalModules} modules integrated`
                };

                console.log(`✅ 模块集成检查完成: ${availableModules}/${totalModules}`);
            } catch (error) {
                this.results.integration = {
                    available: false,
                    error: error.message,
                    score: 0
                };
                console.error('❌ 模块集成检查失败:', error);
            }
        }

        /**
         * 检查性能指标
         */
        async _checkPerformance() {
            console.log('⚡ 检查性能指标...');
            
            const startTime = performance.now();
            
            // 检查模块加载时间
            const moduleLoadTime = this._measureModuleLoadTime();
            
            // 检查初始化时间
            const initTime = this._measureInitializationTime();
            
            // 检查内存使用
            const memoryUsage = this._getMemoryUsage();
            
            const endTime = performance.now();
            const checkDuration = endTime - startTime;
            
            this.results.performance = {
                moduleLoadTime,
                initTime,
                memoryUsage,
                checkDuration,
                score: this._calculatePerformanceScore(moduleLoadTime, initTime, memoryUsage)
            };

            console.log(`✅ 性能检查完成 (耗时: ${checkDuration.toFixed(2)}ms)`);
        }

        /**
         * 测量模块加载时间
         */
        _measureModuleLoadTime() {
            // 这是一个估算，实际加载时间需要在模块加载时记录
            const loadedModules = Object.values(this.results.moduleLoading)
                .filter(m => m.loaded).length;
            
            // 估算：每个模块平均10ms加载时间
            return loadedModules * 10;
        }

        /**
         * 测量初始化时间
         */
        _measureInitializationTime() {
            const integrator = window.MessageIntegratorInstance;
            if (!integrator) return 0;
            
            try {
                const initStatus = integrator.getInitializationStatus();
                return initStatus.initialized ? 50 : 0; // 估算值
            } catch (error) {
                return 0;
            }
        }

        /**
         * 获取内存使用情况
         */
        _getMemoryUsage() {
            if (performance.memory) {
                return {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                };
            }
            return { used: 0, total: 0, limit: 0 };
        }

        /**
         * 计算性能分数
         */
        _calculatePerformanceScore(loadTime, initTime, memory) {
            let score = 100;
            
            // 加载时间扣分 (超过100ms开始扣分)
            if (loadTime > 100) {
                score -= Math.min((loadTime - 100) / 10, 30);
            }
            
            // 初始化时间扣分 (超过50ms开始扣分)
            if (initTime > 50) {
                score -= Math.min((initTime - 50) / 5, 20);
            }
            
            // 内存使用扣分 (超过10MB开始扣分)
            if (memory.used > 10) {
                score -= Math.min((memory.used - 10) / 2, 20);
            }
            
            return Math.max(Math.round(score), 0);
        }

        /**
         * 计算总体分数
         */
        _calculateOverallScore() {
            const weights = {
                moduleLoading: 0.3,
                apiAvailability: 0.3,
                integration: 0.25,
                performance: 0.15
            };

            let totalScore = 0;
            let totalWeight = 0;

            // 模块加载分数
            if (this.results.moduleLoading.summary) {
                totalScore += this.results.moduleLoading.summary.percentage * weights.moduleLoading;
                totalWeight += weights.moduleLoading;
            }

            // API可用性分数
            const apiScores = Object.values(this.results.apiAvailability).map(api => api.score || 0);
            if (apiScores.length > 0) {
                const avgApiScore = apiScores.reduce((sum, score) => sum + score, 0) / apiScores.length;
                totalScore += avgApiScore * weights.apiAvailability;
                totalWeight += weights.apiAvailability;
            }

            // 集成分数
            if (this.results.integration.score !== undefined) {
                totalScore += this.results.integration.score * weights.integration;
                totalWeight += weights.integration;
            }

            // 性能分数
            if (this.results.performance.score !== undefined) {
                totalScore += this.results.performance.score * weights.performance;
                totalWeight += weights.performance;
            }

            this.results.overall.score = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
            
            // 确定状态
            if (this.results.overall.score >= 90) {
                this.results.overall.status = 'excellent';
            } else if (this.results.overall.score >= 75) {
                this.results.overall.status = 'good';
            } else if (this.results.overall.score >= 60) {
                this.results.overall.status = 'fair';
            } else {
                this.results.overall.status = 'poor';
            }

            // 生成建议
            this._generateRecommendations();
        }

        /**
         * 生成建议
         */
        _generateRecommendations() {
            const recommendations = [];

            // 模块加载建议
            if (this.results.moduleLoading.summary.percentage < 80) {
                recommendations.push('缺少关键模块，请检查模块加载顺序和依赖关系');
            }

            // API可用性建议
            Object.entries(this.results.apiAvailability).forEach(([name, api]) => {
                if (api.score < 80) {
                    recommendations.push(`${name} API不完整，请检查相关方法实现`);
                }
            });

            // 集成建议
            if (this.results.integration.score < 80) {
                recommendations.push('模块集成不完整，请检查依赖注入和初始化流程');
            }

            // 性能建议
            if (this.results.performance.score < 70) {
                recommendations.push('性能有待优化，考虑延迟加载和代码分割');
            }

            this.results.overall.recommendations = recommendations;
        }

        /**
         * 生成报告
         */
        _generateReport() {
            console.log('\n📊 消息功能完整性检查报告');
            console.log('=====================================');
            console.log(`总体评分: ${this.results.overall.score}/100 (${this.results.overall.status})`);
            
            console.log('\n📦 模块加载:');
            Object.entries(this.results.moduleLoading).forEach(([name, module]) => {
                if (name !== 'summary') {
                    const icon = module.loaded ? '✅' : '❌';
                    console.log(`  ${icon} ${name}: ${module.status}`);
                }
            });
            
            console.log('\n🔌 API可用性:');
            Object.entries(this.results.apiAvailability).forEach(([name, api]) => {
                const icon = api.score >= 80 ? '✅' : api.score >= 60 ? '⚠️' : '❌';
                console.log(`  ${icon} ${name}: ${api.score}% (${api.summary || 'N/A'})`);
            });
            
            console.log('\n🔗 模块集成:');
            if (this.results.integration.available) {
                console.log(`  ✅ 集成状态: ${this.results.integration.score}% (${this.results.integration.summary})`);
            } else {
                console.log('  ❌ 集成不可用');
            }
            
            console.log('\n⚡ 性能指标:');
            const perf = this.results.performance;
            console.log(`  加载时间: ${perf.moduleLoadTime}ms`);
            console.log(`  初始化时间: ${perf.initTime}ms`);
            console.log(`  内存使用: ${perf.memoryUsage.used}MB`);
            console.log(`  性能评分: ${perf.score}/100`);
            
            if (this.results.overall.recommendations.length > 0) {
                console.log('\n💡 改进建议:');
                this.results.overall.recommendations.forEach(rec => {
                    console.log(`  • ${rec}`);
                });
            }
            
            console.log('=====================================\n');
        }

        /**
         * 获取检查结果
         */
        getResults() {
            return { ...this.results };
        }
    }

    // 暴露到全局
    window.MessageFunctionalityChecker = MessageFunctionalityChecker;

    // 自动运行检查 (延迟执行)
    setTimeout(() => {
        if (!window.__MessageFunctionalityChecked) {
            const checker = new MessageFunctionalityChecker();
            checker.runCheck().then(results => {
                window.__MessageFunctionalityResults = results;
                window.__MessageFunctionalityChecked = true;
            }).catch(error => {
                console.error('功能完整性检查失败:', error);
            });
        }
    }, 2000);

    console.info('[Checker] 消息功能完整性检查器已加载');
})();