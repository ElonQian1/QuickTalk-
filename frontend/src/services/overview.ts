import { api } from '../config/api';

export interface ShopOverview {
  shop: {
    id: number;
    shop_name: string;
    shop_url?: string | null;
    api_key: string;
    status: number;
    created_at: string;
    updated_at: string;
  };
  unread_count: number;
  last_activity?: string | null;
  last_message?: {
    content: string;
    message_type: string;
    sender_type: string;
    created_at: string;
  } | null;
  customer_count: number;
}

export async function listOwnerShopsOverview() {
  const res = await api.get<ShopOverview[]>('/api/shops/overview');
  return res.data;
}

export async function listStaffShopsOverview() {
  const res = await api.get<ShopOverview[]>('/api/staff/shops/overview');
  return res.data;
}
