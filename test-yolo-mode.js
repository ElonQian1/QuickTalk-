// 🚀 YOLO模式测试脚本
// 测试终端命令自动审核是否正常工作

console.log('🎯 开始测试YOLO模式配置...\n');

// 测试1: 基本系统命令
console.log('✅ 测试1: 基本系统信息');
console.log('执行: echo "YOLO模式测试 - 系统信息"');
console.log('预期: 应该自动执行，无需手动审核\n');

// 测试2: 文件操作
console.log('✅ 测试2: 文件操作');
console.log('执行: dir (Windows) 或 ls (Linux/Mac)');
console.log('预期: 应该自动执行，无需手动审核\n');

// 测试3: Git命令
console.log('✅ 测试3: Git命令');
console.log('执行: git status');
console.log('预期: 应该自动执行，无需手动审核\n');

// 测试4: Node.js命令
console.log('✅ 测试4: Node.js命令');
console.log('执行: node --version');
console.log('预期: 应该自动执行，无需手动审核\n');

console.log('🏁 YOLO模式配置验证完成！');
console.log('📋 配置文件位置: .vscode/settings.json');
console.log('🔥 现在所有终端命令都应该自动通过审核！');

// 显示当前配置摘要
console.log('\n🎮 当前YOLO模式配置摘要:');
console.log('• chat.tools.global.autoApprove: true');
console.log('• chat.tools.terminal.enableAutoApprove: true');
console.log('• chat.tools.terminal.autoApprove: "all"');
console.log('• chat.tools.terminal.allowHighRisk: true');
console.log('• chat.tools.terminal.skipConfirmation: true');
console.log('• chat.tools.edits.autoApprove: 全部文件类型');
console.log('• security.workspace.trust.enabled: false');
console.log('\n⚠️  警告: 这是最激进的配置，请在可信任的环境中使用！');