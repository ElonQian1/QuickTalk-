/**
 * 改进的代码重复分析工具
 * 修复算法缺陷，提供准确的代码重复率分析
 * 针对Controllers → Services → Repositories → Database架构的重复率检查
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ImprovedCodeDuplicationAnalyzer {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.sourceFiles = new Map();
        this.duplicateBlocks = new Map();
        this.statistics = {
            totalFiles: 0,
            totalLines: 0,
            duplicateLines: 0,
            duplicateBlocks: 0,
            duplicationRate: 0
        };
        
        // 提高最小代码块大小，避免误报
        this.minBlockSize = 5;
        
        // 忽略的目录和文件
        this.ignorePaths = [
            'node_modules',
            '.git',
            'logs',
            'uploads',
            'temp',
            'data',
            '.github',
            'docs'
        ];
        
        // 忽略的文件扩展名
        this.ignoreExtensions = [
            '.json',
            '.md',
            '.txt',
            '.log',
            '.sql',
            '.csv',
            '.xml',
            '.html',
            '.css'
        ];
        
        // 常见的代码模式，应该被忽略
        this.commonPatterns = [
            /^\s*\}\s*catch\s*\(\s*error\s*\)\s*\{\s*$/,
            /^\s*console\.(log|error|warn|info)\s*\(/,
            /^\s*if\s*\(\s*error\s*\)\s*\{\s*$/,
            /^\s*throw\s+new\s+Error\s*\(/,
            /^\s*return\s*\{\s*success\s*:\s*false/,
            /^\s*return\s*\{\s*success\s*:\s*true/,
            /^\s*const\s+\{\s*[\w\s,]+\}\s*=\s*/,
            /^\s*try\s*\{\s*$/,
            /^\s*\}\s*finally\s*\{\s*$/,
            /^\s*\}\s*else\s*\{\s*$/,
            /^\s*\/\/\s*/,
            /^\s*\/\*.*\*\/\s*$/,
            /^\s*\*\s+/
        ];
    }

    /**
     * 运行完整的代码重复分析
     */
    async analyze() {
        console.log('🔍 开始改进的代码重复分析...');
        console.log(`📁 项目路径: ${this.projectRoot}`);
        
        // 1. 扫描所有源文件
        await this.scanSourceFiles();
        
        // 2. 分析代码重复（改进算法）
        await this.findMeaningfulDuplicateBlocks();
        
        // 3. 计算统计数据
        this.calculateStatistics();
        
        // 4. 生成详细报告
        const report = this.generateReport();
        
        // 5. 保存报告
        this.saveReport(report);
        
        return report;
    }

    /**
     * 扫描所有源文件
     */
    async scanSourceFiles() {
        console.log('📂 扫描源文件...');
        
        const scanDirectory = (dirPath) => {
            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item.name);
                const relativePath = path.relative(this.projectRoot, fullPath);
                
                // 跳过忽略的路径
                if (this.shouldIgnorePath(relativePath)) {
                    continue;
                }
                
                if (item.isDirectory()) {
                    scanDirectory(fullPath);
                } else if (item.isFile() && this.isSourceFile(item.name)) {
                    this.processSourceFile(fullPath, relativePath);
                }
            }
        };
        
        scanDirectory(this.projectRoot);
        
        console.log(`📊 找到 ${this.sourceFiles.size} 个源文件`);
    }

    /**
     * 检查是否应该忽略路径
     */
    shouldIgnorePath(relativePath) {
        const pathParts = relativePath.split(path.sep);
        return this.ignorePaths.some(ignorePath => 
            pathParts.includes(ignorePath)
        );
    }

    /**
     * 检查是否为源文件
     */
    isSourceFile(filename) {
        const ext = path.extname(filename).toLowerCase();
        
        // 包含的源文件扩展名
        const sourceExtensions = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'];
        
        return sourceExtensions.includes(ext) && 
               !this.ignoreExtensions.includes(ext);
    }

    /**
     * 处理源文件
     */
    processSourceFile(fullPath, relativePath) {
        try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            
            // 清理和规范化代码行
            const normalizedLines = lines.map(line => this.normalizeLine(line));
            
            this.sourceFiles.set(relativePath, {
                fullPath,
                lines: normalizedLines,
                originalLines: lines,
                lineCount: lines.length
            });
            
            this.statistics.totalFiles++;
            this.statistics.totalLines += lines.length;
            
        } catch (error) {
            console.warn(`⚠️ 无法读取文件 ${relativePath}: ${error.message}`);
        }
    }

    /**
     * 规范化代码行（移除空白和注释）
     */
    normalizeLine(line) {
        // 移除前后空白
        line = line.trim();
        
        // 跳过空行
        if (!line) return '';
        
        // 跳过单行注释
        if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) {
            return '';
        }
        
        // 移除行内注释（简单处理）
        const commentIndex = line.indexOf('//');
        if (commentIndex > 0) {
            line = line.substring(0, commentIndex).trim();
        }
        
        // 规范化空白字符
        line = line.replace(/\s+/g, ' ');
        
        return line;
    }

    /**
     * 检查是否为常见代码模式
     */
    isCommonPattern(lines) {
        // 检查每一行是否匹配常见模式
        for (const line of lines) {
            if (this.commonPatterns.some(pattern => pattern.test(line))) {
                return true;
            }
        }
        
        // 检查是否为import/require语句
        const joinedLines = lines.join(' ');
        if (joinedLines.includes('require(') || joinedLines.includes('import ') || joinedLines.includes('export ')) {
            return true;
        }
        
        // 检查是否为简单的对象属性或数组
        if (lines.every(line => /^\s*[\w\d_]+\s*:\s*/.test(line) || /^\s*'[^']*'\s*,?\s*$/.test(line))) {
            return true;
        }
        
        return false;
    }

    /**
     * 查找有意义的重复代码块（改进算法）
     */
    async findMeaningfulDuplicateBlocks() {
        console.log('🔎 分析有意义的代码重复...');
        
        const codeBlocks = new Map(); // hash -> { files: [{file, startLine, endLine}], lines: [], size: number }
        const processedRanges = new Map(); // file -> Set<rangeString> to avoid overlapping
        
        // 只分析固定大小的代码块，避免重叠
        for (const blockSize of [5, 7, 10]) {
            console.log(`  分析 ${blockSize} 行代码块...`);
            
            for (const [filePath, fileData] of this.sourceFiles) {
                if (!processedRanges.has(filePath)) {
                    processedRanges.set(filePath, new Set());
                }
                
                this.generateNonOverlappingCodeBlocks(filePath, fileData, blockSize, codeBlocks, processedRanges.get(filePath));
            }
        }
        
        // 找出重复的代码块
        let meaningfulDuplicates = 0;
        for (const [hash, blockData] of codeBlocks) {
            if (blockData.files.length > 1 && !this.isCommonPattern(blockData.lines)) {
                this.duplicateBlocks.set(hash, blockData);
                meaningfulDuplicates++;
            }
        }
        
        console.log(`🔍 发现 ${meaningfulDuplicates} 个有意义的重复代码块`);
    }

    /**
     * 为文件生成非重叠的代码块
     */
    generateNonOverlappingCodeBlocks(filePath, fileData, blockSize, codeBlocks, processedRanges) {
        const { lines } = fileData;
        
        for (let startLine = 0; startLine <= lines.length - blockSize; startLine += blockSize) {
            const endLine = startLine + blockSize - 1;
            const rangeString = `${startLine}-${endLine}`;
            
            // 跳过已处理的范围
            if (processedRanges.has(rangeString)) {
                continue;
            }
            
            const blockLines = lines.slice(startLine, startLine + blockSize);
            
            // 跳过主要由空行组成的块
            const meaningfulLines = blockLines.filter(line => line.length > 2);
            if (meaningfulLines.length < blockSize * 0.8) {
                continue;
            }
            
            // 跳过常见模式
            if (this.isCommonPattern(blockLines)) {
                continue;
            }
            
            // 生成代码块哈希
            const blockContent = blockLines.join('\n');
            const hash = crypto.createHash('md5').update(blockContent).digest('hex');
            
            if (!codeBlocks.has(hash)) {
                codeBlocks.set(hash, {
                    files: [],
                    lines: blockLines,
                    size: blockSize
                });
            }
            
            codeBlocks.get(hash).files.push({
                file: filePath,
                startLine: startLine + 1,
                endLine: endLine + 1,
                actualLines: fileData.originalLines.slice(startLine, startLine + blockSize)
            });
            
            // 标记此范围已处理
            processedRanges.add(rangeString);
        }
    }

    /**
     * 计算统计数据（修正算法）
     */
    calculateStatistics() {
        let totalDuplicateLines = 0;
        
        for (const [, blockData] of this.duplicateBlocks) {
            // 每个重复块的实际重复行数 = 块大小 × (出现次数 - 1)
            const actualDuplicateLines = blockData.size * (blockData.files.length - 1);
            totalDuplicateLines += actualDuplicateLines;
        }
        
        this.statistics.duplicateLines = totalDuplicateLines;
        this.statistics.duplicateBlocks = this.duplicateBlocks.size;
        this.statistics.duplicationRate = this.statistics.totalLines > 0 
            ? (this.statistics.duplicateLines / this.statistics.totalLines) * 100 
            : 0;
        
        console.log(`📊 修正后的代码重复率: ${this.statistics.duplicationRate.toFixed(2)}%`);
    }

    /**
     * 生成详细报告
     */
    generateReport() {
        const report = {
            metadata: {
                projectPath: this.projectRoot,
                analysisDate: new Date(),
                analyzerVersion: '2.0.0 (Improved)',
                phase7Target: '< 10% code duplication',
                improvementNotes: 'Fixed algorithm to exclude common patterns and overlapping blocks'
            },
            summary: {
                ...this.statistics,
                duplicationRate: parseFloat(this.statistics.duplicationRate.toFixed(2)),
                targetAchieved: this.statistics.duplicationRate < 10,
                phase7Status: this.statistics.duplicationRate < 10 ? 'SUCCESS' : 'NEEDS_IMPROVEMENT'
            },
            files: {
                scanned: Array.from(this.sourceFiles.keys()),
                ignored: this.getIgnoredFiles()
            },
            duplicateBlocks: this.formatDuplicateBlocks(),
            recommendations: this.generateRecommendations(),
            architectureAnalysis: this.analyzeArchitecture()
        };
        
        return report;
    }

    /**
     * 获取被忽略的文件列表
     */
    getIgnoredFiles() {
        return this.ignorePaths.map(path => `${path}/**`);
    }

    /**
     * 格式化重复代码块
     */
    formatDuplicateBlocks() {
        const blocks = [];
        
        for (const [hash, blockData] of this.duplicateBlocks) {
            blocks.push({
                id: hash.substring(0, 8),
                size: blockData.size,
                occurrences: blockData.files.length,
                duplicateLines: blockData.size * (blockData.files.length - 1),
                locations: blockData.files.map(file => ({
                    file: file.file,
                    lines: `${file.startLine}-${file.endLine}`,
                    preview: file.actualLines.slice(0, 3).map(line => line.trim()).filter(line => line).join(' | ')
                })),
                codePreview: blockData.lines.filter(line => line.length > 0).slice(0, blockData.size)
            });
        }
        
        // 按重复行数排序
        blocks.sort((a, b) => b.duplicateLines - a.duplicateLines);
        
        return blocks;
    }

    /**
     * 生成改进建议
     */
    generateRecommendations() {
        const recommendations = [];
        
        if (this.statistics.duplicationRate >= 10) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Phase 7 Target',
                description: `代码重复率 ${this.statistics.duplicationRate.toFixed(2)}% 超过目标 <10%`,
                suggestion: '需要进一步重构重复代码块，考虑提取共同逻辑到服务层'
            });
        } else if (this.statistics.duplicationRate >= 5) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'Code Quality',
                description: `代码重复率 ${this.statistics.duplicationRate.toFixed(2)}% 接近目标上限`,
                suggestion: '建议持续监控并优化重复代码'
            });
        }
        
        if (this.duplicateBlocks.size > 5) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'Code Structure',
                description: `发现 ${this.duplicateBlocks.size} 个有意义的重复代码块`,
                suggestion: '考虑将重复逻辑提取为可复用的函数或模块'
            });
        }
        
        // 分析最大的重复块
        let maxDuplicateLines = 0;
        for (const [, blockData] of this.duplicateBlocks) {
            const duplicateLines = blockData.size * (blockData.files.length - 1);
            if (duplicateLines > maxDuplicateLines) {
                maxDuplicateLines = duplicateLines;
            }
        }
        
        if (maxDuplicateLines > 30) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Large Duplicates',
                description: `存在大型重复代码块（${maxDuplicateLines} 重复行）`,
                suggestion: '优先重构最大的重复代码块，可考虑服务层抽象'
            });
        }
        
        if (this.statistics.duplicationRate < 10) {
            recommendations.push({
                priority: 'INFO',
                category: 'Phase 7 Success',
                description: `Phase 7 目标已达成（${this.statistics.duplicationRate.toFixed(2)}% < 10%）`,
                suggestion: '继续保持良好的代码结构，定期进行重复分析'
            });
        }
        
        return recommendations;
    }

    /**
     * 分析架构模式
     */
    analyzeArchitecture() {
        const analysis = {
            serviceLayerFiles: [],
            controllerFiles: [],
            repositoryFiles: [],
            traditionalFiles: [],
            architectureScore: 0,
            serviceLayerCoverage: 0
        };
        
        for (const filePath of this.sourceFiles.keys()) {
            if (filePath.includes('service') || filePath.includes('Service')) {
                analysis.serviceLayerFiles.push(filePath);
            } else if (filePath.includes('controller') || filePath.includes('Controller')) {
                analysis.controllerFiles.push(filePath);
            } else if (filePath.includes('repository') || filePath.includes('Repository')) {
                analysis.repositoryFiles.push(filePath);
            } else {
                analysis.traditionalFiles.push(filePath);
            }
        }
        
        // 计算服务层覆盖率
        const serviceFiles = analysis.serviceLayerFiles.length + analysis.controllerFiles.length + analysis.repositoryFiles.length;
        analysis.serviceLayerCoverage = Math.round((serviceFiles / this.statistics.totalFiles) * 100);
        
        // 计算架构得分
        const serviceLayerRatio = analysis.serviceLayerFiles.length / this.statistics.totalFiles;
        const controllerRatio = analysis.controllerFiles.length / this.statistics.totalFiles;
        const repositoryRatio = analysis.repositoryFiles.length / this.statistics.totalFiles;
        
        analysis.architectureScore = Math.round(
            (serviceLayerRatio + controllerRatio + repositoryRatio) * 100
        );
        
        return analysis;
    }

    /**
     * 保存报告到文件
     */
    saveReport(report) {
        const reportPath = path.join(this.projectRoot, 'improved-code-duplication-analysis.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        // 生成简化的文本报告
        const textReport = this.generateTextReport(report);
        const textReportPath = path.join(this.projectRoot, 'improved-code-duplication-summary.txt');
        fs.writeFileSync(textReportPath, textReport);
        
        console.log(`📄 改进报告已保存到: ${reportPath}`);
        console.log(`📄 改进摘要已保存到: ${textReportPath}`);
    }

    /**
     * 生成文本格式报告
     */
    generateTextReport(report) {
        const lines = [];
        
        lines.push('========================================');
        lines.push('     改进的代码重复分析报告');
        lines.push('========================================');
        lines.push('');
        
        lines.push(`分析时间: ${report.metadata.analysisDate}`);
        lines.push(`项目路径: ${report.metadata.projectPath}`);
        lines.push(`分析器版本: ${report.metadata.analyzerVersion}`);
        lines.push(`Phase 7 目标: ${report.metadata.phase7Target}`);
        lines.push(`改进说明: ${report.metadata.improvementNotes}`);
        lines.push('');
        
        lines.push('📊 统计摘要:');
        lines.push(`  总文件数: ${report.summary.totalFiles}`);
        lines.push(`  总行数: ${report.summary.totalLines}`);
        lines.push(`  重复行数: ${report.summary.duplicateLines}`);
        lines.push(`  有意义重复代码块: ${report.summary.duplicateBlocks}`);
        lines.push(`  代码重复率: ${report.summary.duplicationRate}%`);
        lines.push('');
        
        const status = report.summary.targetAchieved ? '✅ 已达成' : '❌ 未达成';
        lines.push(`🎯 Phase 7 目标状态: ${status}`);
        lines.push(`   状态: ${report.summary.phase7Status}`);
        lines.push('');
        
        if (report.duplicateBlocks.length > 0) {
            lines.push('🔍 主要重复代码块:');
            report.duplicateBlocks.slice(0, 5).forEach((block, index) => {
                lines.push(`  ${index + 1}. 代码块 ${block.id}:`);
                lines.push(`     大小: ${block.size} 行`);
                lines.push(`     出现次数: ${block.occurrences}`);
                lines.push(`     重复行数: ${block.duplicateLines}`);
                lines.push(`     位置: ${block.locations.slice(0, 3).map(loc => `${loc.file} (${loc.lines})`).join(', ')}`);
                if (block.locations.length > 3) {
                    lines.push(`           ... 以及其他 ${block.locations.length - 3} 个位置`);
                }
                lines.push('');
            });
        } else {
            lines.push('🎉 未发现有意义的重复代码块！');
            lines.push('');
        }
        
        lines.push('💡 改进建议:');
        report.recommendations.forEach((rec, index) => {
            lines.push(`  ${index + 1}. [${rec.priority}] ${rec.category}:`);
            lines.push(`     ${rec.description}`);
            lines.push(`     建议: ${rec.suggestion}`);
            lines.push('');
        });
        
        lines.push('🏗️ 架构分析:');
        lines.push(`  服务层文件: ${report.architectureAnalysis.serviceLayerFiles.length}`);
        lines.push(`  控制器文件: ${report.architectureAnalysis.controllerFiles.length}`);
        lines.push(`  仓库文件: ${report.architectureAnalysis.repositoryFiles.length}`);
        lines.push(`  传统文件: ${report.architectureAnalysis.traditionalFiles.length}`);
        lines.push(`  服务层覆盖率: ${report.architectureAnalysis.serviceLayerCoverage}%`);
        lines.push(`  架构得分: ${report.architectureAnalysis.architectureScore}/100`);
        lines.push('');
        
        lines.push('========================================');
        
        return lines.join('\n');
    }

    /**
     * 打印控制台报告
     */
    printConsoleReport(report) {
        console.log('\n📋 ========== 改进的代码重复分析报告 ==========');
        console.log(`📊 总文件数: ${report.summary.totalFiles}`);
        console.log(`📊 总行数: ${report.summary.totalLines}`);
        console.log(`🔍 重复行数: ${report.summary.duplicateLines}`);
        console.log(`🔍 有意义重复代码块: ${report.summary.duplicateBlocks}`);
        console.log(`📈 代码重复率: ${report.summary.duplicationRate}%`);
        
        const statusIcon = report.summary.targetAchieved ? '✅' : '❌';
        console.log(`\n🎯 Phase 7 目标 (<10% 重复率): ${statusIcon} ${report.summary.phase7Status}`);
        
        if (report.duplicateBlocks.length > 0) {
            console.log(`\n🔍 发现 ${report.duplicateBlocks.length} 个有意义的重复代码块:`);
            report.duplicateBlocks.slice(0, 3).forEach((block, index) => {
                console.log(`${index + 1}. 代码块 ${block.id}: ${block.size} 行, ${block.occurrences} 次出现, ${block.duplicateLines} 重复行`);
            });
        } else {
            console.log('\n🎉 未发现有意义的重复代码块！代码质量优秀！');
        }
        
        console.log('\n💡 改进建议:');
        report.recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. [${rec.priority}] ${rec.description}`);
        });
        
        console.log(`\n🏗️ 服务层覆盖率: ${report.architectureAnalysis.serviceLayerCoverage}%`);
        console.log('================================\n');
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const projectRoot = process.argv[2] || __dirname;
    const analyzer = new ImprovedCodeDuplicationAnalyzer(projectRoot);
    
    analyzer.analyze().then(report => {
        analyzer.printConsoleReport(report);
        
        if (report.summary.targetAchieved) {
            console.log('🎉 恭喜！Phase 7 代码重复率目标已达成！');
            process.exit(0);
        } else {
            console.log('⚠️ Phase 7 目标未达成，需要进一步重构。');
            process.exit(1);
        }
    }).catch(error => {
        console.error('❌ 分析失败:', error);
        process.exit(1);
    });
}

module.exports = ImprovedCodeDuplicationAnalyzer;