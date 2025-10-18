/**
 * 店铺列表页适配器
 * 根据 Feature Flag 选择使用新Store或旧逻辑
 */

import React, { useEffect, useState } from 'react';
import { featureFlags } from '../stores/config/featureFlags';
import { useShopsStoreV2, type Shop as ShopV2 } from '../stores/v2';
import { useNotificationsStore } from '../stores/notificationsStore';
import { formatBadgeCount } from '../utils/format';

// 旧版接口（保持兼容）
import { listOwnerShopsOverview, listStaffShopsOverview, ShopOverview } from '../services/overview';
import { loadConversationsForMessagesPage, Conversation } from '../modules/messages/conversations';

export interface ShopWithStats {
  id: number;
  shop_name: string;
  shop_url?: string;
  api_key: string;
  created_at: string;
  unread_count?: number;
  my_role?: 'owner' | 'staff';
  last_activity?: string | null;
  customer_count?: number;
}

/**
 * 店铺数据加载 Hook
 * 自动根据 Feature Flag 选择数据源
 */
export function useShopsData() {
  const [shops, setShops] = useState<ShopWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convByShop, setConvByShop] = useState<Record<number, Conversation>>({});
  
  const byShop = useNotificationsStore(state => state.byShop);
  
  // V2 Store（新架构）
  const shopsV2 = useShopsStoreV2(state => state.shops);
  const loadingV2 = useShopsStoreV2(state => state.loading);
  const errorV2 = useShopsStoreV2(state => state.error);
  const fetchShopsV2 = useShopsStoreV2(state => state.fetchShops);

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    // 使用新Store
    if (featureFlags.USE_NEW_SHOPS_STORE) {
      console.log('🆕 使用新店铺Store');
      await fetchShopsV2();
      return;
    }

    // 使用旧逻辑
    console.log('🔙 使用旧店铺逻辑');
    try {
      setLoading(true);
      setError(null);

      const [ownerOverview, staffOverview] = await Promise.all([
        listOwnerShopsOverview().catch(() => [] as ShopOverview[]),
        listStaffShopsOverview().catch(() => [] as ShopOverview[]),
      ]);

      const convMap: Record<number, Conversation> = {};
      const map = new Map<number, ShopWithStats>();

      // Owner shops
      for (const item of ownerOverview) {
        const s = item.shop;
        map.set(s.id, {
          id: s.id,
          shop_name: s.shop_name,
          shop_url: s.shop_url || undefined,
          api_key: s.api_key,
          created_at: s.created_at,
          unread_count: item.unread_count || 0,
          my_role: 'owner',
          customer_count: item.customer_count || 0,
        });
        
        convMap[s.id] = {
          shop: { id: s.id, shop_name: s.shop_name },
          customer_count: item.customer_count || 0,
          unread_count: item.unread_count || 0,
          last_message: item.last_message ? {
            content: item.last_message.content,
            created_at: item.last_message.created_at,
            sender_type: item.last_message.sender_type,
          } : undefined,
        };
      }

      // Staff shops
      for (const item of staffOverview) {
        const s = item.shop;
        if (!map.has(s.id)) {
          map.set(s.id, {
            id: s.id,
            shop_name: s.shop_name,
            shop_url: s.shop_url || undefined,
            api_key: s.api_key,
            created_at: s.created_at,
            unread_count: item.unread_count || 0,
            my_role: 'staff',
            customer_count: item.customer_count || 0,
          });
          
          convMap[s.id] = {
            shop: { id: s.id, shop_name: s.shop_name },
            customer_count: item.customer_count || 0,
            unread_count: item.unread_count || 0,
            last_message: item.last_message ? {
              content: item.last_message.content,
              created_at: item.last_message.created_at,
              sender_type: item.last_message.sender_type,
            } : undefined,
          };
        }
      }

      const shopsList = Array.from(map.values());
      setShops(shopsList);
      setConvByShop(convMap);
      setLoading(false);
    } catch (err: any) {
      console.error('❌ 加载店铺失败:', err);
      setError(err.message || '加载店铺失败');
      setLoading(false);
    }
  };

  // 转换新Store数据为统一格式
  const transformedShops = featureFlags.USE_NEW_SHOPS_STORE
    ? shopsV2.map(shop => ({
        id: shop.id,
        shop_name: shop.name,
        shop_url: shop.slug ? `${window.location.origin}/shop/${shop.slug}` : undefined,
        api_key: '', // V2不返回API Key
        created_at: shop.created_at,
        unread_count: byShop[shop.id] || 0,
        my_role: 'owner' as const, // V2暂时都视为owner
        customer_count: 0,
      } as ShopWithStats))
    : shops;

  return {
    shops: transformedShops,
    loading: featureFlags.USE_NEW_SHOPS_STORE ? loadingV2 : loading,
    error: featureFlags.USE_NEW_SHOPS_STORE ? errorV2 : error,
    convByShop,
    reload: loadShops,
  };
}

/**
 * 创建店铺 Hook
 */
export function useCreateShop() {
  const createShopV2 = useShopsStoreV2(state => state.createShop);
  const [creating, setCreating] = useState(false);

  const createShop = async (data: { name: string; slug: string }) => {
    if (featureFlags.USE_NEW_SHOPS_STORE) {
      console.log('🆕 使用新Store创建店铺');
      return await createShopV2(data);
    }

    // 旧逻辑
    console.log('🔙 使用旧逻辑创建店铺');
    setCreating(true);
    try {
      const { api } = await import('../config/api');
      const response = await api.post('/api/shops', data);
      return response.data;
    } finally {
      setCreating(false);
    }
  };

  return { createShop, creating };
}
