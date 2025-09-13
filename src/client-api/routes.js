// 客户端API路由集成模块
function integrateClientApiRoutes(app, modularApp) {
    console.log('🔌 集成模块化客户端API...');
    
    const clientApi = modularApp.getClientApiHandler();
    
    // 安全连接API
    app.post('/api/secure-connect', async (req, res) => {
        await clientApi.handleSecureConnect(req, res);
    });

    // 基础连接API
    app.post('/api/connect', async (req, res) => {
        await clientApi.handleBasicConnect(req, res);
    });

    // 发送消息API
    app.post('/api/send', async (req, res) => {
        await clientApi.handleSendMessage(req, res);
    });

    // 获取消息API
    app.get('/api/client/messages', async (req, res) => {
        await clientApi.handleGetMessages(req, res);
    });

    // 健康检查API
    app.get('/api/health', async (req, res) => {
        await clientApi.handleHealthCheck(req, res);
    });

    // 连接统计API
    app.get('/api/stats/connections', async (req, res) => {
        await clientApi.handleConnectionStats(req, res);
    });

    console.log('✅ 客户端API集成完成');
    console.log('📡 可用的客户端API:');
    console.log('   POST /api/secure-connect - 安全连接建立');
    console.log('   POST /api/connect - 基础连接建立');
    console.log('   POST /api/send - 发送消息');
    console.log('   GET  /api/client/messages - 获取新消息');
    console.log('   GET  /api/health - 健康检查');
    console.log('   GET  /api/stats/connections - 连接统计');
}

module.exports = { integrateClientApiRoutes };
