#!/usr/bin/env node

/**
 * 单一版本系统验证器
 * 验证系统是否完全统一为单一版本
 */

const fs = require('fs');
const path = require('path');

class SingleVersionValidator {
    constructor() {
        this.findings = {
            apiVersions: [],
            duplicateFiles: [],
            backupFiles: [],
            versionConflicts: [],
            cleanupItems: []
        };
    }

    /**
     * 运行完整验证
     */
    async validate() {
        console.log('🔍 验证单一版本系统...\n');
        
        await this.checkApiVersions();
        await this.checkDuplicateFiles();
        await this.checkBackupFiles();
        await this.checkVersionConflicts();
        
        this.generateReport();
    }

    /**
     * 检查API版本情况
     */
    async checkApiVersions() {
        console.log('📡 检查API版本...');
        
        try {
            const serverContent = fs.readFileSync('server.js', 'utf8');
            
            // 检查v1/v2 API路由
            const v1Routes = serverContent.match(/\/api\/v1/g) || [];
            const v2Routes = serverContent.match(/\/api\/v2/g) || [];
            const unifiedRoutes = serverContent.match(/app\.use\('\/api',/g) || [];
            
            if (v1Routes.length > 0) {
                this.findings.apiVersions.push(`发现 ${v1Routes.length} 个 v1 API 引用`);
            }
            if (v2Routes.length > 0) {
                this.findings.apiVersions.push(`发现 ${v2Routes.length} 个 v2 API 引用`);
            }
            if (unifiedRoutes.length > 0) {
                this.findings.apiVersions.push(`✅ 发现 ${unifiedRoutes.length} 个统一 API 路由`);
            }
            
        } catch (error) {
            this.findings.apiVersions.push(`❌ 检查失败: ${error.message}`);
        }
    }

    /**
     * 检查重复文件
     */
    async checkDuplicateFiles() {
        console.log('📁 检查重复文件...');
        
        const suspiciousPatterns = [
            /-old\./,
            /-new\./,
            /-backup\./,
            /-refactored\./,
            /-v[0-9]\./,
            /-duplicate\./
        ];
        
        this.scanDirectory('.', suspiciousPatterns);
    }

    /**
     * 扫描目录查找可疑文件
     */
    scanDirectory(dir, patterns) {
        try {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                if (item.startsWith('.') || item === 'node_modules') continue;
                
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    this.scanDirectory(fullPath, patterns);
                } else {
                    // 检查文件名模式
                    for (const pattern of patterns) {
                        if (pattern.test(item)) {
                            this.findings.duplicateFiles.push(fullPath);
                            break;
                        }
                    }
                }
            }
        } catch (error) {
            // 忽略权限错误
        }
    }

    /**
     * 检查备份文件
     */
    async checkBackupFiles() {
        console.log('💾 检查备份文件...');
        
        const backupPatterns = [
            /backup/i,
            /\.bak$/,
            /\.old$/,
            /~$/
        ];
        
        this.scanDirectoryForBackups('.', backupPatterns);
    }

    /**
     * 扫描备份文件
     */
    scanDirectoryForBackups(dir, patterns) {
        try {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                if (item.startsWith('.') || item === 'node_modules') continue;
                
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    this.scanDirectoryForBackups(fullPath, patterns);
                } else {
                    for (const pattern of patterns) {
                        if (pattern.test(item)) {
                            this.findings.backupFiles.push(fullPath);
                            break;
                        }
                    }
                }
            }
        } catch (error) {
            // 忽略权限错误
        }
    }

    /**
     * 检查版本冲突
     */
    async checkVersionConflicts() {
        console.log('⚡ 检查版本冲突...');
        
        // 检查package.json中的版本
        try {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            this.findings.versionConflicts.push(`项目版本: ${packageJson.version}`);
        } catch (error) {
            this.findings.versionConflicts.push(`❌ 无法读取 package.json`);
        }
        
        // 检查是否还有多个类似功能的文件
        const similarFiles = this.findSimilarFiles();
        this.findings.versionConflicts.push(...similarFiles);
    }

    /**
     * 查找相似功能的文件
     */
    findSimilarFiles() {
        const fileGroups = new Map();
        const similar = [];
        
        try {
            this.groupSimilarFiles('src', fileGroups);
            
            for (const [baseName, files] of fileGroups) {
                if (files.length > 1) {
                    similar.push(`可能重复: ${baseName} -> ${files.join(', ')}`);
                }
            }
        } catch (error) {
            similar.push(`❌ 相似文件检查失败: ${error.message}`);
        }
        
        return similar;
    }

    /**
     * 分组相似文件
     */
    groupSimilarFiles(dir, groups) {
        try {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                if (item.startsWith('.')) continue;
                
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    this.groupSimilarFiles(fullPath, groups);
                } else if (item.endsWith('.js')) {
                    // 提取基础名称（去除版本后缀）
                    const baseName = item
                        .replace(/-v[0-9]+/, '')
                        .replace(/-old/, '')
                        .replace(/-new/, '')
                        .replace(/-backup/, '')
                        .replace(/-refactored/, '');
                    
                    if (!groups.has(baseName)) {
                        groups.set(baseName, []);
                    }
                    groups.get(baseName).push(fullPath);
                }
            }
        } catch (error) {
            // 忽略权限错误
        }
    }

    /**
     * 生成验证报告
     */
    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📋 单一版本系统验证报告');
        console.log('='.repeat(60));
        
        console.log('\n🔍 API 版本检查:');
        if (this.findings.apiVersions.length === 0) {
            console.log('  ✅ 未发现版本问题');
        } else {
            this.findings.apiVersions.forEach(item => console.log(`  ${item}`));
        }
        
        console.log('\n📁 重复文件检查:');
        if (this.findings.duplicateFiles.length === 0) {
            console.log('  ✅ 未发现重复文件');
        } else {
            this.findings.duplicateFiles.forEach(item => console.log(`  ❌ ${item}`));
        }
        
        console.log('\n💾 备份文件检查:');
        if (this.findings.backupFiles.length === 0) {
            console.log('  ✅ 未发现备份文件');
        } else {
            this.findings.backupFiles.forEach(item => console.log(`  📦 ${item}`));
        }
        
        console.log('\n⚡ 版本冲突检查:');
        if (this.findings.versionConflicts.length === 0) {
            console.log('  ✅ 未发现版本冲突');
        } else {
            this.findings.versionConflicts.forEach(item => console.log(`  ${item}`));
        }
        
        // 总结
        console.log('\n' + '='.repeat(60));
        const totalIssues = this.findings.duplicateFiles.length + 
                           this.findings.backupFiles.length +
                           this.findings.versionConflicts.filter(v => v.includes('可能重复')).length;
        
        if (totalIssues === 0) {
            console.log('🎉 系统验证通过！已成功统一为单一版本系统');
        } else {
            console.log(`⚠️  发现 ${totalIssues} 个需要关注的项目`);
        }
        
        console.log('\n📊 统计信息:');
        console.log(`  - API版本问题: ${this.findings.apiVersions.filter(v => v.includes('❌')).length}`);
        console.log(`  - 重复文件: ${this.findings.duplicateFiles.length}`);
        console.log(`  - 备份文件: ${this.findings.backupFiles.length}`);
        console.log(`  - 版本冲突: ${this.findings.versionConflicts.filter(v => v.includes('可能重复')).length}`);
        
        console.log('='.repeat(60));
    }
}

// 运行验证
if (require.main === module) {
    const validator = new SingleVersionValidator();
    validator.validate().catch(console.error);
}

module.exports = SingleVersionValidator;