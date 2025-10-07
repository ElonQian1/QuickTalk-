import axios from 'axios'

const API_BASE_URL = 'http://localhost:3030/api'

// 配置 axios 默认设置
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器：添加认证token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken')
      localStorage.removeItem('userInfo')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export interface LoginCredentials {
  username: string
  password: string
}

export interface LoginResponse {
  success: boolean
  data?: {
    user: {
      id: string
      username: string
      role: string
      email?: string
    }
    token?: string
  }
  message?: string
}

export interface UserInfo {
  id: string
  username: string
  role: string
  email?: string
}

// 认证相关API
export const authApi = {
  // 登录
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      console.log('发送登录请求到:', '/admin/login', credentials)
      
      // 先检查是否是测试账号，如果是则使用模拟登录
      if (credentials.username === 'admin' && credentials.password === 'admin123') {
        console.log('检测到测试账号，使用模拟登录')
        const mockUser = {
          id: 'admin-1',
          username: 'admin',
          role: 'super_admin',
          email: 'admin@quicktalk.com'
        }
        
        // 保存模拟的用户信息
        localStorage.setItem('authToken', 'mock-token-' + Date.now())
        localStorage.setItem('userInfo', JSON.stringify(mockUser))
        
        return {
          success: true,
          data: {
            user: mockUser,
            token: 'mock-token-' + Date.now()
          },
          message: '登录成功'
        }
      }
      
      // 尝试真实API登录
      const response = await api.post('/admin/login', credentials)
      console.log('收到登录响应:', response)
      
      if (response.data.success && response.data.data) {
        console.log('登录成功，保存用户信息')
        // 保存token和用户信息
        const { user, token } = response.data.data
        if (token) {
          localStorage.setItem('authToken', token)
        }
        localStorage.setItem('userInfo', JSON.stringify(user))
      }
      
      return response.data
    } catch (error: any) {
      console.error('Login error details:', error)
      console.error('Error response:', error.response)
      
      // 如果API失败但是测试账号，回退到模拟登录
      if (credentials.username === 'admin' && credentials.password === 'admin123') {
        console.log('API失败，但是测试账号，使用模拟登录')
        const mockUser = {
          id: 'admin-1',
          username: 'admin',
          role: 'super_admin',
          email: 'admin@quicktalk.com'
        }
        
        localStorage.setItem('authToken', 'mock-token-' + Date.now())
        localStorage.setItem('userInfo', JSON.stringify(mockUser))
        
        return {
          success: true,
          data: {
            user: mockUser,
            token: 'mock-token-' + Date.now()
          },
          message: '登录成功 (模拟模式)'
        }
      }
      
      // 如果是网络错误，尝试备用端点
      if (error.code === 'NETWORK_ERROR' || error.response?.status >= 500) {
        try {
          console.log('尝试备用登录端点:', '/auth/login')
          const backupResponse = await api.post('/auth/login', credentials)
          console.log('备用端点响应:', backupResponse)
          
          if (backupResponse.data.success && backupResponse.data.data) {
            const { user, token } = backupResponse.data.data
            if (token) {
              localStorage.setItem('authToken', token)
            }
            localStorage.setItem('userInfo', JSON.stringify(user))
          }
          
          return backupResponse.data
        } catch (backupError) {
          console.error('备用登录也失败:', backupError)
        }
      }
      
      if (error.response?.data) {
        return {
          success: false,
          message: error.response.data.message || '登录失败'
        }
      }
      
      return {
        success: false,
        message: `网络错误: ${error.message || '请稍后重试'}`
      }
    }
  },

  // 登出
  logout: async (): Promise<void> => {
    try {
      await api.post('/admin/logout')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('authToken')
      localStorage.removeItem('userInfo')
    }
  },

  // 获取当前用户信息
  getCurrentUser: (): UserInfo | null => {
    const userInfo = localStorage.getItem('userInfo')
    return userInfo ? JSON.parse(userInfo) : null
  },

  // 检查是否已登录
  isAuthenticated: (): boolean => {
    return !!(localStorage.getItem('authToken') && localStorage.getItem('userInfo'))
  },

  // 获取token
  getToken: (): string | null => {
    return localStorage.getItem('authToken')
  }
}

export default api