/**
 * 客户数据 Store (V2 - 缓存优化版)
 * 
 * 优化点:
 * - 按店铺ID分组缓存（20秒TTL）
 * - WebSocket实时更新
 * - 智能排序（置顶逻辑）
 */

import { create } from 'zustand';
import axios from 'axios';
import { cacheManager } from './cacheManager';
import { featureFlags } from '../config/featureFlags';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const CACHE_TTL = 20000; // 20秒

export interface Customer {
  id: number;
  shop_id: number;
  customer_id: string;
  customer_name?: string;
  last_active_at?: string;
  last_message?: string;
  unread_count: number;
  created_at: string;
}

interface CustomersState {
  customersByShop: Record<number, Customer[]>;
  loading: boolean;
  error: string | null;
  
  // 操作
  fetchCustomers: (shopId: number, useCache?: boolean) => Promise<void>;
  updateCustomer: (shopId: number, customerId: string, updates: Partial<Customer>) => void;
  invalidateCache: (shopId: number) => void;
}

export const useCustomersStoreV2 = create<CustomersState>((set, get) => ({
  customersByShop: {},
  loading: false,
  error: null,
  
  fetchCustomers: async (shopId: number, useCache = true) => {
    const cacheKey = `customers:shop:${shopId}`;
    
    // 检查缓存
    if (useCache && featureFlags.USE_NEW_CACHE) {
      const cached = cacheManager.get<Customer[]>(cacheKey);
      if (cached) {
        console.log(`✅ 从缓存加载店铺${shopId}的客户列表`);
        set(state => ({
          customersByShop: {
            ...state.customersByShop,
            [shopId]: cached
          },
          loading: false,
          error: null
        }));
        return;
      }
    }
    
    set({ loading: true, error: null });
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(
        `${API_BASE}/api/shops/${shopId}/customers`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const customers: Customer[] = response.data;
      
      // 更新缓存
      if (featureFlags.USE_NEW_CACHE) {
        cacheManager.set(cacheKey, customers, CACHE_TTL);
        console.log(`💾 店铺${shopId}客户列表已缓存`);
      }
      
      set(state => ({
        customersByShop: {
          ...state.customersByShop,
          [shopId]: customers
        },
        loading: false
      }));
    } catch (error: any) {
      console.error('❌ 加载客户失败:', error);
      set({ 
        error: error.response?.data?.error || '加载客户失败',
        loading: false 
      });
    }
  },
  
  /**
   * 更新单个客户（WebSocket实时推送使用）
   */
  updateCustomer: (shopId: number, customerId: string, updates: Partial<Customer>) => {
    set(state => {
      const customers = state.customersByShop[shopId] || [];
      const index = customers.findIndex(c => c.customer_id === customerId);
      
      if (index === -1) {
        // 新客户 - 不添加到列表顶部
        console.log('⚠️ 新客户需要重新加载列表');
        return state;
      }
      
      // 更新现有客户
      const updatedCustomers = [...customers];
      updatedCustomers[index] = {
        ...updatedCustomers[index],
        ...updates
      };
      
      // 重新排序（last_active_at降序，NULL排最后）
      updatedCustomers.sort((a, b) => {
        if (!a.last_active_at) return 1;
        if (!b.last_active_at) return -1;
        return new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime();
      });
      
      // 更新缓存
      if (featureFlags.USE_NEW_CACHE) {
        const cacheKey = `customers:shop:${shopId}`;
        cacheManager.set(cacheKey, updatedCustomers, CACHE_TTL);
      }
      
      return {
        customersByShop: {
          ...state.customersByShop,
          [shopId]: updatedCustomers
        }
      };
    });
  },
  
  invalidateCache: (shopId: number) => {
    const cacheKey = `customers:shop:${shopId}`;
    cacheManager.delete(cacheKey);
    console.log(`🗑️ 店铺${shopId}客户缓存已失效`);
  }
}));
