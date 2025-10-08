const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 8080;
const JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';

// 中间件
app.use(cors());
app.use(express.json());

// 数据库连接
const dbPath = path.join(__dirname, 'backend', 'customer_service.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
    } else {
        console.log('已连接到SQLite数据库');
    }
});

// JWT验证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// 基础路由
app.get('/', (req, res) => {
    res.json({ message: 'Customer Service System API - Node.js临时服务器' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 认证路由
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, email, phone } = req.body;
        
        console.log('注册请求:', { username, email, phone });
        
        if (!username || !password) {
            console.log('缺少用户名或密码');
            return res.status(400).json({ error: '用户名和密码是必需的' });
        }

        console.log('开始加密密码...');
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('密码加密完成');
        
        const sql = `INSERT INTO users (username, password_hash, email, phone) VALUES (?, ?, ?, ?)`;
        console.log('执行SQL:', sql);
        console.log('参数:', [username, '***', email, phone]);
        
        db.run(sql, [username, hashedPassword, email, phone], function(err) {
            if (err) {
                console.error('数据库错误:', err);
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: '用户名已存在' });
                }
                return res.status(500).json({ error: '注册失败: ' + err.message });
            }
            
            console.log('用户创建成功, ID:', this.lastID);
            
            const user = {
                id: this.lastID,
                username,
                email,
                phone
            };
            
            // 注册成功后自动生成token
            const token = jwt.sign(
                { id: this.lastID, username },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            console.log('注册成功，返回token');
            res.status(201).json({ 
                message: '注册成功',
                token,
                user 
            });
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ error: '服务器错误: ' + error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码是必需的' });
        }

        const sql = `SELECT * FROM users WHERE username = ?`;
        
        db.get(sql, [username], async (err, user) => {
            if (err) {
                return res.status(500).json({ error: '登录失败' });
            }
            
            if (!user) {
                return res.status(401).json({ error: '用户名或密码错误' });
            }
            
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            
            if (!isValidPassword) {
                return res.status(401).json({ error: '用户名或密码错误' });
            }
            
            const token = jwt.sign(
                { id: user.id, username: user.username },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            res.json({
                message: '登录成功',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    phone: user.phone
                }
            });
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 店铺路由
app.get('/api/shops', (req, res) => {
    console.log('收到店铺请求');
    const sql = `SELECT * FROM shops ORDER BY created_at DESC`;
    
    db.all(sql, [], (err, shops) => {
        if (err) {
            console.error('获取店铺失败:', err);
            return res.status(500).json({ error: '获取店铺失败' });
        }
        
        // 为每个店铺计算未读消息数量
        const shopPromises = shops.map(shop => {
            return new Promise((resolve) => {
                const unreadSql = `SELECT SUM(unread_count) as total_unread FROM unread_counts WHERE shop_id = ?`;
                db.get(unreadSql, [shop.id], (err, result) => {
                    if (err) {
                        console.error('获取未读消息数失败:', err);
                        resolve({
                            ...shop,
                            unread_count: 0
                        });
                    } else {
                        resolve({
                            ...shop,
                            unread_count: result?.total_unread || 0
                        });
                    }
                });
            });
        });
        
        Promise.all(shopPromises).then(shopsWithUnread => {
            console.log('返回店铺数据:', shopsWithUnread.length, '个店铺，包含未读消息统计');
            res.json(shopsWithUnread);
        });
    });
});

app.post('/api/shops', authenticateToken, (req, res) => {
    console.log('收到创建店铺请求:', req.body);
    const { shop_name, shop_url } = req.body;
    const owner_id = req.user.id;
    
    // 验证店铺名称
    if (!shop_name || typeof shop_name !== 'string') {
        return res.status(400).json({ error: '店铺名称是必需的' });
    }
    
    const trimmedShopName = shop_name.trim();
    if (trimmedShopName.length < 2) {
        return res.status(400).json({ error: '店铺名称至少需要2个字符' });
    }
    
    if (trimmedShopName.length > 50) {
        return res.status(400).json({ error: '店铺名称不能超过50个字符' });
    }
    
    // 验证URL（如果提供）
    if (shop_url && typeof shop_url === 'string' && shop_url.trim()) {
        const trimmedUrl = shop_url.trim();
        let isValidUrl = false;
        
        // 基本格式检查：至少包含一个点，且不能只是单个词
        if (!trimmedUrl.includes('.') || trimmedUrl.split('.').length < 2) {
            return res.status(400).json({ error: '请提供有效的网址格式（如：example.com 或 https://example.com）' });
        }
        
        // 尝试各种URL格式
        const urlsToTry = [
            trimmedUrl, // 原始输入
            `https://${trimmedUrl}`, // 添加https://
            `http://${trimmedUrl}`, // 添加http://
        ];
        
        // 如果输入已经包含协议，只验证原始URL
        if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
            try {
                const parsed = new URL(trimmedUrl);
                isValidUrl = !!(parsed.hostname && parsed.hostname.includes('.'));
            } catch (error) {
                isValidUrl = false;
            }
        } else {
            // 对于没有协议的URL，尝试添加协议后验证
            for (const testUrl of urlsToTry) {
                try {
                    const parsed = new URL(testUrl);
                    // 确保域名部分看起来合理：包含点且至少有两个部分
                    if (parsed.hostname && parsed.hostname.includes('.')) {
                        const parts = parsed.hostname.split('.');
                        if (parts.length >= 2 && parts.every(part => part.length > 0)) {
                            isValidUrl = true;
                            break;
                        }
                    }
                } catch (error) {
                    continue;
                }
            }
        }
        
        if (!isValidUrl) {
            return res.status(400).json({ error: '请提供有效的网址格式（如：example.com 或 https://example.com）' });
        }
    }
    
    // 检查店铺名称是否已存在（相同用户下）
    const checkSql = `SELECT COUNT(*) as count FROM shops WHERE owner_id = ? AND shop_name = ?`;
    db.get(checkSql, [owner_id, trimmedShopName], (err, row) => {
        if (err) {
            console.error('检查店铺名称失败:', err);
            return res.status(500).json({ error: '服务器错误' });
        }
        
        if (row.count > 0) {
            return res.status(409).json({ error: '您已经有一个同名的店铺' });
        }
        
        // 创建店铺
        const api_key = crypto.randomUUID();
        const finalShopUrl = shop_url && shop_url.trim() ? shop_url.trim() : null;
        const sql = `INSERT INTO shops (owner_id, shop_name, shop_url, api_key) VALUES (?, ?, ?, ?)`;
        
        db.run(sql, [owner_id, trimmedShopName, finalShopUrl, api_key], function(err) {
            if (err) {
                console.error('创建店铺失败:', err);
                if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    return res.status(409).json({ error: '店铺名称已存在' });
                }
                return res.status(500).json({ error: '创建店铺失败' });
            }
            
            const newShop = {
                id: this.lastID,
                owner_id,
                shop_name: trimmedShopName,
                shop_url: finalShopUrl,
                api_key,
                status: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            console.log('店铺创建成功:', newShop);
            res.status(201).json(newShop);
        });
    });
});

// 客户路由
app.get('/api/shops/:shopId/customers', (req, res) => {
    const { shopId } = req.params;
    console.log('获取店铺客户:', shopId);
    const sql = `SELECT * FROM customers WHERE shop_id = ? ORDER BY last_active_at DESC`;
    
    db.all(sql, [shopId], (err, customers) => {
        if (err) {
            console.error('获取客户失败:', err);
            return res.status(500).json({ error: '获取客户失败' });
        }
        
        // 为每个客户添加模拟的未读消息数
        const customersWithStats = customers.map(customer => ({
            ...customer,
            unread_count: Math.floor(Math.random() * 5)
        }));
        
        console.log('返回客户数据:', customersWithStats.length, '个客户');
        res.json(customersWithStats);
    });
});

// 统计路由
app.get('/api/stats', (req, res) => {
    console.log('收到统计请求');
    // 获取基础统计数据
    const statsQueries = [
        'SELECT COUNT(*) as total_shops FROM shops',
        'SELECT COUNT(*) as total_customers FROM customers',
        'SELECT COUNT(*) as total_messages FROM messages',
        'SELECT COUNT(*) as active_sessions FROM sessions WHERE session_status = "active"'
    ];
    
    let stats = {};
    let completed = 0;
    
    statsQueries.forEach((query, index) => {
        db.get(query, [], (err, result) => {
            if (!err) {
                const key = Object.keys(result)[0];
                stats[key] = result[key];
            }
            
            completed++;
            if (completed === statsQueries.length) {
                const response = {
                    total_shops: stats.total_shops || 0,
                    total_customers: stats.total_customers || 0,
                    total_messages: stats.total_messages || 0,
                    active_sessions: stats.active_sessions || 0,
                    response_time: '< 1分钟',
                    satisfaction_rate: '98%'
                };
                console.log('返回统计数据:', response);
                res.json(response);
            }
        });
    });
});

// 会话和消息路由
app.get('/api/sessions/:sessionId/messages', (req, res) => {
    const { sessionId } = req.params;
    const sql = `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC`;
    
    db.all(sql, [sessionId], (err, messages) => {
        if (err) {
            console.error('获取消息失败:', err);
            return res.status(500).json({ error: '获取消息失败' });
        }
        res.json(messages);
    });
});

app.post('/api/sessions/:sessionId/messages', authenticateToken, (req, res) => {
    const { sessionId } = req.params;
    const { content, message_type = 'text' } = req.body;
    const sender_id = req.user.id;
    
    if (!content) {
        return res.status(400).json({ error: '消息内容是必需的' });
    }
    
    const sql = `INSERT INTO messages (session_id, sender_type, sender_id, content, message_type) VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sql, [sessionId, 'staff', sender_id, content, message_type], function(err) {
        if (err) {
            console.error('发送消息失败:', err);
            return res.status(500).json({ error: '发送消息失败' });
        }
        
        res.status(201).json({
            id: this.lastID,
            session_id: sessionId,
            sender_type: 'staff',
            sender_id,
            content,
            message_type,
            created_at: new Date().toISOString()
        });
    });
});

// 错误处理
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ error: '内部服务器错误' });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 临时Node.js服务器正在运行在 http://localhost:${PORT}`);
    console.log(`📊 API文档: http://localhost:${PORT}/health`);
    console.log('💡 这是一个临时解决方案，建议稍后修复Rust后端编译问题');
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    db.close((err) => {
        if (err) {
            console.error('关闭数据库连接时出错:', err.message);
        } else {
            console.log('数据库连接已关闭');
        }
        process.exit(0);
    });
});