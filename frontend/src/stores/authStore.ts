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
          const response = await api.post('/api/auth/register', {
            username,
            password,
            email,
            phone,
          });

          const { token, user } = response.data;
          
          // 设置默认的 Authorization header
          setAuthToken(token);
          
          set({
            isAuthenticated: true,
            user,
            token,
          });

          toast.success('注册成功');
          return true;
        } catch (error: any) {
          const message = error.response?.data?.message || '注册失败';
          toast.error(message);
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