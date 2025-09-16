#!/usr/bin/env node
/**
 * QuickTalk 智能代码重复检测
 * 更精确地识别真正的代码重复问题
 */

const fs = require('fs');
const path = require('path');

console.log('🎯 QuickTalk 智能代码重复检测开始...\n');

/**
 * 检查具体的重复实现
 */
function checkActualDuplicates() {
    console.log('🔍 检查真正的代码重复...');
    console.log('─'.repeat(50));
    
    const realDuplicates = [];
    
    // 1. 检查重复的utils文件
    const unifiedUtilsPath = 'static/js/core/UnifiedUtils.js';
    const legacyUtilsPath = 'static/assets/js/core/utils.js';
    
    try {
        if (fs.existsSync(unifiedUtilsPath) && fs.existsSync(legacyUtilsPath)) {
            const unifiedContent = fs.readFileSync(unifiedUtilsPath, 'utf8');
            const legacyContent = fs.readFileSync(legacyUtilsPath, 'utf8');
            
            // 检查是否有相同的方法
            const unifiedMethods = extractMethods(unifiedContent);
            const legacyMethods = extractMethods(legacyContent);
            
            const duplicateMethods = unifiedMethods.filter(method => 
                legacyMethods.some(legacyMethod => method.name === legacyMethod.name)
            );
            
            if (duplicateMethods.length > 0) {
                realDuplicates.push({
                    type: 'duplicate_utils',
                    severity: 'high',
                    description: '发现重复的工具类实现',
                    files: [unifiedUtilsPath, legacyUtilsPath],
                    methods: duplicateMethods.map(m => m.name),
                    recommendation: '删除legacy utils文件，统一使用UnifiedUtils'
                });
                
                console.log('🔴 发现重复工具类:');
                console.log(`  - 统一工具类: ${unifiedUtilsPath}`);
                console.log(`  - 重复工具类: ${legacyUtilsPath}`);
                console.log(`  - 重复方法: ${duplicateMethods.map(m => m.name).join(', ')}`);
            } else {
                console.log('✅ 工具类无重复方法');
            }
        }
    } catch (error) {
        console.log(`❌ 检查工具类失败: ${error.message}`);
    }
    
    // 2. 检查WebSocket实现重复
    const webSocketFiles = [
        'static/js/core/UnifiedWebSocketClient.js',
        'static/chat.js',
        'static/realtime-customer-service.js'
    ];
    
    try {
        console.log('\n🔍 检查WebSocket实现重复...');
        const wsImplementations = [];
        
        webSocketFiles.forEach(file => {
            try {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    
                    // 检查是否有WebSocket连接逻辑
                    const hasWebSocketLogic = content.includes('new WebSocket') || 
                                            content.includes('ws.onopen') ||
                                            content.includes('ws.onmessage');
                    
                    if (hasWebSocketLogic) {
                        wsImplementations.push({
                            file,
                            hasUnified: content.includes('UnifiedWebSocketClient'),
                            hasNative: content.includes('new WebSocket')
                        });
                    }
                }
            } catch (error) {
                // 忽略文件访问错误
            }
        });
        
        const hasConflicts = wsImplementations.some(impl => impl.hasUnified && impl.hasNative);
        
        if (hasConflicts) {
            realDuplicates.push({
                type: 'websocket_conflict',
                severity: 'medium',
                description: '同时使用统一和原生WebSocket实现',
                files: wsImplementations.filter(impl => impl.hasUnified && impl.hasNative).map(impl => impl.file),
                recommendation: '统一使用UnifiedWebSocketClient'
            });
            
            console.log('🟡 发现WebSocket实现冲突:');
            wsImplementations.forEach(impl => {
                if (impl.hasUnified && impl.hasNative) {
                    console.log(`  - ${impl.file}: 同时使用统一和原生实现`);
                }
            });
        } else {
            console.log('✅ WebSocket实现无冲突');
        }
    } catch (error) {
        console.log(`❌ 检查WebSocket失败: ${error.message}`);
    }
    
    // 3. 检查legacy参数使用
    console.log('\n🔍 检查legacy参数使用...');
    const legacyUsageFiles = [
        'src/client-api/connection-handler.js',
        'src/services/ServiceIntegration.js'
    ];
    
    try {
        legacyUsageFiles.forEach(file => {
            try {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    
                    // 检查legacy使用情况
                    const legacyMatches = content.match(/legacy|Legacy/g);
                    
                    if (legacyMatches && legacyMatches.length > 5) {
                        realDuplicates.push({
                            type: 'legacy_usage',
                            severity: 'low',
                            description: 'Legacy参数使用过多',
                            files: [file],
                            matches: legacyMatches.length,
                            recommendation: '逐步迁移到新的服务结构'
                        });
                        
                        console.log(`🟡 ${file}: ${legacyMatches.length}个legacy引用`);
                    } else {
                        console.log(`✅ ${file}: legacy使用适中`);
                    }
                }
            } catch (error) {
                // 忽略文件访问错误
            }
        });
    } catch (error) {
        console.log(`❌ 检查legacy使用失败: ${error.message}`);
    }
    
    return realDuplicates;
}

/**
 * 提取方法名
 */
function extractMethods(content) {
    const methods = [];
    
    // 静态方法
    const staticMatches = content.match(/static\s+(\w+)\s*\(/g);
    if (staticMatches) {
        staticMatches.forEach(match => {
            const methodName = match.match(/static\s+(\w+)/)[1];
            methods.push({ name: methodName, type: 'static' });
        });
    }
    
    // 普通方法
    const methodMatches = content.match(/^\s*(\w+)\s*\(/gm);
    if (methodMatches) {
        methodMatches.forEach(match => {
            const methodName = match.match(/(\w+)\s*\(/)[1];
            if (!['constructor', 'if', 'for', 'while', 'switch'].includes(methodName)) {
                methods.push({ name: methodName, type: 'method' });
            }
        });
    }
    
    return methods;
}

/**
 * 生成优化建议
 */
function generateOptimizationRecommendations(duplicates) {
    console.log('\n💡 优化建议生成...');
    console.log('═'.repeat(50));
    
    if (duplicates.length === 0) {
        console.log('🎉 恭喜！没有发现明显的代码重复问题');
        console.log('✅ 当前代码结构良好，重构优化已基本完成');
        return {
            status: 'excellent',
            score: 95,
            issues: 0,
            recommendations: ['继续保持良好的代码结构']
        };
    }
    
    const highSeverity = duplicates.filter(d => d.severity === 'high').length;
    const mediumSeverity = duplicates.filter(d => d.severity === 'medium').length;
    const lowSeverity = duplicates.filter(d => d.severity === 'low').length;
    
    let score = 100;
    score -= highSeverity * 20;
    score -= mediumSeverity * 10;
    score -= lowSeverity * 5;
    
    let status = 'excellent';
    if (score < 70) status = 'needs_improvement';
    else if (score < 85) status = 'good';
    
    console.log(`📊 代码质量评分: ${score}/100`);
    console.log(`📈 质量等级: ${status.toUpperCase()}`);
    console.log('');
    
    console.log('🔧 具体问题和建议:');
    duplicates.forEach((duplicate, index) => {
        const severityIcon = {
            'high': '🔴',
            'medium': '🟡',
            'low': '🟢'
        };
        
        console.log(`${severityIcon[duplicate.severity]} ${index + 1}. ${duplicate.description}`);
        console.log(`   严重程度: ${duplicate.severity.toUpperCase()}`);
        console.log(`   影响文件: ${duplicate.files.join(', ')}`);
        console.log(`   建议: ${duplicate.recommendation}`);
        console.log('');
    });
    
    // 优先级建议
    console.log('⚡ 优先处理建议:');
    if (highSeverity > 0) {
        console.log('1. 🔴 优先解决高严重性问题（代码重复）');
    }
    if (mediumSeverity > 0) {
        console.log('2. 🟡 其次处理中等严重性问题（实现冲突）');
    }
    if (lowSeverity > 0) {
        console.log('3. 🟢 最后处理低严重性问题（legacy清理）');
    }
    
    return {
        status,
        score,
        issues: duplicates.length,
        recommendations: duplicates.map(d => d.recommendation)
    };
}

/**
 * 主函数
 */
function main() {
    console.log('🎯 开始智能代码重复检测...\n');
    
    // 1. 检查真实的重复问题
    const duplicates = checkActualDuplicates();
    
    // 2. 生成优化建议
    const analysis = generateOptimizationRecommendations(duplicates);
    
    // 3. 保存分析结果
    try {
        const reportPath = path.join(__dirname, 'intelligent-analysis-report.json');
        const report = {
            timestamp: new Date().toISOString(),
            analysis,
            duplicates,
            summary: {
                totalIssues: duplicates.length,
                highSeverity: duplicates.filter(d => d.severity === 'high').length,
                mediumSeverity: duplicates.filter(d => d.severity === 'medium').length,
                lowSeverity: duplicates.filter(d => d.severity === 'low').length
            }
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n💾 详细分析报告已保存到: ${reportPath}`);
    } catch (error) {
        console.log(`❌ 报告保存失败: ${error.message}`);
    }
    
    // 4. 总结
    console.log('\n═'.repeat(60));
    if (analysis.score >= 90) {
        console.log('🎉 分析完成：代码质量优秀！重构优化非常成功');
    } else if (analysis.score >= 80) {
        console.log('✅ 分析完成：代码质量良好，还有少量改进空间');
    } else if (analysis.score >= 70) {
        console.log('🟡 分析完成：代码质量可接受，建议进行优化');
    } else {
        console.log('🔴 分析完成：发现一些问题，需要进一步改进');
    }
    
    return analysis;
}

// 运行分析
if (require.main === module) {
    main();
}

module.exports = { main, checkActualDuplicates, generateOptimizationRecommendations };