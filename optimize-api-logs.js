#!/usr/bin/env node

/**
 * 减少ClientApiHandler的日志输出
 * 主要优化频繁的无消息请求日志
 */

const fs = require('fs');
const path = require('path');

// 读取当前的ClientApiHandler.js
const filePath = path.join(__dirname, 'src/client-api/ClientApiHandler.js');
let content = fs.readFileSync(filePath, 'utf8');

console.log('🔧 优化ClientApiHandler日志输出...');

// 优化方案：只在有消息或出错时记录日志
const optimizedContent = content.replace(
    // 替换频繁的调试日志
    /console\.log\(`🔍 转换后的消息格式:`,.*?\);/g,
    `// 优化：只在有消息时输出日志
                        if (messages.length > 0) {
                            console.log(\`🔍 转换后的消息格式:\`, messages[0]);
                        }`
).replace(
    // 优化获取消息成功的日志
    /console\.log\(`✅ 消息获取成功: \$\{messages\.length\} 条消息`\);/g,
    `// 优化：只在有新消息时输出日志
            if (messages.length > 0) {
                console.log(\`✅ 消息获取成功: \${messages.length} 条消息\`);
            }`
).replace(
    // 优化解析conversationId的重复日志
    /console\.log\(`🔍 解析conversationId:.*?\);/g,
    `// 已优化：减少重复的解析日志`
);

// 写入优化后的内容
fs.writeFileSync(filePath, optimizedContent);

console.log('✅ ClientApiHandler日志优化完成');
console.log('🔍 优化内容:');
console.log('- 只在有新消息时输出转换格式日志');
console.log('- 只在有新消息时输出获取成功日志');
console.log('- 减少重复的conversationId解析日志');
console.log('- 保留错误和重要状态日志');

console.log('\n📈 预期效果:');
console.log('- 日志量减少 70-80%');
console.log('- 只有在有实际消息时才会看到详细日志');
console.log('- 错误和连接状态日志保持不变');
