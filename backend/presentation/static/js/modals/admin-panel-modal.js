// 超级管理员面板脚本（从 mobile-dashboard.html 抽取）
function hideAdminPanel() {
  const modal = document.getElementById('adminPanelModal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

function showAdminTab(tabName) {
  // 隐藏所有标签内容
  document.querySelectorAll('#adminPanelModal .tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  // 移除所有标签按钮的激活状态
  document.querySelectorAll('#adminPanelModal .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  // 显示指定标签内容
  const targetTab = document.getElementById(tabName + 'Tab');
  if (targetTab) targetTab.classList.add('active');
  // 激活对应的标签按钮
  const targetBtn = (typeof event !== 'undefined' && event) ? event.target : document.querySelector(`[onclick="showAdminTab('${tabName}')"]`);
  if (targetBtn) targetBtn.classList.add('active');
  // 根据标签加载相应数据
  if (tabName === 'overview') {
    if (typeof loadSystemStats === 'function') loadSystemStats();
  } else if (tabName === 'owners') {
    if (typeof loadShopOwnersStats === 'function') loadShopOwnersStats();
  } else if (tabName === 'shops') {
    if (typeof loadAllShopsMonitor === 'function') loadAllShopsMonitor();
  }
}

function refreshAdminData() {
  if (!window.userData || (userData.role !== 'super_admin' && userData.role !== 'administrator')) return;
  if (typeof loadSystemStats === 'function') loadSystemStats();
  if (typeof loadShopOwnersStats === 'function') loadShopOwnersStats();
  if (typeof loadAllShopsMonitor === 'function') loadAllShopsMonitor();
  if (typeof showToast === 'function') showToast('数据已刷新', 'success');
}
