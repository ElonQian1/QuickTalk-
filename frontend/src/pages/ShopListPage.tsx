import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { FiPlus, FiGlobe } from 'react-icons/fi';
import { api } from '../config/api';
import { listStaffShops } from '../services/shops';
import { listOwnerShopsOverview, listStaffShopsOverview, ShopOverview } from '../services/overview';
import { normalizeShopsList } from '../utils/normalize';
import { Button, Card, LoadingSpinner, Badge } from '../styles/globalStyles';
import { EmptyState, EmptyIcon, EmptyTitle, EmptyDescription } from '../components/UI';
import { ShopManageButton, ShopManageModal } from '../components/shops';
import { theme } from '../styles/globalStyles';
import toast from 'react-hot-toast';
import CreateShopModal from '../components/CreateShopModal';
import { useNotificationsStore } from '../stores/notificationsStore';
import { formatBadgeCount } from '../utils/format';
import { formatRelativeTime, formatMessagePreview } from '../utils/display';
import { useNavigate } from 'react-router-dom';
import { loadConversationsForMessagesPage, Conversation } from '../modules/messages/conversations';
import { useWSStore } from '../stores/wsStore';
import { sortShopsWithState } from '../utils/sort';

const Container = styled.div`
  padding: ${theme.spacing.md};
  height: 100%;
  overflow-y: auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${theme.spacing.lg};
`;

const Title = styled.h2`
  font-size: ${theme.typography.h2};
  color: ${theme.colors.text.primary};
`;

const ShopList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

const ShopCard = styled(Card)<{ $role?: 'owner' | 'staff' }>`
  padding: ${theme.spacing.md};
  transition: all 0.2s ease;
  position: relative;

  /* 员工店铺：左侧角色强调条 */
  ${p => p.$role === 'staff' && `
    box-shadow: inset 4px 0 0 ${theme.colors.secondary};
    background: #f6f8ff; /* 略带蓝灰底色，区分 owner */
    border: 1px dashed ${theme.colors.border};
  `}
`;

const ShopUnreadBadge = styled(Badge)`
  position: absolute;
  top: 8px;
  right: 8px;
`;

const ShopHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  margin-bottom: ${theme.spacing.sm};
`;

const ShopIcon = styled.div<{ $role?: 'owner' | 'staff' }>`
  position: relative;
  width: 48px;
  height: 48px;
  background: ${p => (p.$role === 'staff' ? theme.colors.secondary : theme.colors.primary)};
  border-radius: ${theme.borderRadius.medium};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.white};
  font-size: 20px;
  font-weight: bold;
`;

const ShopInfo = styled.div`
  flex: 1;
  overflow: hidden;
`;

const ShopName = styled.h3`
  font-size: ${theme.typography.body};
  font-weight: 600;
  color: ${theme.colors.text.primary};
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RolePill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  margin-left: 8px;
  border-radius: 999px;
  font-size: 12px;
  color: ${theme.colors.secondary};
  background: rgba(87, 107, 149, 0.12);
  border: 1px solid rgba(87, 107, 149, 0.25);
  flex-shrink: 0;
`;

const ShopUrl = styled.p`
  font-size: ${theme.typography.small};
  color: ${theme.colors.text.secondary};
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LastMessage = styled.div`
  margin-top: ${theme.spacing.sm};
`;

const MessageContent = styled.div`
  font-size: ${theme.typography.small};
  color: ${theme.colors.text.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: ${theme.spacing.micro};
`;

const MessageTime = styled.div`
  font-size: ${theme.typography.caption};
  color: ${theme.colors.text.placeholder};
`;

// 统计区域移除，改为右上角管理按钮。保留命名占位可在未来扩展（例如显示订单统计）。

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
`;

interface Shop {
  id: number;
  shop_name: string;
  shop_url?: string;
  api_key: string; // 仍从后端获取但不在卡片直接展示
  created_at: string;
  unread_count?: number; // 仍获取但不显示
  my_role?: 'owner' | 'staff';
  last_activity?: string | null;
  customer_count?: number;
}

const ShopListPage: React.FC = () => {
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // 移除店铺点击跳转：改为仅通过“管理”按钮操作。
  const [manageOpen, setManageOpen] = useState(false);
  const [activeShop, setActiveShop] = useState<Shop | undefined>();
  const [initialTab, setInitialTab] = useState<'info' | 'staff' | 'apiKey'>('info');
  const byShop = useNotificationsStore(state => state.byShop);
  const { addMessageListener, removeMessageListener } = useWSStore();

  // shopId -> 会话快照（未读与最近消息）
  const [convByShop, setConvByShop] = useState<Record<number, Conversation>>({});
  const [usedOverview, setUsedOverview] = useState(false);

  useEffect(() => {
    fetchShops();
  }, []);

  // 加载会话汇总（回退方案）：仅在未使用 overview 成功时调用
  useEffect(() => {
    if (usedOverview) return;
    const run = async () => {
      try {
        const list = await loadConversationsForMessagesPage();
        const map: Record<number, Conversation> = {};
        for (const c of list) map[c.shop.id] = c;
        setConvByShop(map);
      } catch (e) {
        console.debug('加载会话汇总失败（忽略）：', e);
      }
    };
    run();
  }, [usedOverview]);

  // 监听 WS：更新对应店铺的未读与最近消息
  useEffect(() => {
    const listener = (data: any) => {
      try {
        const t = data?.messageType || data?.message_type;
        if (t !== 'new_message') return;
        const activeShopId = (() => { try { return useWSStore.getState().activeShopId; } catch { return undefined; } })();
        const shopId: number | undefined = data?.metadata?.shopId || data?.metadata?.shop_id || activeShopId;
        if (!shopId) return;
        const senderType = data?.sender_type || data?.senderType || 'customer';
        const createdAt = data?.timestamp || new Date().toISOString();
        const content = data?.content || '';
        setConvByShop(prev => {
          const old = prev[shopId];
          const unread = (old?.unread_count || 0) + (senderType === 'customer' ? 1 : 0);
          const next: Conversation = {
            shop: old?.shop || { id: shopId, shop_name: String(shopId) },
            customer_count: old?.customer_count || 0,
            unread_count: unread,
            last_message: { content, created_at: createdAt, sender_type: senderType },
          };
          const nextMap = { ...prev, [shopId]: next };
          // 收到新消息后按最新状态重新排序
          setShops(prevShops => sortShopsWithState(prevShops, nextMap, byShop));
          return nextMap;
        });
      } catch {}
    };
    addMessageListener(listener);
    return () => removeMessageListener(listener);
  }, [addMessageListener, removeMessageListener]);

  const fetchShops = async () => {
    try {
      // 优先使用 overview 接口，失败时回退到旧接口
      const [ownerOverview, staffOverview] = await Promise.all([
        listOwnerShopsOverview().catch(() => [] as ShopOverview[]),
        listStaffShopsOverview().catch(() => [] as ShopOverview[]),
      ]);

      if ((ownerOverview?.length || 0) + (staffOverview?.length || 0) > 0) {
        const convMap: Record<number, Conversation> = {};
        const map = new Map<number, Shop>();
        // owner
        for (const item of ownerOverview) {
          const s = item.shop;
          map.set(s.id, {
            id: s.id,
            shop_name: s.shop_name,
            shop_url: s.shop_url || undefined,
            api_key: s.api_key,
            created_at: s.created_at,
            my_role: 'owner',
            last_activity: item.last_activity ?? null,
            customer_count: item.customer_count,
          });
          convMap[s.id] = {
            shop: { id: s.id, shop_name: s.shop_name },
            customer_count: item.customer_count,
            unread_count: item.unread_count ?? 0,
            last_message: item.last_message
              ? { content: item.last_message.content, created_at: item.last_message.created_at, sender_type: item.last_message.sender_type }
              : undefined,
          } as Conversation;
        }
        // staff
        for (const item of staffOverview) {
          const s = item.shop;
          if (!map.has(s.id)) {
            map.set(s.id, {
              id: s.id,
              shop_name: s.shop_name,
              shop_url: s.shop_url || undefined,
              api_key: s.api_key,
              created_at: s.created_at,
              my_role: 'staff',
              last_activity: item.last_activity ?? null,
              customer_count: item.customer_count,
            });
          }
          convMap[s.id] = {
            shop: { id: s.id, shop_name: s.shop_name },
            customer_count: item.customer_count,
            unread_count: item.unread_count ?? 0,
            last_message: item.last_message
              ? { content: item.last_message.content, created_at: item.last_message.created_at, sender_type: item.last_message.sender_type }
              : undefined,
          } as Conversation;
        }

        setConvByShop(convMap);
        const merged = sortShopsWithState(Array.from(map.values()), convMap, byShop);
        setShops(merged);
        setUsedOverview(true);
      } else {
        // 回退到旧接口
        const [ownerRes, staffList] = await Promise.all([
          api.get('/api/shops'),
          listStaffShops().catch(() => []),
        ]);
  
        const ownerNormalized = (normalizeShopsList(ownerRes.data) as Shop[])
          .map(s => ({ ...s, my_role: 'owner' as const }));
  
        const staffNormalized: Shop[] = (staffList || []).map(s => ({
          id: s.id,
          shop_name: s.shop_name,
          shop_url: s.shop_url || undefined,
          api_key: s.api_key,
          created_at: s.created_at,
          unread_count: s.unread_count,
          my_role: 'staff' as const,
        }));
  
        const map = new Map<number, Shop>();
        for (const item of [...ownerNormalized, ...staffNormalized]) {
          if (!map.has(item.id)) map.set(item.id, item);
        }
        const merged = sortShopsWithState(Array.from(map.values()), convByShop, byShop);
        setShops(merged);
        setUsedOverview(false);
      }
    } catch (error) {
      // 回退路径（overview 整体失败）
      try {
        const [ownerRes, staffList] = await Promise.all([
          api.get('/api/shops'),
          listStaffShops().catch(() => []),
        ]);

        const ownerNormalized = (normalizeShopsList(ownerRes.data) as Shop[])
          .map(s => ({ ...s, my_role: 'owner' as const }));

        const staffNormalized: Shop[] = (staffList || []).map(s => ({
          id: s.id,
          shop_name: s.shop_name,
          shop_url: s.shop_url || undefined,
          api_key: s.api_key,
          created_at: s.created_at,
          unread_count: s.unread_count,
          my_role: 'staff' as const,
        }));

        const map = new Map<number, Shop>();
        for (const item of [...ownerNormalized, ...staffNormalized]) {
          if (!map.has(item.id)) map.set(item.id, item);
        }
        const merged = sortShopsWithState(Array.from(map.values()), convByShop, byShop);
        setShops(merged);
        setUsedOverview(false);
      } catch (e2) {
        toast.error('获取店铺列表失败');
        console.error('Error fetching shops:', error, e2);
      }
    } finally {
      setLoading(false);
    }
  };

  // 之前点击卡片跳转逻辑已移除。

  const openManage = (shop: Shop, tab: 'info' | 'staff' | 'apiKey' = 'info') => {
    setActiveShop(shop);
    setInitialTab(tab);
    setManageOpen(true);
  };

  const handleCreateShop = () => {
    setIsCreateModalOpen(true);
  };

  const createShop = async (shopName: string, shopUrl?: string) => {
    try {
      const response = await api.post('/api/shops', {
        shop_name: shopName,
        shop_url: shopUrl,
      });
      
      setShops([response.data, ...shops]);
      toast.success('店铺创建成功');
    } catch (error) {
      toast.error('创建店铺失败');
      console.error('Error creating shop:', error);
      throw error; // 重新抛出错误，让模态框知道创建失败
    }
  };

  if (loading) {
    return (
      <Container>
        <LoadingContainer>
          <LoadingSpinner />
        </LoadingContainer>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>我的店铺</Title>
        <Button
          variant="primary"
          size="small"
          onClick={handleCreateShop}
        >
          <FiPlus style={{ marginRight: '4px' }} />
          添加店铺
        </Button>
      </Header>

      {shops.length === 0 ? (
        <EmptyState>
          <EmptyIcon>🏪</EmptyIcon>
          <EmptyTitle>还没有店铺</EmptyTitle>
          <EmptyDescription>点击右上角添加按钮创建您的第一个店铺</EmptyDescription>
        </EmptyState>
      ) : (
        <ShopList>
          {shops.map((shop) => {
            const isStaff = shop.my_role === 'staff';
            return (
              <ShopCard
                key={shop.id ?? `${shop.shop_name}-${shop.api_key || 'no-key'}`}
                className="fade-in"
                $role={shop.my_role}
              >
                <ShopHeader>
                  <ShopIcon style={{ position: 'relative' }} $role={shop.my_role}>
                    🏪
                  </ShopIcon>
                  {(() => {
                    const unread = (byShop[shop.id] ?? convByShop[shop.id]?.unread_count) || 0;
                    const t = formatBadgeCount(unread);
                    return t ? (<ShopUnreadBadge count={unread}>{t}</ShopUnreadBadge>) : null;
                  })()}

                  <ShopInfo>
                    <ShopName>
                      {shop.shop_name}
                      {isStaff && <RolePill>员工</RolePill>}
                    </ShopName>
                    {(() => {
                      const conv = convByShop[shop.id];
                      const lm = conv?.last_message;
                      const hasPreview = !!lm;
                      return (
                        <LastMessage>
                          <MessageContent>
                            {hasPreview ? (formatMessagePreview(lm as any) || '消息') : '暂无消息'}
                          </MessageContent>
                          <MessageTime>
                            {formatRelativeTime(lm?.created_at || shop.last_activity || shop.created_at)}
                          </MessageTime>
                        </LastMessage>
                      );
                    })()}
                  </ShopInfo>

                  <div>
                      <ShopManageButton
                        shop={shop}
                        mode="direct"
                        onAction={(action) => {
                          openManage(shop, action === 'apiKey' ? 'apiKey' : action === 'staff' ? 'staff' : 'info');
                        }}
                      />
                  </div>
                </ShopHeader>
              </ShopCard>
            );
          })}
        </ShopList>
      )}
      <ShopManageModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        shop={activeShop}
        initialTab={initialTab}
        mode={activeShop?.my_role === 'staff' ? 'staff' : 'owner'}
      />
      
      <CreateShopModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createShop}
      />
    </Container>
  );
};

export default ShopListPage;