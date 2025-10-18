/**
 * 客户列表页适配器
 * 根据 Feature Flag 选择使用新Store或旧逻辑
 */

import { useState, useEffect } from 'react';
import { featureFlags } from '../stores/config/featureFlags';
import { useCustomersStoreV2, type Customer as CustomerV2 } from '../stores/v2';
import { api } from '../config/api';

export interface CustomerWithStats {
  id: number;
  shop_id: number;
  customer_id: string;
  customer_name?: string;
  last_active_at?: string;
  last_message?: string;
  unread_count: number;
  created_at: string;
  session_id?: number;
}

/**
 * 客户列表数据加载 Hook
 */
export function useCustomersData(shopId: number | null) {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // V2 Store（新架构）
  const customersByShop = useCustomersStoreV2(state => state.customersByShop);
  const loadingV2 = useCustomersStoreV2(state => state.loading);
  const errorV2 = useCustomersStoreV2(state => state.error);
  const fetchCustomersV2 = useCustomersStoreV2(state => state.fetchCustomers);
  const updateCustomerV2 = useCustomersStoreV2(state => state.updateCustomer);

  useEffect(() => {
    if (shopId) {
      loadCustomers(shopId);
    }
  }, [shopId]);

  const loadCustomers = async (targetShopId: number) => {
    // 使用新Store
    if (featureFlags.USE_NEW_CUSTOMERS_STORE) {
      console.log(`🆕 使用新客户Store加载店铺${targetShopId}`);
      await fetchCustomersV2(targetShopId);
      return;
    }

    // 使用旧逻辑
    console.log(`🔙 使用旧客户逻辑加载店铺${targetShopId}`);
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      const response = await api.get(`/api/shops/${targetShopId}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const customersData: CustomerWithStats[] = response.data;
      setCustomers(customersData);
      setLoading(false);
    } catch (err: any) {
      console.error('❌ 加载客户失败:', err);
      setError(err.response?.data?.error || '加载客户失败');
      setLoading(false);
    }
  };

  // 转换新Store数据为统一格式
  const transformedCustomers = featureFlags.USE_NEW_CUSTOMERS_STORE && shopId
    ? (customersByShop[shopId] || []).map(c => ({
        id: c.id,
        shop_id: c.shop_id,
        customer_id: c.customer_id,
        customer_name: c.customer_name,
        last_active_at: c.last_active_at,
        last_message: c.last_message,
        unread_count: c.unread_count,
        created_at: c.created_at,
      } as CustomerWithStats))
    : customers;

  return {
    customers: transformedCustomers,
    loading: featureFlags.USE_NEW_CUSTOMERS_STORE ? loadingV2 : loading,
    error: featureFlags.USE_NEW_CUSTOMERS_STORE ? errorV2 : error,
    reload: () => shopId && loadCustomers(shopId),
    updateCustomer: (customerId: string, updates: Partial<CustomerV2>) => {
      if (featureFlags.USE_NEW_CUSTOMERS_STORE && shopId) {
        updateCustomerV2(shopId, customerId, updates);
      } else {
        // 旧逻辑：直接更新本地状态
        setCustomers(prev => 
          prev.map(c => c.customer_id === customerId ? { ...c, ...updates } : c)
        );
      }
    }
  };
}

/**
 * WebSocket实时更新客户信息
 */
export function useCustomerWebSocketUpdates(
  shopId: number | null,
  updateCustomer: (customerId: string, updates: Partial<CustomerV2>) => void
) {
  useEffect(() => {
    if (!shopId) return;

    // 监听WebSocket消息
    const handleWSMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const messageType = data?.messageType || data?.message_type;
        
        if (messageType === 'new_message') {
          const metadata = data?.metadata || {};
          const msgShopId = metadata.shopId || metadata.shop_id;
          
          if (msgShopId === shopId) {
            const customerId = metadata.customerId || metadata.customer_id;
            const content = data.content || '';
            const senderType = data.sender_type || data.senderType || 'customer';
            
            if (customerId) {
              updateCustomer(customerId, {
                last_message: content,
                last_active_at: new Date().toISOString(),
                unread_count: senderType === 'customer' ? 1 : 0,
              });
            }
          }
        }
      } catch (err) {
        console.debug('WebSocket消息解析失败:', err);
      }
    };

    // TODO: 接入实际的WebSocket连接
    // wsStore.addListener(handleWSMessage);
    // return () => wsStore.removeListener(handleWSMessage);

    console.log('📡 WebSocket监听已启用（待接入实际连接）');
  }, [shopId, updateCustomer]);
}
