/**
 * Config模块单元测试
 */

describe('Config模块测试', () => {
    let config;
    
    beforeEach(() => {
        // 确保Config模块加载
        if (!window.Config) {
            throw new Error('Config模块未加载');
        }
        config = window.Config;
        
        // 重置配置状态
        config.reset();
    });
    
    afterEach(() => {
        // 清理配置
        config.reset();
    });
    
    describe('基本配置操作', () => {
        it('应该设置和获取配置值', () => {
            config.set('test.value', 'hello');
            const value = config.get('test.value');
            
            expect(value).toBe('hello');
        });
        
        it('应该支持深层路径设置', () => {
            config.set('app.ui.theme', 'dark');
            config.set('app.ui.language', 'zh-CN');
            
            expect(config.get('app.ui.theme')).toBe('dark');
            expect(config.get('app.ui.language')).toBe('zh-CN');
        });
        
        it('应该返回默认值当键不存在时', () => {
            const value = config.get('non.existent.key', 'default');
            expect(value).toBe('default');
        });
        
        it('应该获取整个配置对象', () => {
            config.set('a', 1);
            config.set('b.c', 2);
            
            const all = config.getAll();
            expect(all.a).toBe(1);
            expect(all.b.c).toBe(2);
        });
    });
    
    describe('配置初始化', () => {
        it('应该使用初始配置初始化', () => {
            const initialConfig = {
                api: {
                    baseUrl: 'http://localhost:3000',
                    timeout: 5000
                },
                ui: {
                    theme: 'light'
                }
            };
            
            config.init(initialConfig);
            
            expect(config.get('api.baseUrl')).toBe('http://localhost:3000');
            expect(config.get('api.timeout')).toBe(5000);
            expect(config.get('ui.theme')).toBe('light');
        });
        
        it('应该合并配置而不覆盖', () => {
            config.set('existing', 'value');
            
            config.init({
                new: 'config',
                nested: { key: 'value' }
            });
            
            expect(config.get('existing')).toBe('value');
            expect(config.get('new')).toBe('config');
            expect(config.get('nested.key')).toBe('value');
        });
    });
    
    describe('配置验证', () => {
        beforeEach(() => {
            // 设置验证规则
            config.addValidationRule('api.baseUrl', (value) => {
                if (typeof value !== 'string') {
                    return 'API基础URL必须是字符串';
                }
                if (!value.startsWith('http')) {
                    return 'API基础URL必须以http开头';
                }
                return null;
            });
            
            config.addValidationRule('api.timeout', (value) => {
                if (typeof value !== 'number') {
                    return '超时时间必须是数字';
                }
                if (value <= 0) {
                    return '超时时间必须大于0';
                }
                return null;
            });
        });
        
        it('应该验证有效配置', () => {
            config.set('api.baseUrl', 'http://localhost:3000');
            config.set('api.timeout', 5000);
            
            const validation = config.validate();
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });
        
        it('应该检测无效配置', () => {
            config.set('api.baseUrl', 'invalid-url');
            config.set('api.timeout', -1);
            
            const validation = config.validate();
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toHaveLength(2);
        });
        
        it('应该提供详细的错误信息', () => {
            config.set('api.baseUrl', 123);
            
            const validation = config.validate();
            expect(validation.errors[0]).toContain('API基础URL必须是字符串');
        });
    });
    
    describe('配置监听', () => {
        it('应该监听配置变化', () => {
            let changeCount = 0;
            let lastChange = null;
            
            config.onChange((key, newValue, oldValue) => {
                changeCount++;
                lastChange = { key, newValue, oldValue };
            });
            
            config.set('test.key', 'new value');
            
            expect(changeCount).toBe(1);
            expect(lastChange.key).toBe('test.key');
            expect(lastChange.newValue).toBe('new value');
            expect(lastChange.oldValue).toBeUndefined();
        });
        
        it('应该监听特定键的变化', () => {
            let specificChangeCount = 0;
            
            config.onChange('specific.key', () => {
                specificChangeCount++;
            });
            
            config.set('specific.key', 'value1');
            config.set('other.key', 'value2');
            config.set('specific.key', 'value3');
            
            expect(specificChangeCount).toBe(2);
        });
        
        it('应该移除监听器', () => {
            let changeCount = 0;
            
            const unsubscribe = config.onChange(() => {
                changeCount++;
            });
            
            config.set('test1', 'value1');
            unsubscribe();
            config.set('test2', 'value2');
            
            expect(changeCount).toBe(1);
        });
    });
    
    describe('配置持久化', () => {
        beforeEach(() => {
            localStorage.clear();
        });
        
        it('应该保存配置到localStorage', () => {
            config.set('persistent.key', 'value');
            config.save();
            
            const saved = JSON.parse(localStorage.getItem('quicktalk_config') || '{}');
            expect(saved.persistent.key).toBe('value');
        });
        
        it('应该从localStorage加载配置', () => {
            const savedConfig = {
                loaded: { key: 'value' }
            };
            localStorage.setItem('quicktalk_config', JSON.stringify(savedConfig));
            
            config.load();
            
            expect(config.get('loaded.key')).toBe('value');
        });
        
        it('应该处理无效的localStorage数据', () => {
            localStorage.setItem('quicktalk_config', 'invalid-json');
            
            expect(() => {
                config.load();
            }).not.toThrow();
        });
    });
    
    describe('环境配置', () => {
        it('应该检测开发环境', () => {
            config.set('debug', true);
            expect(config.isDevelopment()).toBe(true);
        });
        
        it('应该检测生产环境', () => {
            config.set('debug', false);
            expect(config.isProduction()).toBe(true);
        });
        
        it('应该检测调试模式', () => {
            config.set('debug', true);
            expect(config.isDebugMode()).toBe(true);
            
            config.set('debug', false);
            expect(config.isDebugMode()).toBe(false);
        });
    });
    
    describe('预设配置', () => {
        it('应该应用开发环境预设', () => {
            config.applyPreset('development');
            
            expect(config.get('debug')).toBe(true);
            expect(config.get('api.baseUrl')).toBe('http://localhost:3030');
        });
        
        it('应该应用生产环境预设', () => {
            config.applyPreset('production');
            
            expect(config.get('debug')).toBe(false);
            expect(config.get('api.baseUrl')).toBe('/');
        });
        
        it('应该应用测试环境预设', () => {
            config.applyPreset('test');
            
            expect(config.get('debug')).toBe(true);
            expect(config.get('api.mock')).toBe(true);
        });
    });
    
    describe('配置重置', () => {
        it('应该重置到初始状态', () => {
            config.set('temp.value', 'temporary');
            config.reset();
            
            expect(config.get('temp.value')).toBeUndefined();
            expect(config.getAll()).toEqual({});
        });
        
        it('应该保留默认配置', () => {
            const defaults = { keep: 'this' };
            config.setDefaults(defaults);
            config.set('temp', 'value');
            
            config.reset();
            
            expect(config.get('keep')).toBe('this');
            expect(config.get('temp')).toBeUndefined();
        });
    });
    
    describe('配置导入导出', () => {
        it('应该导出配置', () => {
            config.set('export.test', 'value');
            const exported = config.export();
            
            expect(exported).toContain('export.test');
            expect(exported).toContain('value');
        });
        
        it('应该导入配置', () => {
            const configData = JSON.stringify({
                import: { test: 'imported' }
            });
            
            config.import(configData);
            
            expect(config.get('import.test')).toBe('imported');
        });
        
        it('应该处理无效的导入数据', () => {
            expect(() => {
                config.import('invalid-json');
            }).not.toThrow();
        });
    });
    
    describe('配置模板', () => {
        it('应该支持模板变量', () => {
            config.set('baseUrl', 'http://localhost');
            config.set('port', '3030');
            config.set('apiUrl', '${baseUrl}:${port}/api');
            
            const resolved = config.resolve('apiUrl');
            expect(resolved).toBe('http://localhost:3030/api');
        });
        
        it('应该处理嵌套模板变量', () => {
            config.set('protocol', 'http');
            config.set('host', 'localhost');
            config.set('baseUrl', '${protocol}://${host}');
            config.set('apiUrl', '${baseUrl}/api');
            
            const resolved = config.resolve('apiUrl');
            expect(resolved).toBe('http://localhost/api');
        });
        
        it('应该处理未定义的变量', () => {
            config.set('template', 'Value: ${undefined_var}');
            
            const resolved = config.resolve('template');
            expect(resolved).toBe('Value: ${undefined_var}');
        });
    });
});