const fs = require('fs');
const path = require('path');

/**
 * 构建独立版本的SDK文件
 * 将ES6模块转换为浏览器兼容的IIFE格式
 */

const srcDir = path.join(__dirname, '..', 'dist');
const outputDir = path.join(__dirname, '..', '..', 'backend', 'static', 'embed');
const outputFile = path.join(outputDir, 'service-standalone.js');

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * 读取并处理模块文件
 */
function readModuleFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // 移除sourcemap注释
    return content.replace(/\/\/# sourceMappingURL=.*$/gm, '');
  } catch (error) {
    console.warn(`⚠️ 无法读取文件: ${filePath} - ${error.message}`);
    return '';
  }
}

/**
 * 处理ES6模块代码，转换为IIFE兼容格式
 */
function processModuleCode(code, moduleName) {
  // 移除export语句，保留声明
  code = code.replace(/export\s+class\s+/g, 'class ');
  code = code.replace(/export\s+interface\s+/g, 'interface ');
  code = code.replace(/export\s+const\s+/g, 'const ');
  code = code.replace(/export\s+function\s+/g, 'function ');
  code = code.replace(/export\s+{[^}]*};?\s*/g, '');
  code = code.replace(/export\s+default\s+[^;]+;?\s*/g, '');
  
  // 移除import语句
  code = code.replace(/import\s+{[^}]*}\s+from\s+[^;]+;?\s*/g, '');
  code = code.replace(/import\s+\*\s+as\s+\w+\s+from\s+[^;]+;?\s*/g, '');
  code = code.replace(/import\s+\w+\s+from\s+[^;]+;?\s*/g, '');
  
  return code;
}

try {
  console.log('🔨 开始构建独立版本SDK...');
  
  // 读取所有模块文件
  const modules = {};
  
  // 核心模块
  modules.config = readModuleFile(path.join(srcDir, 'core', 'config.js'));
  modules.websocketClient = readModuleFile(path.join(srcDir, 'core', 'websocket-client.js'));
  
  // UI模块
  modules.styleSystem = readModuleFile(path.join(srcDir, 'ui', 'style-system.js'));
  modules.viewportManager = readModuleFile(path.join(srcDir, 'ui', 'viewport-manager.js'));
  modules.uiManager = readModuleFile(path.join(srcDir, 'ui', 'ui-manager.js'));
  
  // 媒体模块
  modules.mediaHandler = readModuleFile(path.join(srcDir, 'media', 'media-handler.js'));
  
  // 工具模块
  modules.eventUtils = readModuleFile(path.join(srcDir, 'utils', 'event-utils.js'));
  
  // 主入口
  modules.main = readModuleFile(path.join(srcDir, 'standalone-entry.js'));
  
  // 处理所有模块代码
  const processedModules = {};
  for (const [name, code] of Object.entries(modules)) {
    if (code) {
      processedModules[name] = processModuleCode(code, name);
    }
  }
  
  // 构建最终的IIFE代码
  const finalCode = `
/* QuickTalk SDK v2.0.0 - 模块化重构版本 */
/* 解决独立站样式覆盖问题，支持响应式字体和布局 */
(function() {
  'use strict';
  
  // ===== 工具函数模块 =====
  ${processedModules.eventUtils || '// 工具模块未找到'}
  
  // ===== 核心配置模块 =====
  ${processedModules.config || '// 配置模块未找到'}
  
  // ===== WebSocket客户端模块 =====
  ${processedModules.websocketClient || '// WebSocket模块未找到'}
  
  // ===== 样式系统模块 =====
  ${processedModules.styleSystem || '// 样式系统模块未找到'}
  
  // ===== 视口管理模块 =====
  ${processedModules.viewportManager || '// 视口管理模块未找到'}
  
  // ===== UI管理模块 =====
  ${processedModules.uiManager || '// UI管理模块未找到'}
  
  // ===== 媒体处理模块 =====
  ${processedModules.mediaHandler || '// 媒体处理模块未找到'}
  
  // ===== 主SDK类 =====
  ${processedModules.main || '// 主模块未找到'}
  
  console.log('✅ QuickTalk SDK 2.0.0 已加载（独立版本）');
  console.log('🎯 重点改进:');
  console.log('  • 防止独立站样式覆盖');  
  console.log('  • 响应式字体和窗口比例');
  console.log('  • 模块化架构重构');
  console.log('  • 更好的移动端适配');
})();
`;

  // 写入输出文件
  fs.writeFileSync(outputFile, finalCode);
  
  console.log(`✅ 独立版本构建完成: ${outputFile}`);
  console.log(`📦 文件大小: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);
  
} catch (error) {
  console.error('❌ 构建失败:', error.message);
  process.exit(1);
}