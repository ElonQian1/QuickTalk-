import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { loadConversationsForMessagesPage, Conversation } from '../../modules/messages/conversations';
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

// Conversation 类型改为从模块导入，复用逻辑

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
      const conversationData = await loadConversationsForMessagesPage();
      setConversations(conversationData);

      // 统计数据在页面顶部卡片已移除，故不再计算聚合统计

      // 初始化全局 unread store（shopId -> unread）
      useConversationsStore.getState().setManyUnreads(conversationData.map((c) => ({ shopId: c.shop.id, count: c.unread_count })));

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