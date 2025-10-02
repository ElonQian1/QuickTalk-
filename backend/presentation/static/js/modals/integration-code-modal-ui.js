// 集成代码模态框：在模态内追加服务器地址输入，并在打开时确保注入
(function(){
  const injectServerUrlUI = () => {
    const modal = document.getElementById('integration-code-modal');
    if (!modal) return;
    const apiBlock = modal.querySelector('.info-section:nth-of-type(2)'); // API信息块
    if (!apiBlock) return;
    // 避免重复插入
    if (modal.querySelector('#integrationServerUrl')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'info-section';
    wrapper.innerHTML = `
      <h4>服务器地址</h4>
      <div class="info-grid">
        <div class="info-item" style="grid-column: 1 / -1; display: grid; gap: 8px;">
          <label for="integrationServerUrl">Server URL</label>
          <input id="integrationServerUrl" type="text" style="width: 100%; padding: 10px 12px; border: 1px solid #e1e5ea; border-radius: 8px; font-size: 14px;" placeholder="例如：https://quicktalk.your-domain.com">
          <small id="integrationServerHint" style="color:#6c757d;">请填写可从客户网站访问的 QuickTalk 服务地址。当前默认值为本页面的来源地址。</small>
        </div>
      </div>`;
    apiBlock.insertAdjacentElement('afterend', wrapper);
    // 初始化与监听
    const input = document.getElementById('integrationServerUrl');
    if (input) {
      input.value = (window.__integrationState?.serverUrl || window.location.origin);
      input.addEventListener('change', window.updateIntegrationServerUrl);
      input.addEventListener('blur', window.updateIntegrationServerUrl);
    }
  };
  // 初次载入尝试注入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectServerUrlUI);
  } else { injectServerUrlUI(); }
  // 打开模态时确保注入
  const origOpenIntegrationCode = window.openIntegrationCode;
  window.openIntegrationCode = function(shopId){
    try { injectServerUrlUI(); } catch(_){}
    return origOpenIntegrationCode ? origOpenIntegrationCode(shopId) : undefined;
  };
})();
