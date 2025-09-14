/**
 * EventBus模块单元测试
 */

describe('EventBus模块测试', () => {
    let eventBus;
    
    beforeEach(() => {
        // 确保EventBus模块加载
        if (!window.EventBus) {
            throw new Error('EventBus模块未加载');
        }
        eventBus = window.EventBus;
        
        // 清理所有监听器
        eventBus.removeAllListeners();
    });
    
    afterEach(() => {
        // 清理
        eventBus.removeAllListeners();
    });
    
    describe('基本事件操作', () => {
        it('应该注册和触发事件', () => {
            let called = false;
            let receivedData = null;
            
            eventBus.on('test.event', (data) => {
                called = true;
                receivedData = data;
            });
            
            eventBus.emit('test.event', { message: 'hello' });
            
            expect(called).toBe(true);
            expect(receivedData).toEqual({ message: 'hello' });
        });
        
        it('应该支持多个监听器', () => {
            let count = 0;
            
            eventBus.on('test.multiple', () => count++);
            eventBus.on('test.multiple', () => count++);
            eventBus.on('test.multiple', () => count++);
            
            eventBus.emit('test.multiple');
            
            expect(count).toBe(3);
        });
        
        it('应该按照注册顺序执行监听器', () => {
            const order = [];
            
            eventBus.on('test.order', () => order.push('first'));
            eventBus.on('test.order', () => order.push('second'));
            eventBus.on('test.order', () => order.push('third'));
            
            eventBus.emit('test.order');
            
            expect(order).toEqual(['first', 'second', 'third']);
        });
    });
    
    describe('一次性事件', () => {
        it('应该只执行一次', () => {
            let count = 0;
            
            eventBus.once('test.once', () => count++);
            
            eventBus.emit('test.once');
            eventBus.emit('test.once');
            eventBus.emit('test.once');
            
            expect(count).toBe(1);
        });
        
        it('应该在执行后自动移除', () => {
            let executed = false;
            
            eventBus.once('test.auto-remove', () => {
                executed = true;
            });
            
            eventBus.emit('test.auto-remove');
            
            // 检查监听器是否被移除
            const listeners = eventBus.getListeners('test.auto-remove');
            expect(listeners).toHaveLength(0);
            expect(executed).toBe(true);
        });
    });
    
    describe('事件移除', () => {
        it('应该移除特定的监听器', () => {
            let count = 0;
            const listener = () => count++;
            
            eventBus.on('test.remove', listener);
            eventBus.emit('test.remove');
            
            eventBus.off('test.remove', listener);
            eventBus.emit('test.remove');
            
            expect(count).toBe(1);
        });
        
        it('应该移除事件的所有监听器', () => {
            let count1 = 0;
            let count2 = 0;
            
            eventBus.on('test.remove-all', () => count1++);
            eventBus.on('test.remove-all', () => count2++);
            
            eventBus.emit('test.remove-all');
            
            eventBus.off('test.remove-all');
            eventBus.emit('test.remove-all');
            
            expect(count1).toBe(1);
            expect(count2).toBe(1);
        });
        
        it('应该移除所有事件监听器', () => {
            let count1 = 0;
            let count2 = 0;
            
            eventBus.on('test.event1', () => count1++);
            eventBus.on('test.event2', () => count2++);
            
            eventBus.removeAllListeners();
            
            eventBus.emit('test.event1');
            eventBus.emit('test.event2');
            
            expect(count1).toBe(0);
            expect(count2).toBe(0);
        });
    });
    
    describe('事件传播', () => {
        it('应该支持事件冒泡', () => {
            const events = [];
            
            eventBus.on('user.login', () => events.push('user.login'));
            eventBus.on('user.*', () => events.push('user.*'));
            eventBus.on('*', () => events.push('*'));
            
            eventBus.emit('user.login', {}, { bubble: true });
            
            expect(events).toContain('user.login');
            expect(events).toContain('user.*');
            expect(events).toContain('*');
        });
        
        it('应该支持停止传播', () => {
            const events = [];
            
            eventBus.on('test.stop', (data, context) => {
                events.push('first');
                context.stopPropagation();
            });
            eventBus.on('test.stop', () => events.push('second'));
            
            eventBus.emit('test.stop');
            
            expect(events).toEqual(['first']);
        });
    });
    
    describe('异步事件处理', () => {
        it('应该支持异步监听器', async () => {
            let resolved = false;
            
            eventBus.on('test.async', async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                resolved = true;
            });
            
            await eventBus.emitAsync('test.async');
            
            expect(resolved).toBe(true);
        });
        
        it('应该等待所有异步监听器完成', async () => {
            const results = [];
            
            eventBus.on('test.parallel', async () => {
                await new Promise(resolve => setTimeout(resolve, 20));
                results.push('first');
            });
            
            eventBus.on('test.parallel', async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                results.push('second');
            });
            
            await eventBus.emitAsync('test.parallel');
            
            expect(results).toHaveLength(2);
            expect(results).toContain('first');
            expect(results).toContain('second');
        });
        
        it('应该处理异步监听器中的错误', async () => {
            let errorCaught = false;
            
            eventBus.on('test.async-error', async () => {
                throw new Error('Async error');
            });
            
            eventBus.on('error', () => {
                errorCaught = true;
            });
            
            await eventBus.emitAsync('test.async-error');
            
            expect(errorCaught).toBe(true);
        });
    });
    
    describe('命名空间', () => {
        it('应该支持命名空间事件', () => {
            let received = [];
            
            eventBus.on('user:login', () => received.push('login'));
            eventBus.on('user:logout', () => received.push('logout'));
            eventBus.on('system:start', () => received.push('start'));
            
            eventBus.emit('user:login');
            eventBus.emit('user:logout');
            eventBus.emit('system:start');
            
            expect(received).toEqual(['login', 'logout', 'start']);
        });
        
        it('应该支持通配符匹配', () => {
            let received = [];
            
            eventBus.on('user:*', (data, context) => {
                received.push(context.event);
            });
            
            eventBus.emit('user:login');
            eventBus.emit('user:logout');
            eventBus.emit('user:update');
            eventBus.emit('system:start'); // 不应该匹配
            
            expect(received).toEqual(['user:login', 'user:logout', 'user:update']);
        });
    });
    
    describe('事件优先级', () => {
        it('应该按优先级执行监听器', () => {
            const order = [];
            
            eventBus.on('test.priority', () => order.push('normal'), { priority: 0 });
            eventBus.on('test.priority', () => order.push('high'), { priority: 10 });
            eventBus.on('test.priority', () => order.push('low'), { priority: -10 });
            
            eventBus.emit('test.priority');
            
            expect(order).toEqual(['high', 'normal', 'low']);
        });
    });
    
    describe('事件过滤', () => {
        it('应该支持条件过滤', () => {
            let received = [];
            
            eventBus.on('test.filter', (data) => {
                received.push(data.value);
            }, {
                filter: (data) => data.value > 5
            });
            
            eventBus.emit('test.filter', { value: 3 });
            eventBus.emit('test.filter', { value: 7 });
            eventBus.emit('test.filter', { value: 1 });
            eventBus.emit('test.filter', { value: 10 });
            
            expect(received).toEqual([7, 10]);
        });
    });
    
    describe('中间件支持', () => {
        it('应该支持事件中间件', () => {
            const log = [];
            
            // 添加日志中间件
            eventBus.use((event, data, next) => {
                log.push(`before-${event}`);
                next();
                log.push(`after-${event}`);
            });
            
            eventBus.on('test.middleware', () => {
                log.push('handler');
            });
            
            eventBus.emit('test.middleware');
            
            expect(log).toEqual([
                'before-test.middleware',
                'handler',
                'after-test.middleware'
            ]);
        });
        
        it('应该支持中间件链', () => {
            const log = [];
            
            eventBus.use((event, data, next) => {
                log.push('middleware1-before');
                next();
                log.push('middleware1-after');
            });
            
            eventBus.use((event, data, next) => {
                log.push('middleware2-before');
                next();
                log.push('middleware2-after');
            });
            
            eventBus.on('test.chain', () => {
                log.push('handler');
            });
            
            eventBus.emit('test.chain');
            
            expect(log).toEqual([
                'middleware1-before',
                'middleware2-before',
                'handler',
                'middleware2-after',
                'middleware1-after'
            ]);
        });
    });
    
    describe('错误处理', () => {
        it('应该捕获监听器中的错误', () => {
            let errorCaught = false;
            
            eventBus.on('error', () => {
                errorCaught = true;
            });
            
            eventBus.on('test.error', () => {
                throw new Error('Test error');
            });
            
            eventBus.emit('test.error');
            
            expect(errorCaught).toBe(true);
        });
        
        it('应该继续执行其他监听器', () => {
            let executed = false;
            
            eventBus.on('test.continue', () => {
                throw new Error('First listener error');
            });
            
            eventBus.on('test.continue', () => {
                executed = true;
            });
            
            eventBus.emit('test.continue');
            
            expect(executed).toBe(true);
        });
    });
    
    describe('调试功能', () => {
        it('应该提供调试信息', () => {
            eventBus.setDebug(true);
            
            const originalLog = console.log;
            let logCalled = false;
            
            console.log = () => {
                logCalled = true;
            };
            
            eventBus.on('test.debug', () => {});
            eventBus.emit('test.debug');
            
            console.log = originalLog;
            
            expect(logCalled).toBe(true);
            
            eventBus.setDebug(false);
        });
        
        it('应该统计事件数据', () => {
            eventBus.on('test.stats', () => {});
            
            eventBus.emit('test.stats');
            eventBus.emit('test.stats');
            
            const stats = eventBus.getStats();
            
            expect(stats['test.stats']).toBeDefined();
            expect(stats['test.stats'].count).toBe(2);
        });
    });
    
    describe('性能考虑', () => {
        it('应该处理大量监听器', () => {
            const start = Date.now();
            
            // 添加1000个监听器
            for (let i = 0; i < 1000; i++) {
                eventBus.on('test.performance', () => {});
            }
            
            const setupTime = Date.now() - start;
            expect(setupTime).toBeLessThan(100); // 应该在100ms内完成
            
            const emitStart = Date.now();
            eventBus.emit('test.performance');
            const emitTime = Date.now() - emitStart;
            
            expect(emitTime).toBeLessThan(50); // 发送事件应该在50ms内完成
        });
        
        it('应该高效地移除监听器', () => {
            const listeners = [];
            
            // 添加100个监听器
            for (let i = 0; i < 100; i++) {
                const listener = () => {};
                listeners.push(listener);
                eventBus.on('test.remove-performance', listener);
            }
            
            const start = Date.now();
            
            // 移除所有监听器
            listeners.forEach(listener => {
                eventBus.off('test.remove-performance', listener);
            });
            
            const removeTime = Date.now() - start;
            expect(removeTime).toBeLessThan(20); // 应该在20ms内完成
        });
    });
});