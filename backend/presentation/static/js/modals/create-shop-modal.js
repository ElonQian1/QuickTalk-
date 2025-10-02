// 创建店铺模态脚本（从 mobile-dashboard.html 抽取）
function showCreateShopModal() {
  console.log('🏪 showCreateShopModal 函数被调用');
  const modal = document.getElementById('createShopModal');
  console.log('🔍 模态框元素:', modal ? '找到' : '未找到');
  if (modal) {
    console.log('✅ 显示创建店铺模态框');
    modal.style.display = 'flex';
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    console.log('🎯 模态框应该已显示');
    console.log('🔍 模态框当前样式:', window.getComputedStyle(modal).display);
  } else {
    console.error('❌ 模态框元素未找到');
    if (typeof showToast === 'function') {
      showToast('无法显示创建店铺对话框，请刷新页面重试', 'error');
    }
  }
}

function hideCreateShopModal() {
  console.log('🏪 hideCreateShopModal 函数被调用');
  const modal = document.getElementById('createShopModal');
  const form = document.getElementById('createShopForm');
  if (modal) {
    console.log('✅ 隐藏创建店铺模态框');
    modal.style.display = 'none';
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
    console.log('🎯 模态框应该已隐藏');
  } else {
    console.error('❌ 未找到创建店铺模态框');
  }
  if (form) {
    form.reset();
    console.log('📝 表单已重置');
  } else {
    console.error('❌ 未找到创建店铺表单');
  }
}
