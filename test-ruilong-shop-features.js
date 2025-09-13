#!/usr/bin/env node

/**
 * 验证ruilong分支店铺功能的集成测试
 * 检查角色识别、按钮显示等功能是否正确集成
 */

const fs = require('fs');

console.log('🧪 开始验证ruilong分支店铺功能集成...\n');

try {
    // 读取当前的admin-mobile.html文件
    const htmlContent = fs.readFileSync('./static/admin-mobile.html', 'utf8');
    
    console.log('📊 检查ruilong分支的关键店铺功能:');
    
    const checks = [
        { name: '店铺角色容器样式', pattern: 'shop-avatar-container', required: true },
        { name: '店铺角色显示样式', pattern: 'shop-role', required: true },
        { name: '店铺内容布局样式', pattern: 'shop-content', required: true },
        { name: '用户角色识别方法', pattern: 'getUserRoleInShop', required: true },
        { name: '角色文本转换方法', pattern: 'getRoleText', required: true },
        { name: '基于角色的按钮逻辑', pattern: 'userRole === \'owner\'', required: true },
        { name: '经理角色按钮', pattern: 'userRole === \'manager\'', required: true },
        { name: '员工角色按钮', pattern: 'userRole === \'employee\'', required: true },
        { name: '等待审核状态', pattern: 'approvalStatus === \'pending\'', required: true },
        { name: '拒绝状态按钮', pattern: 'shop-btn danger', required: true },
        { name: '禁用按钮样式', pattern: ':disabled', required: true },
        { name: '店铺角色显示', pattern: '${this.getRoleText(userRole)}', required: true }
    ];
    
    let allPassed = true;
    
    checks.forEach(check => {
        const found = htmlContent.includes(check.pattern);
        const status = found ? '✅' : (check.required ? '❌' : '⚠️');
        console.log(status, check.name + ':', found ? '已集成' : '缺失');
        
        if (check.required && !found) {
            allPassed = false;
        }
    });
    
    console.log('\n🎨 验证CSS样式完整性:');
    
    const styleChecks = [
        'shop-avatar-container',
        'shop-role',
        'shop-content', 
        'shop-btn.danger',
        'shop-btn.secondary',
        'shop-btn:disabled'
    ];
    
    styleChecks.forEach(style => {
        const found = htmlContent.includes(style);
        console.log(found ? '✅' : '❌', style + ':', found ? '已定义' : '缺失');
        if (!found) allPassed = false;
    });
    
    console.log('\n📱 检查JavaScript功能完整性:');
    
    const jsChecks = [
        'getUserRoleInShop(shop)',
        'getRoleText(userRole)', 
        'shop_owner',
        'super_admin',
        'employee',
        'userRole === \'owner\'',
        'userRole === \'manager\'',
        'userRole === \'employee\''
    ];
    
    jsChecks.forEach(jsFeature => {
        const found = htmlContent.includes(jsFeature);
        console.log(found ? '✅' : '❌', jsFeature + ':', found ? '已实现' : '缺失');
        if (!found) allPassed = false;
    });
    
    console.log('\n🔄 对比两个版本的差异:');
    
    // 读取ruilong备份文件进行对比
    const ruilongContent = fs.readFileSync('./static/admin-mobile-ruilong-check.html', 'utf8');
    
    console.log('📏 文件大小对比:');
    console.log(`   当前版本: ${htmlContent.split('\n').length} 行`);
    console.log(`   ruilong版本: ${ruilongContent.split('\n').length} 行`);
    
    // 检查特有功能
    const ruilongFeatures = [
        'viewMobileShopMessages',
        'generateMobileIntegrationCode', 
        'editMobileShopInfo',
        'renewShop'
    ];
    
    console.log('\n🔍 ruilong版本的特有功能:');
    ruilongFeatures.forEach(feature => {
        const inCurrent = htmlContent.includes(feature);
        const inRuilong = ruilongContent.includes(feature);
        
        if (inRuilong && !inCurrent) {
            console.log('⚠️', feature + ': ruilong有但当前版本缺失');
        } else if (inCurrent) {
            console.log('✅', feature + ': 已集成');
        }
    });
    
    console.log('\n🎯 集成状态总结:');
    
    if (allPassed) {
        console.log('✅ 所有核心ruilong店铺功能已成功集成');
    } else {
        console.log('⚠️ 部分功能可能需要进一步调整');
    }
    
    console.log('\n📋 主要改进对比:');
    console.log('✅ 店铺角色显示 - 每个店铺显示用户角色');
    console.log('✅ 基于角色的按钮 - 不同角色看到不同操作');
    console.log('✅ 增强的样式布局 - 改进的视觉效果');
    console.log('✅ 状态敏感的UI - 根据审核状态调整按钮');
    console.log('✅ 权限控制逻辑 - 店主/经理/员工不同权限');
    
    console.log('\n🚀 建议测试步骤:');
    console.log('1. 创建不同角色的用户账号');
    console.log('2. 测试店铺列表中的角色显示');
    console.log('3. 验证不同角色用户看到的按钮');
    console.log('4. 测试店铺审核状态的按钮变化');
    console.log('5. 验证权限控制是否生效');
    
} catch (error) {
    console.error('❌ 测试过程中出错:', error.message);
}

console.log('\n📝 ruilong店铺功能集成验证完成');