// 通配符域名匹配测试
const DomainValidator = require('./domain-validator');

// 创建一个模拟的数据库对象
const mockDatabase = {
    getAllShops: async () => [],
    insertAccessLog: async () => {}
};

const validator = new DomainValidator(mockDatabase);

// 测试函数
function testDomainMatch(clientDomain, allowedDomain) {
    const result = validator.isDomainMatch(clientDomain, allowedDomain);
    console.log(`客户端域名: ${clientDomain}`);
    console.log(`允许的域名: ${allowedDomain}`);
    console.log(`匹配结果: ${result ? '✅ 通过' : '❌ 失败'}`);
    console.log('---');
}

console.log('🔍 域名通配符匹配测试\n');

// 测试通配符匹配
console.log('📝 通配符测试 (*.929991.xyz):');
testDomainMatch('bbs10.929991.xyz', '*.929991.xyz');
testDomainMatch('bbs11.929991.xyz', '*.929991.xyz');
testDomainMatch('shop.929991.xyz', '*.929991.xyz');
testDomainMatch('929991.xyz', '*.929991.xyz'); // 主域名也应该匹配

console.log('📝 非匹配测试:');
testDomainMatch('evil.com', '*.929991.xyz');
testDomainMatch('929991.xyz.evil.com', '*.929991.xyz');

console.log('📝 精确匹配测试:');
testDomainMatch('bbs10.929991.xyz', 'bbs10.929991.xyz');
testDomainMatch('bbs11.929991.xyz', 'bbs10.929991.xyz');

console.log('📝 协议和路径处理测试:');
testDomainMatch('https://bbs10.929991.xyz/', 'bbs10.929991.xyz');
testDomainMatch('http://bbs10.929991.xyz/forum/', 'bbs10.929991.xyz');

console.log('📝 标准化函数测试:');
console.log('输入: https://bbs10.929991.xyz/forum/');
console.log('输出:', validator.normalizeDomain('https://bbs10.929991.xyz/forum/'));
console.log('输入: *.929991.xyz');
console.log('输出:', validator.normalizeDomain('*.929991.xyz'));
