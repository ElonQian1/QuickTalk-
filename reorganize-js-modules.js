/**
 * JavaScript模块重组脚本
 * 分析依赖关系并重组JS文件结构
 */

const fs = require('fs');
const path = require('path');

class JSReorganizer {
    constructor() {
        this.staticPath = './static';
        this.analysis = {
            dependencies: new Map(),
            modules: [],
            circularDeps: [],
            recommendations: []
        };
        
        this.newStructure = {
            'static/assets/js/core/': [
                'assets/js/core/utils.js'  // 已经整合的工具函数
            ],
            'static/assets/js/modules/message/': [
                'js/message-search-manager.js',
                'js/mobile-message-manager.js',
                'js/unified-message-manager.js'
            ],
            'static/assets/js/modules/shop/': [
                'js/mobile-shop-manager.js',
                'js/mobile-ecommerce-customer-service.js'
            ],
            'static/assets/js/modules/analytics/': [
                'js/analytics-dashboard.js',
                'js/enhanced-analytics-dashboard.js'
            ],
            'static/assets/js/modules/ai/': [
                'js/ai-chatbot.js',
                'js/enhanced-ai-assistant.js'
            ],
            'static/assets/js/modules/mobile/': [
                'js/mobile-customer-service.js',
                'js/enhanced-mobile-customer-service.js'
            ],
            'static/assets/js/modules/admin/': [
                'js/enhanced-file-manager.js',
                'js/notification-manager.js'
            ]
        };
    }

    async reorganize() {
        console.log('⚙️ 开始JavaScript模块重组...\n');
        
        // 分析现有模块
        await this.analyzeExistingModules();
        
        // 创建新目录结构
        await this.createDirectories();
        
        // 重组模块文件
        await this.reorganizeModules();
        
        // 生成报告
        this.generateReport();
    }

    async analyzeExistingModules() {
        console.log('🔍 分析现有JavaScript模块...');
        
        const jsFiles = this.getJSFiles();
        
        for (const file of jsFiles) {
            try {
                const content = fs.readFileSync(path.join(this.staticPath, file), 'utf8');
                const deps = this.extractDependencies(content);
                
                this.analysis.modules.push({
                    file,
                    dependencies: deps,
                    size: content.length,
                    hasClassDefinition: content.includes('class '),
                    hasModuleExports: content.includes('module.exports') || content.includes('export '),
                    hasGlobalVariables: this.detectGlobalVariables(content)
                });
                
                this.analysis.dependencies.set(file, deps);
            } catch (error) {
                console.error(`❌ 分析文件失败 ${file}:`, error.message);
            }
        }
        
        console.log(`✅ 分析了 ${this.analysis.modules.length} 个JavaScript文件`);
    }

    getJSFiles() {
        const files = [];
        
        const searchDir = (dirPath, relativePath = '') => {
            try {
                const items = fs.readdirSync(dirPath);
                
                for (const item of items) {
                    const fullPath = path.join(dirPath, item);
                    const relativeFilePath = path.join(relativePath, item);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isFile() && path.extname(item) === '.js') {
                        files.push(relativeFilePath);
                    } else if (stat.isDirectory() && !item.includes('node_modules')) {
                        searchDir(fullPath, relativeFilePath);
                    }
                }
            } catch (error) {
                console.error(`❌ 搜索目录失败: ${dirPath}`, error.message);
            }
        };
        
        searchDir(this.staticPath);
        return files;
    }

    extractDependencies(content) {
        const deps = [];
        
        // 匹配require语句
        const requireMatches = content.match(/require\(['"]([^'"]+)['"]\)/g);
        if (requireMatches) {
            requireMatches.forEach(match => {
                const dep = match.match(/require\(['"]([^'"]+)['"]\)/)[1];
                deps.push(dep);
            });
        }
        
        // 匹配import语句
        const importMatches = content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
        if (importMatches) {
            importMatches.forEach(match => {
                const dep = match.match(/from\s+['"]([^'"]+)['"]/)[1];
                deps.push(dep);
            });
        }
        
        // 匹配script标签引用
        const scriptMatches = content.match(/<script\s+.*?src=['"]([^'"]+)['"]/g);
        if (scriptMatches) {
            scriptMatches.forEach(match => {
                const dep = match.match(/src=['"]([^'"]+)['"]/)[1];
                if (dep.endsWith('.js')) {
                    deps.push(dep);
                }
            });
        }
        
        return [...new Set(deps)]; // 去重
    }

    detectGlobalVariables(content) {
        const globals = [];
        
        // 检测常见的全局变量定义
        const globalPatterns = [
            /window\.(\w+)\s*=/g,
            /var\s+(\w+)\s*=.*window/g,
            /function\s+(\w+)\s*\(/g  // 全局函数
        ];
        
        globalPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                globals.push(match[1]);
            }
        });
        
        return globals;
    }

    async createDirectories() {
        console.log('📁 创建新的JS模块目录结构...');
        
        const dirs = [
            'static/assets/js/modules/message',
            'static/assets/js/modules/shop',
            'static/assets/js/modules/analytics',
            'static/assets/js/modules/ai',
            'static/assets/js/modules/mobile',
            'static/assets/js/modules/admin',
            'static/assets/js/pages/admin',
            'static/assets/js/pages/customer',
            'static/assets/js/pages/mobile'
        ];
        
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`✅ 创建目录: ${dir.replace('static/', '')}`);
            }
        }
    }

    async reorganizeModules() {
        console.log('📦 重组JavaScript模块...');
        
        // 按业务功能重组文件
        const reorganizationPlan = [
            // 消息模块
            { from: 'js/message-search-manager.js', to: 'assets/js/modules/message/search-manager.js', module: 'message' },
            { from: 'js/mobile-message-manager.js', to: 'assets/js/modules/message/mobile-manager.js', module: 'message' },
            { from: 'js/unified-message-manager.js', to: 'assets/js/modules/message/unified-manager.js', module: 'message' },
            
            // 店铺模块
            { from: 'js/mobile-shop-manager.js', to: 'assets/js/modules/shop/mobile-manager.js', module: 'shop' },
            { from: 'js/mobile-ecommerce-customer-service.js', to: 'assets/js/modules/shop/ecommerce-service.js', module: 'shop' },
            
            // 分析模块
            { from: 'js/analytics-dashboard.js', to: 'assets/js/modules/analytics/dashboard.js', module: 'analytics' },
            { from: 'js/enhanced-analytics-dashboard.js', to: 'assets/js/modules/analytics/enhanced-dashboard.js', module: 'analytics' },
            
            // AI模块
            { from: 'js/ai-chatbot.js', to: 'assets/js/modules/ai/chatbot.js', module: 'ai' },
            { from: 'js/enhanced-ai-assistant.js', to: 'assets/js/modules/ai/enhanced-assistant.js', module: 'ai' },
            
            // 移动端模块
            { from: 'js/mobile-customer-service.js', to: 'assets/js/modules/mobile/customer-service.js', module: 'mobile' },
            { from: 'js/enhanced-mobile-customer-service.js', to: 'assets/js/modules/mobile/enhanced-service.js', module: 'mobile' },
            
            // 管理模块
            { from: 'js/enhanced-file-manager.js', to: 'assets/js/modules/admin/file-manager.js', module: 'admin' },
            { from: 'js/notification-manager.js', to: 'assets/js/modules/admin/notification-manager.js', module: 'admin' }
        ];
        
        for (const plan of reorganizationPlan) {
            await this.moveJSFile(plan.from, plan.to, plan.module);
        }
    }

    async moveJSFile(from, to, module) {
        try {
            const fromPath = path.join(this.staticPath, from);
            const toPath = path.join(this.staticPath, to);
            
            if (fs.existsSync(fromPath)) {
                // 确保目标目录存在
                const targetDir = path.dirname(toPath);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                
                // 复制文件
                fs.copyFileSync(fromPath, toPath);
                console.log(`✅ [${module}] ${path.basename(from)} → ${to.replace('static/', '')}`);
                
                return true;
            } else {
                console.log(`⚠️  文件不存在: ${from}`);
                return false;
            }
        } catch (error) {
            console.error(`❌ 移动文件失败 ${from}: ${error.message}`);
            return false;
        }
    }

    generateReport() {
        console.log('\n📊 JavaScript模块重组报告');
        console.log('='.repeat(60));
        
        // 模块统计
        console.log(`\n📈 模块分析结果:`);
        console.log(`   总文件数: ${this.analysis.modules.length}个`);
        console.log(`   包含类定义: ${this.analysis.modules.filter(m => m.hasClassDefinition).length}个`);
        console.log(`   模块化文件: ${this.analysis.modules.filter(m => m.hasModuleExports).length}个`);
        console.log(`   使用全局变量: ${this.analysis.modules.filter(m => m.hasGlobalVariables.length > 0).length}个`);
        
        // 新的模块结构
        console.log('\n📁 新的JavaScript架构:');
        console.log('static/assets/js/');
        console.log('├── core/                    # 核心工具');
        console.log('│   └── utils.js            # 统一工具函数');
        console.log('├── modules/                 # 业务模块');
        console.log('│   ├── message/            # 消息相关');
        console.log('│   ├── shop/               # 店铺相关');
        console.log('│   ├── analytics/          # 分析相关');
        console.log('│   ├── ai/                 # AI功能');
        console.log('│   ├── mobile/             # 移动端');
        console.log('│   └── admin/              # 管理功能');
        console.log('├── components/             # UI组件');
        console.log('├── pages/                  # 页面脚本');
        console.log('│   ├── admin/');
        console.log('│   ├── customer/');
        console.log('│   └── mobile/');
        console.log('└── lib/                    # 第三方库');
        
        // 重组建议
        console.log('\n💡 进一步优化建议:');
        console.log('   1. 为每个模块创建统一的入口文件 (index.js)');
        console.log('   2. 建立模块间的清晰接口和API');
        console.log('   3. 消除全局变量，使用模块化导入/导出');
        console.log('   4. 为核心模块添加TypeScript类型定义');
        console.log('   5. 建立模块依赖管理和版本控制');
    }
}

// 运行重组
if (require.main === module) {
    const reorganizer = new JSReorganizer();
    reorganizer.reorganize().catch(console.error);
}

module.exports = JSReorganizer;