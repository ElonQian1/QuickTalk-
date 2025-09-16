/**
 * CSS架构重组脚本
 * 重新组织CSS文件，建立清晰的样式架构
 */

const fs = require('fs');
const path = require('path');

class CSSReorganizer {
    constructor() {
        this.staticPath = './static';
        this.newStructure = {
            base: [
                'style.css',
                'assets/css/base.css',
                'assets/css/main.css',
                'assets/css/responsive.css'
            ],
            components: [
                'assets/css/components/button.css',
                'assets/css/components/form.css',
                'assets/css/components/modal.css',
                'assets/css/components/navigation.css',
                'assets/css/components/notification.css',
                'integration-manager.css'
            ],
            pages: [
                'analytics-dashboard.css',
                'enhanced-analytics-dashboard.css',
                'enhanced-ai-assistant.css',
                'enhanced-file-manager.css',
                'mobile-customer-service.css',
                'enhanced-mobile-customer-service.css',
                'mobile-shop-manager.css',
                'mobile-message.css',
                'message-search.css',
                'notification-manager.css',
                'multi-shop-customer-service.css'
            ],
            modules: [
                'css/modules/ruilong-features/shop-components.css',
                'css/modules/ruilong-features/mobile-modals.css',
                'css/modules/ruilong-features/payment-styles.css'
            ]
        };
        
        this.reorganizationMap = [];
    }

    async reorganize() {
        console.log('🎨 开始重组CSS架构...\n');
        
        // 确保目标目录存在
        await this.ensureDirectories();
        
        // 重组基础样式
        await this.reorganizeBase();
        
        // 重组组件样式  
        await this.reorganizeComponents();
        
        // 重组页面样式
        await this.reorganizePages();
        
        // 重组模块样式
        await this.reorganizeModules();
        
        // 生成重组报告
        this.generateReport();
        
        // 创建主样式文件
        await this.createMasterStylesheet();
    }

    async ensureDirectories() {
        const directories = [
            'static/assets/css/base',
            'static/assets/css/components', 
            'static/assets/css/pages',
            'static/assets/css/modules',
            'static/assets/css/themes'
        ];
        
        for (const dir of directories) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 创建目录: ${dir}`);
            }
        }
    }

    async reorganizeBase() {
        console.log('📋 重组基础样式...');
        
        const baseFiles = [
            { from: 'static/style.css', to: 'static/assets/css/base/global.css', name: '全局样式' },
            { from: 'static/assets/css/main.css', to: 'static/assets/css/base/main.css', name: '主样式' },
            { from: 'static/assets/css/base.css', to: 'static/assets/css/base/foundation.css', name: '基础样式' },
            { from: 'static/assets/css/responsive.css', to: 'static/assets/css/base/responsive.css', name: '响应式样式' }
        ];
        
        for (const file of baseFiles) {
            await this.moveFile(file.from, file.to, file.name);
        }
    }

    async reorganizeComponents() {
        console.log('🧩 重组组件样式...');
        
        const componentFiles = [
            { from: 'static/integration-manager.css', to: 'static/assets/css/components/integration-manager.css', name: '集成管理器组件' }
        ];
        
        // 组件目录下的文件已经在正确位置，只需要验证
        const existingComponents = [
            'static/assets/css/components/button.css',
            'static/assets/css/components/form.css',
            'static/assets/css/components/modal.css',
            'static/assets/css/components/navigation.css',
            'static/assets/css/components/notification.css'
        ];
        
        for (const file of componentFiles) {
            await this.moveFile(file.from, file.to, file.name);
        }
        
        for (const component of existingComponents) {
            if (fs.existsSync(component)) {
                console.log(`✅ 组件样式已存在: ${path.basename(component)}`);
            }
        }
    }

    async reorganizePages() {
        console.log('📄 重组页面样式...');
        
        const pageFiles = [
            { from: 'static/analytics-dashboard.css', to: 'static/assets/css/pages/analytics-dashboard.css', name: '分析仪表板' },
            { from: 'static/enhanced-analytics-dashboard.css', to: 'static/assets/css/pages/enhanced-analytics.css', name: '增强分析' },
            { from: 'static/enhanced-ai-assistant.css', to: 'static/assets/css/pages/ai-assistant.css', name: 'AI助手' },
            { from: 'static/enhanced-file-manager.css', to: 'static/assets/css/pages/file-manager.css', name: '文件管理器' },
            { from: 'static/mobile-customer-service.css', to: 'static/assets/css/pages/mobile-customer.css', name: '移动端客服' },
            { from: 'static/enhanced-mobile-customer-service.css', to: 'static/assets/css/pages/enhanced-mobile-customer.css', name: '增强移动客服' },
            { from: 'static/mobile-shop-manager.css', to: 'static/assets/css/pages/mobile-shop.css', name: '移动店铺管理' },
            { from: 'static/mobile-message.css', to: 'static/assets/css/pages/mobile-message.css', name: '移动消息' },
            { from: 'static/message-search.css', to: 'static/assets/css/pages/message-search.css', name: '消息搜索' },
            { from: 'static/notification-manager.css', to: 'static/assets/css/pages/notification-manager.css', name: '通知管理' },
            { from: 'static/multi-shop-customer-service.css', to: 'static/assets/css/pages/multi-shop-service.css', name: '多店铺服务' }
        ];
        
        for (const file of pageFiles) {
            await this.moveFile(file.from, file.to, file.name);
        }
    }

    async reorganizeModules() {
        console.log('📦 重组模块样式...');
        
        // 移动ruilong-features模块
        const moduleSourceDir = 'static/css/modules/ruilong-features';
        const moduleTargetDir = 'static/assets/css/modules/ruilong-features';
        
        if (fs.existsSync(moduleSourceDir)) {
            if (!fs.existsSync(moduleTargetDir)) {
                fs.mkdirSync(moduleTargetDir, { recursive: true });
            }
            
            const moduleFiles = fs.readdirSync(moduleSourceDir);
            for (const file of moduleFiles) {
                if (path.extname(file) === '.css') {
                    const from = path.join(moduleSourceDir, file);
                    const to = path.join(moduleTargetDir, file);
                    await this.moveFile(from, to, `Ruilong模块: ${file}`);
                }
            }
        }
    }

    async moveFile(from, to, description) {
        try {
            if (fs.existsSync(from)) {
                // 确保目标目录存在
                const targetDir = path.dirname(to);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                
                // 复制文件
                fs.copyFileSync(from, to);
                console.log(`✅ 移动 ${description}: ${path.basename(from)} → ${to.replace('static/', '')}`);
                
                this.reorganizationMap.push({
                    from: from.replace('static/', ''),
                    to: to.replace('static/', ''),
                    description
                });
                
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

    async createMasterStylesheet() {
        console.log('📝 创建主样式文件...');
        
        const masterCSS = `/**
 * QuickTalk客服系统 - 主样式文件
 * 统一导入所有样式文件
 */

/* 基础样式 */
@import url('./base/foundation.css');
@import url('./base/global.css');
@import url('./base/main.css');
@import url('./base/responsive.css');

/* 组件样式 */
@import url('./components/button.css');
@import url('./components/form.css');
@import url('./components/modal.css');
@import url('./components/navigation.css');
@import url('./components/notification.css');
@import url('./components/integration-manager.css');

/* 页面样式 - 按需加载 */
/* @import url('./pages/analytics-dashboard.css'); */
/* @import url('./pages/ai-assistant.css'); */
/* @import url('./pages/file-manager.css'); */
/* @import url('./pages/mobile-customer.css'); */
/* @import url('./pages/mobile-shop.css'); */

/* 主题样式 */
/* @import url('./themes/default.css'); */

/* 模块样式 */
/* @import url('./modules/ruilong-features/shop-components.css'); */
`;

        fs.writeFileSync('static/assets/css/master.css', masterCSS);
        console.log('✅ 创建主样式文件: assets/css/master.css');
    }

    generateReport() {
        console.log('\n📊 CSS重组报告');
        console.log('='.repeat(50));
        
        console.log(`\n✅ 总共重组了 ${this.reorganizationMap.length} 个CSS文件`);
        console.log('\n📁 新的CSS架构:');
        console.log('static/assets/css/');
        console.log('├── base/                # 基础样式');
        console.log('│   ├── foundation.css   # 基础设置');
        console.log('│   ├── global.css       # 全局样式');
        console.log('│   ├── main.css         # 主样式');
        console.log('│   └── responsive.css   # 响应式');
        console.log('├── components/          # 组件样式');
        console.log('│   ├── button.css');
        console.log('│   ├── form.css');
        console.log('│   ├── modal.css');
        console.log('│   ├── navigation.css');
        console.log('│   ├── notification.css');
        console.log('│   └── integration-manager.css');
        console.log('├── pages/               # 页面样式');
        console.log('│   ├── analytics-dashboard.css');
        console.log('│   ├── ai-assistant.css');
        console.log('│   ├── mobile-customer.css');
        console.log('│   └── ...');
        console.log('├── modules/             # 模块样式');
        console.log('│   └── ruilong-features/');
        console.log('├── themes/              # 主题样式');
        console.log('└── master.css           # 主样式入口');
        
        console.log('\n📋 重组详情:');
        this.reorganizationMap.forEach((item, index) => {
            console.log(`${index + 1}. ${item.description}`);
            console.log(`   ${item.from} → ${item.to}`);
        });
    }
}

// 运行重组
if (require.main === module) {
    const reorganizer = new CSSReorganizer();
    reorganizer.reorganize().catch(console.error);
}

module.exports = CSSReorganizer;