// 审核管理面板脚本（从 mobile-dashboard.html 抽取）
function showReviewPanel() {
  if (!window.userData || (userData.role !== 'super_admin' && userData.role !== 'administrator')) {
    if (typeof showToast === 'function') showToast('只有超级管理员才能访问此功能', 'warning');
    return;
  }
  const modal = document.getElementById('reviewPanelModal');
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  if (typeof loadPendingShops === 'function') loadPendingShops();
}

function hideReviewPanel() {
  const modal = document.getElementById('reviewPanelModal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}
