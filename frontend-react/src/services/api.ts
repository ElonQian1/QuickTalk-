import axios, { AxiosResponse } from 'axios'
import { 
  Conversation, 
  Message, 
  ApiResponse, 
  ConversationListResponse, 
  MessageListResponse,
  SendMessageForm 
} from '@/types'

// API 客户端配置
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器 - 添加认证头
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器 - 统一错误处理
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      window.location.href = '/admin/login'
    }
    return Promise.reject(error)
  }
)

// 对话相关 API
export const conversationApi = {
  // 获取对话列表
  async getConversations(shopId?: string, page = 1, limit = 20): Promise<Conversation[]> {
    const params = new URLSearchParams()
    if (shopId) params.append('shop_id', shopId)
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    
    const response: AxiosResponse<ApiResponse<ConversationListResponse>> = await apiClient.get(
      `/conversations?${params.toString()}`
    )
    
    if (response.data.success && response.data.data) {
      return response.data.data.conversations
    }
    throw new Error(response.data.error || '获取对话列表失败')
  },

  // 获取单个对话详情
  async getConversation(conversationId: string): Promise<Conversation> {
    const response: AxiosResponse<ApiResponse<Conversation>> = await apiClient.get(
      `/conversations/${conversationId}`
    )
    
    if (response.data.success && response.data.data) {
      return response.data.data
    }
    throw new Error(response.data.error || '获取对话详情失败')
  },

  // 获取对话消息列表
  async getMessages(conversationId: string, page = 1, limit = 50): Promise<Message[]> {
    const response: AxiosResponse<ApiResponse<MessageListResponse>> = await apiClient.get(
      `/conversations/${conversationId}/messages?page=${page}&limit=${limit}`
    )
    
    if (response.data.success && response.data.data) {
      return response.data.data.messages
    }
    throw new Error(response.data.error || '获取消息列表失败')
  },

  // 发送消息 (DDD API)
  async sendMessage(params: {
    conversationId: string
    content: string
    type?: 'text' | 'image' | 'file'
  }): Promise<void> {
    const { conversationId, content, type = 'text' } = params
    
    const response = await apiClient.post(`/ddd/conversations/${conversationId}/messages`, {
      content,
      sender_type: 'agent', // 默认为客服发送
      sender_id: '1', // TODO: 从认证上下文获取
      message_type: type,
    })
    
    if (!response.data.success) {
      throw new Error(response.data.error || '发送消息失败')
    }
  },

  // 创建新对话
  async createConversation(params: {
    shopId: string
    customerId: string
  }): Promise<Conversation> {
    const response: AxiosResponse<ApiResponse<Conversation>> = await apiClient.post(
      '/conversations',
      params
    )
    
    if (response.data.success && response.data.data) {
      return response.data.data
    }
    throw new Error(response.data.error || '创建对话失败')
  },

  // 更新对话状态
  async updateConversationStatus(conversationId: string, status: 'open' | 'closed' | 'pending'): Promise<void> {
    const response = await apiClient.patch(`/conversations/${conversationId}/status`, {
      status,
    })
    
    if (!response.data.success) {
      throw new Error(response.data.error || '更新对话状态失败')
    }
  },
}

// 文件上传 API
export const uploadApi = {
  async uploadFile(file: File): Promise<{ url: string }> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await apiClient.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    
    if (response.data.success && response.data.data) {
      return response.data.data
    }
    throw new Error(response.data.error || '文件上传失败')
  },
}

// 健康检查 API
export const healthApi = {
  async check(): Promise<{ status: string; timestamp: string }> {
    const response = await apiClient.get('/health')
    return response.data
  },
}

export default apiClient