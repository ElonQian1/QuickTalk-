const fs = require('fs');
const path = require('path');

/**
 * 构建独立版本的SDK文件
 * 将所有模块打包成单一的JavaScript文件
 */

const srcDir = path.join(__dirname, '..', 'dist');
const outputDir = path.join(__dirname, '..', '..', 'backend', 'static', 'embed');
const outputFile = path.join(outputDir, 'service-standalone.js');

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 读取编译后的入口文件
const entryFile = path.join(srcDir, 'standalone-entry.js');

if (!fs.existsSync(entryFile)) {
  console.error('❌ 入口文件不存在，请先运行 npm run build:modules');
  process.exit(1);
}

try {
  // 读取编译后的代码
  let code = fs.readFileSync(entryFile, 'utf-8');
  
  // 简单的模块替换（将ES6 import/export转换为IIFE格式）
  // 这是一个简化版本，实际项目中建议使用webpack或rollup
  
  // 移除export语句
  code = code.replace(/export\s+{[^}]*};?\s*/g, '');
  code = code.replace(/export\s+default\s+\w+;?\s*/g, '');
  code = code.replace(/export\s+const\s+VERSION\s*=\s*[^;]+;?\s*/g, '');
  code = code.replace(/export\s+class\s+/g, 'class ');
  code = code.replace(/export\s+interface\s+/g, 'interface ');
  
  // 移除import语句（简化处理）
  code = code.replace(/import\s+{[^}]*}\s+from\s+[^;]+;?\s*/g, '');
  code = code.replace(/import\s+\w+\s+from\s+[^;]+;?\s*/g, '');
  
  // 包装在IIFE中
  const wrappedCode = `
/* QuickTalk SDK v2.0.0 - 模块化重构版本 */
/* 解决独立站样式覆盖问题，支持响应式字体和布局 */
(function() {
  'use strict';
  
  ${code}
  
  console.log('✅ QuickTalk SDK 2.0.0 已加载（独立版本）');
  console.log('🎯 重点改进:');
  console.log('  • 防止独立站样式覆盖');
  console.log('  • 响应式字体和窗口比例');
  console.log('  • 模块化架构重构');
  console.log('  • 更好的移动端适配');
})();
`;

  // 写入输出文件
  fs.writeFileSync(outputFile, wrappedCode);
  
  console.log(`✅ 独立版本构建完成: ${outputFile}`);
  console.log(`📦 文件大小: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);
  
} catch (error) {
  console.error('❌ 构建失败:', error.message);
  process.exit(1);
}