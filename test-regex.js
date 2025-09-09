// 测试域名验证正则表达式
function testDomainRegex() {
    const domainRegex = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
    
    const testCases = [
        'bbs10.929991.xyz',
        '*.929991.xyz',
        'example.com',
        'sub.example.com',
        'test123.456789.org',
        'a.b.c.d.com',
        '123.456.com',
        'www.google.com',
        'api-v1.test.net',
        'invalid..com',
        '.invalid.com',
        'invalid.',
        ''
    ];
    
    console.log('🧪 域名正则表达式测试:\n');
    
    testCases.forEach(domain => {
        const isValid = domainRegex.test(domain);
        console.log(`${isValid ? '✅' : '❌'} ${domain || '(空字符串)'}`);
    });
}

testDomainRegex();
