/**
 * 统一认证验证工具类
 * 整合权限检查和认证逻辑，减少代码重复
 */

const ErrorHandler = require('./ErrorHandler');

class AuthValidator {
    constructor(database) {
        this.database = database;
    }

    /**
     * 验证用户是否为超级管理员
     * @param {Object} user - 用户对象
     * @returns {boolean} - 是否为超级管理员
     */
    isSuperAdmin(user) {
        return user && user.role === 'super_admin';
    }

    /**
     * 验证用户是否为店铺拥有者
     * @param {Object} user - 用户对象
     * @param {string} shopId - 店铺ID
     * @returns {Promise<boolean>} - 是否为店铺拥有者
     */
    async isShopOwner(user, shopId) {
        if (!user || !shopId) return false;
        
        try {
            const userShops = await this.database.getUserShops(user.id);
            const shop = userShops.find(s => s.id === shopId);
            return shop && shop.role === 'owner';
        } catch (error) {
            console.error('检查店铺拥有者权限失败:', error);
            return false;
        }
    }

    /**
     * 验证用户是否为店铺管理员（包含拥有者）
     * @param {Object} user - 用户对象
     * @param {string} shopId - 店铺ID
     * @returns {Promise<boolean>} - 是否为店铺管理员
     */
    async isShopManager(user, shopId) {
        if (!user || !shopId) return false;
        
        try {
            const userShops = await this.database.getUserShops(user.id);
            const shop = userShops.find(s => s.id === shopId);
            return shop && ['owner', 'manager'].includes(shop.role);
        } catch (error) {
            console.error('检查店铺管理员权限失败:', error);
            return false;
        }
    }

    /**
     * 验证用户是否有店铺访问权限
     * @param {Object} user - 用户对象
     * @param {string} shopId - 店铺ID
     * @returns {Promise<boolean>} - 是否有访问权限
     */
    async hasShopAccess(user, shopId) {
        if (!user || !shopId) return false;
        
        // 超级管理员有所有权限
        if (this.isSuperAdmin(user)) return true;
        
        try {
            const userShops = await this.database.getUserShops(user.id);
            return userShops.some(s => s.id === shopId);
        } catch (error) {
            console.error('检查店铺访问权限失败:', error);
            return false;
        }
    }

    /**
     * 验证用户是否有特定权限
     * @param {Object} user - 用户对象
     * @param {string} shopId - 店铺ID
     * @param {string} permission - 权限名称
     * @returns {Promise<boolean>} - 是否有该权限
     */
    async hasPermission(user, shopId, permission) {
        if (!user || !shopId || !permission) return false;
        
        // 超级管理员有所有权限
        if (this.isSuperAdmin(user)) return true;
        
        try {
            const userShops = await this.database.getUserShops(user.id);
            const shop = userShops.find(s => s.id === shopId);
            return shop && shop.permissions && shop.permissions.includes(permission);
        } catch (error) {
            console.error('检查特定权限失败:', error);
            return false;
        }
    }

    /**
     * 统一的权限验证中间件工厂
     * @param {string} requiredRole - 必需的角色 ('super_admin', 'shop_owner', 'shop_manager', 'shop_member')
     * @param {string} permission - 特定权限（可选）
     * @returns {Function} - Express中间件函数
     */
    createPermissionMiddleware(requiredRole, permission = null) {
        return async (req, res, next) => {
            try {
                const user = req.user;
                if (!user) {
                    return ErrorHandler.sendError(res, 'UNAUTHORIZED', '用户未登录');
                }

                let hasAccess = false;
                const shopId = req.params.shopId || req.body.shopId;

                switch (requiredRole) {
                    case 'super_admin':
                        hasAccess = this.isSuperAdmin(user);
                        break;
                        
                    case 'shop_owner':
                        if (!shopId) {
                            return ErrorHandler.sendError(res, 'MISSING_SHOP_ID', '缺少店铺ID');
                        }
                        hasAccess = await this.isShopOwner(user, shopId);
                        break;
                        
                    case 'shop_manager':
                        if (!shopId) {
                            return ErrorHandler.sendError(res, 'MISSING_SHOP_ID', '缺少店铺ID');
                        }
                        hasAccess = await this.isShopManager(user, shopId);
                        break;
                        
                    case 'shop_member':
                        if (!shopId) {
                            return ErrorHandler.sendError(res, 'MISSING_SHOP_ID', '缺少店铺ID');
                        }
                        hasAccess = await this.hasShopAccess(user, shopId);
                        break;
                        
                    default:
                        return ErrorHandler.sendError(res, 'INVALID_ROLE_CONFIG', '无效的角色配置');
                }

                // 检查特定权限
                if (hasAccess && permission && !this.isSuperAdmin(user)) {
                    hasAccess = await this.hasPermission(user, shopId, permission);
                }

                if (!hasAccess) {
                    return ErrorHandler.sendError(res, 'PERMISSION_DENIED', '权限不足');
                }

                next();
            } catch (error) {
                console.error('权限验证失败:', error);
                ErrorHandler.sendError(res, 'PERMISSION_CHECK_FAILED', '权限验证失败');
            }
        };
    }

    /**
     * 快捷方法：超级管理员权限验证
     */
    requireSuperAdmin() {
        return this.createPermissionMiddleware('super_admin');
    }

    /**
     * 快捷方法：店铺拥有者权限验证
     */
    requireShopOwner() {
        return this.createPermissionMiddleware('shop_owner');
    }

    /**
     * 快捷方法：店铺管理员权限验证
     */
    requireShopManager() {
        return this.createPermissionMiddleware('shop_manager');
    }

    /**
     * 快捷方法：店铺成员权限验证
     */
    requireShopMember() {
        return this.createPermissionMiddleware('shop_member');
    }

    /**
     * 快捷方法：特定权限验证
     * @param {string} permission - 权限名称
     */
    requirePermission(permission) {
        return this.createPermissionMiddleware('shop_member', permission);
    }

    /**
     * 验证用户输入数据
     * @param {Object} data - 待验证的数据
     * @param {Object} rules - 验证规则
     * @returns {Object} - 验证结果 {isValid: boolean, errors: Array}
     */
    validateInput(data, rules) {
        const errors = [];
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = data[field];
            
            // 必填字段检查
            if (rule.required && (!value || value.toString().trim() === '')) {
                errors.push(`${rule.name || field}为必填项`);
                continue;
            }
            
            // 如果字段为空且非必填，跳过其他验证
            if (!value) continue;
            
            // 类型检查
            if (rule.type) {
                switch (rule.type) {
                    case 'email':
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                            errors.push(`${rule.name || field}格式不正确`);
                        }
                        break;
                    case 'phone':
                        if (!/^1[3-9]\d{9}$/.test(value)) {
                            errors.push(`${rule.name || field}格式不正确`);
                        }
                        break;
                    case 'url':
                        try {
                            new URL(value);
                        } catch {
                            errors.push(`${rule.name || field}格式不正确`);
                        }
                        break;
                }
            }
            
            // 长度检查
            if (rule.minLength && value.length < rule.minLength) {
                errors.push(`${rule.name || field}长度不能少于${rule.minLength}个字符`);
            }
            if (rule.maxLength && value.length > rule.maxLength) {
                errors.push(`${rule.name || field}长度不能超过${rule.maxLength}个字符`);
            }
            
            // 枚举值检查
            if (rule.enum && !rule.enum.includes(value)) {
                errors.push(`${rule.name || field}值不在允许范围内`);
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 数据验证中间件工厂
     * @param {Object} rules - 验证规则
     * @returns {Function} - Express中间件函数
     */
    createValidationMiddleware(rules) {
        return (req, res, next) => {
            const validation = this.validateInput(req.body, rules);
            
            if (!validation.isValid) {
                return ErrorHandler.sendError(res, 'VALIDATION_FAILED', validation.errors.join('; '));
            }
            
            next();
        };
    }
}

module.exports = AuthValidator;