// 测试代码生成功能
const IntegrationCodeGenerator = require('./integration-code-generator');

// 模拟数据库
const mockDatabase = {
    async getAllShops() {
        return [
            {
                id: 'shop_123',
                name: '测试商店',
                domain: 'bbs16.929991.xyz',
                api_key: 'sk_test123456789abcdef',
                createdAt: new Date().toISOString()
            }
        ];
    },
    
    async updateShopApiKey(shopId, apiKey) {
        console.log(`更新店铺 ${shopId} 的API密钥: ${apiKey}`);
        return true;
    }
};

// 模拟HTTP请求对象
const mockRequest = {
    secure: false,
    headers: {
        host: 'localhost:3030',
        'x-forwarded-proto': null,
        'x-forwarded-host': null
    }
};

async function testCodeGeneration() {
    console.log('🧪 测试代码生成功能...\n');
    
    const generator = new IntegrationCodeGenerator(mockDatabase);
    
    // 模拟服务器地址检测逻辑
    const protocol = mockRequest.secure || mockRequest.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const host = mockRequest.headers['x-forwarded-host'] || mockRequest.headers.host || 'localhost:3030';
    const serverUrl = `${protocol}://${host}`;
    
    console.log(`🌐 检测到的服务器地址: ${serverUrl}`);
    
    // 生成代码
    const options = {
        serverUrl: serverUrl,
        position: 'bottom-right',
        theme: 'default',
        title: '在线客服',
        welcomeMessage: '您好！有什么可以帮您的吗？',
        placeholder: '请输入您的消息...',
        sendButton: '发送'
    };
    
    try {
        const result = await generator.generateIntegrationCode('shop_123', options);
        
        if (result.success) {
            console.log('✅ 代码生成成功！');
            console.log(`📋 店铺: ${result.shop.name}`);
            console.log(`🌐 域名: ${result.shop.domain}`);
            console.log(`🔑 API密钥: ${result.shop.apiKey.substring(0, 12)}****`);
            console.log(`📍 服务器地址: ${result.config.serverUrl}`);
            console.log('\n📄 生成的代码:\n');
            console.log('='.repeat(80));
            console.log(result.code);
            console.log('='.repeat(80));
            
            // 检查代码中是否包含正确的服务器地址
            if (result.code.includes(serverUrl)) {
                console.log('\n✅ 代码中包含正确的服务器地址！');
            } else {
                console.log('\n❌ 代码中未包含正确的服务器地址');
            }
            
        } else {
            console.log('❌ 代码生成失败');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

// 测试不同环境的服务器地址检测
async function testDifferentEnvironments() {
    console.log('\n🌍 测试不同环境的服务器地址检测...\n');
    
    const environments = [
        // 本地开发环境
        {
            name: '本地开发环境',
            headers: { host: 'localhost:3030' },
            secure: false,
            expected: 'http://localhost:3030'
        },
        // ngrok隧道
        {
            name: 'ngrok隧道',
            headers: { 
                host: 'localhost:3030',
                'x-forwarded-host': 'abc123.ngrok.io',
                'x-forwarded-proto': 'https'
            },
            secure: false,
            expected: 'https://abc123.ngrok.io'
        },
        // 生产环境
        {
            name: '生产环境',
            headers: { host: 'api.example.com' },
            secure: true,
            expected: 'https://api.example.com'
        }
    ];
    
    environments.forEach(env => {
        const protocol = env.secure || env.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const host = env.headers['x-forwarded-host'] || env.headers.host || 'localhost:3030';
        const serverUrl = `${protocol}://${host}`;
        
        console.log(`📍 ${env.name}:`);
        console.log(`   检测结果: ${serverUrl}`);
        console.log(`   期望结果: ${env.expected}`);
        console.log(`   是否正确: ${serverUrl === env.expected ? '✅' : '❌'}`);
        console.log('');
    });
}

// 运行测试
async function runTests() {
    await testCodeGeneration();
    await testDifferentEnvironments();
}

runTests().catch(console.error);
