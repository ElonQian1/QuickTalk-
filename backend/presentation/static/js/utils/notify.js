// 通知与消息提醒工具
// 依赖：ui-tools.js

function showNotify(message, type = 'info', duration = 2000) {
    // ...原实现代码...
}

function hideNotify() {
    // ...原实现代码...
}

function showError(message) {
    showNotify(message, 'error', 3000);
}

function showSuccess(message) {
    showNotify(message, 'success', 2000);
}

function showInfo(message) {
    showNotify(message, 'info', 2000);
}

function showConfirm(message, onConfirm, onCancel) {
    // ...原实现代码...
}

function showAlert(message, onClose) {
    // ...原实现代码...
}
