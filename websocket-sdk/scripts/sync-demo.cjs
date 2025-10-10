const fs = require('fs');
const path = require('path');

// 简化版本的同步脚本，仅用于开发环境
console.log('WebSocket SDK: 开发模式构建完成');

// 检查并创建目标目录
const targetDir = path.join(__dirname, '../../backend/static/sdk');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 同步构建文件到backend静态目录
const srcDir = path.join(__dirname, '../dist');
if (fs.existsSync(srcDir)) {
  console.log('正在同步SDK文件到后端静态目录...');
  
  // 复制主要文件
  const files = ['index.js', 'index.d.ts'];
  files.forEach(file => {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(targetDir, file);
    
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
      console.log(`已同步: ${file}`);
    }
  });
  
  console.log('SDK同步完成!');
} else {
  console.log('SDK构建目录不存在，跳过同步');
}