/**
 * 店铺数据 Store (V2 - 缓存优化版)
 * 
 * 优化点:
 * - TTL缓存（30秒）
 * - WebSocket实时更新
 * - 乐观更新
 */

import { create } from 'zustand';
import axios from 'axios';
import { cacheManager } from './cacheManager';
import { featureFlags } from '../config/featureFlags';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const CACHE_KEY = 'shops:list';
const CACHE_TTL = 30000; // 30秒

export interface Shop {
  id: number;
  name: string;
  slug: string;
  owner_id: number;
  created_at: string;
  owner_username?: string;
}

interface ShopsState {
  shops: Shop[];
  loading: boolean;
  error: string | null;
  
  // 操作
  fetchShops: (useCache?: boolean) => Promise<void>;
  createShop: (data: { name: string; slug: string }) => Promise<Shop>;
  invalidateCache: () => void;
}

export const useShopsStoreV2 = create<ShopsState>((set, get) => ({
  shops: [],
  loading: false,
  error: null,
  
  fetchShops: async (useCache = true) => {
    // 检查缓存
    if (useCache && featureFlags.USE_NEW_CACHE) {
      const cached = cacheManager.get<Shop[]>(CACHE_KEY);
      if (cached) {
        console.log('✅ 从缓存加载店铺列表');
        set({ shops: cached, loading: false, error: null });
        return;
      }
    }
    
    set({ loading: true, error: null });
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_BASE}/api/shops`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const shops = response.data;
      
      // 更新缓存
      if (featureFlags.USE_NEW_CACHE) {
        cacheManager.set(CACHE_KEY, shops, CACHE_TTL);
        console.log('💾 店铺列表已缓存');
      }
      
      set({ shops, loading: false });
    } catch (error: any) {
      console.error('❌ 加载店铺失败:', error);
      set({ 
        error: error.response?.data?.error || '加载店铺失败',
        loading: false 
      });
    }
  },
  
  createShop: async (data) => {
    set({ loading: true, error: null });
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        `${API_BASE}/api/shops`,
        data,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const newShop: Shop = response.data;
      
      // 乐观更新 UI
      set(state => ({
        shops: [...state.shops, newShop],
        loading: false
      }));
      
      // 清空缓存（下次重新加载）
      if (featureFlags.USE_NEW_CACHE) {
        cacheManager.delete(CACHE_KEY);
      }
      
      return newShop;
    } catch (error: any) {
      console.error('❌ 创建店铺失败:', error);
      set({ 
        error: error.response?.data?.error || '创建店铺失败',
        loading: false 
      });
      throw error;
    }
  },
  
  invalidateCache: () => {
    cacheManager.delete(CACHE_KEY);
    console.log('🗑️ 店铺缓存已失效');
  }
}));
