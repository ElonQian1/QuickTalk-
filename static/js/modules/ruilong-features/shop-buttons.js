/**
 * Ruilong版本 - 店铺按钮渲染模块
 * 负责根据用户角色和店铺状态动态生成按钮
 * 避免与elon版本的基础店铺功能冲突
 */

class RuilongShopButtons {
    
    /**
     * 渲染店铺操作按钮（ruilong增强版本）
     * @param {Object} shop - 店铺数据
     * @param {string} userRole - 用户在店铺中的角色
     * @returns {string} - 按钮HTML
     */
    static renderShopButtons(shop, userRole) {
        const approvalStatus = shop.approval_status || shop.approvalStatus;
        
        console.log('🔍 [Ruilong] 店铺按钮渲染:', {
            shopName: shop.name,
            approval_status: shop.approval_status,
            approvalStatus: shop.approvalStatus,
            finalStatus: approvalStatus,
            userRole: userRole
        });
        
        // 已批准状态的按钮
        if (approvalStatus === 'approved') {
            return this.renderApprovedButtons(shop, userRole);
        }
        
        // 待审核状态的按钮
        if (approvalStatus === 'pending') {
            return this.renderPendingButtons(shop, userRole);
        }
        
        // 已拒绝状态的按钮
        if (approvalStatus === 'rejected') {
            return this.renderRejectedButtons(shop, userRole);
        }
        
        // 其他状态的默认按钮
        return this.renderDefaultButtons(shop, userRole);
    }
    
    /**
     * 渲染已批准状态的按钮
     */
    static renderApprovedButtons(shop, userRole) {
        if (userRole === 'owner') {
            // 店主：显示所有管理按钮
            return `
                <button class="shop-btn primary" onclick="ShopManager.manageShop('${shop.id}')">管理</button>
                <button class="shop-btn success" onclick="MessageManager.viewShopConversations('${shop.id}')">💬 消息</button>
                <button class="shop-btn primary" onclick="RuilongMobile.viewShopMessages('${shop.id}')">📄 消息详情</button>
                <button class="shop-btn info" onclick="window.integrationManager.generateCode('${shop.id}')">📋 代码</button>
                <button class="shop-btn warning" onclick="RuilongMobile.editShopInfo('${shop.id}')">✏️ 编辑</button>
                <button class="shop-btn info" onclick="RuilongPayment.renewShop('${shop.id}')">🔄 续费</button>
            `;
        } else if (userRole === 'manager') {
            // 经理：显示部分管理按钮
            return `
                <button class="shop-btn success" onclick="MessageManager.viewShopConversations('${shop.id}')">💬 消息</button>
                <button class="shop-btn primary" onclick="RuilongMobile.viewShopMessages('${shop.id}')">📄 消息详情</button>
                <button class="shop-btn info" onclick="window.integrationManager.generateCode('${shop.id}')">📋 代码</button>
            `;
        } else if (userRole === 'employee') {
            // 员工：只显示消息相关按钮
            return `
                <button class="shop-btn success" onclick="MessageManager.viewShopConversations('${shop.id}')">💬 消息</button>
            `;
        } else {
            // 其他角色：基本查看权限
            return `
                <button class="shop-btn success" onclick="MessageManager.viewShopConversations('${shop.id}')">💬 消息</button>
            `;
        }
    }
    
    /**
     * 渲染待审核状态的按钮
     */
    static renderPendingButtons(shop, userRole) {
        if (userRole === 'owner') {
            // 店主可以付费开通、编辑、重新提交
            return `
                <button class="shop-btn warning" onclick="RuilongPayment.payToActivate('${shop.id}')">💰 付费开通</button>
                <button class="shop-btn secondary" onclick="RuilongMobile.editShopInfo('${shop.id}')">📝 编辑</button>
                <button class="shop-btn info" onclick="RuilongMobile.resubmitShop('${shop.id}')">🔄 重新提交</button>
            `;
        } else {
            // 非店主显示等待提示
            return `<div class="shop-pending-note">店铺审核中，请等待店主处理</div>`;
        }
    }
    
    /**
     * 渲染已拒绝状态的按钮
     */
    static renderRejectedButtons(shop, userRole) {
        if (userRole === 'owner') {
            // 店主可以重新编辑和提交
            return `
                <button class="shop-btn danger" onclick="RuilongMobile.editShopInfo('${shop.id}')">❌ 重新编辑</button>
                <button class="shop-btn info" onclick="RuilongMobile.resubmitShop('${shop.id}')">🔄 重新提交</button>
            `;
        } else {
            return `<div class="shop-rejected-note">店铺已被拒绝，请联系店主</div>`;
        }
    }
    
    /**
     * 渲染默认状态的按钮
     */
    static renderDefaultButtons(shop, userRole) {
        return `
            <button class="shop-btn secondary" onclick="ShopManager.manageShop('${shop.id}')">查看</button>
        `;
    }
    
    /**
     * 检查按钮功能是否可用
     */
    static checkButtonAvailability(shop, userRole, action) {
        const permissions = {
            'owner': ['manage', 'messages', 'code', 'edit', 'renew', 'pay'],
            'manager': ['messages', 'code', 'view'],
            'employee': ['messages'],
            'member': ['view']
        };
        
        return permissions[userRole]?.includes(action) || false;
    }
}

// 全局注册模块
window.RuilongShopButtons = RuilongShopButtons;

console.log('📦 [Ruilong] 店铺按钮模块已加载');