const Database = require('./database-sqlite');

async function checkCurrentData() {
    try {
        const db = new Database();
        
        // 等待数据库初始化完成
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 检查用户数据
        const users = await new Promise((resolve, reject) => {
            db.db.all('SELECT username, email, role, created_at FROM users', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log('当前用户数据:');
        console.table(users);
        
        // 检查店铺数据
        const shops = await new Promise((resolve, reject) => {
            db.db.all('SELECT name, domain, status, approval_status, created_at FROM shops', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log('\n当前店铺数据:');
        console.table(shops);
        
        process.exit(0);
    } catch (error) {
        console.error('检查数据失败:', error);
        process.exit(1);
    }
}

checkCurrentData();
