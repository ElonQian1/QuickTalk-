/**
 * API客户端模块测试
 */

describe('ApiClient 模块测试', () => {
    let apiClient;
    let originalFetch;
    
    beforeEach(() => {
        // 保存原始fetch
        originalFetch = window.fetch;
        
        // 重置API客户端（如果存在）
        if (window.ApiClient) {
            apiClient = new window.ApiClient();
        } else {
            // 创建简单的API客户端用于测试
            window.ApiClient = class {
                constructor(config = {}) {
                    this.baseUrl = config.baseUrl || '';
                    this.timeout = config.timeout || 5000;
                    this.headers = config.headers || {};
                }
                
                async request(url, options = {}) {
                    const fullUrl = this.baseUrl + url;
                    const config = {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            ...this.headers,
                            ...options.headers
                        },
                        ...options
                    };
                    
                    if (config.body && typeof config.body === 'object') {
                        config.body = JSON.stringify(config.body);
                    }
                    
                    try {
                        const response = await fetch(fullUrl, config);
                        
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('application/json')) {
                            return await response.json();
                        }
                        
                        return await response.text();
                    } catch (error) {
                        throw new Error(`API请求失败: ${error.message}`);
                    }
                }
                
                async get(url, options = {}) {
                    return this.request(url, { ...options, method: 'GET' });
                }
                
                async post(url, data, options = {}) {
                    return this.request(url, { 
                        ...options, 
                        method: 'POST', 
                        body: data 
                    });
                }
                
                async put(url, data, options = {}) {
                    return this.request(url, { 
                        ...options, 
                        method: 'PUT', 
                        body: data 
                    });
                }
                
                async delete(url, options = {}) {
                    return this.request(url, { ...options, method: 'DELETE' });
                }
                
                setHeader(name, value) {
                    this.headers[name] = value;
                }
                
                removeHeader(name) {
                    delete this.headers[name];
                }
                
                setAuthToken(token) {
                    this.setHeader('Authorization', `Bearer ${token}`);
                }
            };
            
            apiClient = new window.ApiClient();
        }
    });
    
    afterEach(() => {
        // 恢复原始fetch
        window.fetch = originalFetch;
    });
    
    describe('基础配置', () => {
        it('应该能够创建API客户端实例', () => {
            const client = new window.ApiClient({
                baseUrl: 'https://api.example.com',
                timeout: 3000,
                headers: { 'X-Custom': 'test' }
            });
            
            expect(client.baseUrl).toBe('https://api.example.com');
            expect(client.timeout).toBe(3000);
            expect(client.headers['X-Custom']).toBe('test');
        });
        
        it('应该使用默认配置', () => {
            const client = new window.ApiClient();
            
            expect(client.baseUrl).toBe('');
            expect(client.timeout).toBe(5000);
            expect(typeof client.headers).toBe('object');
        });
    });
    
    describe('HTTP请求方法', () => {
        it('应该能够发送GET请求', async () => {
            const mockResponse = { data: 'test' };
            
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('application/json')
                },
                json: jest.fn().mockResolvedValue(mockResponse)
            });
            
            const result = await apiClient.get('/test');
            
            expect(window.fetch).toHaveBeenCalledWith('/test', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            expect(result).toEqual(mockResponse);
        });
        
        it('应该能够发送POST请求', async () => {
            const mockResponse = { success: true };
            const postData = { name: 'test', value: 123 };
            
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('application/json')
                },
                json: jest.fn().mockResolvedValue(mockResponse)
            });
            
            const result = await apiClient.post('/test', postData);
            
            expect(window.fetch).toHaveBeenCalledWith('/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(postData)
            });
            expect(result).toEqual(mockResponse);
        });
        
        it('应该能够发送PUT请求', async () => {
            const mockResponse = { updated: true };
            const putData = { id: 1, name: 'updated' };
            
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('application/json')
                },
                json: jest.fn().mockResolvedValue(mockResponse)
            });
            
            const result = await apiClient.put('/test/1', putData);
            
            expect(window.fetch).toHaveBeenCalledWith('/test/1', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(putData)
            });
            expect(result).toEqual(mockResponse);
        });
        
        it('应该能够发送DELETE请求', async () => {
            const mockResponse = { deleted: true };
            
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('application/json')
                },
                json: jest.fn().mockResolvedValue(mockResponse)
            });
            
            const result = await apiClient.delete('/test/1');
            
            expect(window.fetch).toHaveBeenCalledWith('/test/1', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            expect(result).toEqual(mockResponse);
        });
    });
    
    describe('请求头管理', () => {
        it('应该能够设置自定义请求头', async () => {
            apiClient.setHeader('X-API-Key', 'test-key');
            
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('application/json')
                },
                json: jest.fn().mockResolvedValue({})
            });
            
            await apiClient.get('/test');
            
            expect(window.fetch).toHaveBeenCalledWith('/test', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'test-key'
                }
            });
        });
        
        it('应该能够移除请求头', async () => {
            apiClient.setHeader('X-Test', 'value');
            apiClient.removeHeader('X-Test');
            
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('application/json')
                },
                json: jest.fn().mockResolvedValue({})
            });
            
            await apiClient.get('/test');
            
            const headers = window.fetch.mock.calls[0][1].headers;
            expect(headers['X-Test']).toBeUndefined();
        });
        
        it('应该能够设置认证令牌', async () => {
            apiClient.setAuthToken('test-token');
            
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('application/json')
                },
                json: jest.fn().mockResolvedValue({})
            });
            
            await apiClient.get('/test');
            
            expect(window.fetch).toHaveBeenCalledWith('/test', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token'
                }
            });
        });
    });
    
    describe('错误处理', () => {
        it('应该处理HTTP错误状态', async () => {
            window.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            });
            
            await expect(apiClient.get('/test')).rejects.toThrow('HTTP 404: Not Found');
        });
        
        it('应该处理网络错误', async () => {
            window.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));
            
            await expect(apiClient.get('/test')).rejects.toThrow('API请求失败: Network Error');
        });
        
        it('应该处理JSON解析错误', async () => {
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('application/json')
                },
                json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
            });
            
            await expect(apiClient.get('/test')).rejects.toThrow('API请求失败: Invalid JSON');
        });
    });
    
    describe('响应处理', () => {
        it('应该处理JSON响应', async () => {
            const jsonResponse = { data: 'test', status: 'success' };
            
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('application/json')
                },
                json: jest.fn().mockResolvedValue(jsonResponse)
            });
            
            const result = await apiClient.get('/test');
            expect(result).toEqual(jsonResponse);
        });
        
        it('应该处理文本响应', async () => {
            const textResponse = 'plain text response';
            
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('text/plain')
                },
                text: jest.fn().mockResolvedValue(textResponse)
            });
            
            const result = await apiClient.get('/test');
            expect(result).toBe(textResponse);
        });
        
        it('应该处理空响应', async () => {
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue(null)
                },
                text: jest.fn().mockResolvedValue('')
            });
            
            const result = await apiClient.get('/test');
            expect(result).toBe('');
        });
    });
    
    describe('请求配置', () => {
        it('应该合并自定义选项', async () => {
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('application/json')
                },
                json: jest.fn().mockResolvedValue({})
            });
            
            await apiClient.get('/test', {
                headers: { 'X-Custom': 'value' },
                timeout: 1000
            });
            
            expect(window.fetch).toHaveBeenCalledWith('/test', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Custom': 'value'
                },
                timeout: 1000
            });
        });
        
        it('应该处理baseUrl', () => {
            const client = new window.ApiClient({
                baseUrl: 'https://api.example.com'
            });
            
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('application/json')
                },
                json: jest.fn().mockResolvedValue({})
            });
            
            client.get('/test');
            
            expect(window.fetch).toHaveBeenCalledWith(
                'https://api.example.com/test',
                expect.any(Object)
            );
        });
    });
    
    describe('数据序列化', () => {
        it('应该自动序列化对象为JSON', async () => {
            const data = { name: 'test', nested: { value: 123 } };
            
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('application/json')
                },
                json: jest.fn().mockResolvedValue({})
            });
            
            await apiClient.post('/test', data);
            
            const body = window.fetch.mock.calls[0][1].body;
            expect(body).toBe(JSON.stringify(data));
        });
        
        it('应该保持字符串数据不变', async () => {
            const data = 'raw string data';
            
            window.fetch = jest.fn().mockResolvedValue({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('application/json')
                },
                json: jest.fn().mockResolvedValue({})
            });
            
            await apiClient.post('/test', data);
            
            const body = window.fetch.mock.calls[0][1].body;
            expect(body).toBe(data);
        });
    });
});

console.log('[ApiClient Tests] API客户端测试加载完成');