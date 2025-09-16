/**
 * 文件结构分析脚本
 * 分析static目录下的文件组织现状，识别需要重组的文件
 */

const fs = require('fs');
const path = require('path');

class FileStructureAnalyzer {
    constructor(staticPath = './static') {
        this.staticPath = staticPath;
        this.analysis = {
            html: {
                production: [],
                demo: [],
                test: [],
                admin: []
            },
            css: {
                global: [],
                component: [],
                page: [],
                duplicate: []
            },
            js: {
                core: [],
                modules: [],
                pages: [],
                utilities: []
            },
            directories: [],
            issues: []
        };
    }

    async analyze() {
        console.log('🔍 开始分析文件结构...\n');
        
        await this.analyzeDirectory(this.staticPath);
        await this.analyzeHTMLFiles();
        await this.analyzeCSSFiles();
        await this.analyzeJSFiles();
        await this.findDuplicates();
        
        this.generateReport();
    }

    async analyzeDirectory(dirPath, level = 0) {
        try {
            const items = fs.readdirSync(dirPath);
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    this.analysis.directories.push({
                        path: fullPath.replace(this.staticPath + path.sep, ''),
                        level,
                        fileCount: this.countFilesInDir(fullPath)
                    });
                    
                    if (level < 3) { // 避免过深递归
                        await this.analyzeDirectory(fullPath, level + 1);
                    }
                }
            }
        } catch (error) {
            console.error(`❌ 分析目录失败: ${dirPath}`, error.message);
        }
    }

    countFilesInDir(dirPath) {
        try {
            const items = fs.readdirSync(dirPath);
            let count = 0;
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const stat = fs.statSync(fullPath);
                if (stat.isFile()) count++;
                else if (stat.isDirectory()) count += this.countFilesInDir(fullPath);
            }
            return count;
        } catch {
            return 0;
        }
    }

    async analyzeHTMLFiles() {
        const htmlFiles = this.getFilesByExtension('.html');
        
        for (const file of htmlFiles) {
            const content = fs.readFileSync(path.join(this.staticPath, file), 'utf8');
            const fileName = path.basename(file);
            
            // 分类HTML文件
            if (fileName.includes('demo') || content.includes('演示') || content.includes('demo')) {
                this.analysis.html.demo.push(file);
            } else if (fileName.includes('test') || content.includes('测试') || content.includes('test')) {
                this.analysis.html.test.push(file);
            } else if (fileName.includes('admin') || file.includes('admin')) {
                this.analysis.html.admin.push(file);
            } else {
                this.analysis.html.production.push(file);
            }
        }
    }

    async analyzeCSSFiles() {
        const cssFiles = this.getFilesByExtension('.css');
        
        for (const file of cssFiles) {
            const fileName = path.basename(file);
            const dirName = path.dirname(file);
            
            if (dirName.includes('components') || fileName.includes('component')) {
                this.analysis.css.component.push(file);
            } else if (fileName.includes('main') || fileName.includes('base') || fileName === 'style.css') {
                this.analysis.css.global.push(file);
            } else {
                this.analysis.css.page.push(file);
            }
        }
    }

    async analyzeJSFiles() {
        const jsFiles = this.getFilesByExtension('.js');
        
        for (const file of jsFiles) {
            const fileName = path.basename(file);
            const dirName = path.dirname(file);
            
            if (dirName.includes('core') || fileName.includes('utils') || fileName.includes('Utils')) {
                this.analysis.js.core.push(file);
            } else if (dirName.includes('modules') || fileName.includes('module')) {
                this.analysis.js.modules.push(file);
            } else if (fileName.includes('manager') || fileName.includes('Manager')) {
                this.analysis.js.utilities.push(file);
            } else {
                this.analysis.js.pages.push(file);
            }
        }
    }

    getFilesByExtension(ext) {
        const files = [];
        
        const searchDir = (dirPath, relativePath = '') => {
            try {
                const items = fs.readdirSync(dirPath);
                
                for (const item of items) {
                    const fullPath = path.join(dirPath, item);
                    const relativeFilePath = path.join(relativePath, item);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isFile() && path.extname(item) === ext) {
                        files.push(relativeFilePath);
                    } else if (stat.isDirectory()) {
                        searchDir(fullPath, relativeFilePath);
                    }
                }
            } catch (error) {
                console.error(`❌ 搜索文件失败: ${dirPath}`, error.message);
            }
        };
        
        searchDir(this.staticPath);
        return files;
    }

    async findDuplicates() {
        // 查找可能重复的CSS
        const cssContents = new Map();
        const cssFiles = this.getFilesByExtension('.css');
        
        for (const file of cssFiles) {
            try {
                const content = fs.readFileSync(path.join(this.staticPath, file), 'utf8');
                const normalizedContent = content.replace(/\s+/g, ' ').trim();
                
                if (normalizedContent.length > 100) { // 忽略太短的文件
                    const hash = this.simpleHash(normalizedContent.substring(0, 500)); // 取前500字符的哈希
                    
                    if (cssContents.has(hash)) {
                        this.analysis.css.duplicate.push({
                            file1: cssContents.get(hash),
                            file2: file,
                            similarity: 'high'
                        });
                    } else {
                        cssContents.set(hash, file);
                    }
                }
            } catch (error) {
                console.error(`❌ 读取CSS文件失败: ${file}`, error.message);
            }
        }
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return hash;
    }

    generateReport() {
        console.log('📊 文件结构分析报告');
        console.log('='.repeat(50));
        
        // HTML文件分析
        console.log('\n📄 HTML文件分布:');
        console.log(`   生产文件: ${this.analysis.html.production.length}个`);
        console.log(`   管理文件: ${this.analysis.html.admin.length}个`);
        console.log(`   演示文件: ${this.analysis.html.demo.length}个`);
        console.log(`   测试文件: ${this.analysis.html.test.length}个`);
        
        if (this.analysis.html.demo.length > 0) {
            console.log('\n   演示文件列表:');
            this.analysis.html.demo.forEach(file => console.log(`     - ${file}`));
        }
        
        // CSS文件分析
        console.log('\n🎨 CSS文件分布:');
        console.log(`   全局样式: ${this.analysis.css.global.length}个`);
        console.log(`   组件样式: ${this.analysis.css.component.length}个`);
        console.log(`   页面样式: ${this.analysis.css.page.length}个`);
        console.log(`   疑似重复: ${this.analysis.css.duplicate.length}对`);
        
        if (this.analysis.css.duplicate.length > 0) {
            console.log('\n   重复CSS文件:');
            this.analysis.css.duplicate.forEach(dup => {
                console.log(`     - ${dup.file1} ↔ ${dup.file2}`);
            });
        }
        
        // JavaScript文件分析
        console.log('\n⚙️ JavaScript文件分布:');
        console.log(`   核心模块: ${this.analysis.js.core.length}个`);
        console.log(`   功能模块: ${this.analysis.js.modules.length}个`);
        console.log(`   工具文件: ${this.analysis.js.utilities.length}个`);
        console.log(`   页面脚本: ${this.analysis.js.pages.length}个`);
        
        // 目录结构分析
        console.log('\n📁 目录结构:');
        const sortedDirs = this.analysis.directories.sort((a, b) => a.level - b.level);
        sortedDirs.forEach(dir => {
            const indent = '  '.repeat(dir.level);
            console.log(`${indent}- ${dir.path} (${dir.fileCount}个文件)`);
        });
        
        // 重组建议
        console.log('\n💡 重组建议:');
        this.generateReorganizationSuggestions();
    }

    generateReorganizationSuggestions() {
        const suggestions = [];
        
        // HTML文件建议
        if (this.analysis.html.demo.length > 0 || this.analysis.html.test.length > 0) {
            suggestions.push('1. 创建 demos/ 和 tests/ 目录，移动演示和测试文件');
        }
        
        if (this.analysis.html.admin.length > 1) {
            suggestions.push('2. 统一管理后台HTML文件到 admin/ 目录');
        }
        
        // CSS文件建议
        if (this.analysis.css.page.length > 5) {
            suggestions.push('3. 重组页面CSS文件到 css/pages/ 目录');
        }
        
        if (this.analysis.css.duplicate.length > 0) {
            suggestions.push('4. 合并重复的CSS文件，提取公共样式');
        }
        
        // JS文件建议
        if (this.analysis.js.pages.length > 3) {
            suggestions.push('5. 整理页面JavaScript文件到 js/pages/ 目录');
        }
        
        suggestions.forEach(suggestion => console.log(`   ${suggestion}`));
        
        if (suggestions.length === 0) {
            console.log('   文件结构相对良好，建议进行细微调整');
        }
    }
}

// 运行分析
if (require.main === module) {
    const analyzer = new FileStructureAnalyzer();
    analyzer.analyze().catch(console.error);
}

module.exports = FileStructureAnalyzer;