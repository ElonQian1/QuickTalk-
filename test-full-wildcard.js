// 完整的通配符功能测试
const DomainValidator = require('./domain-validator');

// 创建一个模拟的数据库对象，包含通配符店铺
const mockDatabase = {
    getAllShops: async () => [
        {
            id: 1,
            name: '测试店铺-通配符',
            domain: '*.929991.xyz',
            status: 'approved'
        },
        {
            id: 2,
            name: '测试店铺-精确',
            domain: 'bbs10.929991.xyz',
            status: 'approved'
        }
    ],
    insertAccessLog: async () => {}
};

const validator = new DomainValidator(mockDatabase);

async function testFullValidation() {
    console.log('🧪 完整的域名验证测试\n');

    // 模拟不同的客户端请求
    const testCases = [
        {
            name: '访问 bbs10.929991.xyz (应该匹配通配符店铺)',
            referer: 'https://bbs10.929991.xyz/forum/',
            origin: 'https://bbs10.929991.xyz',
            ip: '203.208.60.1'
        },
        {
            name: '访问 bbs11.929991.xyz (应该匹配通配符店铺)',
            referer: 'https://bbs11.929991.xyz/',
            origin: 'https://bbs11.929991.xyz',
            ip: '203.208.60.2'
        },
        {
            name: '访问 shop.929991.xyz (应该匹配通配符店铺)',
            referer: 'https://shop.929991.xyz/products/',
            origin: 'https://shop.929991.xyz',
            ip: '203.208.60.3'
        },
        {
            name: '访问 evil.com (不应该匹配)',
            referer: 'https://evil.com/',
            origin: 'https://evil.com',
            ip: '203.208.60.4'
        }
    ];

    for (const testCase of testCases) {
        console.log(`📋 测试: ${testCase.name}`);
        
        // 提取客户端信息
        const clientInfo = validator.extractClientInfo({
            ip: testCase.ip,
            get: (header) => {
                if (header === 'Referer') return testCase.referer;
                if (header === 'Origin') return testCase.origin;
                if (header === 'User-Agent') return 'Test User Agent';
                if (header === 'Host') return 'localhost:3030';
                return null;
            }
        });

        console.log(`   📍 提取的域名: ${clientInfo.refererDomain || clientInfo.originDomain}`);

        // 验证域名
        const validationResult = await validator.validateDomain(clientInfo);
        
        console.log(`   📊 验证结果: ${validationResult.isValid ? '✅ 通过' : '❌ 拒绝'}`);
        console.log(`   📝 匹配原因: ${validationResult.reason}`);
        if (validationResult.shopInfo) {
            console.log(`   🏪 匹配店铺: ${validationResult.shopInfo.name} (${validationResult.shopInfo.domain})`);
        }
        console.log('');
    }
}

// 运行测试
testFullValidation().catch(console.error);
