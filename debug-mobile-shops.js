// 测试移动端店铺加载问题
const http = require('http');
const querystring = require('querystring');

function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

async function testShopAPI() {
    console.log('🧪 测试用户jkl的店铺数据');
    
    try {
        // 1. 登录获取session
        console.log('\n1️⃣ 登录用户jkl...');
        const loginData = querystring.stringify({
            username: 'jkl',
            password: '123'
        });
        
        const loginOptions = {
            hostname: 'localhost',
            port: 3030,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(loginData)
            }
        };
        
        const loginResult = await makeRequest(loginOptions, loginData);
        console.log('登录结果:', loginResult);
        
        if (loginResult.status !== 200) {
            throw new Error('登录失败');
        }
        
        const sessionId = loginResult.data.sessionId;
        console.log('✅ 登录成功，SessionId:', sessionId);
        
        // 2. 测试 /api/auth/me
        console.log('\n2️⃣ 测试 /api/auth/me...');
        const meOptions = {
            hostname: 'localhost',
            port: 3030,
            path: '/api/auth/me',
            method: 'GET',
            headers: {
                'X-Session-Id': sessionId
            }
        };
        
        const meResult = await makeRequest(meOptions);
        console.log('/api/auth/me 结果:');
        console.log('状态:', meResult.status);
        console.log('数据:', JSON.stringify(meResult.data, null, 2));
        
        // 3. 测试 /api/shops
        console.log('\n3️⃣ 测试 /api/shops...');
        const shopsOptions = {
            hostname: 'localhost',
            port: 3030,
            path: '/api/shops',
            method: 'GET',
            headers: {
                'X-Session-Id': sessionId
            }
        };
        
        const shopsResult = await makeRequest(shopsOptions);
        console.log('/api/shops 结果:');
        console.log('状态:', shopsResult.status);
        console.log('数据:', JSON.stringify(shopsResult.data, null, 2));
        
        // 4. 分析结果
        console.log('\n4️⃣ 分析结果:');
        if (shopsResult.status === 200 && shopsResult.data.shops) {
            const shops = shopsResult.data.shops;
            console.log(`发现 ${shops.length} 个店铺:`);
            shops.forEach((shop, index) => {
                console.log(`${index + 1}. ${shop.name} (${shop.id})`);
                console.log(`   审核状态: ${shop.approvalStatus}`);
                console.log(`   用户角色: ${shop.userRole}`);
                console.log(`   权限: ${JSON.stringify(shop.permissions)}`);
            });
        } else {
            console.log('❌ 没有获取到店铺数据');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

testShopAPI();
