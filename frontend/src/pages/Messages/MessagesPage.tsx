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
import { useWSStore } from '../../stores/wsStore';
import { useNotificationsStore } from '../../stores/notificationsStore';

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
  const notifByShop = useNotificationsStore(state => state.byShop);
  const navigate = useNavigate();
  const { connect, addMessageListener, removeMessageListener } = useWSStore();
  // 稳定的 WS 监听器：仅更新消息中心所需的未读与最后一条消息
  useEffect(() => {
    const listener = (data: any) => {
      try {
        const type = data.messageType || data.message_type;
        if (type !== 'new_message') return;
        const sessionId = data.session_id || data.sessionId;
        const shopId = data.metadata?.shopId || data.metadata?.shop_id;
        const senderType = data.sender_type || data.senderType;
        const content = data.content || '';
        const createdAt = data.timestamp || new Date().toISOString();

        if (!shopId) return;

        // 更新本页的列表快照：最后一条消息 + 未读计数（仅客户来的消息计入未读）
        setConversations(prev => prev.map(c => {
          if (c.shop.id !== shopId) return c;
          const incUnread = senderType === 'customer' ? 1 : 0;
          const nextUnread = (c.unread_count ?? 0) + incUnread;
          const last_message = { content, created_at: createdAt, sender_type: senderType };
          return { ...c, unread_count: nextUnread, last_message };
        }));
      } catch (e) {
        console.warn('消息中心 WS 监听处理失败:', e);
      }
    };
    addMessageListener(listener);
    return () => removeMessageListener(listener);
  }, [addMessageListener, removeMessageListener]);

  useEffect(() => {
    fetchConversations();
    // 尝试建立/保持 WS 连接：选择列表里的第一个店铺作为活跃连接（用于接收广播）
    // 若 ChatPage 已建立会复用 wsStore 的同一实例，不会重复连接
    // 首次加载后在数据返回后也会再尝试基于第一个店铺 connect 一次
  }, []);

  const fetchConversations = async () => {
    try {
      const conversationData = await loadConversationsForMessagesPage();
      setConversations(conversationData);
      // 基于第一个店铺维持 staff WS 连接，确保在消息中心也能收到新消息
      if (conversationData.length > 0) {
        const firstShopId = conversationData[0].shop.id;
        try { connect(firstShopId); } catch {}
      }

      // 统计数据在页面顶部卡片已移除，故不再计算聚合统计

      // 初始化全局 unread store（shopId -> unread）：旧 store 与新通知中心并行
      const initItems = conversationData.map((c) => ({ shopId: c.shop.id, count: c.unread_count }));
      useConversationsStore.getState().setManyUnreads(initItems);
      // 新通知中心（按店铺维度）
      try {
        const notif = (await import('../../stores/notificationsStore')).useNotificationsStore;
        notif.getState().setManyShopUnreads(initItems);
      } catch {}

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
            const unreadFromNotif = notifByShop[conversation.shop.id];
            const unreadFromStore =
              (typeof unreadFromNotif === 'number' ? unreadFromNotif : undefined) ??
              unreads[conversation.shop.id] ??
              conversation.unread_count;
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