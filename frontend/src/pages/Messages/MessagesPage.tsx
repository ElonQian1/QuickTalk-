import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { normalizeShopsList } from '../../utils/normalize';
import { ConversationCard as ModularConversationCard } from '../../components/Messages';
import { EmptyState, EmptyIcon, EmptyTitle, EmptyDescription } from '../../components/UI';
import { api } from '../../config/api';
import { LoadingSpinner } from '../../styles/globalStyles';
import { theme } from '../../styles/globalStyles';
import toast from 'react-hot-toast';
import { useConversationsStore } from '../../stores/conversationsStore';

const Container = styled.div`
  padding: ${theme.spacing.md};
  padding-bottom: ${theme.spacing.xxl}; /* 原 80px → xxl(40) 可视需求再扩，可引入 footerHeight token */
  height: 100vh;
  overflow-y: auto;
`;

const Header = styled.div`
  margin-bottom: ${theme.spacing.lg};
`;

const Title = styled.h2`
  font-size: ${theme.typography.h2};
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.sm};
`;

const Subtitle = styled.p`
  font-size: ${theme.typography.small};
  color: ${theme.colors.text.secondary};
`;

const ConversationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.hair}; /* 原 1px */
  background: ${theme.colors.divider};
  border-radius: ${theme.borderRadius.medium};
  overflow: hidden;
`;

interface Shop {
  id: number;
  shop_name: string;
  unread_count?: number;
}

interface Conversation {
  shop: Shop;
  customer_count: number;
  last_message?: {
    content: string;
    created_at: string;
    sender_type: string;
  };
  unread_count: number;
}

const MessagesPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const unreads = useConversationsStore(state => state.unreads);
  const navigate = useNavigate();

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      // 获取所有店铺
      const shopsResponse = await api.get('/api/shops');
      const shops = normalizeShopsList(shopsResponse.data).map(s => ({ id: s.id, shop_name: s.shop_name, unread_count: s.unread_count })) as Shop[];

      // 为每个店铺获取对话数据
      const conversationData = await Promise.all(
        shops.map(async (shop: Shop) => {
          try {
            const customersResponse = await api.get(`/api/shops/${shop.id}/customers`);
            const customers = customersResponse.data;
            
            const unreadCount = customers.reduce((total: number, customer: any) => {
              return total + (customer.unread_count || 0);
            }, 0);

            const lastMessage = customers.length > 0 && customers[0].last_message 
              ? customers[0].last_message 
              : null;

            return {
              shop: { ...shop, unread_count: unreadCount },
              customer_count: customers.length,
              last_message: lastMessage,
              unread_count: unreadCount,
            };
          } catch (error) {
            return {
              shop: { ...shop, unread_count: 0 },
              customer_count: 0,
              last_message: null,
              unread_count: 0,
            };
          }
        })
      );

      setConversations(conversationData);

      // 统计数据在页面顶部卡片已移除，故不再计算聚合统计

      // 初始化全局 unread store（shopId -> unread）
      useConversationsStore.getState().setManyUnreads(
        conversationData.map((c: Conversation) => ({ shopId: c.shop.id, count: c.unread_count }))
      );

    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('获取消息列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConversationClick = (conversation: Conversation) => {
    navigate(`/shops/${conversation.shop.id}/customers`);
  };

  if (loading) {
    return (
      <Container>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <LoadingSpinner />
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>消息中心</Title>
        <Subtitle>管理所有店铺的客户对话</Subtitle>
      </Header>

      {conversations.length === 0 ? (
        <EmptyState>
          <EmptyIcon>💬</EmptyIcon>
          <EmptyTitle>暂无对话</EmptyTitle>
          <EmptyDescription>当有客户发起对话时，会显示在这里</EmptyDescription>
        </EmptyState>
      ) : (
        <ConversationList>
          {conversations.map((conversation) => {
            const unreadFromStore = unreads[conversation.shop.id] ?? conversation.unread_count;
            return (
              <ModularConversationCard
                key={conversation.shop.id}
                shopName={conversation.shop.shop_name}
                customerCount={conversation.customer_count}
                unreadCount={unreadFromStore}
                lastMessage={conversation.last_message}
                onClick={() => handleConversationClick(conversation)}
              />
            );
          })}
        </ConversationList>
      )}
    </Container>
  );
};

export default MessagesPage;