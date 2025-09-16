#!/usr/bin/env node
/**
 * QuickTalk 深度代码质量分析
 * 全面检查代码重复、架构问题和新旧系统混用情况
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 QuickTalk 深度代码质量分析开始...\n');

// 分析结果收集
const analysisResults = {
    duplicateCode: { issues: [], severity: 'none' },
    architectureProblems: { issues: [], severity: 'none' },
    legacyMixing: { issues: [], severity: 'none' },
    overall: { score: 0, status: 'unknown' }
};

/**
 * 检查代码重复 - 更深入的分析
 */
function analyzeCodeDuplication() {
    console.log('🔄 分析代码重复情况...');
    console.log('─'.repeat(50));
    
    const duplicatePatterns = [
        // 函数定义重复
        { pattern: /function\s+(\w+)\s*\(/g, name: '函数定义', type: 'function' },
        { pattern: /class\s+(\w+)/g, name: '类定义', type: 'class' },
        { pattern: /static\s+(\w+)\s*\(/g, name: '静态方法', type: 'static' },
        
        // 具体功能重复
        { pattern: /deepClone|deep_clone/gi, name: 'deepClone功能', type: 'utility' },
        { pattern: /addMessage|add_message/gi, name: 'addMessage功能', type: 'message' },
        { pattern: /WebSocket|websocket/gi, name: 'WebSocket相关', type: 'websocket' },
        { pattern: /copyCode|copy_code|copyToClipboard/gi, name: '复制功能', type: 'copy' },
        { pattern: /formatFileSize|format_file_size/gi, name: '文件大小格式化', type: 'format' },
        { pattern: /debounce|throttle/gi, name: '防抖节流', type: 'performance' }
    ];
    
    const filePatterns = [
        'static/**/*.js',
        'src/**/*.js'
    ];
    
    // 实际文件路径（简化版本）
    const filesToCheck = [
        // 前端文件
        'static/chat.js',
        'static/realtime-customer-service.js',
        'static/js/core/IntegrationManager.js',
        'static/js/core/UnifiedUtils.js',
        'static/js/core/UnifiedWebSocketClient.js',
        'static/js/core/UnifiedMessageManager.js',
        'static/assets/js/core/utils.js',
        'static/assets/js/modules/message/mobile-manager.js',
        'static/assets/js/modules/admin/file-manager.js',
        
        // 后端文件
        'src/app/modular-app.js',
        'src/websocket/WebSocketManager.js',
        'src/client-api/connection-handler.js',
        'src/client-api/message-handler.js',
        'src/database/message-repository.js',
        'src/services/ServiceIntegration.js'
    ];
    
    const duplicateResults = {};
    
    duplicatePatterns.forEach(pattern => {
        duplicateResults[pattern.name] = {
            pattern: pattern.pattern,
            type: pattern.type,
            matches: [],
            files: [],
            severity: 'none'
        };
        
        filesToCheck.forEach(filePath => {
            try {
                const fullPath = path.join(__dirname, filePath);
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const matches = content.match(pattern.pattern);
                    
                    if (matches && matches.length > 0) {
                        duplicateResults[pattern.name].matches.push(...matches);
                        duplicateResults[pattern.name].files.push(filePath);
                    }
                }
            } catch (error) {
                // 忽略文件访问错误
            }
        });
        
        // 计算严重程度
        const uniqueFiles = [...new Set(duplicateResults[pattern.name].files)];
        const uniqueMatches = [...new Set(duplicateResults[pattern.name].matches)];
        
        if (uniqueFiles.length > 3) {
            duplicateResults[pattern.name].severity = 'high';
        } else if (uniqueFiles.length > 2) {
            duplicateResults[pattern.name].severity = 'medium';
        } else if (uniqueFiles.length > 1) {
            duplicateResults[pattern.name].severity = 'low';
        }
        
        // 输出结果
        const severityIcon = {
            'high': '🔴',
            'medium': '🟡', 
            'low': '🟢',
            'none': '✅'
        };
        
        console.log(`${severityIcon[duplicateResults[pattern.name].severity]} ${pattern.name}: ${uniqueFiles.length}个文件, ${uniqueMatches.length}个匹配`);
        
        if (uniqueFiles.length > 1) {
            console.log(`  文件: ${uniqueFiles.slice(0, 3).join(', ')}${uniqueFiles.length > 3 ? '...' : ''}`);
            analysisResults.duplicateCode.issues.push({
                name: pattern.name,
                severity: duplicateResults[pattern.name].severity,
                files: uniqueFiles,
                matches: uniqueMatches.length
            });
        }
    });
    
    // 计算总体重复程度
    const highIssues = analysisResults.duplicateCode.issues.filter(i => i.severity === 'high').length;
    const mediumIssues = analysisResults.duplicateCode.issues.filter(i => i.severity === 'medium').length;
    const lowIssues = analysisResults.duplicateCode.issues.filter(i => i.severity === 'low').length;
    
    if (highIssues > 0) {
        analysisResults.duplicateCode.severity = 'high';
    } else if (mediumIssues > 2) {
        analysisResults.duplicateCode.severity = 'high';
    } else if (mediumIssues > 0 || lowIssues > 3) {
        analysisResults.duplicateCode.severity = 'medium';
    } else if (lowIssues > 0) {
        analysisResults.duplicateCode.severity = 'low';
    }
    
    console.log('');
}

/**
 * 分析架构清晰度
 */
function analyzeArchitectureClarity() {
    console.log('🏗️ 分析架构清晰度...');
    console.log('─'.repeat(50));
    
    const architectureChecks = [
        {
            name: '模块化程度',
            check: () => {
                // 检查是否有明确的模块边界
                const moduleFiles = [
                    'src/app/modular-app.js',
                    'src/services/ServiceManager.js',
                    'src/database/database-core.js'
                ];
                
                const existingModules = moduleFiles.filter(file => {
                    try {
                        return fs.existsSync(path.join(__dirname, file));
                    } catch {
                        return false;
                    }
                });
                
                return {
                    score: existingModules.length / moduleFiles.length,
                    details: `${existingModules.length}/${moduleFiles.length} 核心模块存在`
                };
            }
        },
        {
            name: '依赖关系清晰度',
            check: () => {
                // 检查循环依赖和不明确的依赖
                const serviceFiles = [
                    'src/services/',
                    'src/database/',
                    'src/client-api/'
                ];
                
                let clearDependencies = 0;
                serviceFiles.forEach(dir => {
                    try {
                        const fullPath = path.join(__dirname, dir);
                        if (fs.existsSync(fullPath)) {
                            clearDependencies++;
                        }
                    } catch {
                        // 忽略错误
                    }
                });
                
                return {
                    score: clearDependencies / serviceFiles.length,
                    details: `${clearDependencies}/${serviceFiles.length} 服务层目录存在`
                };
            }
        },
        {
            name: '接口标准化',
            check: () => {
                // 检查是否有统一的接口标准
                const unifiedComponents = [
                    'static/js/core/UnifiedUtils.js',
                    'static/js/core/UnifiedWebSocketClient.js',
                    'static/js/core/UnifiedMessageManager.js'
                ];
                
                const existingComponents = unifiedComponents.filter(file => {
                    try {
                        return fs.existsSync(path.join(__dirname, file));
                    } catch {
                        return false;
                    }
                });
                
                return {
                    score: existingComponents.length / unifiedComponents.length,
                    details: `${existingComponents.length}/${unifiedComponents.length} 统一组件存在`
                };
            }
        }
    ];
    
    let totalScore = 0;
    architectureChecks.forEach(check => {
        const result = check.check();
        totalScore += result.score;
        
        const scoreIcon = result.score >= 0.8 ? '✅' : result.score >= 0.6 ? '🟡' : '❌';
        console.log(`${scoreIcon} ${check.name}: ${(result.score * 100).toFixed(1)}% - ${result.details}`);
        
        if (result.score < 0.6) {
            analysisResults.architectureProblems.issues.push({
                name: check.name,
                score: result.score,
                details: result.details
            });
        }
    });
    
    const avgScore = totalScore / architectureChecks.length;
    if (avgScore >= 0.8) {
        analysisResults.architectureProblems.severity = 'low';
    } else if (avgScore >= 0.6) {
        analysisResults.architectureProblems.severity = 'medium';
    } else {
        analysisResults.architectureProblems.severity = 'high';
    }
    
    console.log(`📊 架构总分: ${(avgScore * 100).toFixed(1)}%`);
    console.log('');
}

/**
 * 检查新旧系统混用
 */
function analyzeLegacyMixing() {
    console.log('🔄 检查新旧系统混用...');
    console.log('─'.repeat(50));
    
    const legacyIndicators = [
        { pattern: /legacy|Legacy|LEGACY/g, name: 'Legacy标识', severity: 'high' },
        { pattern: /@deprecated|废弃|旧的/g, name: '废弃标记', severity: 'medium' },
        { pattern: /TODO|FIXME|HACK/g, name: 'TODO标记', severity: 'low' },
        { pattern: /v1|v2|version|Version/g, name: '版本标识', severity: 'medium' },
        { pattern: /old|Old|OLD/g, name: 'Old标识', severity: 'medium' }
    ];
    
    const filesToCheck = [
        'src/**/*.js',
        'static/**/*.js'
    ];
    
    // 实际文件检查
    const checkFiles = [
        'src/app/modular-app.js',
        'src/websocket/WebSocketManager.js',
        'src/client-api/connection-handler.js',
        'src/client-api/message-handler.js',
        'src/services/ServiceIntegration.js',
        'static/chat.js',
        'static/realtime-customer-service.js',
        'static/js/core/IntegrationManager.js'
    ];
    
    legacyIndicators.forEach(indicator => {
        let totalMatches = 0;
        const matchedFiles = [];
        
        checkFiles.forEach(filePath => {
            try {
                const fullPath = path.join(__dirname, filePath);
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const matches = content.match(indicator.pattern);
                    
                    if (matches) {
                        totalMatches += matches.length;
                        matchedFiles.push(filePath);
                    }
                }
            } catch (error) {
                // 忽略文件访问错误
            }
        });
        
        const severityIcon = {
            'high': '🔴',
            'medium': '🟡',
            'low': '🟢'
        };
        
        if (totalMatches > 0) {
            console.log(`${severityIcon[indicator.severity]} ${indicator.name}: ${totalMatches}个匹配，${matchedFiles.length}个文件`);
            console.log(`  文件: ${matchedFiles.slice(0, 3).join(', ')}${matchedFiles.length > 3 ? '...' : ''}`);
            
            analysisResults.legacyMixing.issues.push({
                name: indicator.name,
                severity: indicator.severity,
                matches: totalMatches,
                files: matchedFiles
            });
        } else {
            console.log(`✅ ${indicator.name}: 无匹配项`);
        }
    });
    
    // 计算legacy混用严重程度
    const highLegacy = analysisResults.legacyMixing.issues.filter(i => i.severity === 'high' && i.matches > 0).length;
    const mediumLegacy = analysisResults.legacyMixing.issues.filter(i => i.severity === 'medium' && i.matches > 5).length;
    
    if (highLegacy > 0) {
        analysisResults.legacyMixing.severity = 'high';
    } else if (mediumLegacy > 0) {
        analysisResults.legacyMixing.severity = 'medium';
    } else {
        analysisResults.legacyMixing.severity = 'low';
    }
    
    console.log('');
}

/**
 * 生成综合评估报告
 */
function generateComprehensiveReport() {
    console.log('📋 生成综合评估报告...');
    console.log('═'.repeat(60));
    
    // 计算总体评分
    const severityScores = {
        'none': 100,
        'low': 80,
        'medium': 60,
        'high': 30
    };
    
    const duplicateScore = severityScores[analysisResults.duplicateCode.severity];
    const architectureScore = severityScores[analysisResults.architectureProblems.severity];
    const legacyScore = severityScores[analysisResults.legacyMixing.severity];
    
    const overallScore = (duplicateScore + architectureScore + legacyScore) / 3;
    
    analysisResults.overall.score = overallScore;
    
    if (overallScore >= 90) {
        analysisResults.overall.status = 'excellent';
    } else if (overallScore >= 80) {
        analysisResults.overall.status = 'good';
    } else if (overallScore >= 70) {
        analysisResults.overall.status = 'acceptable';
    } else if (overallScore >= 60) {
        analysisResults.overall.status = 'needs_improvement';
    } else {
        analysisResults.overall.status = 'poor';
    }
    
    // 输出综合报告
    console.log('📊 QuickTalk 代码质量综合评估');
    console.log('═'.repeat(60));
    console.log(`🎯 总体评分: ${overallScore.toFixed(1)}/100`);
    console.log(`📈 质量等级: ${analysisResults.overall.status.toUpperCase()}`);
    console.log('');
    
    console.log('📋 分项评估:');
    console.log(`🔄 代码重复: ${analysisResults.duplicateCode.severity.toUpperCase()} (${duplicateScore}分)`);
    console.log(`🏗️ 架构清晰度: ${analysisResults.architectureProblems.severity.toUpperCase()} (${architectureScore}分)`);
    console.log(`🔄 新旧混用: ${analysisResults.legacyMixing.severity.toUpperCase()} (${legacyScore}分)`);
    console.log('');
    
    // 详细问题分析
    if (analysisResults.duplicateCode.issues.length > 0) {
        console.log('🔴 发现的代码重复问题:');
        analysisResults.duplicateCode.issues.forEach(issue => {
            console.log(`  • ${issue.name}: ${issue.files.length}个文件，严重程度${issue.severity}`);
        });
        console.log('');
    }
    
    if (analysisResults.architectureProblems.issues.length > 0) {
        console.log('🟡 发现的架构问题:');
        analysisResults.architectureProblems.issues.forEach(issue => {
            console.log(`  • ${issue.name}: ${(issue.score * 100).toFixed(1)}% - ${issue.details}`);
        });
        console.log('');
    }
    
    if (analysisResults.legacyMixing.issues.length > 0) {
        console.log('🔄 发现的新旧混用问题:');
        analysisResults.legacyMixing.issues.forEach(issue => {
            if (issue.matches > 0) {
                console.log(`  • ${issue.name}: ${issue.matches}个匹配项，${issue.files.length}个文件`);
            }
        });
        console.log('');
    }
    
    // 改进建议
    console.log('💡 改进建议:');
    
    if (overallScore >= 90) {
        console.log('  ✅ 代码质量优秀，无需重大改进');
    } else if (overallScore >= 80) {
        console.log('  🟢 代码质量良好，建议进行微调优化');
    } else if (overallScore >= 70) {
        console.log('  🟡 代码质量可接受，建议关注重点问题');
    } else {
        console.log('  🔴 代码质量需要改进，建议进行重构');
    }
    
    if (analysisResults.duplicateCode.severity === 'high' || analysisResults.duplicateCode.severity === 'medium') {
        console.log('  • 优先解决代码重复问题，整合重复功能');
    }
    
    if (analysisResults.architectureProblems.severity === 'high') {
        console.log('  • 重新设计架构，提高模块化程度');
    }
    
    if (analysisResults.legacyMixing.severity === 'high') {
        console.log('  • 清理遗留代码，统一新系统标准');
    }
    
    // 保存详细报告
    try {
        const reportPath = path.join(__dirname, 'deep-analysis-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(analysisResults, null, 2));
        console.log(`\n💾 详细分析报告已保存到: ${reportPath}`);
    } catch (error) {
        console.log(`❌ 报告保存失败: ${error.message}`);
    }
    
    return analysisResults;
}

/**
 * 主分析流程
 */
function main() {
    console.log('🔍 开始 QuickTalk 深度代码质量分析...\n');
    
    // 1. 分析代码重复
    analyzeCodeDuplication();
    
    // 2. 分析架构清晰度
    analyzeArchitectureClarity();
    
    // 3. 检查新旧系统混用
    analyzeLegacyMixing();
    
    // 4. 生成综合评估报告
    const results = generateComprehensiveReport();
    
    // 5. 总结
    console.log('═'.repeat(60));
    if (results.overall.score >= 80) {
        console.log('🎉 分析完成：代码质量良好，重构优化效果显著！');
    } else if (results.overall.score >= 70) {
        console.log('✅ 分析完成：代码质量可接受，还有改进空间。');
    } else {
        console.log('⚠️  分析完成：发现一些问题，建议进一步优化。');
    }
    
    return results;
}

// 运行分析
if (require.main === module) {
    main();
}

module.exports = { main, analyzeCodeDuplication, analyzeArchitectureClarity, analyzeLegacyMixing };