/**
 * 移动端管理后台模块初始化
 * 从admin-mobile.html中提取的模块初始化和店铺管理JavaScript代码
 */

// 初始化新的模块化系统
window.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀🚀🚀 DOMContentLoaded 事件触发 - 版本4.0（多店铺客服） 🚀🚀🚀');
    
    // 初始化店铺管理器
    if (typeof MobileShopManager !== 'undefined') {
        console.log('🏪 初始化模块化店铺管理器');
        window.mobileShopManager = new MobileShopManager();
    }
    
    // 🔄 优先使用新的多店铺客服系统
    if (typeof MultiShopCustomerServiceManager !== 'undefined') {
        console.log('🎯 初始化多店铺电商客服系统');
        window.customerServiceManager = new MultiShopCustomerServiceManager();
    } else {
        // 备用：使用原有的消息管理器
        if (typeof MobileMessageManager !== 'undefined') {
            console.log('💬 初始化模块化消息管理器（备用）');
            window.messageManager = new MobileMessageManager();
        }
    }
        
    // 确保用户已登录后再初始化所有模块
    const checkAndInitAll = async () => {
        const sessionId = localStorage.getItem('sessionId');
        console.log('🔍 检查会话状态:', sessionId ? '有会话' : '无会话');
        
        if (sessionId) {
            console.log('🔄 用户已登录，开始初始化所有模块...');
            try {
                // 初始化店铺管理器
                if (window.mobileShopManager) {
                    await window.mobileShopManager.init();
                    console.log('✅ 店铺管理器初始化完成');
                }
                
                // 🎯 优先初始化多店铺客服系统
                if (window.customerServiceManager) {
                    await window.customerServiceManager.init();
                    console.log('✅ 多店铺客服系统初始化完成');
                } else if (window.messageManager) {
                    // 备用：初始化原有消息管理器
                    await window.messageManager.init();
                    console.log('✅ 消息管理器初始化完成（备用）');
                }
                
            } catch (error) {
                console.error('❌ 模块初始化失败:', error);
            }
        } else {
            console.log('⏰ 等待用户登录...');
            // 如果没有会话，等待一段时间后重试
            setTimeout(checkAndInitAll, 1000);
        }
    };
        
    await checkAndInitAll();
});

// 店铺管理相关类
class ShopManagementManager {
    constructor() {
        this.currentManageShopId = null;
    }

    openShopManageModal(shopId) {
        console.log('🏪 打开店铺管理模态框:', shopId);
        this.currentManageShopId = shopId;
        
        // 找到对应的店铺信息
        const shop = currentShops.find(s => s.id == shopId);
        if (shop) {
            document.getElementById('shopManageTitle').textContent = `🏪 ${shop.name} - 店铺管理`;
        }
        
        // 显示模态框
        document.getElementById('shopManageModal').style.display = 'block';
        
        // 默认显示员工管理标签
        this.showShopTab('employees');
    }

    closeShopManageModal() {
        document.getElementById('shopManageModal').style.display = 'none';
        this.currentManageShopId = null;
    }

    showShopTab(tabName) {
        console.log('🔄 切换到标签页:', tabName);
        
        // 隐藏所有标签内容
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });
        
        // 移除所有标签按钮的活动状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 显示对应的标签内容
        const targetTab = document.getElementById(tabName + 'Tab');
        if (targetTab) {
            targetTab.classList.add('active');
            targetTab.style.display = 'block';
        }
        
        // 激活对应的标签按钮
        const targetBtn = document.querySelector(`[onclick="showShopTab('${tabName}')"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
        
        // 根据标签页加载对应的数据
        if (tabName === 'employees' && this.currentManageShopId) {
            this.loadEmployees(this.currentManageShopId);
        } else if (tabName === 'settings' && this.currentManageShopId) {
            this.loadShopSettings(this.currentManageShopId);
        }
    }

    async loadEmployees(shopId) {
        console.log('👥 加载店铺员工列表:', shopId);
        const employeesList = document.getElementById('employeesList');
        employeesList.innerHTML = '<div class="loading">正在加载员工列表...</div>';

        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch(`/api/shops/${shopId}/employees`, {
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                const employees = await response.json();
                console.log('📋 员工数据:', employees);
                this.renderEmployees(employees);
            } else {
                throw new Error('获取员工列表失败: ' + response.status);
            }
        } catch (error) {
            console.error('❌ 加载员工失败:', error);
            employeesList.innerHTML = '<div class="error">加载员工列表失败</div>';
        }
    }

    async loadShopSettings(shopId) {
        console.log('⚙️ 加载店铺设置:', shopId);
        
        try {
            // 先从当前店铺列表中获取数据
            const shop = currentShops.find(s => s.id == shopId);
            if (shop) {
                console.log('📋 从缓存加载店铺数据:', shop);
                document.getElementById('shopName').value = shop.name || '';
                document.getElementById('shopDomain').value = shop.domain || '';
                document.getElementById('shopDescription').value = shop.description || '';
                return;
            }
            
            // 如果缓存中没有，从服务器获取
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch(`/api/shops/${shopId}`, {
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                const shopData = await response.json();
                console.log('📋 从服务器加载店铺数据:', shopData);
                document.getElementById('shopName').value = shopData.name || '';
                document.getElementById('shopDomain').value = shopData.domain || '';
                document.getElementById('shopDescription').value = shopData.description || '';
            } else {
                throw new Error('获取店铺信息失败: ' + response.status);
            }
        } catch (error) {
            console.error('❌ 加载店铺设置失败:', error);
            alert('加载店铺设置失败: ' + error.message);
        }
    }

    renderEmployees(employees) {
        const employeesList = document.getElementById('employeesList');
        
        if (employees.length === 0) {
            employeesList.innerHTML = '<div class="empty-state">暂无员工</div>';
            return;
        }

        const html = employees.map(employee => `
            <div class="employee-item">
                <div class="employee-info">
                    <div class="employee-name">${employee.username}</div>
                    <div class="employee-role">${this.getRoleText(employee.role)}</div>
                </div>
                <div class="employee-actions">
                    <button class="btn btn-small" onclick="shopManagementManager.editEmployee('${employee.id}')">编辑</button>
                    <button class="btn btn-small btn-secondary" onclick="shopManagementManager.removeEmployee('${employee.id}')">移除</button>
                </div>
            </div>
        `).join('');

        employeesList.innerHTML = html;
    }

    getRoleText(role) {
        const roleMap = {
            'owner': '店主',
            'manager': '经理',
            'staff': '员工'
        };
        return roleMap[role] || role;
    }

    showAddEmployeeForm() {
        document.getElementById('addEmployeeForm').style.display = 'block';
    }

    hideAddEmployeeForm() {
        document.getElementById('addEmployeeForm').style.display = 'none';
        // 清空表单
        document.getElementById('addEmployeeForm').querySelector('form').reset();
    }

    async addEmployee(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const employeeData = {
            username: formData.get('employeeUsername'),
            email: formData.get('employeeEmail'),
            password: formData.get('employeePassword'),
            role: formData.get('employeeRole')
        };

        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch(`/api/shops/${this.currentManageShopId}/employees`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': sessionId
                },
                body: JSON.stringify(employeeData)
            });

            if (response.ok) {
                console.log('✅ 员工添加成功');
                this.hideAddEmployeeForm();
                this.loadEmployees(this.currentManageShopId); // 重新加载员工列表
            } else {
                throw new Error('添加员工失败: ' + response.status);
            }
        } catch (error) {
            console.error('❌ 添加员工失败:', error);
            alert('添加员工失败: ' + error.message);
        }
    }

    async saveShopSettings() {
        if (!this.currentManageShopId) return;

        const shopData = {
            name: document.getElementById('shopName').value,
            domain: document.getElementById('shopDomain').value,
            description: document.getElementById('shopDescription').value
        };

        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch(`/api/shops/${this.currentManageShopId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': sessionId
                },
                body: JSON.stringify(shopData)
            });

            if (response.ok) {
                console.log('✅ 店铺设置保存成功');
                
                // 更新本地缓存中的店铺信息
                const shopIndex = currentShops.findIndex(s => s.id == this.currentManageShopId);
                if (shopIndex >= 0) {
                    currentShops[shopIndex] = { 
                        ...currentShops[shopIndex], 
                        ...shopData 
                    };
                    console.log('🔄 已更新本地店铺缓存');
                }
                
                // 更新模态框标题
                document.getElementById('shopManageTitle').textContent = `🏪 ${shopData.name} - 店铺管理`;
                
                alert('店铺设置保存成功！');
                
                // 重新加载店铺列表以确保数据同步
                if (window.mobileShopManager) {
                    await window.mobileShopManager.loadShops();
                }
            } else {
                throw new Error('保存设置失败: ' + response.status);
            }
        } catch (error) {
            console.error('❌ 保存设置失败:', error);
            alert('保存设置失败: ' + error.message);
        }
    }

    async editEmployee(employeeId) {
        console.log('✏️ 编辑员工:', employeeId);
        // TODO: 实现员工编辑功能
        alert('员工编辑功能开发中...');
    }

    async removeEmployee(employeeId) {
        if (!confirm('确定要移除这个员工吗？')) return;

        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await fetch(`/api/shops/${this.currentManageShopId}/employees/${employeeId}`, {
                method: 'DELETE',
                headers: { 'X-Session-Id': sessionId }
            });

            if (response.ok) {
                console.log('✅ 员工移除成功');
                this.loadEmployees(this.currentManageShopId); // 重新加载员工列表
            } else {
                throw new Error('移除员工失败: ' + response.status);
            }
        } catch (error) {
            console.error('❌ 移除员工失败:', error);
            alert('移除员工失败: ' + error.message);
        }
    }
}

// 创建全局实例
const shopManagementManager = new ShopManagementManager();

// 全局函数（保持向后兼容）
function openShopManageModal(shopId) {
    shopManagementManager.openShopManageModal(shopId);
}

function closeShopManageModal() {
    shopManagementManager.closeShopManageModal();
}

function showShopTab(tabName) {
    shopManagementManager.showShopTab(tabName);
}

function loadEmployees(shopId) {
    return shopManagementManager.loadEmployees(shopId);
}

function loadShopSettings(shopId) {
    return shopManagementManager.loadShopSettings(shopId);
}

function showAddEmployeeForm() {
    shopManagementManager.showAddEmployeeForm();
}

function hideAddEmployeeForm() {
    shopManagementManager.hideAddEmployeeForm();
}

function addEmployee(event) {
    return shopManagementManager.addEmployee(event);
}

function saveShopSettings() {
    return shopManagementManager.saveShopSettings();
}

function editEmployee(employeeId) {
    return shopManagementManager.editEmployee(employeeId);
}

function removeEmployee(employeeId) {
    return shopManagementManager.removeEmployee(employeeId);
}

function showIntegrationCode(shopId, shopName) {
    // 使用统一的IntegrationManager代替Legacy版本
    if (window.integrationManager) {
        window.integrationManager.generateCode(shopId, { mobile: true });
    } else {
        console.warn('IntegrationManager not available');
    }
}

function copyIntegrationCode() {
    // 功能已由IntegrationManager内部处理
    console.warn('copyIntegrationCode: 功能已集成到IntegrationManager中');
}

function regenerateApiKey() {
    // 功能已由IntegrationManager内部处理
    console.warn('regenerateApiKey: 功能已集成到IntegrationManager中');
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// 点击模态框外部关闭
window.onclick = function(event) {
    const shopModal = document.getElementById('shopManageModal');
    if (event.target === shopModal) {
        closeShopManageModal();
    }
};

// 全局导出
window.ShopManagementManager = ShopManagementManager;
window.shopManagementManager = shopManagementManager;

console.log('📱 [MobileAdminModules] 移动端管理后台模块初始化器已加载');