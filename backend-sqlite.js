const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const sqlite3 = require('sqlite3').verbose();

const PORT = 8080;
const DB_PATH = path.join(__dirname, 'backend', 'customer_service.db');

// 初始化数据库连接
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
    process.exit(1);
  } else {
    console.log('✅ 已连接到SQLite数据库');
  }
});

// CORS和响应头设置
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function createResponse(res, statusCode, data) {
  setCORSHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function hashPassword(password) {
  // 简单的密码哈希（生产环境应使用bcrypt）
  return Buffer.from(password).toString('base64');
}

function verifyPassword(password, hash) {
  return Buffer.from(password).toString('base64') === hash;
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  console.log(`${method} ${pathname}`);

  // 处理CORS预检请求
  if (method === 'OPTIONS') {
    setCORSHeaders(res);
    res.writeHead(200);
    res.end();
    return;
  }

  // 根路由
  if (pathname === '/' && method === 'GET') {
    createResponse(res, 200, { message: 'Customer Service System API with SQLite' });
    return;
  }

  // 用户注册
  if (pathname === '/api/auth/register' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { username, password, email, phone } = JSON.parse(body);
        
        if (!username || !password) {
          createResponse(res, 400, { error: '用户名和密码不能为空' });
          return;
        }

        const passwordHash = hashPassword(password);
        const sql = 'INSERT INTO users (username, password_hash, email, phone) VALUES (?, ?, ?, ?)';
        
        db.run(sql, [username, passwordHash, email, phone], function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              createResponse(res, 409, { error: '用户名已存在' });
            } else {
              console.error('注册错误:', err.message);
              createResponse(res, 500, { error: '服务器内部错误' });
            }
          } else {
            const newUser = {
              id: this.lastID,
              username,
              email,
              phone
            };
            createResponse(res, 200, {
              token: `token_${this.lastID}_${Date.now()}`,
              user: newUser
            });
            console.log(`✅ 用户注册成功: ${username} (ID: ${this.lastID})`);
          }
        });
      } catch (e) {
        createResponse(res, 400, { error: '无效的JSON数据' });
      }
    });
    return;
  }

  // 用户登录
  if (pathname === '/api/auth/login' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        
        const sql = 'SELECT * FROM users WHERE username = ?';
        db.get(sql, [username], (err, user) => {
          if (err) {
            createResponse(res, 500, { error: '服务器内部错误' });
          } else if (!user) {
            createResponse(res, 401, { error: '用户名不存在' });
          } else if (!verifyPassword(password, user.password_hash)) {
            createResponse(res, 401, { error: '密码错误' });
          } else {
            const userInfo = {
              id: user.id,
              username: user.username,
              email: user.email,
              phone: user.phone
            };
            createResponse(res, 200, {
              token: `token_${user.id}_${Date.now()}`,
              user: userInfo
            });
            console.log(`✅ 用户登录成功: ${username}`);
          }
        });
      } catch (e) {
        createResponse(res, 400, { error: '无效的JSON数据' });
      }
    });
    return;
  }

  // 获取用户列表（用于调试）
  if (pathname === '/api/users' && method === 'GET') {
    const sql = 'SELECT id, username, email, phone, created_at FROM users';
    db.all(sql, [], (err, users) => {
      if (err) {
        createResponse(res, 500, { error: '获取用户列表失败' });
      } else {
        createResponse(res, 200, { users, count: users.length });
      }
    });
    return;
  }

  // 获取店铺列表
  if (pathname === '/api/shops' && method === 'GET') {
    const sql = 'SELECT * FROM shops ORDER BY created_at DESC';
    db.all(sql, [], (err, shops) => {
      if (err) {
        createResponse(res, 500, { error: '获取店铺列表失败' });
      } else {
        createResponse(res, 200, shops);
      }
    });
    return;
  }

  // 创建店铺
  if (pathname === '/api/shops' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { shop_name, shop_url, owner_id = 1 } = JSON.parse(body);
        const api_key = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const sql = 'INSERT INTO shops (owner_id, shop_name, shop_url, api_key) VALUES (?, ?, ?, ?)';
        db.run(sql, [owner_id, shop_name, shop_url, api_key], function(err) {
          if (err) {
            createResponse(res, 500, { error: '创建店铺失败' });
          } else {
            const newShop = {
              id: this.lastID,
              owner_id,
              shop_name,
              shop_url,
              api_key
            };
            createResponse(res, 200, newShop);
          }
        });
      } catch (e) {
        createResponse(res, 400, { error: '无效的JSON数据' });
      }
    });
    return;
  }

  // 404 处理
  createResponse(res, 404, { error: 'API端点未找到' });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`🚀 带SQLite数据库的客服系统后端已启动`);
  console.log(`   服务地址: http://localhost:${PORT}`);
  console.log(`   数据库路径: ${DB_PATH}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🔄 收到关闭信号，正在关闭服务器...');
  server.close(() => {
    console.log('✅ HTTP服务器已关闭');
    db.close((err) => {
      if (err) {
        console.error('关闭数据库时出错:', err.message);
      } else {
        console.log('✅ 数据库连接已关闭');
      }
      process.exit(0);
    });
  });
});

process.on('SIGTERM', () => {
  console.log('\n🔄 收到终止信号，正在关闭服务器...');
  server.close(() => {
    db.close((err) => {
      if (err) {
        console.error('关闭数据库时出错:', err.message);
      } else {
        console.log('✅ 数据库连接已关闭');
      }
      process.exit(0);
    });
  });
});