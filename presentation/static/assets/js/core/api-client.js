/**
 * API客户端 - 统一的后端API调用接口
 * 负责处理认证、错误处理、请求重试等
 */
class APIClient {
    constructor() {
        this.baseURL = window.location.origin;
        this.sessionId = localStorage.getItem('sessionId') || localStorage.getItem('token');
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    /**
     * 更新会话ID
     */
    updateSessionId(sessionId) {
        this.sessionId = sessionId;
        localStorage.setItem('sessionId', sessionId);
    }

    /**
     * 获取认证头
     */
    getAuthHeaders() {
        if (!this.sessionId) return {};
        
        return {
            'X-Session-Id': this.sessionId,
            'Authorization': `Bearer ${this.sessionId}`
        };
    }

    /**
     * 发送HTTP请求
     * @param {string} endpoint - API端点
     * @param {Object} options - 请求选项
     * @returns {Promise<Object>} - 响应数据
     */
    async request(endpoint, options = {}) {
        const config = {
            ...options,
            headers: {
                ...this.defaultHeaders,
                ...this.getAuthHeaders(),
                ...options.headers
            }
        };

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, config);
            
            if (!response.ok) {
                const error = new Error(`API Error: ${response.status} ${response.statusText}`);
                error.status = response.status;
                error.response = response;
                throw error;
            }

            // 检查响应类型
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }

        } catch (error) {
            console.error(`API请求失败: ${endpoint}`, error);
            
            // 认证错误处理
            if (error.status === 401 || error.status === 403) {
                this.handleAuthError();
            }
            
            throw error;
        }
    }

    /**
     * GET请求
     */
    async get(endpoint, params = {}) {
        const url = new URL(endpoint, this.baseURL);
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });
        
        return this.request(url.pathname + url.search);
    }

    /**
     * POST请求
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT请求
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE请求
     */
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    /**
     * 处理认证错误
     */
    handleAuthError() {
        console.warn('认证失败，清除本地会话');
        localStorage.removeItem('sessionId');
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        
        // 触发认证失败事件
        window.dispatchEvent(new CustomEvent('auth:failed'));
    }

    /**
     * 检查连接状态
     */
    async healthCheck() {
        try {
            await this.get('/api/health');
            return true;
        } catch (error) {
            return false;
        }
    }
}

// 创建全局API客户端实例
window.apiClient = new APIClient();

export default APIClient;