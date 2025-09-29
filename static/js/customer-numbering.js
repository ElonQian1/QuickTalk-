/**
 * 客户编号系统模块
 * 负责客户编号的生成、管理和显示
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-09-29
 */

class CustomerNumberingSystem {
    constructor() {
        this.storageKey = 'customer_number_map';
        this.counterKey = 'customer_number_counter';
        this.customerMap = this.loadCustomerMap();
        this.counter = this.loadCounter();
    }

    /**
     * 从localStorage加载客户编号映射
     * @returns {Object} 客户编号映射对象
     */
    loadCustomerMap() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('加载客户编号映射失败:', error);
            return {};
        }
    }

    /**
     * 从localStorage加载客户编号计数器
     * @returns {number} 当前计数器值
     */
    loadCounter() {
        try {
            const stored = localStorage.getItem(this.counterKey);
            return stored ? parseInt(stored, 10) : 0;
        } catch (error) {
            console.error('加载客户编号计数器失败:', error);
            return 0;
        }
    }

    /**
     * 保存客户编号映射到localStorage
     */
    saveCustomerMap() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.customerMap));
        } catch (error) {
            console.error('保存客户编号映射失败:', error);
        }
    }

    /**
     * 保存客户编号计数器到localStorage
     */
    saveCounter() {
        try {
            localStorage.setItem(this.counterKey, this.counter.toString());
        } catch (error) {
            console.error('保存客户编号计数器失败:', error);
        }
    }

    /**
     * 生成客户编号
     * @param {string} customerId 客户ID
     * @returns {string} 格式化的客户编号（如：客户001）
     */
    generateCustomerNumber(customerId) {
        if (!customerId) {
            console.warn('客户ID为空，无法生成编号');
            return '未知客户';
        }

        // 如果已存在编号，直接返回
        if (this.customerMap[customerId]) {
            return this.customerMap[customerId];
        }

        // 递增计数器，生成新编号（确保按访问顺序）
        this.counter++;
        const formattedNumber = `客户${String(this.counter).padStart(3, '0')}`;
        
        // 保存映射和计数器
        this.customerMap[customerId] = formattedNumber;
        this.saveCustomerMap();
        this.saveCounter();
        
        console.log(`为客户 ${customerId} 分配编号: ${formattedNumber} (第${this.counter}位访问者)`);
        return formattedNumber;
    }

    /**
     * 获取客户编号（不创建新编号）
     * @param {string} customerId 客户ID
     * @returns {string|null} 客户编号或null
     */
    getCustomerNumber(customerId) {
        return this.customerMap[customerId] || null;
    }

    /**
     * 获取客户编号的数字部分（用于头像等）
     * @param {string} customerId 客户ID
     * @returns {string} 编号数字部分（如：001）
     */
    getCustomerNumberDigits(customerId) {
        const number = this.getCustomerNumber(customerId);
        if (!number) return '000';
        
        const match = number.match(/\d+/);
        return match ? match[0] : '000';
    }

    /**
     * 获取所有客户编号映射
     * @returns {Object} 完整的客户编号映射
     */
    getAllCustomerNumbers() {
        return { ...this.customerMap };
    }

    /**
     * 清空所有客户编号映射
     */
    clearAllCustomerNumbers() {
        this.customerMap = {};
        this.counter = 0;
        this.saveCustomerMap();
        this.saveCounter();
        console.log('已清空所有客户编号映射和计数器');
    }

    /**
     * 获取客户总数
     * @returns {number} 已分配编号的客户总数
     */
    getCustomerCount() {
        return Object.keys(this.customerMap).length;
    }

    /**
     * 获取当前访问者计数
     * @returns {number} 当前计数器值（代表总访问者数量）
     */
    getTotalVisitorCount() {
        return this.counter;
    }

    /**
     * 批量导入客户编号映射
     * @param {Object} data 包含customerMap和counter的数据对象
     */
    importCustomerMap(data) {
        if (typeof data !== 'object' || data === null) {
            console.error('无效的客户编号数据');
            return;
        }

        // 导入映射表
        if (data.customerMap) {
            this.customerMap = { ...this.customerMap, ...data.customerMap };
        }

        // 导入计数器（确保不会重复编号）
        if (typeof data.counter === 'number' && data.counter > this.counter) {
            this.counter = data.counter;
        }

        this.saveCustomerMap();
        this.saveCounter();
        console.log('客户编号数据导入完成');
    }

    /**
     * 导出客户编号数据
     * @returns {string} JSON格式的完整数据（包含映射和计数器）
     */
    exportCustomerMap() {
        const data = {
            customerMap: this.customerMap,
            counter: this.counter,
            exportTime: new Date().toISOString(),
            totalVisitors: this.counter,
            activeCustomers: Object.keys(this.customerMap).length
        };
        return JSON.stringify(data, null, 2);
    }
}

// 创建全局实例
window.CustomerNumbering = new CustomerNumberingSystem();

// 向后兼容的全局函数
window.generateCustomerNumber = function(customerId) {
    return window.CustomerNumbering.generateCustomerNumber(customerId);
};

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CustomerNumberingSystem;
}