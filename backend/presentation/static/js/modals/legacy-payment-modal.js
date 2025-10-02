"use strict";

// 旧版支付弹窗逻辑（从 mobile-dashboard.html 抽离）
// 保持与原有函数名/行为一致：goToPayment, showPaymentModal, processPayment
// 依赖：showToast, closeModal, loadShops

function goToPayment(shopId) {
  if (!shopId) {
    if (typeof showToast === 'function') showToast('店铺ID无效', 'error');
    return;
  }
  // 关闭当前店铺详情模态
  if (typeof closeModal === 'function') closeModal('shop-details-modal');
  if (typeof showToast === 'function') showToast('正在跳转到付费页面...', 'info');
  // 目前使用模态框方式展示
  showPaymentModal(shopId);
}

function showPaymentModal(shopId) {
  const modalHtml = `
    <div id="payment-modal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>💳 选择付费套餐</h3>
          <button class="modal-close" onclick="closeModal('payment-modal')">×</button>
        </div>
        <div class="modal-body">
          <div class="payment-options">
            <div class="payment-plan">
              <h4>基础版</h4>
              <div class="price">¥99/年</div>
              <ul>
                <li>✅ API密钥</li>
                <li>✅ 集成代码生成</li>
                <li>✅ 基础客服功能</li>
                <li>✅ 月访问量1万次</li>
              </ul>
              <button class="btn primary" onclick="processPayment('${shopId}', 'basic', 99)">选择基础版</button>
            </div>
            <div class="payment-plan popular">
              <div class="popular-badge">推荐</div>
              <h4>标准版</h4>
              <div class="price">¥299/年</div>
              <ul>
                <li>✅ 包含基础版所有功能</li>
                <li>✅ 高级定制选项</li>
                <li>✅ 优先技术支持</li>
                <li>✅ 月访问量10万次</li>
                <li>✅ 数据分析报告</li>
              </ul>
              <button class="btn primary" onclick="processPayment('${shopId}', 'standard', 299)">选择标准版</button>
            </div>
            <div class="payment-plan">
              <h4>高级版</h4>
              <div class="price">¥599/年</div>
              <ul>
                <li>✅ 包含标准版所有功能</li>
                <li>✅ 无限访问量</li>
                <li>✅ 专属客服经理</li>
                <li>✅ 定制开发支持</li>
                <li>✅ 企业级SLA保障</li>
              </ul>
              <button class="btn primary" onclick="processPayment('${shopId}', 'premium', 599)">选择高级版</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  const existingModal = document.getElementById('payment-modal');
  if (existingModal) existingModal.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.getElementById('payment-modal');
  const overlay = document.getElementById('modal-overlay');
  if (overlay && modal) {
    overlay.style.display = 'flex';
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function processPayment(shopId, plan, amount) {
  if (typeof showToast === 'function') {
    showToast(`正在处理 ${plan} 套餐付费 (¥${amount})...`, 'info');
  }
  // 模拟付费成功
  setTimeout(() => {
    if (typeof showToast === 'function') showToast('付费成功！店铺功能已激活', 'success');
    if (typeof closeModal === 'function') closeModal('payment-modal');
    if (typeof loadShops === 'function') loadShops();
  }, 2000);
}
