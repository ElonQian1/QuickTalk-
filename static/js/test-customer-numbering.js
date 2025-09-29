/**
 * 客户编号算法测试脚本
 * 用于验证编号按访问顺序正确分配
 */

// 模拟测试环境
const testLocalStorage = {};

// Mock localStorage
const mockLocalStorage = {
    getItem: (key) => testLocalStorage[key] || null,
    setItem: (key, value) => { testLocalStorage[key] = value; },
    removeItem: (key) => { delete testLocalStorage[key]; }
};

// Mock console
const mockConsole = {
    log: (...args) => console.log('TEST:', ...args),
    warn: (...args) => console.warn('TEST:', ...args),
    error: (...args) => console.error('TEST:', ...args)
};

// 简化的CustomerNumberingSystem类（用于测试）
class TestCustomerNumberingSystem {
    constructor() {
        this.storageKey = 'customer_number_map';
        this.counterKey = 'customer_number_counter';
        this.customerMap = this.loadCustomerMap();
        this.counter = this.loadCounter();
    }

    loadCustomerMap() {
        try {
            const stored = mockLocalStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            mockConsole.error('加载客户编号映射失败:', error);
            return {};
        }
    }

    loadCounter() {
        try {
            const stored = mockLocalStorage.getItem(this.counterKey);
            return stored ? parseInt(stored, 10) : 0;
        } catch (error) {
            mockConsole.error('加载客户编号计数器失败:', error);
            return 0;
        }
    }

    saveCustomerMap() {
        try {
            mockLocalStorage.setItem(this.storageKey, JSON.stringify(this.customerMap));
        } catch (error) {
            mockConsole.error('保存客户编号映射失败:', error);
        }
    }

    saveCounter() {
        try {
            mockLocalStorage.setItem(this.counterKey, this.counter.toString());
        } catch (error) {
            mockConsole.error('保存客户编号计数器失败:', error);
        }
    }

    generateCustomerNumber(customerId) {
        if (!customerId) {
            mockConsole.warn('客户ID为空，无法生成编号');
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
        
        mockConsole.log(`为客户 ${customerId} 分配编号: ${formattedNumber} (第${this.counter}位访问者)`);
        return formattedNumber;
    }

    getTotalVisitorCount() {
        return this.counter;
    }

    getCustomerCount() {
        return Object.keys(this.customerMap).length;
    }

    clearAllCustomerNumbers() {
        this.customerMap = {};
        this.counter = 0;
        this.saveCustomerMap();
        this.saveCounter();
        mockConsole.log('已清空所有客户编号映射和计数器');
    }
}

// 运行测试
function runCustomerNumberingTests() {
    console.log('🧪 开始客户编号算法测试...\n');
    
    const numbering = new TestCustomerNumberingSystem();
    
    // 清空之前的测试数据
    numbering.clearAllCustomerNumbers();
    
    // 测试1: 第一个客户应该是客户001
    console.log('测试1: 第一个访问的客户');
    const customer1 = numbering.generateCustomerNumber('customer_001_abc');
    console.log(`结果: ${customer1}`);
    console.log(`期望: 客户001`);
    console.log(`通过: ${customer1 === '客户001' ? '✅' : '❌'}\n`);
    
    // 测试2: 第二个客户应该是客户002
    console.log('测试2: 第二个访问的客户');
    const customer2 = numbering.generateCustomerNumber('customer_002_def');
    console.log(`结果: ${customer2}`);
    console.log(`期望: 客户002`);
    console.log(`通过: ${customer2 === '客户002' ? '✅' : '❌'}\n`);
    
    // 测试3: 重复访问应该返回相同编号
    console.log('测试3: 重复访问相同客户');
    const customer1Again = numbering.generateCustomerNumber('customer_001_abc');
    console.log(`结果: ${customer1Again}`);
    console.log(`期望: 客户001`);
    console.log(`通过: ${customer1Again === '客户001' ? '✅' : '❌'}\n`);
    
    // 测试4: 模拟大量客户（到767）
    console.log('测试4: 模拟到第767位客户');
    for (let i = 3; i < 767; i++) {
        numbering.generateCustomerNumber(`customer_${String(i).padStart(3, '0')}_test`);
    }
    const customer767 = numbering.generateCustomerNumber('customer_767_final');
    console.log(`结果: ${customer767}`);
    console.log(`期望: 客户767`);
    console.log(`通过: ${customer767 === '客户767' ? '✅' : '❌'}\n`);
    
    // 测试5: 验证统计信息
    console.log('测试5: 验证统计信息');
    const totalVisitors = numbering.getTotalVisitorCount();
    const activeCustomers = numbering.getCustomerCount();
    console.log(`总访问者: ${totalVisitors}`);
    console.log(`活跃客户: ${activeCustomers}`);
    console.log(`期望总访问者: 767`);
    console.log(`期望活跃客户: 767`);
    console.log(`访问者统计通过: ${totalVisitors === 767 ? '✅' : '❌'}`);
    console.log(`活跃客户统计通过: ${activeCustomers === 767 ? '✅' : '❌'}\n`);
    
    // 测试6: 清空后重新开始
    console.log('测试6: 清空后重新开始');
    numbering.clearAllCustomerNumbers();
    const newCustomer1 = numbering.generateCustomerNumber('new_customer_001');
    console.log(`结果: ${newCustomer1}`);
    console.log(`期望: 客户001`);
    console.log(`通过: ${newCustomer1 === '客户001' ? '✅' : '❌'}\n`);
    
    console.log('🏁 客户编号算法测试完成！');
}

// 如果在Node.js环境中运行
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TestCustomerNumberingSystem, runCustomerNumberingTests };
    
    // 直接运行测试
    if (require.main === module) {
        runCustomerNumberingTests();
    }
} else {
    // 在浏览器环境中运行
    window.runCustomerNumberingTests = runCustomerNumberingTests;
    window.TestCustomerNumberingSystem = TestCustomerNumberingSystem;
}