/**
 * 模块加载调试工具
 * 用于检查模块加载状态和依赖关系
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-10-03
 */

window.ModuleDebugger = (function() {
    'use strict';
    
    /**
     * 检查所有关键模块的加载状态
     */
    function checkModuleStatus() {
        console.log('🔍 检查模块加载状态...');
        console.log('=====================================');
        
        const coreModules = [
            'ModuleLoader',
            'UnifiedSessionManager',
            'UnifiedDataSyncManager',
            'EventBus',
            'NavBadgeManager',
            'ShopCardManager'
        ];
        
        const results = {};
        
        coreModules.forEach(moduleName => {
            // 检查新模块系统
            const isRegistered = window.ModuleRegistry ? window.ModuleRegistry.isRegistered(moduleName) : false;
            const isGlobal = window[moduleName] !== undefined;
            
            results[moduleName] = {
                isLoaded: isRegistered,
                isGlobal,
                status: isRegistered && isGlobal ? '✅' : isRegistered ? '⚠️' : '❌'
            };
            
            console.log(`${results[moduleName].status} ${moduleName}: 注册=${isRegistered}, 全局=${isGlobal}`);
        });
        
        console.log('=====================================');
        return results;
    }
    
    /**
     * 检查重复声明
     */
    function checkDuplicateDeclarations() {
        console.log('🔍 检查重复声明...');
        console.log('=====================================');
        
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        const scriptUrls = scripts.map(script => script.src);
        const duplicates = [];
        
        scriptUrls.forEach((url, index) => {
            const cleanUrl = url.split('?')[0]; // 移除查询参数
            const otherIndexes = scriptUrls
                .map((otherUrl, otherIndex) => otherUrl.split('?')[0] === cleanUrl ? otherIndex : -1)
                .filter(idx => idx !== -1 && idx !== index);
                
            if (otherIndexes.length > 0) {
                duplicates.push({
                    url: cleanUrl,
                    indexes: [index, ...otherIndexes]
                });
            }
        });
        
        if (duplicates.length === 0) {
            console.log('✅ 没有发现重复加载的脚本');
        } else {
            console.log('❌ 发现重复加载的脚本:');
            duplicates.forEach(dup => {
                console.log(`  ${dup.url} (索引: ${dup.indexes.join(', ')})`);
            });
        }
        
        console.log('=====================================');
        return duplicates;
    }
    
    /**
     * 检查类的重复定义
     */
    function checkClassRedefinitions() {
        console.log('🔍 检查类重复定义...');
        console.log('=====================================');
        
        const classNames = [
            'DataSyncManager',
            'SessionManager', 
            'CustomerSessionManager',
            'NavBadgeManager',
            'ShopCardManager'
        ];
        
        const issues = [];
        
        classNames.forEach(className => {
            try {
                // 尝试重新定义类，看是否会报错
                const testScript = document.createElement('script');
                testScript.textContent = `
                    try {
                        class ${className}Test {};
                        console.log('⚠️ 可以重新定义 ${className}');
                    } catch (e) {
                        if (e.message.includes('already been declared')) {
                            console.log('✅ ${className} 受保护，无法重复定义');
                        }
                    }
                `;
                document.head.appendChild(testScript);
                document.head.removeChild(testScript);
            } catch (error) {
                issues.push({ className, error: error.message });
            }
        });
        
        console.log('=====================================');
        return issues;
    }
    
    /**
     * 完整的模块健康检查
     */
    function healthCheck() {
        console.log('🏥 开始模块健康检查...');
        console.log('=====================================');
        
        const results = {
            moduleStatus: checkModuleStatus(),
            duplicateScripts: checkDuplicateDeclarations(),
            classIssues: checkClassRedefinitions(),
            timestamp: new Date().toISOString()
        };
        
        // 总结
        const moduleCount = Object.keys(results.moduleStatus).length;
        const loadedCount = Object.values(results.moduleStatus).filter(m => m.isLoaded && m.isGlobal).length;
        const duplicateCount = results.duplicateScripts.length;
        
        console.log('📊 健康检查总结:');
        console.log(`  模块加载: ${loadedCount}/${moduleCount}`);
        console.log(`  重复脚本: ${duplicateCount}`);
        console.log(`  整体状态: ${loadedCount === moduleCount && duplicateCount === 0 ? '✅ 健康' : '⚠️ 需要关注'}`);
        console.log('=====================================');
        
        return results;
    }
    
    // 公开 API
    return {
        checkModuleStatus,
        checkDuplicateDeclarations,
        checkClassRedefinitions,
        healthCheck
    };
})();

// 页面加载完成后自动进行健康检查
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.ModuleDebugger.healthCheck();
        }, 2000);
    });
} else {
    setTimeout(() => {
        window.ModuleDebugger.healthCheck();
    }, 2000);
}

console.log('🔧 模块调试工具已加载');