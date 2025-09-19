/**
 * Ruilong版本 - 角色权限控制模块
 * 统一管理用户角色检测和权限验证
 */

class RuilongRoleManager {
    
    /**
     * 获取用户在指定店铺中的角色
     * @param {string} userId - 用户ID
     * @param {Object} shop - 店铺对象
     * @returns {string} - 角色类型 (owner/manager/employee/member)
     */
    static getUserRoleInShop(userId, shop) {
        if (!userId || !shop) {
            console.warn('🔍 [Ruilong] 角色检测参数不完整:', { userId, shop });
            return 'member';
        }
        
        try {
            // 1. 检查是否为店主
            if (shop.ownerId === userId || shop.owner_id === userId) {
                console.log('👑 [Ruilong] 检测到店主角色:', { userId, shopId: shop.id });
                return 'owner';
            }
            
            // 2. 检查管理员角色
            if (shop.managers && Array.isArray(shop.managers)) {
                const isManager = shop.managers.some(manager => 
                    (typeof manager === 'string' && manager === userId) ||
                    (typeof manager === 'object' && manager.userId === userId)
                );
                if (isManager) {
                    console.log('👨‍💼 [Ruilong] 检测到经理角色:', { userId, shopId: shop.id });
                    return 'manager';
                }
            }
            
            // 3. 检查员工角色
            if (shop.employees && Array.isArray(shop.employees)) {
                const isEmployee = shop.employees.some(employee => 
                    (typeof employee === 'string' && employee === userId) ||
                    (typeof employee === 'object' && employee.userId === userId)
                );
                if (isEmployee) {
                    console.log('👷 [Ruilong] 检测到员工角色:', { userId, shopId: shop.id });
                    return 'employee';
                }
            }
            
            // 4. 检查shop_users表中的角色
            if (shop.userRole) {
                console.log('📋 [Ruilong] 使用数据库角色:', { 
                    userId, 
                    shopId: shop.id, 
                    role: shop.userRole 
                });
                return shop.userRole;
            }
            
            // 5. 默认为普通成员
            console.log('👤 [Ruilong] 默认普通成员角色:', { userId, shopId: shop.id });
            return 'member';
            
        } catch (error) {
            console.error('❌ [Ruilong] 角色检测异常:', error);
            return 'member';
        }
    }
    
    /**
     * 获取角色的中文显示文本
     * @param {string} role - 角色英文名
     * @returns {string} - 角色中文名
     */
    static getRoleText(role) {
        const roleMap = {
            'owner': '店主',
            'manager': '经理', 
            'employee': '员工',
            'member': '成员',
            'admin': '管理员'
        };
        
        return roleMap[role] || '未知';
    }
    
    /**
     * 获取角色的图标
     * @param {string} role - 角色英文名
     * @returns {string} - 角色图标
     */
    static getRoleIcon(role) {
        const iconMap = {
            'owner': '👑',
            'manager': '👨‍💼',
            'employee': '👷',
            'member': '👤',
            'admin': '🔧'
        };
        
        return iconMap[role] || '👤';
    }
    
    /**
     * 获取角色的CSS类名
     * @param {string} role - 角色英文名
     * @returns {string} - CSS类名
     */
    static getRoleClass(role) {
        const classMap = {
            'owner': 'role-owner',
            'manager': 'role-manager',
            'employee': 'role-employee',
            'member': 'role-member',
            'admin': 'role-admin'
        };
        
        return classMap[role] || 'role-default';
    }
    
    /**
     * 检查用户是否有指定权限
     * @param {string} role - 用户角色
     * @param {string} permission - 权限名称
     * @returns {boolean} - 是否有权限
     */
    static hasPermission(role, permission) {
        const permissions = {
            'owner': [
                'manage_shop', 'edit_shop', 'delete_shop', 'view_messages', 
                'reply_messages', 'manage_employees', 'view_analytics', 
                'generate_code', 'renew_shop', 'pay_activation'
            ],
            'manager': [
                'view_messages', 'reply_messages', 'view_analytics', 
                'generate_code', 'manage_employees'
            ],
            'employee': [
                'view_messages', 'reply_messages'
            ],
            'member': [
                'view_public'
            ],
            'admin': [
                'all_permissions'
            ]
        };
        
        const rolePermissions = permissions[role] || [];
        return rolePermissions.includes(permission) || rolePermissions.includes('all_permissions');
    }
    
    /**
     * 检查操作权限并执行
     * @param {string} role - 用户角色
     * @param {string} permission - 所需权限
     * @param {Function} callback - 权限通过后执行的回调
     * @param {Function} failCallback - 权限不足时的回调
     */
    static checkPermissionAndExecute(role, permission, callback, failCallback) {
        if (this.hasPermission(role, permission)) {
            console.log('✅ [Ruilong] 权限验证通过:', { role, permission });
            if (typeof callback === 'function') {
                callback();
            }
        } else {
            console.warn('❌ [Ruilong] 权限不足:', { role, permission });
            if (typeof failCallback === 'function') {
                failCallback();
            } else {
                this.showPermissionDeniedMessage(permission);
            }
        }
    }
    
    /**
     * 显示权限不足提示
     * @param {string} permission - 权限名称
     */
    static showPermissionDeniedMessage(permission) {
        const permissionNames = {
            'manage_shop': '管理店铺',
            'edit_shop': '编辑店铺',
            'delete_shop': '删除店铺',
            'view_messages': '查看消息',
            'reply_messages': '回复消息',
            'manage_employees': '管理员工',
            'view_analytics': '查看统计',
            'generate_code': '生成代码',
            'renew_shop': '续费店铺',
            'pay_activation': '付费激活'
        };
        
        const permissionText = permissionNames[permission] || permission;
        alert(`❌ 权限不足\n\n您没有"${permissionText}"的权限，请联系店主或管理员。`);
    }
    
    /**
     * 获取角色的优先级（用于排序）
     * @param {string} role - 角色名称
     * @returns {number} - 优先级数值，越大权限越高
     */
    static getRolePriority(role) {
        const priorities = {
            'admin': 100,
            'owner': 90,
            'manager': 80,
            'employee': 70,
            'member': 60
        };
        
        return priorities[role] || 0;
    }
    
    /**
     * 批量检查用户角色
     * @param {string} userId - 用户ID
     * @param {Array} shops - 店铺列表
     * @returns {Object} - 角色映射对象 {shopId: role}
     */
    static batchCheckUserRoles(userId, shops) {
        const roleMap = {};
        
        if (!Array.isArray(shops)) {
            console.warn('🔍 [Ruilong] 店铺列表格式错误');
            return roleMap;
        }
        
        shops.forEach(shop => {
            if (shop && shop.id) {
                roleMap[shop.id] = this.getUserRoleInShop(userId, shop);
            }
        });
        
        console.log('📊 [Ruilong] 批量角色检测结果:', roleMap);
        return roleMap;
    }
}

// 全局注册模块
window.RuilongRoleManager = RuilongRoleManager;

console.log('🔐 [Ruilong] 角色权限模块已加载');