// employees-list.js — 员工列表加载与操作（从 mobile-dashboard.html 抽取）
// 提供全局：loadEmployeesList, editEmployee, removeEmployee
// 依赖（全局）：currentShopId, showToast, getAuthToken, safeJson（可选，内置兜底）

(function () {
  'use strict';

  function toast(msg, type) {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      try { window.showToast(msg, type); } catch (_) { console.log(`[toast:${type}]`, msg); }
    } else {
      console.log(`[toast:${type}]`, msg);
    }
  }

  async function safeJsonFallback(resp) {
    try { return await resp.json(); } catch (_) { return null; }
  }

  function localFormatDate(d) {
    try {
      if (!d) return '';
      const dt = typeof d === 'string' ? new Date(d) : new Date(d?.seconds ? d.seconds * 1000 : d);
      if (Number.isNaN(dt.getTime())) return '';
      return dt.toISOString().slice(0, 19).replace('T', ' ');
    } catch { return ''; }
  }

  // 加载员工列表
  window.loadEmployeesList = async function loadEmployeesList() {
    try {
      const shopId = typeof window !== 'undefined' ? window.currentShopId : null;
      if (!shopId) return;
      const container = document.getElementById('employeesList');
      if (!container) return;
      container.innerHTML = '<div class="loading">正在加载员工信息...</div>';

      const headers = {};
      if (typeof window !== 'undefined' && typeof window.getAuthToken === 'function') {
        headers['Authorization'] = `Bearer ${window.getAuthToken()}`;
      }

      const resp = await fetch(`/api/shops/${shopId}/employees`, { headers });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const employees = data?.data ?? data?.employees ?? [];

      if (!Array.isArray(employees) || employees.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">👥</div>
            <h3>暂无员工</h3>
            <p>点击上方"添加员工"按钮来添加第一个员工</p>
          </div>`;
        return;
      }

      const roleName = (r) => (typeof window !== 'undefined' && typeof window.getRoleName === 'function') ? window.getRoleName(r) : (r || '未知');

      container.innerHTML = `${employees.map(e => `
        <div class="employee-item">
          <div class="employee-info">
            <div class="employee-avatar">${(e.name||e.email||'E').charAt(0).toUpperCase()}</div>
            <div class="employee-details">
              <div class="employee-name">${e.name || e.email || e.username || '未命名'}</div>
              <div class="employee-meta">角色：${roleName(e.role)} ｜ 状态：${e.status === 'active' ? '启用' : (e.status||'未知')} ｜ 加入时间：${localFormatDate(e.created_at)}</div>
            </div>
          </div>
          <div class="employee-actions">
            <button class="btn btn-small" onclick="editEmployee('${e.id}')">编辑</button>
            <button class="btn btn-small btn-danger" onclick="removeEmployee('${e.id}', '${(e.name||e.email||'').replace(/'/g, "&#39;")}')">移除</button>
          </div>
        </div>`).join('')}`;
    } catch (error) {
      console.error('加载员工列表失败:', error);
      const container = document.getElementById('employeesList');
      if (container) container.innerHTML = '<div class="error">加载失败，请稍后重试</div>';
    }
  };

  // 编辑员工（占位）
  window.editEmployee = function editEmployee(employeeId) {
    toast('编辑员工功能开发中...', 'info');
    // TODO: 实现编辑员工功能
  };

  // 移除员工
  window.removeEmployee = async function removeEmployee(employeeId, username) {
    try {
      if (!confirm(`确定要移除员工 ${username || ''} 吗？`)) return;
      const shopId = typeof window !== 'undefined' ? window.currentShopId : null;
      if (!shopId) { toast('请先选择一个店铺', 'error'); return; }

      toast('正在移除员工...', 'info');
      const resp = await fetch(`/api/shops/${shopId}/employees/${employeeId}`, { method: 'DELETE' });
      if (!resp.ok) {
        const sj = (typeof window !== 'undefined' && typeof window.safeJson === 'function') ? window.safeJson : safeJsonFallback;
        const err = await sj(resp);
        throw new Error(err?.message || `移除失败 (${resp.status})`);
      }

      toast(`成功移除员工 ${username || ''}`.trim(), 'success');
      if (typeof window.loadEmployeesList === 'function') await window.loadEmployeesList();
    } catch (error) {
      console.error('移除员工失败:', error);
      toast(error.message || '移除员工失败，请重试', 'error');
    }
  };
})();
