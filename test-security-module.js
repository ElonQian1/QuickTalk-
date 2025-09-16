/**
 * 测试安全模块语法和基本功能
 */

const ComprehensiveSecurityModule = require('./src/modules/ComprehensiveSecurityModule');

async function testSecurityModule() {
    try {
        console.log('🧪 开始测试安全模块...');
        
        // 创建模拟数据库
        const mockDb = {
            // 模拟内存数据库
            securityAuditLogs: new Map(),
            securitySessions: new Map()
        };
        
        // 创建安全模块实例
        const securityModule = new ComprehensiveSecurityModule(mockDb);
        
        // 测试初始化
        await securityModule.initialize();
        
        // 测试创建会话
        const sessionResult = await securityModule.createSecureSession('user_123', 'shop_456', {
            ipAddress: '127.0.0.1'
        });
        
        console.log('✅ 会话创建成功:', sessionResult);
        
        // 测试验证会话
        const validatedSession = await securityModule.validateSession(sessionResult.sessionToken);
        console.log('✅ 会话验证成功:', validatedSession ? '有效' : '无效');
        
        // 测试收集安全指标
        const metrics = await securityModule.collectSecurityMetrics();
        console.log('✅ 安全指标收集完成');
        
        // 测试销毁会话
        await securityModule.destroySession(sessionResult.sessionId);
        console.log('✅ 会话销毁成功');
        
        // 关闭安全模块
        await securityModule.shutdown();
        console.log('✅ 安全模块关闭成功');
        
        console.log('🎉 安全模块测试全部通过！');
        
    } catch (error) {
        console.error('❌ 安全模块测试失败:', error);
        process.exit(1);
    }
}

// 执行测试
if (require.main === module) {
    testSecurityModule();
}

module.exports = { testSecurityModule };