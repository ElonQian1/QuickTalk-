export interface ShopNormalized {
  id: number;
  shop_name: string;
  shop_url?: string;
  api_key?: string;
  created_at?: string;
  unread_count?: number;
}

export function normalizeShopsList(input: any[]): ShopNormalized[] {
  return (input || []).map((it: any) => ({
    id: it?.shop?.id ?? it?.id,
    shop_name: it?.shop?.shop_name ?? it?.shop_name,
    shop_url: it?.shop?.shop_url ?? it?.shop_url,
    api_key: it?.shop?.api_key ?? it?.api_key,
    created_at: it?.shop?.created_at ?? it?.created_at,
    unread_count: it?.unread_count ?? it?.unreadTotal ?? 0,
  })).filter((s: any) => !!s.id && !!s.shop_name);
}
