// 通知与消息提示相关逻辑模块
// 包含 showNotify、showError、showSuccess、hideNotify、renderNotifyBar、showToast 等
// 保持全局函数名，确保与主页面兼容

function showToast(message, type = 'info') {
	// 创建toast元素
	const toast = document.createElement('div');
	toast.className = `toast toast-${type}`;
	toast.textContent = message;
    
	// 添加样式
	Object.assign(toast.style, {
		position: 'fixed',
		top: '20px',
		left: '50%',
		transform: 'translateX(-50%)',
		backgroundColor: type === 'info' ? '#17a2b8' : type === 'error' ? '#dc3545' : '#28a745',
		color: 'white',
		padding: '12px 20px',
		borderRadius: '8px',
		zIndex: '9999',
		fontSize: '14px',
		fontWeight: '500',
		boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
		opacity: '0',
		transition: 'opacity 0.3s ease'
	});
    
	document.body.appendChild(toast);
    
	// 显示动画
	setTimeout(() => {
		toast.style.opacity = '1';
	}, 100);
    
	// 3秒后自动消失
	setTimeout(() => {
		toast.style.opacity = '0';
		setTimeout(() => {
			if (toast.parentNode) {
				toast.parentNode.removeChild(toast);
			}
		}, 300);
	}, 3000);
}
// 通知与消息提示相关逻辑模块
// 包含 showNotify、showError、showSuccess、hideNotify、renderNotifyBar 等
// 保持全局函数名，确保与主页面兼容

// ...请将 mobile-dashboard.html 中通知与消息提示相关 JS 逻辑粘贴到此处...

// 示例结构：
// function showNotify(msg, type) { ... }
// function showError(msg) { ... }
// function showSuccess(msg) { ... }
// function hideNotify() { ... }
// function renderNotifyBar() { ... }
// ...

// ...如有依赖工具函数，请在顶部注明依赖关系...
