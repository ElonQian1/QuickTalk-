import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// 使用集中管理的 Axios 实例
import { api, setAuthToken } from '../config/api';
import toast from 'react-hot-toast';

interface User {
  id: number;
  username: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (username: string, password: string, email?: string, phone?: string) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      token: null,

      login: async (username: string, password: string) => {
        try {
          const response = await api.post('/api/auth/login', {
            username,
            password,
          });

          const { token, user } = response.data;
          
          // 设置默认的 Authorization header
          setAuthToken(token);
          
          set({
            isAuthenticated: true,
            user,
            token,
          });

          toast.success('登录成功');
          return true;
        } catch (error: any) {
          const message = error.response?.data?.message || '登录失败';
          toast.error(message);
          return false;
        }
      },

      logout: () => {
        // 清除 Authorization header
  setAuthToken(undefined);
        
        set({
          isAuthenticated: false,
          user: null,
          token: null,
        });

        toast.success('已退出登录');
      },

      register: async (username: string, password: string, email?: string, phone?: string) => {
        try {
          console.log('🚀 开始注册流程...');
          console.log('📋 注册数据:', { username, email, phone, hasPassword: !!password });
          
          // 检查API健康状况
          console.log('🔍 检查API连接...');
          const healthResponse = await api.get('/health');
          console.log('✅ API连接正常:', healthResponse.data);
          
          console.log('📤 发送注册请求...');
          const response = await api.post('/api/auth/register', {
            username,
            password,
            email,
            phone,
          });

          console.log('📨 注册响应:', response.data);
          console.log('📨 响应状态:', response.status);
          
          const { token, user } = response.data;
          
          if (!token || !user) {
            console.error('❌ 响应缺少token或user信息');
            toast.error('注册响应格式错误');
            return false;
          }
          
          console.log('✅ 注册数据验证通过');
          
          // 设置默认的 Authorization header
          setAuthToken(token);
          
          set({
            isAuthenticated: true,
            user,
            token,
          });

          console.log('✅ 状态更新完成');
          toast.success('注册成功');
          return true;
        } catch (error: any) {
          console.error('❌ 注册错误详情:', error);
          console.error('❌ 错误类型:', error.constructor.name);
          console.error('❌ 错误代码:', error.code);
          
          if (error.response) {
            console.error('❌ 响应错误:', error.response.status, error.response.data);
          } else if (error.request) {
            console.error('❌ 请求错误:', error.request);
          }
          
          if (error.code === 'ERR_NETWORK') {
            toast.error('无法连接到服务器，请检查网络连接');
          } else if (error.response?.status === 409) {
            toast.error('用户名已存在，请选择其他用户名');
          } else if (error.response?.status === 400) {
            toast.error('请求参数错误，请检查输入信息');
          } else {
            const message = error.response?.data?.error || error.response?.data?.message || '注册失败';
            toast.error(message);
          }
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
      }),
      onRehydrateStorage: () => (state) => {
        // 恢复时设置 Authorization header
        if (state?.token) {
          setAuthToken(state.token || undefined);
        }
      },
    }
  )
);