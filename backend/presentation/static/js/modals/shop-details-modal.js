"use strict";

// shop-details-modal.js — 店铺详情模态与标签页逻辑（从 mobile-dashboard.html 抽取）
// 提供全局函数：showShopDetails(shop), showShopTab(tabName)
// 依赖：openModal/closeModal（modal-utils.js）、getEffectiveStatus（内联/兼容）、getStatusText（status-utils.js）
//       showAddEmployeeForm/cancelAddEmployee/addEmployee（employees.js）、loadEmployeesList（employees-list.js）、
//       loadShopSettings（shop-settings.js）、openIntegrationCode/regenerateApiKey（integration-code-modal.js）、
//       goToPayment（legacy-payment-modal.js）、showToast（notify-utils.js）

(function(){
  // 显示店铺详细信息模态框
  window.showShopDetails = function showShopDetails(shop) {
    // 确保当前店铺ID已设置，供员工与设置等API使用
    if (shop && shop.id) { window.currentShopId = shop.id; }

    const status = (typeof getEffectiveStatus === 'function')
      ? getEffectiveStatus(shop)
      : ((shop && (shop.approvalStatus || shop.status)) || 'pending');
    const statusText = (typeof getStatusText === 'function') ? getStatusText(status) : String(status);

    let modal = document.getElementById('shop-details-modal');
    // 关键修复：不同店铺/不同状态切换时，始终以当前状态重建模态内容，避免首次状态锁死
    if (modal) {
      try { modal.parentNode.removeChild(modal); } catch (_) {}
      modal = null;
    }

    // 规则：未付款=未审核；客户付款成功后才通过审核
    // 因此：已通过(approved) 即视为已付费；active 同样视为已付费
    const isApproved = status === 'approved' || status === 'active';
    const isPaid = isApproved; // 当前模型下，已通过/激活即视为已付费
    // 展示策略拆分：
    // - 员工管理：已通过即可使用（不强制付费）
    // - 高级功能（API Key/集成代码按钮等）：已通过且已付费
    const showEmployeesTab = isApproved;
    const showSettingsTab = true;
    const showAdvancedFeatures = isApproved; // 已通过=已付费

    if (!modal) {
      // 创建店铺详情模态框，支持多标签页结构
      const modalHtml = `
        <div id="shop-details-modal" class="modal">
          <div class="modal-content shop-management-modal">
            <div class="modal-header">
              <h3 id="shop-details-title">${shop.name} - 店铺管理</h3>
              <button class="modal-close" onclick="closeModal('shop-details-modal')">×</button>
            </div>
            <div class="modal-body">
              <!-- 标签页导航 -->
              <div class="tab-nav">
                <button class="tab-btn active" onclick="showShopTab('info')">📋 基本信息</button>
                ${showEmployeesTab ? `<button class="tab-btn" onclick="showShopTab('employees')">👥 员工管理</button>` : ''}
                ${showSettingsTab ? `<button class="tab-btn" onclick="showShopTab('settings')">⚙️ 店铺设置</button>` : ''}
              </div>

              <!-- 基本信息标签页 -->
              <div id="infoTab" class="tab-content active">
                <div class="shop-detail-info">
                  <div class="detail-item">
                    <label>店铺名称：</label>
                    <span id="detail-shop-name"></span>
                  </div>
                  <div class="detail-item">
                    <label>域名：</label>
                    <span id="detail-shop-domain"></span>
                  </div>
                  <div class="detail-item">
                    <label>状态：</label>
                    <span id="detail-shop-status" class="status-badge"></span>
                  </div>
                  ${showAdvancedFeatures ? `
                    <div class="detail-item">
                      <label>API密钥：</label>
                      <span id="detail-shop-api-key" class="api-key-display"></span>
                    </div>
                  ` : ''}
                  <div class="detail-item">
                    <label>创建时间：</label>
                    <span id="detail-shop-created"></span>
                  </div>
                  ${status === 'pending' ? `
                    <div class="detail-item status-info">
                      <div class="status-message pending">
                        <div class="status-icon">⏳</div>
                        <div class="status-text">
                          <h4>等待审核中</h4>
                          <p>您的店铺申请正在审核中，我们会在1-2个工作日内完成审核。</p>
                        </div>
                      </div>
                    </div>
                  ` : ''}
                  ${status === 'inactive' ? `
                    <div class="detail-item status-info">
                      <div class="status-message payment-pending">
                        <div class="status-icon">💳</div>
                        <div class="status-text">
                          <h4>未激活</h4>
                          <p>当前店铺未激活，激活后可使用 API 密钥和集成代码等功能。</p>
                          <button class="payment-btn" onclick="goToPayment('${shop.id}')">立即激活</button>
                        </div>
                      </div>
                    </div>
                  ` : ''}
                </div>
                ${showAdvancedFeatures ? `
                  <div class="shop-detail-actions">
                    <button class="btn primary" onclick="openIntegrationCode('${shop.id}')">生成集成代码</button>
                    <button class="btn secondary" onclick="regenerateApiKey()">重新生成API密钥</button>
                  </div>
                ` : ''}
              </div>

              <!-- 员工管理标签页 -->
              ${showEmployeesTab ? `
                <div id="employeesTab" class="tab-content">
                  <div class="section-header">
                    <h4>员工列表</h4>
                    <button class="btn btn-small" onclick="showAddEmployeeForm()">➕ 添加员工</button>
                  </div>

                  <!-- 添加员工表单 -->
                  <div id="addEmployeeForm" class="add-employee-form" style="display: none;">
                    <h5>添加新员工</h5>
                    <div class="employee-help-text">
                      <p>💡 <strong>员工权限说明：</strong></p>
                      <ul>
                        <li><strong>员工</strong>：可以回复客户消息，处理客服对话</li>
                        <li><strong>经理</strong>：可以回复客户消息，查看统计报表，管理其他员工</li>
                      </ul>
                      <p>✅ 添加的员工将能够登录系统并处理本店铺的客服工作</p>
                    </div>
                    <form id="addEmployeeFormData" onsubmit="return addEmployee(event)">
                      <div class="form-row">
                        <div class="form-group">
                          <label for="employeeUsername">用户名</label>
                          <input type="text" id="employeeUsername" placeholder="输入要添加的用户名" required>
                        </div>
                        <div class="form-group">
                          <label>角色权限</label>
                          <div class="readonly-field">员工（默认，客服权限）</div>
                          <input type="hidden" id="employeeRole" value="employee" />
                        </div>
                      </div>
                      <div class="form-buttons">
                        <button type="button" onclick="cancelAddEmployee()">取消</button>
                        <button type="submit">➕ 添加员工</button>
                      </div>
                    </form>
                  </div>

                  <!-- 员工列表 -->
                  <div id="employeesList" class="employees-list"></div>
                </div>

                <!-- 店铺设置标签页 -->
                ${showSettingsTab ? `<div id="settingsTab" class="tab-content">` : `<div id="settingsTab" class="tab-content" style="display:none;">`}
                  <form id="shopSettingsForm" onsubmit="updateShopSettings(event)">
                    <div class="form-group">
                      <label for="editShopName">店铺名称</label>
                      <input type="text" id="editShopName" required>
                    </div>
                    <div class="form-group">
                      <label for="editShopDomain">店铺域名</label>
                      <input type="text" id="editShopDomain" required>
                      <div class="domain-help">
                        <h4>📝 域名填写格式说明：</h4>
                        <ul>
                          <li><strong>✅ 正确格式：</strong> <code>example.com</code></li>
                          <li><strong>❌ 错误格式：</strong> <code>https://example.com/</code></li>
                          <li><strong>🌟 通配符支持：</strong> <code>*.example.com</code></li>
                        </ul>
                      </div>
                    </div>
                    <div class="form-group">
                      <label for="editShopDescription">店铺描述</label>
                      <textarea id="editShopDescription" rows="3"></textarea>
                    </div>
                    <div class="form-buttons">
                      <button type="button" onclick="closeModal('shop-details-modal')">取消</button>
                      <button type="submit">💾 保存设置</button>
                    </div>
                  </form>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      modal = document.getElementById('shop-details-modal');
      // 初次创建后立即显示模态框
      if (typeof openModal === 'function') openModal('shop-details-modal');
    }

    // 填充店铺信息
    const nameEl = document.getElementById('detail-shop-name');
    const domainEl = document.getElementById('detail-shop-domain');
    const statusEl = document.getElementById('detail-shop-status');
    if (nameEl) nameEl.textContent = shop.name || '';
    if (domainEl) domainEl.textContent = shop.domain || '';
    if (statusEl) {
      statusEl.textContent = statusText;
      statusEl.className = `status-badge status-${status}`;
    }

    // 只有付费用户才显示API密钥
    if (showAdvancedFeatures) {
      const apiKeyElement = document.getElementById('detail-shop-api-key');
      if (apiKeyElement) apiKeyElement.textContent = shop.api_key || '未生成';
    }

    const createdEl = document.getElementById('detail-shop-created');
    if (createdEl) createdEl.textContent = shop.created_at ? new Date(shop.created_at).toLocaleDateString() : '未知';

    // 若已存在模态框但未显示，则显示
    if (modal && !modal.classList.contains('show')) {
      if (typeof openModal === 'function') openModal('shop-details-modal');
    }
  };

  // 显示店铺标签页
  window.showShopTab = function showShopTab(tabName) {
    // 更新标签按钮状态（防御空指针）
    const allBtns = document.querySelectorAll('.tab-btn');
    allBtns.forEach(btn => btn.classList.remove('active'));
    const targetBtn = Array.from(allBtns).find(btn => btn.getAttribute('onclick') === `showShopTab('${tabName}')`);
    if (targetBtn) targetBtn.classList.add('active');

    // 切换标签页内容（防御空指针）
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const targetTab = document.getElementById(tabName + 'Tab');
    if (targetTab) {
      targetTab.classList.add('active');
    } else {
      // 当目标页不存在（例如未付费/未审核时隐藏员工页）
      if (typeof showToast === 'function') showToast('该功能暂不可用，请确认店铺已审核并完成付费', 'warning');
    }

    // 根据标签页加载相应数据
    switch (tabName) {
      case 'employees':
        if (typeof loadEmployeesList === 'function') loadEmployeesList();
        break;
      case 'settings':
        if (typeof loadShopSettings === 'function') loadShopSettings();
        break;
      case 'info':
      default:
        // 基本信息已在showShopDetails中加载
        break;
    }
  };
})();
