const http = require('http');
const url = require('url');

const PORT = 8080;

// 简单的内存数据存储
const data = {
  users: [
    { id: 'user1', username: 'admin', email: 'admin@example.com' }
  ],
  shops: [
    { id: 'shop1', name: '测试店铺', owner_id: 'user1', api_key: 'test-api-key' }
  ],
  customers: [
    { id: 'customer1', shop_id: 'shop1', customer_name: '测试客户', customer_email: 'customer@example.com' }
  ],
  messages: [
    {
      id: 'msg1',
      shop_id: 'shop1',
      customer_id: 'customer1',
      content: '你好，我需要帮助',
      is_from_customer: true,
      timestamp: new Date().toISOString()
    },
    {
      id: 'msg2',
      shop_id: 'shop1',
      customer_id: 'customer1',
      content: '您好，我们很乐意为您提供帮助！',
      is_from_customer: false,
      timestamp: new Date().toISOString()
    }
  ]
};

// CORS头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function createResponse(res, statusCode, data, contentType = 'application/json') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    ...corsHeaders
  });
  
  if (contentType === 'application/json') {
    res.end(JSON.stringify(data));
  } else {
    res.end(data);
  }
}

function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const method = req.method;
  const pathname = parsedUrl.pathname;

  console.log(`${method} ${pathname}`);

  // 处理OPTIONS请求（CORS预检）
  if (method === 'OPTIONS') {
    createResponse(res, 200, '', 'text/plain');
    return;
  }

  // 健康检查
  if (pathname === '/' && method === 'GET') {
    createResponse(res, 200, { message: 'Customer Service Backend is running!' });
    return;
  }

  // 登录
  if (pathname === '/api/auth/login' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        if (username === 'admin' && password === 'password') {
          createResponse(res, 200, {
            token: 'fake-jwt-token',
            user: data.users[0]
          });
        } else {
          createResponse(res, 401, { error: 'Invalid credentials' });
        }
      } catch (e) {
        createResponse(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  // 注册
  if (pathname === '/api/auth/register' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { username, password, email } = JSON.parse(body);
        const newUser = {
          id: `user${Date.now()}`,
          username,
          email
        };
        data.users.push(newUser);
        createResponse(res, 200, {
          token: 'fake-jwt-token',
          user: newUser
        });
      } catch (e) {
        createResponse(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  // 获取店铺列表
  if (pathname === '/api/shops' && method === 'GET') {
    createResponse(res, 200, data.shops);
    return;
  }

  // 创建店铺
  if (pathname === '/api/shops' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { name } = JSON.parse(body);
        const newShop = {
          id: `shop${Date.now()}`,
          name,
          owner_id: 'user1',
          api_key: `api-${Date.now()}`
        };
        data.shops.push(newShop);
        createResponse(res, 200, newShop);
      } catch (e) {
        createResponse(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  // 获取客户列表
  if (pathname.match(/^\/api\/shops\/[^\/]+\/customers$/) && method === 'GET') {
    createResponse(res, 200, data.customers);
    return;
  }

  // 获取消息
  if (pathname.match(/^\/api\/shops\/[^\/]+\/customers\/[^\/]+\/messages$/) && method === 'GET') {
    createResponse(res, 200, data.messages);
    return;
  }

  // 发送消息
  if (pathname.match(/^\/api\/shops\/[^\/]+\/customers\/[^\/]+\/messages$/) && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { content, is_from_customer } = JSON.parse(body);
        const newMessage = {
          id: `msg${Date.now()}`,
          shop_id: 'shop1',
          customer_id: 'customer1',
          content,
          is_from_customer: is_from_customer || false,
          timestamp: new Date().toISOString()
        };
        data.messages.push(newMessage);
        createResponse(res, 200, newMessage);
      } catch (e) {
        createResponse(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  // 404
  createResponse(res, 404, { error: 'Not Found' });
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`🚀 Node.js Backend Server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  / - Health check');
  console.log('  POST /api/auth/login - Login');
  console.log('  POST /api/auth/register - Register');
  console.log('  GET  /api/shops - Get shops');
  console.log('  POST /api/shops - Create shop');
  console.log('  GET  /api/shops/:id/customers - Get customers');
  console.log('  GET  /api/shops/:id/customers/:id/messages - Get messages');
  console.log('  POST /api/shops/:id/customers/:id/messages - Send message');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\\nShutting down server...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});