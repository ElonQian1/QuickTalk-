/**
 * module-dependency-analyzer.js
 * 模块依赖分析器
 * 
 * 目的：分析当前项目的模块依赖关系，识别重复加载和冗余模块
 */
(function(){
    'use strict';
    
    const MODULE_ANALYSIS = {
        totalScripts: 0,
        duplicates: [],
        categories: {},
        loadOrder: [],
        potentialRedundancy: [],
        recommendations: []
    };
    
    /**
     * 分析页面中的所有脚本标签
     */
    function analyzeScripts() {
        const scripts = document.querySelectorAll('script[src]');
        MODULE_ANALYSIS.totalScripts = scripts.length;
        
        const scriptPaths = [];
        const scriptsByCategory = {};
        
        scripts.forEach((script, index) => {
            const src = script.getAttribute('src');
            if (!src) return;
            
            // 记录加载顺序
            MODULE_ANALYSIS.loadOrder.push({ index, src });
            
            // 检查重复
            if (scriptPaths.includes(src)) {
                MODULE_ANALYSIS.duplicates.push(src);
            } else {
                scriptPaths.push(src);
            }
            
            // 分类统计
            const category = categorizeScript(src);
            if (!scriptsByCategory[category]) {
                scriptsByCategory[category] = [];
            }
            scriptsByCategory[category].push(src);
        });
        
        MODULE_ANALYSIS.categories = scriptsByCategory;
        
        // 分析潜在冗余
        analyzePotentialRedundancy();
        
        // 生成建议
        generateRecommendations();
    }
    
    /**
     * 脚本分类
     */
    function categorizeScript(src) {
        if (src.includes('/core/')) return 'Core';
        if (src.includes('/utils/')) return 'Utils';
        if (src.includes('/domain/')) return 'Domain';
        if (src.includes('/usecases/')) return 'UseCases';
        if (src.includes('/ui/')) return 'UI';
        if (src.includes('/mobile/')) return 'Mobile';
        if (src.includes('/modals/')) return 'Modals';
        if (src.includes('/bootstrap/')) return 'Bootstrap';
        if (src.includes('/message/')) return 'Message';
        if (src.includes('/application/')) return 'Application';
        return 'Other';
    }
    
    /**
     * 分析潜在冗余
     */
    function analyzePotentialRedundancy() {
        const redundancyPatterns = [
            // 检查同名但不同版本的文件
            { pattern: /message-module/, files: [] },
            { pattern: /shops-manager/, files: [] },
            { pattern: /conversations-manager/, files: [] },
            { pattern: /messages-manager/, files: [] },
            { pattern: /ws-/, files: [] },
            { pattern: /bootstrap/, files: [] }
        ];
        
        MODULE_ANALYSIS.loadOrder.forEach(({ src }) => {
            redundancyPatterns.forEach(pattern => {
                if (pattern.pattern.test(src)) {
                    pattern.files.push(src);
                }
            });
        });
        
        redundancyPatterns.forEach(pattern => {
            if (pattern.files.length > 1) {
                MODULE_ANALYSIS.potentialRedundancy.push({
                    pattern: pattern.pattern.toString(),
                    files: pattern.files,
                    count: pattern.files.length
                });
            }
        });
    }
    
    /**
     * 生成优化建议
     */
    function generateRecommendations() {
        const recommendations = [];
        
        // 脚本数量过多
        if (MODULE_ANALYSIS.totalScripts > 50) {
            recommendations.push({
                type: 'warning',
                message: `脚本数量过多 (${MODULE_ANALYSIS.totalScripts}个)，建议合并核心模块`,
                priority: 'high'
            });
        }
        
        // 重复加载
        if (MODULE_ANALYSIS.duplicates.length > 0) {
            recommendations.push({
                type: 'error',
                message: `发现重复加载的脚本: ${MODULE_ANALYSIS.duplicates.join(', ')}`,
                priority: 'critical'
            });
        }
        
        // 潜在冗余
        MODULE_ANALYSIS.potentialRedundancy.forEach(redundancy => {
            recommendations.push({
                type: 'warning',
                message: `发现可能冗余的模块: ${redundancy.pattern} (${redundancy.count}个文件)`,
                priority: 'medium',
                files: redundancy.files
            });
        });
        
        // 类别分析建议
        Object.entries(MODULE_ANALYSIS.categories).forEach(([category, files]) => {
            if (files.length > 10) {
                recommendations.push({
                    type: 'info',
                    message: `${category}类别模块过多 (${files.length}个)，考虑合并`,
                    priority: 'low'
                });
            }
        });
        
        MODULE_ANALYSIS.recommendations = recommendations;
    }
    
    /**
     * 生成优化后的脚本加载建议
     */
    function generateOptimizedStructure() {
        const structure = {
            core: [],
            utils: [],
            business: [],
            ui: [],
            adapters: [],
            bootstrap: []
        };
        
        // 核心基础设施
        structure.core = [
            '/static/js/core/module-registry.js',
            '/static/js/core/constants.js',
            '/static/js/core/logger.js',
            '/static/js/core/event-bus.js',
            '/static/js/core/responsive-view-manager.js'
        ];
        
        // 工具库
        structure.utils = [
            '/static/js/utils/global-utils.js',
            '/static/js/utils/auth-helper.js',
            '/static/js/utils/http-utils.js',
            '/static/js/utils/notify-utils.js',
            '/static/js/utils/partials-loader.js'
        ];
        
        // 业务逻辑
        structure.business = [
            '/static/js/domain/entities/conversation.js',
            '/static/js/domain/entities/message.js',
            '/static/js/domain/entities/shop.js',
            '/static/js/message/core/message-event-bus.js',
            '/static/js/message/core/message-state-store.js',
            '/static/js/usecases/shops-manager-refactored.js',
            '/static/js/usecases/conversations-manager-refactored.js',
            '/static/js/usecases/messages-manager-refactored.js',
            '/static/js/core/message-coordinator.js'
        ];
        
        // UI组件
        structure.ui = [
            '/static/js/ui/toast.js',
            '/static/js/ui/empty-states.js',
            '/static/js/ui/message-bubble.js'
        ];
        
        // 适配器
        structure.adapters = [
            '/static/js/mobile/mobile-bootstrap.js',
            '/static/js/mobile/message-view-mobile-adapter.js',
            '/static/js/mobile/conversations-mobile-adapter.js'
        ];
        
        // 启动器
        structure.bootstrap = [
            '/static/js/bootstrap/app-bootstrap.js',
            '/static/js/bootstrap/messages-micro-bootstrap.js'
        ];
        
        return structure;
    }
    
    /**
     * 输出分析报告
     */
    function generateReport() {
        console.log('📊 模块依赖分析报告');
        console.log('=====================================');
        console.log(`总脚本数量: ${MODULE_ANALYSIS.totalScripts}`);
        console.log(`重复脚本数量: ${MODULE_ANALYSIS.duplicates.length}`);
        console.log(`潜在冗余: ${MODULE_ANALYSIS.potentialRedundancy.length}组`);
        
        console.log('\n📂 脚本分类统计:');
        Object.entries(MODULE_ANALYSIS.categories).forEach(([category, files]) => {
            console.log(`  ${category}: ${files.length}个`);
        });
        
        if (MODULE_ANALYSIS.duplicates.length > 0) {
            console.log('\n🔄 重复加载的脚本:');
            MODULE_ANALYSIS.duplicates.forEach(dup => console.log(`  - ${dup}`));
        }
        
        if (MODULE_ANALYSIS.potentialRedundancy.length > 0) {
            console.log('\n⚠️ 潜在冗余模块:');
            MODULE_ANALYSIS.potentialRedundancy.forEach(redundancy => {
                console.log(`  ${redundancy.pattern}:`);
                redundancy.files.forEach(file => console.log(`    - ${file}`));
            });
        }
        
        console.log('\n💡 优化建议:');
        MODULE_ANALYSIS.recommendations.forEach(rec => {
            const icon = rec.type === 'error' ? '🚨' : rec.type === 'warning' ? '⚠️' : 'ℹ️';
            console.log(`  ${icon} [${rec.priority}] ${rec.message}`);
        });
        
        console.log('\n🎯 推荐的优化结构:');
        const optimized = generateOptimizedStructure();
        let totalOptimized = 0;
        Object.entries(optimized).forEach(([category, files]) => {
            console.log(`  ${category}: ${files.length}个模块`);
            totalOptimized += files.length;
        });
        console.log(`总计: ${totalOptimized}个模块 (减少 ${MODULE_ANALYSIS.totalScripts - totalOptimized}个)`);
        
        return MODULE_ANALYSIS;
    }
    
    /**
     * 运行分析
     */
    function runAnalysis() {
        analyzeScripts();
        return generateReport();
    }
    
    // 暴露到全局
    window.ModuleDependencyAnalyzer = {
        runAnalysis,
        getResults: () => ({ ...MODULE_ANALYSIS }),
        generateOptimizedStructure
    };
    
    // 自动运行分析
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAnalysis);
    } else {
        setTimeout(runAnalysis, 100);
    }
    
})();