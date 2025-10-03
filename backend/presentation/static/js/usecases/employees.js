// employees.js — 员工管理入口用例（从 mobile-dashboard.html 抽取）
// 提供：showAddEmployeeForm, cancelAddEmployee, addEmployee
// 依赖（全局）：currentShopId, showToast, safeJson, loadEmployeesList

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

  // 展示添加员工表单
  window.showAddEmployeeForm = function showAddEmployeeForm() {
    try {
      const form = document.getElementById('addEmployeeForm');
      if (form) {
        form.style.display = 'block';
        const input = document.getElementById('employeeUsername');
        if (input) input.focus();
      }
    } catch (e) {
      console.error('showAddEmployeeForm error:', e);
    }
  };

  // 取消并重置添加员工表单
  window.cancelAddEmployee = function cancelAddEmployee() {
    try {
      const form = document.getElementById('addEmployeeForm');
      if (form) {
        form.style.display = 'none';
        const f = document.getElementById('addEmployeeFormData');
        if (f && typeof f.reset === 'function') f.reset();
      }
    } catch (e) {
      console.error('cancelAddEmployee error:', e);
    }
  };

  // 提交添加员工
  window.addEmployee = async function addEmployee(event) {
    try {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();

      const shopId = typeof window !== 'undefined' ? window.currentShopId : null;
      if (!shopId) { toast('请先选择一个店铺', 'error'); return false; }

      const username = (document.getElementById('employeeUsername')?.value || '').trim();
      const role = 'employee';
      if (!username) { toast('请输入用户名', 'error'); return false; }

      toast('正在添加员工...', 'info');

      const email = username.includes('@') ? username : `${username}@example.com`;

      const resp = await fetch(`/api/shops/${shopId}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role })
      });

      if (!resp.ok) {
        const sj = (typeof window !== 'undefined' && typeof window.safeJson === 'function') ? window.safeJson : safeJsonFallback;
        const err = await sj(resp);
        throw new Error(err?.message || `添加失败 (${resp.status})`);
      }

      toast(`成功添加员工 ${username}`, 'success');
      if (typeof window.cancelAddEmployee === 'function') window.cancelAddEmployee();
      if (typeof window.loadEmployeesList === 'function') await window.loadEmployeesList();
      return false;
    } catch (e) {
      console.error('添加员工失败:', e);
      toast(e.message || '添加员工失败，请重试', 'error');
      return false;
    }
  };
})();
