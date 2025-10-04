"use strict";

/**
 * 员工管理模态框功能
 * 提供员工的添加、删除、角色变更等管理操作
 */

// 全局变量
let currentShopId = null;
let employeesData = [];

/**
 * 打开员工管理模态框
 */
function openEmployeeManagement(shopId) {
    currentShopId = shopId;
    console.log('打开员工管理:', shopId);
    
    // 清空表单
    const emailInput = document.getElementById('employee-email');
    const roleSelect = document.getElementById('employee-role');
    if (emailInput) emailInput.value = '';
    if (roleSelect) roleSelect.value = 'agent';
    
    // 加载员工列表
    loadEmployees(shopId);
    
    // 打开模态框
    if (typeof openModal === 'function') {
        openModal('employee-management-modal');
    }
}

/**
 * 加载员工列表
 */
async function loadEmployees(shopId) {
    try {
        showLoading('正在加载员工列表...');
        
        const response = await fetch(`/api/shops/${shopId}/employees`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            employeesData = data.employees || [];
            displayEmployees(employeesData);
        } else {
            console.error('加载员工列表失败');
            displayEmployees([]);
            showToast('加载员工列表失败', 'error');
        }
    } catch (error) {
        console.error('加载员工列表错误:', error);
        displayEmployees([]);
        showToast('网络错误，请重试', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * 显示员工列表
 */
function displayEmployees(employees) {
    const container = document.getElementById('employees-list');
    if (!container) return;

    if (employees.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <div class="empty-text">暂无员工</div>
                <div class="empty-subtext">添加第一个员工开始管理团队</div>
            </div>
        `;
        return;
    }

    container.innerHTML = employees.map(employee => `
        <div class="employee-item">
            <div class="employee-info">
                <div class="employee-avatar">
                    <span class="avatar-text">${getEmployeeInitials(employee.name || employee.email)}</span>
                </div>
                <div class="employee-details">
                    <div class="employee-name">${employee.name || employee.email}</div>
                    <div class="employee-role">${getRoleName(employee.role)}</div>
                    <div class="employee-meta">
                        <span class="employee-status status-${employee.status || 'offline'}">${getStatusName(employee.status)}</span>
                        <span class="employee-join-date">加入于 ${formatDate(employee.joinedAt || employee.created_at)}</span>
                    </div>
                </div>
            </div>
            <div class="employee-actions">
                <button class="btn btn-small btn-secondary" onclick="changeEmployeeRole('${employee.id}', '${employee.role}')" title="变更角色">
                    🔄
                </button>
                <button class="btn btn-small btn-danger" onclick="removeEmployee('${employee.id}')" title="移除员工">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * 添加员工
 */
async function addEmployee() {
    const email = document.getElementById('employee-email').value.trim();
    const role = document.getElementById('employee-role').value;

    if (!email) {
        showToast('请输入员工邮箱', 'error');
        return;
    }

    if (!isValidEmail(email)) {
        showToast('请输入有效的邮箱地址', 'error');
        return;
    }

    try {
        showLoading('正在添加员工...');
        
        const response = await fetch(`/api/shops/${currentShopId}/employees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                email,
                role
            })
        });

        if (response.ok) {
            showToast('员工已添加', 'success');
            document.getElementById('employee-email').value = '';
            await loadEmployees(currentShopId);
        } else {
            const error = await response.json();
            showToast(error.message || '添加员工失败', 'error');
        }
    } catch (error) {
        console.error('添加员工失败:', error);
        showToast('网络错误，请重试', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * 变更员工角色
 */
async function changeEmployeeRole(employeeId, currentRole) {
    const roles = [
        { value: 'manager', label: '经理' },
        { value: 'agent', label: '客服专员' },
        { value: 'viewer', label: '观察员' }
    ];
    
    const otherRoles = roles.filter(r => r.value !== currentRole);
    const newRoleIndex = prompt(
        `当前角色: ${getRoleName(currentRole)}\n\n请选择新角色:\n${otherRoles.map((r, i) => `${i + 1}. ${r.label}`).join('\n')}`,
        '1'
    );

    if (!newRoleIndex || newRoleIndex < '1' || newRoleIndex > otherRoles.length.toString()) {
        return;
    }

    const selectedRole = otherRoles[parseInt(newRoleIndex) - 1].value;
    
    try {
        showLoading('正在更新员工角色...');
        
        const response = await fetch(`/api/shops/${currentShopId}/employees/${employeeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                role: selectedRole
            })
        });

        if (response.ok) {
            showToast('员工角色已更新', 'success');
            await loadEmployees(currentShopId);
        } else {
            const error = await response.json();
            showToast(error.message || '更新角色失败', 'error');
        }
    } catch (error) {
        console.error('更新员工角色失败:', error);
        showToast('网络错误，请重试', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * 移除员工
 */
async function removeEmployee(employeeId) {
    const employee = employeesData.find(e => e.id === employeeId);
    const employeeName = employee?.name || employee?.email || '该员工';
    
    if (!confirm(`确定要移除员工"${employeeName}"吗？`)) {
        return;
    }

    try {
        showLoading('正在移除员工...');
        
        const response = await fetch(`/api/shops/${currentShopId}/employees/${employeeId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (response.ok) {
            showToast('员工已移除', 'success');
            await loadEmployees(currentShopId);
        } else {
            const error = await response.json();
            showToast(error.message || '移除员工失败', 'error');
        }
    } catch (error) {
        console.error('移除员工失败:', error);
        showToast('网络错误，请重试', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * 工具函数
 */

// 获取角色名称
function getRoleName(role) {
    const roleNames = {
        'manager': '经理',
        'agent': '客服专员',
        'viewer': '观察员',
        'admin': '管理员'
    };
    return roleNames[role] || role;
}

// 获取状态名称
function getStatusName(status) {
    const statusNames = {
        'online': '在线',
        'offline': '离线',
        'busy': '忙碌',
        'away': '离开'
    };
    return statusNames[status] || '离线';
}

// 获取员工姓名首字母
function getEmployeeInitials(name) {
    if (!name) return '?';
    
    if (name.includes('@')) {
        // 如果是邮箱，取@前的部分
        name = name.split('@')[0];
    }
    
    const parts = name.split(/[\s._-]+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length >= 2) {
        return parts[0].substring(0, 2).toUpperCase();
    } else {
        return parts[0][0].toUpperCase();
    }
}

// 验证邮箱格式
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// 格式化日期
function formatDate(dateString) {
    if (!dateString) return '未知';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return '未知';
    }
}

// 获取授权token
function getAuthToken() {
    return localStorage.getItem('authToken') || '';
}