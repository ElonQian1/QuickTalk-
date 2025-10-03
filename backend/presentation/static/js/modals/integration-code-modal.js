"use strict";

// 集成代码核心逻辑：从 mobile-dashboard.html 抽离
// 依赖：getAuthToken, getStatusText, openModal, showLoading/hideLoading, showSuccess/showError

(function(){
  // 共享状态：供 UI 注入脚本访问
  const __integrationState = window.__integrationState || { shop: null, embed: null, serverUrl: window.location.origin };
  window.__integrationState = __integrationState;

  function openIntegrationCode(shopId) {
    window.currentShopId = shopId;
    if (typeof openModal === 'function') openModal('integration-code-modal');
    loadIntegrationData(shopId);
  }

  async function loadIntegrationData(shopId) {
    try {
      const shopResp = await fetch(`/api/shops/${shopId}`, {
        headers: { 'Authorization': `Bearer ${typeof getAuthToken==='function'?getAuthToken():''}` }
      });

      if (shopResp.ok) {
        const shopJson = await shopResp.json();
        const shopData = shopJson?.data || shopJson;
        __integrationState.shop = shopData;

        const s = shopData;
        const name = s?.name || '';
        const domain = s?.domain || '';
        const status = s?.status || '';
        const apiKey = s?.api_key || '';
        const endpoint = `${window.location.origin}`;

        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setText('shop-info-name', name);
        setText('shop-info-domain', domain);
        setText('shop-info-plan', '-');
        if (typeof getStatusText==='function') setText('shop-info-status', getStatusText(status));
        setText('api-info-key', apiKey);
        setText('api-info-secret', '—');
        setText('api-info-endpoint', endpoint);

        // 兼容旧信息区
        setText('integrationShopName', name);
        setText('integrationShopId', s?.id || shopId);
        setText('integrationApiKey', apiKey);
        setText('integrationGeneratedTime', new Date().toLocaleString());
      } else {
        console.error('加载店铺详情失败');
      }

      // 获取 embed 配置（无认证）
      const cfgResp = await fetch(`/embed/config/${shopId}`);
      if (cfgResp.ok) {
        const cfgJson = await cfgResp.json();
        __integrationState.embed = cfgJson?.data || cfgJson;
      }

      // 生成嵌入代码
      generateIntegrationCode();
    } catch (error) {
      console.error('加载集成信息错误:', error);
    }
  }

  // 提供给 UI 注入脚本的更新函数
  function updateIntegrationServerUrl() {
    const input = document.getElementById('integrationServerUrl');
    const hint = document.getElementById('integrationServerHint');
    if (!input) return;
    let val = (input.value || '').trim();
    if (!val) { val = window.location.origin; }
    try {
      const u = new URL(val, window.location.origin);
      __integrationState.serverUrl = u.origin;
      if (hint) {
        if (/localhost|127\.0\.0\.1/i.test(u.hostname)) {
          hint.textContent = '当前为本地地址（localhost）。将此代码放入生产网站会指向本地服务，请改为生产环境的 QuickTalk 地址。';
          hint.style.color = '#d9534f';
        } else {
          hint.textContent = '已更新服务器地址：' + u.origin;
          hint.style.color = '#6c757d';
        }
      }
    } catch (e) {
      __integrationState.serverUrl = window.location.origin;
      if (hint) {
        hint.textContent = '地址无效，已回退到：' + window.location.origin;
        hint.style.color = '#d9534f';
      }
    }
    generateIntegrationCode();
  }

  function generateIntegrationCode() {
    const s = __integrationState.shop?.data || __integrationState.shop || {};
    const shopId = s?.id || window.currentShopId || '';
    const domain = s?.domain || '';
    const serverUrl = __integrationState.serverUrl;
    const cache = Date.now();

    const code = `<!-- QuickTalk 客服系统 - 轻量动态集成（纯Rust版） -->\n` +
`<script>(function(){\n` +
`  var CONFIG = {\n` +
`    shopId: '${shopId}',\n` +
`    serverUrl: '${serverUrl}',\n` +
`    authorizedDomain: '${domain}',\n` +
`    cache: ${cache}\n` +
`  };\n` +
`  var host = window.location.hostname;\n` +
`  if (CONFIG.authorizedDomain && host !== CONFIG.authorizedDomain && !host.endsWith('.' + CONFIG.authorizedDomain) && host !== 'localhost') {\n` +
`    console.error('❌ QuickTalk 域名未授权:', host, '期望:', CONFIG.authorizedDomain);\n` +
`    return;\n` +
`  }\n` +
`  var link = document.createElement('link');\n` +
`  link.rel = 'stylesheet';\n` +
`  link.href = CONFIG.serverUrl + '/embed/styles.css?v=' + CONFIG.cache;\n` +
`  link.onerror = function(){ console.error('❌ QuickTalk 样式加载失败'); };\n` +
`  document.head.appendChild(link);\n` +
`  var s = document.createElement('script');\n` +
`  s.src = CONFIG.serverUrl + '/embed/service.js?v=' + CONFIG.cache;\n` +
`  s.onload = function(){\n` +
`    if (window.QuickTalkCustomerService) {\n` +
`      window.QuickTalkCustomerService.init({ shopId: CONFIG.shopId, serverUrl: CONFIG.serverUrl });\n` +
`      console.log('✅ QuickTalk 已初始化');\n` +
`    } else {\n` +
`      console.error('❌ QuickTalk 服务未就绪');\n` +
`    }\n` +
`  };\n` +
`  s.onerror = function(){ console.error('❌ QuickTalk 脚本加载失败'); };\n` +
`  document.head.appendChild(s);\n` +
`})();<\/script>`;

    const primary = document.getElementById('integration-code');
    if (primary) primary.value = code;
    const alt = document.getElementById('integrationCodeText');
    if (alt) alt.value = code;
  }

  function copyIntegrationCode() {
    const textarea = document.getElementById('integration-code');
    if (!textarea) return;
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    try {
      document.execCommand('copy');
      if (typeof showSuccess==='function') showSuccess('集成代码已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      if (typeof showError==='function') showError('复制失败，请手动复制');
    }
  }

  // 兼容旧版页面上的复制/下载按钮（generated-code 区域）
  function copyCode() {
    const codeTextarea = document.getElementById('generated-code');
    if (!codeTextarea) return;
    try {
      codeTextarea.select();
      document.execCommand('copy');
      if (typeof showSuccess==='function') showSuccess('代码已复制到剪贴板');
      else if (typeof showToast==='function') showToast('代码已复制到剪贴板', 'success');
    } catch (e) {
      console.error('复制失败:', e);
      if (typeof showError==='function') showError('复制失败，请手动复制');
      else if (typeof showToast==='function') showToast('复制失败，请手动复制', 'error');
    }
  }

  function getFileExtension(platform) {
    switch (platform) {
      case 'html': return 'html';
      case 'react': return 'jsx';
      case 'php': return 'php';
      case 'python': return 'py';
      default: return 'txt';
    }
  }

  function downloadCode() {
    if (!window.currentGeneratedCode) {
      if (typeof showToast==='function') showToast('没有可下载的代码', 'error');
      return;
    }
    const { platform, code } = window.currentGeneratedCode;
    const filename = `quicktalk-integration.${getFileExtension(platform)}`;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof showToast==='function') showToast(`${filename} 下载成功`, 'success');
  }

  async function regenerateApiKey() {
    if (!confirm('重新生成API密钥后，现有的集成将失效，确定继续吗？')) {
      return;
    }
    try {
      if (typeof showLoading==='function') showLoading('正在生成新的API密钥...');
      const response = await fetch(`/api/shops/${window.currentShopId}/rotate-api-key`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${typeof getAuthToken==='function'?getAuthToken():''}` }
      });
      if (response.ok) {
        if (typeof showSuccess==='function') showSuccess('API密钥已更新');
        await loadIntegrationData(window.currentShopId);
      } else {
        if (typeof showError==='function') showError('生成API密钥失败');
      }
    } catch (error) {
      console.error('生成API密钥失败:', error);
      if (typeof showError==='function') showError('网络错误，请重试');
    } finally {
      if (typeof hideLoading==='function') hideLoading();
    }
  }

  // 暴露到全局（保持原有契约）
  window.openIntegrationCode = openIntegrationCode;
  window.loadIntegrationData = loadIntegrationData;
  window.updateIntegrationServerUrl = updateIntegrationServerUrl;
  window.generateIntegrationCode = generateIntegrationCode;
  window.copyIntegrationCode = copyIntegrationCode;
  window.regenerateApiKey = regenerateApiKey;
  // 兼容旧版的按钮处理函数
  window.copyCode = copyCode;
  window.downloadCode = downloadCode;
  window.getFileExtension = getFileExtension;
})();
