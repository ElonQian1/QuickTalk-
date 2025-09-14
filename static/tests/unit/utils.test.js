/**
 * Utils模块单元测试
 */

describe('Utils模块测试', () => {
    let utils;
    
    before(() => {
        // 确保Utils模块加载
        if (!window.Utils) {
            throw new Error('Utils模块未加载');
        }
        utils = window.Utils;
    });
    
    describe('时间格式化', () => {
        it('应该正确格式化时间戳', () => {
            const timestamp = new Date('2024-01-01 12:30:45').getTime();
            const formatted = utils.formatTime(timestamp);
            
            expect(formatted).toBe('12:30');
        });
        
        it('应该正确格式化日期时间', () => {
            const timestamp = new Date('2024-01-01 12:30:45').getTime();
            const formatted = utils.formatDateTime(timestamp);
            
            expect(formatted).toContain('2024-01-01');
            expect(formatted).toContain('12:30:45');
        });
        
        it('应该处理无效时间戳', () => {
            const formatted = utils.formatTime('invalid');
            expect(formatted).toBe('无效时间');
        });
    });
    
    describe('HTML转义', () => {
        it('应该转义危险的HTML字符', () => {
            const dangerous = '<script>alert("xss")</script>';
            const escaped = utils.escapeHtml(dangerous);
            
            expect(escaped).not.toContain('<script>');
            expect(escaped).toContain('&lt;script&gt;');
        });
        
        it('应该转义引号', () => {
            const text = 'He said "Hello"';
            const escaped = utils.escapeHtml(text);
            
            expect(escaped).toContain('&quot;');
        });
        
        it('应该处理空值', () => {
            expect(utils.escapeHtml(null)).toBe('');
            expect(utils.escapeHtml(undefined)).toBe('');
            expect(utils.escapeHtml('')).toBe('');
        });
    });
    
    describe('ID生成', () => {
        it('应该生成唯一ID', () => {
            const id1 = utils.generateId();
            const id2 = utils.generateId();
            
            expect(id1).not.toBe(id2);
            expect(typeof id1).toBe('string');
            expect(id1.length).toBeGreaterThan(0);
        });
        
        it('应该生成指定长度的ID', () => {
            const id = utils.generateId(10);
            expect(id.length).toBe(10);
        });
    });
    
    describe('防抖函数', () => {
        it('应该创建防抖函数', () => {
            let callCount = 0;
            const increment = () => callCount++;
            const debounced = utils.debounce(increment, 100);
            
            expect(typeof debounced).toBe('function');
        });
        
        it('应该延迟函数执行', (done) => {
            let called = false;
            const fn = () => { called = true; };
            const debounced = utils.debounce(fn, 50);
            
            debounced();
            expect(called).toBe(false);
            
            setTimeout(() => {
                expect(called).toBe(true);
                done();
            }, 100);
        });
        
        it('应该取消之前的调用', (done) => {
            let callCount = 0;
            const increment = () => callCount++;
            const debounced = utils.debounce(increment, 50);
            
            debounced();
            debounced();
            debounced();
            
            setTimeout(() => {
                expect(callCount).toBe(1);
                done();
            }, 100);
        });
    });
    
    describe('节流函数', () => {
        it('应该创建节流函数', () => {
            const fn = () => {};
            const throttled = utils.throttle(fn, 100);
            
            expect(typeof throttled).toBe('function');
        });
        
        it('应该限制函数调用频率', (done) => {
            let callCount = 0;
            const increment = () => callCount++;
            const throttled = utils.throttle(increment, 100);
            
            // 快速调用多次
            throttled();
            throttled();
            throttled();
            throttled();
            
            // 第一次应该立即执行
            expect(callCount).toBe(1);
            
            setTimeout(() => {
                // 100ms后应该只执行了1或2次
                expect(callCount).toBeLessThanOrEqual(2);
                done();
            }, 150);
        });
    });
    
    describe('深拷贝', () => {
        it('应该深拷贝简单对象', () => {
            const original = { a: 1, b: 'test' };
            const cloned = utils.deepClone(original);
            
            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
        });
        
        it('应该深拷贝嵌套对象', () => {
            const original = {
                a: 1,
                b: {
                    c: 2,
                    d: {
                        e: 'deep'
                    }
                }
            };
            const cloned = utils.deepClone(original);
            
            expect(cloned).toEqual(original);
            expect(cloned.b).not.toBe(original.b);
            expect(cloned.b.d).not.toBe(original.b.d);
        });
        
        it('应该深拷贝数组', () => {
            const original = [1, [2, 3], { a: 4 }];
            const cloned = utils.deepClone(original);
            
            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
            expect(cloned[1]).not.toBe(original[1]);
            expect(cloned[2]).not.toBe(original[2]);
        });
        
        it('应该处理null和undefined', () => {
            expect(utils.deepClone(null)).toBe(null);
            expect(utils.deepClone(undefined)).toBe(undefined);
        });
        
        it('应该处理基本类型', () => {
            expect(utils.deepClone(42)).toBe(42);
            expect(utils.deepClone('test')).toBe('test');
            expect(utils.deepClone(true)).toBe(true);
        });
    });
    
    describe('URL处理', () => {
        it('应该构建查询字符串', () => {
            const params = { name: 'test', age: 25, active: true };
            const query = utils.buildQueryString(params);
            
            expect(query).toContain('name=test');
            expect(query).toContain('age=25');
            expect(query).toContain('active=true');
        });
        
        it('应该处理数组参数', () => {
            const params = { tags: ['javascript', 'testing'] };
            const query = utils.buildQueryString(params);
            
            expect(query).toContain('tags=javascript');
            expect(query).toContain('tags=testing');
        });
        
        it('应该过滤空值', () => {
            const params = { name: 'test', empty: '', nullValue: null };
            const query = utils.buildQueryString(params);
            
            expect(query).toContain('name=test');
            expect(query).not.toContain('empty=');
            expect(query).not.toContain('nullValue');
        });
    });
    
    describe('数据验证', () => {
        it('应该验证邮箱格式', () => {
            expect(utils.isValidEmail('test@example.com')).toBe(true);
            expect(utils.isValidEmail('user+tag@domain.org')).toBe(true);
            expect(utils.isValidEmail('invalid-email')).toBe(false);
            expect(utils.isValidEmail('user@')).toBe(false);
            expect(utils.isValidEmail('@domain.com')).toBe(false);
        });
        
        it('应该验证手机号格式', () => {
            expect(utils.isValidPhone('13812345678')).toBe(true);
            expect(utils.isValidPhone('18987654321')).toBe(true);
            expect(utils.isValidPhone('1234567890')).toBe(false);
            expect(utils.isValidPhone('phone')).toBe(false);
        });
        
        it('应该验证URL格式', () => {
            expect(utils.isValidUrl('https://example.com')).toBe(true);
            expect(utils.isValidUrl('http://test.org/path')).toBe(true);
            expect(utils.isValidUrl('ftp://files.com')).toBe(true);
            expect(utils.isValidUrl('not-a-url')).toBe(false);
            expect(utils.isValidUrl('javascript:alert(1)')).toBe(false);
        });
    });
    
    describe('数组操作', () => {
        it('应该移除数组中的重复项', () => {
            const arr = [1, 2, 2, 3, 3, 3, 4];
            const unique = utils.unique(arr);
            
            expect(unique).toEqual([1, 2, 3, 4]);
        });
        
        it('应该对数组进行分组', () => {
            const arr = [
                { type: 'fruit', name: 'apple' },
                { type: 'fruit', name: 'banana' },
                { type: 'vegetable', name: 'carrot' }
            ];
            const grouped = utils.groupBy(arr, 'type');
            
            expect(grouped.fruit).toHaveLength(2);
            expect(grouped.vegetable).toHaveLength(1);
        });
        
        it('应该对数组进行分块', () => {
            const arr = [1, 2, 3, 4, 5, 6, 7];
            const chunks = utils.chunk(arr, 3);
            
            expect(chunks).toHaveLength(3);
            expect(chunks[0]).toEqual([1, 2, 3]);
            expect(chunks[1]).toEqual([4, 5, 6]);
            expect(chunks[2]).toEqual([7]);
        });
    });
    
    describe('存储操作', () => {
        beforeEach(() => {
            // 清理localStorage
            localStorage.clear();
        });
        
        it('应该设置和获取localStorage', () => {
            utils.setStorage('test', { value: 123 });
            const retrieved = utils.getStorage('test');
            
            expect(retrieved).toEqual({ value: 123 });
        });
        
        it('应该处理不存在的键', () => {
            const result = utils.getStorage('non-existent');
            expect(result).toBe(null);
        });
        
        it('应该移除localStorage项', () => {
            utils.setStorage('temp', 'value');
            utils.removeStorage('temp');
            
            expect(utils.getStorage('temp')).toBe(null);
        });
        
        it('应该处理JSON序列化错误', () => {
            // 模拟存储限制或序列化错误的场景
            const circular = {};
            circular.self = circular;
            
            expect(() => {
                utils.setStorage('circular', circular);
            }).not.toThrow();
        });
    });
    
    describe('错误处理', () => {
        it('应该安全地处理函数调用', () => {
            const safeCall = utils.safeCall(() => {
                throw new Error('Test error');
            });
            
            expect(safeCall).toBe(null);
        });
        
        it('应该返回函数的返回值', () => {
            const result = utils.safeCall(() => 'success');
            expect(result).toBe('success');
        });
        
        it('应该使用默认值', () => {
            const result = utils.safeCall(() => {
                throw new Error('Test error');
            }, 'default');
            
            expect(result).toBe('default');
        });
    });
});