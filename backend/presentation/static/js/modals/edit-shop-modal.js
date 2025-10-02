// 编辑店铺模态脚本（从 mobile-dashboard.html 抽取）
function openEditShop(shopId) {
  window.currentShopId = shopId;
  const shop = Array.isArray(window.shopsData) ? shopsData.find(s => s.id === shopId) : null;
  if (shop) {
    document.getElementById('edit-shop-name').value = shop.name;
    document.getElementById('edit-shop-domain').value = shop.domain || '';
    document.getElementById('edit-shop-plan').value = shop.plan || 'basic';
    if (typeof openModal === 'function') openModal('edit-shop-modal');
  }
}

async function saveShop() {
  const name = document.getElementById('edit-shop-name').value.trim();
  const domain = document.getElementById('edit-shop-domain').value.trim();
  const plan = document.getElementById('edit-shop-plan').value;
  if (!name) {
    if (typeof showError === 'function') showError('店铺名称不能为空');
    return;
  }
  try {
    if (typeof showLoading === 'function') showLoading('正在保存店铺信息...');
    const response = await fetch(`/api/shops/${window.currentShopId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${typeof getAuthToken === 'function' ? getAuthToken() : ''}`
      },
      body: JSON.stringify({ name, domain, plan })
    });
    if (response.ok) {
      if (typeof showSuccess === 'function') showSuccess('店铺信息已更新');
      if (typeof closeModal === 'function') closeModal('edit-shop-modal');
      if (typeof loadShops === 'function') await loadShops();
    } else {
      if (typeof showError === 'function') showError('保存失败');
    }
  } catch (error) {
    console.error('保存店铺失败:', error);
    if (typeof showError === 'function') showError('网络错误，请重试');
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
  }
}
