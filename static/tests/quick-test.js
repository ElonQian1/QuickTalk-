/**
 * QuickTalk 测试框架
 * 轻量级的JavaScript测试框架，专为QuickTalk客服系统设计
 */

class QuickTestFramework {
    constructor() {
        this.tests = [];
        this.suites = new Map();
        this.results = {
            passed: 0,
            failed: 0,
            skipped: 0,
            total: 0
        };
        this.startTime = null;
        this.endTime = null;
        this.reporter = new TestReporter();
        
        console.log('[QuickTest] 测试框架初始化');
    }
    
    /**
     * 创建测试套件
     */
    describe(name, callback) {
        const suite = new TestSuite(name);
        this.suites.set(name, suite);
        
        // 设置当前套件上下文
        const originalSuite = this.currentSuite;
        this.currentSuite = suite;
        
        try {
            callback();
        } finally {
            this.currentSuite = originalSuite;
        }
        
        return suite;
    }
    
    /**
     * 创建测试用例
     */
    it(description, testFunction) {
        if (!this.currentSuite) {
            throw new Error('测试用例必须在测试套件内定义');
        }
        
        const test = new TestCase(description, testFunction, this.currentSuite);
        this.currentSuite.addTest(test);
        this.tests.push(test);
        
        return test;
    }
    
    /**
     * 跳过测试
     */
    skip(description, testFunction) {
        const test = this.it(description, testFunction);
        test.skip();
        return test;
    }
    
    /**
     * 仅运行此测试
     */
    only(description, testFunction) {
        const test = this.it(description, testFunction);
        test.only();
        return test;
    }
    
    /**
     * 设置前置条件
     */
    beforeEach(callback) {
        if (this.currentSuite) {
            this.currentSuite.beforeEach(callback);
        }
    }
    
    /**
     * 设置后置清理
     */
    afterEach(callback) {
        if (this.currentSuite) {
            this.currentSuite.afterEach(callback);
        }
    }
    
    /**
     * 设置套件前置条件
     */
    before(callback) {
        if (this.currentSuite) {
            this.currentSuite.before(callback);
        }
    }
    
    /**
     * 设置套件后置清理
     */
    after(callback) {
        if (this.currentSuite) {
            this.currentSuite.after(callback);
        }
    }
    
    /**
     * 运行所有测试
     */
    async run() {
        this.startTime = Date.now();
        this.reporter.onStart();
        
        try {
            // 检查是否有only测试
            const onlyTests = this.tests.filter(test => test.isOnly);
            const testsToRun = onlyTests.length > 0 ? onlyTests : this.tests;
            
            // 按套件分组运行
            for (const [suiteName, suite] of this.suites) {
                await this.runSuite(suite, testsToRun);
            }
            
            this.endTime = Date.now();
            this.reporter.onComplete(this.results, this.endTime - this.startTime);
            
        } catch (error) {
            console.error('[QuickTest] 测试运行失败:', error);
            this.reporter.onError(error);
        }
        
        return this.results;
    }
    
    /**
     * 运行测试套件
     */
    async runSuite(suite, testsToRun) {
        this.reporter.onSuiteStart(suite.name);
        
        try {
            // 运行套件前置条件
            await suite.runBefore();
            
            // 运行套件中的测试
            const suiteTests = testsToRun.filter(test => test.suite === suite);
            
            for (const test of suiteTests) {
                await this.runTest(test);
            }
            
            // 运行套件后置清理
            await suite.runAfter();
            
        } catch (error) {
            this.reporter.onSuiteError(suite.name, error);
        }
        
        this.reporter.onSuiteEnd(suite.name);
    }
    
    /**
     * 运行单个测试
     */
    async runTest(test) {
        if (test.isSkipped) {
            this.results.skipped++;
            this.results.total++;
            this.reporter.onTestSkip(test);
            return;
        }
        
        this.reporter.onTestStart(test);
        
        try {
            // 运行前置条件
            await test.suite.runBeforeEach();
            
            // 运行测试
            await test.run();
            
            // 测试通过
            this.results.passed++;
            this.reporter.onTestPass(test);
            
        } catch (error) {
            // 测试失败
            test.error = error;
            this.results.failed++;
            this.reporter.onTestFail(test, error);
            
        } finally {
            try {
                // 运行后置清理
                await test.suite.runAfterEach();
            } catch (cleanupError) {
                console.warn('[QuickTest] 清理阶段错误:', cleanupError);
            }
            
            this.results.total++;
        }
    }
    
    /**
     * 获取测试结果
     */
    getResults() {
        return {
            ...this.results,
            duration: this.endTime ? this.endTime - this.startTime : 0,
            suites: Array.from(this.suites.values()).map(suite => suite.getInfo())
        };
    }
    
    /**
     * 清理测试环境
     */
    reset() {
        this.tests = [];
        this.suites.clear();
        this.results = {
            passed: 0,
            failed: 0,
            skipped: 0,
            total: 0
        };
        this.currentSuite = null;
    }
}

/**
 * 测试套件
 */
class TestSuite {
    constructor(name) {
        this.name = name;
        this.tests = [];
        this.beforeEachCallbacks = [];
        this.afterEachCallbacks = [];
        this.beforeCallbacks = [];
        this.afterCallbacks = [];
    }
    
    addTest(test) {
        this.tests.push(test);
    }
    
    beforeEach(callback) {
        this.beforeEachCallbacks.push(callback);
    }
    
    afterEach(callback) {
        this.afterEachCallbacks.push(callback);
    }
    
    before(callback) {
        this.beforeCallbacks.push(callback);
    }
    
    after(callback) {
        this.afterCallbacks.push(callback);
    }
    
    async runBefore() {
        for (const callback of this.beforeCallbacks) {
            await callback();
        }
    }
    
    async runAfter() {
        for (const callback of this.afterCallbacks) {
            await callback();
        }
    }
    
    async runBeforeEach() {
        for (const callback of this.beforeEachCallbacks) {
            await callback();
        }
    }
    
    async runAfterEach() {
        for (const callback of this.afterEachCallbacks) {
            await callback();
        }
    }
    
    getInfo() {
        return {
            name: this.name,
            testCount: this.tests.length,
            tests: this.tests.map(test => test.getInfo())
        };
    }
}

/**
 * 测试用例
 */
class TestCase {
    constructor(description, testFunction, suite) {
        this.description = description;
        this.testFunction = testFunction;
        this.suite = suite;
        this.isSkipped = false;
        this.isOnly = false;
        this.error = null;
        this.startTime = null;
        this.endTime = null;
    }
    
    skip() {
        this.isSkipped = true;
    }
    
    only() {
        this.isOnly = true;
    }
    
    async run() {
        this.startTime = Date.now();
        
        try {
            const result = this.testFunction();
            
            // 如果返回Promise，等待完成
            if (result && typeof result.then === 'function') {
                await result;
            }
            
        } finally {
            this.endTime = Date.now();
        }
    }
    
    getDuration() {
        return this.endTime ? this.endTime - this.startTime : 0;
    }
    
    getInfo() {
        return {
            description: this.description,
            isSkipped: this.isSkipped,
            isOnly: this.isOnly,
            duration: this.getDuration(),
            error: this.error ? this.error.message : null
        };
    }
}

/**
 * 测试报告器
 */
class TestReporter {
    constructor() {
        this.indent = 0;
    }
    
    onStart() {
        console.log('\n🧪 开始运行测试...\n');
    }
    
    onSuiteStart(name) {
        console.log(`${'  '.repeat(this.indent)}📦 ${name}`);
        this.indent++;
    }
    
    onSuiteEnd(name) {
        this.indent = Math.max(0, this.indent - 1);
    }
    
    onSuiteError(name, error) {
        console.error(`${'  '.repeat(this.indent)}❌ 套件错误: ${error.message}`);
    }
    
    onTestStart(test) {
        // 可以添加详细的测试开始日志
    }
    
    onTestPass(test) {
        const duration = test.getDuration();
        console.log(`${'  '.repeat(this.indent)}✅ ${test.description} (${duration}ms)`);
    }
    
    onTestFail(test, error) {
        const duration = test.getDuration();
        console.log(`${'  '.repeat(this.indent)}❌ ${test.description} (${duration}ms)`);
        console.error(`${'  '.repeat(this.indent + 1)}错误: ${error.message}`);
        if (error.stack) {
            console.error(`${'  '.repeat(this.indent + 1)}堆栈: ${error.stack}`);
        }
    }
    
    onTestSkip(test) {
        console.log(`${'  '.repeat(this.indent)}⏭️  ${test.description} (跳过)`);
    }
    
    onComplete(results, duration) {
        console.log('\n📊 测试结果:');
        console.log(`   总计: ${results.total}`);
        console.log(`   ✅ 通过: ${results.passed}`);
        console.log(`   ❌ 失败: ${results.failed}`);
        console.log(`   ⏭️  跳过: ${results.skipped}`);
        console.log(`   ⏱️  耗时: ${duration}ms`);
        
        const successRate = results.total > 0 ? (results.passed / results.total * 100).toFixed(1) : 0;
        console.log(`   📈 成功率: ${successRate}%`);
        
        if (results.failed === 0) {
            console.log('\n🎉 所有测试通过！');
        } else {
            console.log(`\n⚠️  有${results.failed}个测试失败`);
        }
    }
    
    onError(error) {
        console.error('\n💥 测试运行异常:', error);
    }
}

/**
 * 断言库
 */
class Expect {
    constructor(actual) {
        this.actual = actual;
        this.isNot = false;
    }
    
    get not() {
        const newExpect = new Expect(this.actual);
        newExpect.isNot = !this.isNot;
        return newExpect;
    }
    
    toBe(expected) {
        const passed = this.actual === expected;
        this.assert(passed, `期望 ${this.actual} ${this.isNot ? '不' : ''}严格等于 ${expected}`);
        return this;
    }
    
    toEqual(expected) {
        const passed = this.deepEqual(this.actual, expected);
        this.assert(passed, `期望 ${JSON.stringify(this.actual)} ${this.isNot ? '不' : ''}等于 ${JSON.stringify(expected)}`);
        return this;
    }
    
    toBeNull() {
        const passed = this.actual === null;
        this.assert(passed, `期望 ${this.actual} ${this.isNot ? '不' : ''}为 null`);
        return this;
    }
    
    toBeUndefined() {
        const passed = this.actual === undefined;
        this.assert(passed, `期望 ${this.actual} ${this.isNot ? '不' : ''}为 undefined`);
        return this;
    }
    
    toBeTruthy() {
        const passed = !!this.actual;
        this.assert(passed, `期望 ${this.actual} ${this.isNot ? '不' : ''}为真值`);
        return this;
    }
    
    toBeFalsy() {
        const passed = !this.actual;
        this.assert(passed, `期望 ${this.actual} ${this.isNot ? '不' : ''}为假值`);
        return this;
    }
    
    toContain(expected) {
        let passed = false;
        
        if (Array.isArray(this.actual)) {
            passed = this.actual.includes(expected);
        } else if (typeof this.actual === 'string') {
            passed = this.actual.indexOf(expected) !== -1;
        } else {
            throw new Error('toContain 只能用于数组或字符串');
        }
        
        this.assert(passed, `期望 ${this.actual} ${this.isNot ? '不' : ''}包含 ${expected}`);
        return this;
    }
    
    toThrow(expectedError) {
        let passed = false;
        let actualError = null;
        
        try {
            if (typeof this.actual === 'function') {
                this.actual();
            } else {
                throw new Error('toThrow 只能用于函数');
            }
        } catch (error) {
            actualError = error;
            
            if (expectedError) {
                if (typeof expectedError === 'string') {
                    passed = error.message.includes(expectedError);
                } else if (expectedError instanceof RegExp) {
                    passed = expectedError.test(error.message);
                } else if (typeof expectedError === 'function') {
                    passed = error instanceof expectedError;
                }
            } else {
                passed = true; // 只要抛出错误就算通过
            }
        }
        
        if (!actualError && !this.isNot) {
            throw new Error('期望函数抛出错误，但没有抛出');
        }
        
        this.assert(passed, `期望函数${this.isNot ? '不' : ''}抛出错误`);
        return this;
    }
    
    toBeInstanceOf(expectedClass) {
        const passed = this.actual instanceof expectedClass;
        this.assert(passed, `期望 ${this.actual} ${this.isNot ? '不' : ''}是 ${expectedClass.name} 的实例`);
        return this;
    }
    
    toHaveProperty(property, value) {
        const hasProperty = property in this.actual;
        let passed = hasProperty;
        
        if (hasProperty && value !== undefined) {
            passed = this.actual[property] === value;
        }
        
        this.assert(passed, `期望对象${this.isNot ? '不' : ''}有属性 ${property}${value !== undefined ? ` 值为 ${value}` : ''}`);
        return this;
    }
    
    toHaveLength(expectedLength) {
        const actualLength = this.actual ? this.actual.length : 0;
        const passed = actualLength === expectedLength;
        this.assert(passed, `期望长度${this.isNot ? '不' : ''}为 ${expectedLength}，实际为 ${actualLength}`);
        return this;
    }
    
    // 工具方法
    assert(condition, message) {
        const passed = this.isNot ? !condition : condition;
        if (!passed) {
            throw new Error(message);
        }
    }
    
    deepEqual(a, b) {
        if (a === b) return true;
        
        if (a === null || b === null) return false;
        if (a === undefined || b === undefined) return false;
        
        if (typeof a !== typeof b) return false;
        
        if (typeof a === 'object') {
            if (Array.isArray(a) !== Array.isArray(b)) return false;
            
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            
            if (keysA.length !== keysB.length) return false;
            
            for (const key of keysA) {
                if (!keysB.includes(key)) return false;
                if (!this.deepEqual(a[key], b[key])) return false;
            }
            
            return true;
        }
        
        return false;
    }
}

/**
 * 全局测试函数
 */
function expect(actual) {
    return new Expect(actual);
}

function describe(name, callback) {
    return quickTest.describe(name, callback);
}

function it(description, testFunction) {
    return quickTest.it(description, testFunction);
}

function test(description, testFunction) {
    return quickTest.it(description, testFunction);
}

function skip(description, testFunction) {
    return quickTest.skip(description, testFunction);
}

function only(description, testFunction) {
    return quickTest.only(description, testFunction);
}

function beforeEach(callback) {
    return quickTest.beforeEach(callback);
}

function afterEach(callback) {
    return quickTest.afterEach(callback);
}

function before(callback) {
    return quickTest.before(callback);
}

function after(callback) {
    return quickTest.after(callback);
}

// 创建全局测试实例
const quickTest = new QuickTestFramework();

// 暴露到全局
if (typeof window !== 'undefined') {
    window.QuickTestFramework = QuickTestFramework;
    window.quickTest = quickTest;
    window.expect = expect;
    window.describe = describe;
    window.it = it;
    window.test = test;
    window.skip = skip;
    window.only = only;
    window.beforeEach = beforeEach;
    window.afterEach = afterEach;
    window.before = before;
    window.after = after;
}

// Node.js环境支持
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        QuickTestFramework,
        quickTest,
        expect,
        describe,
        it,
        test,
        skip,
        only,
        beforeEach,
        afterEach,
        before,
        after
    };
}

console.log('[QuickTest] 测试框架加载完成');