// 检查是否可以管理员工
function canManageEmployees() {
	const user = getUserData();
	if (!user) {
		console.warn('ℹ️ 用户数据为空，无法管理员工');
		return false;
	}
	// 超级管理员可以管理所有店铺的员工
	if (user.role === 'super_admin') {
		console.log('👑 超级管理员，可管理所有店铺员工');
		return true;
	}
	// 对于普通用户，只能管理自己创建的店铺的员工
	// 这个检查在openEmployeeManagement函数中进行，需要结合店铺所有者信息
	console.log(`💼 普通用户(${user.role})，需要验证店铺所有权`);
	return true; // 在这里返回true，具体权限在openEmployeeManagement中检查
}

// 获取用户数据
function getUserData() {
	// 优先返回全局变量userData（如果存在）
	if (typeof userData !== 'undefined' && userData) {
		return userData;
	}
	// 如果全局变量为空，尝试从 localStorage 获取
	try {
		const savedUser = localStorage.getItem('userData');
		if (savedUser) {
			const user = JSON.parse(savedUser);
			console.log('💾 从 localStorage 获取用户数据:', user);
			return user;
		}
	} catch (error) {
		console.error('❌ 解析 localStorage 中的用户数据失败:', error);
	}
	// 如果都没有，返回默认值
	console.warn('⚠️ 未找到用户数据，返回默认值');
	return {
		id: null,
		username: 'unknown',
		role: 'guest'
	};
}

// 员工管理
function manageShopEmployees() {
	if (!window.currentShopId) {
		showToast('请先选择一个店铺', 'error');
		return;
	}
	showToast('员工管理功能开发中...', 'info');
	// TODO: 实现员工管理功能
}

// ========== 员工管理表单/列表相关函数已合并 ==========
// 依赖：currentShopId, showToast, getAuthToken, safeJson, getRoleName, loadEmployeesList

// showAddEmployeeForm, cancelAddEmployee, addEmployee
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

// loadEmployeesList, editEmployee, removeEmployee
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
						<button class="btn btn-small btn-danger" onclick="removeEmployee('${e.id}', '${(e.name||e.email||'').replace(/'/g, "&#39;")}")">移除</button>
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
			toast('员工已移除', 'success');
			if (typeof window.loadEmployeesList === 'function') await window.loadEmployeesList();
		} catch (e) {
			console.error('移除员工失败:', e);
			toast(e.message || '移除员工失败，请重试', 'error');
		}
	};
})();
