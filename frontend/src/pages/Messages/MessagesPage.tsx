import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { FiMessageCircle, FiUsers, FiClock } from 'react-icons/fi';
import { api, checkApiHealth } from '../../config/api';
import { mockApi } from '../../config/mockData';
import { Card, Badge, LoadingSpinner } from '../../styles/globalStyles';
import { theme } from '../../styles/globalStyles';
import toast from 'react-hot-toast';

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

const ConversationCard = styled(Card)`
  padding: ${theme.spacing.md};
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 0;
  
  &:hover {
    background: #f8f8f8;
  }
  
  &:active {
    background: #f0f0f0;
  }
`;

const ConversationHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  margin-bottom: ${theme.spacing.sm};
`;

const ConversationAvatar = styled.div<{ src?: string }>`
  position: relative;
  width: ${theme.spacing.xxl}; /* 原 48px；如需更大头像可新增 xxxl */
  height: ${theme.spacing.xxl};
  border-radius: ${theme.borderRadius.round};
  background: ${props => props.src ? `url(${props.src})` : theme.colors.primary};
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.white};
  font-size: ${theme.typography.h2}; /* 原 16px */
  font-weight: 600;
  flex-shrink: 0;
`;

const ConversationInfo = styled.div`
  flex: 1;
  overflow: hidden;
`;

const ConversationTitle = styled.div`
  font-size: ${theme.typography.body};
  font-weight: 600;
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.micro}; /* 原 2px */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ConversationMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  font-size: ${theme.typography.small};
  color: ${theme.colors.text.secondary};
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
  margin-bottom: ${theme.spacing.micro}; /* 原 4px */
`;

const MessageTime = styled.div`
  font-size: ${theme.typography.caption};
  color: ${theme.colors.text.placeholder};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const UnreadBadge = styled(Badge)`
  position: static;
  margin-left: auto;
`;

const StatsCard = styled(Card)`
  padding: ${theme.spacing.md};
  margin-bottom: ${theme.spacing.lg};
  background: linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%);
  color: ${theme.colors.white};
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${theme.spacing.md};
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatValue = styled.div`
  font-size: ${theme.typography.h2};
  font-weight: bold;
  margin-bottom: ${theme.spacing.micro}; /* 原 4px */
`;

const StatLabel = styled.div`
  font-size: ${theme.typography.small};
  opacity: 0.9;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.spacing.xl} ${theme.spacing.md};
  color: ${theme.colors.text.secondary};
`;

const EmptyIcon = styled.div`
  width: ${theme.spacing.xxl}; /* 原 80px */
  height: ${theme.spacing.xxl};
  margin: 0 auto ${theme.spacing.md};
  background: ${theme.colors.background};
  border-radius: ${theme.borderRadius.round};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.typography.display}; /* 原 32px */
  color: ${theme.colors.text.placeholder};
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
  // 已移除离线数据回退逻辑的标记状态（此前未使用）
  const [stats, setStats] = useState({
    totalShops: 0,
    totalCustomers: 0,
    unreadMessages: 0,
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      // 首先检查API健康状况
      const isApiHealthy = await checkApiHealth();
      
      if (!isApiHealthy) {
        console.log('API不可用，使用离线数据');
  // 离线数据回退：已简化，去除未使用的状态标记
        const mockShops = await mockApi.getShops();
        const mockConversations = await Promise.all(
          mockShops.map(async (shop) => {
            const customers = await mockApi.getCustomers(shop.id);
            const unreadCount = customers.reduce((total, customer) => total + (customer.unread_count || 0), 0);
            return {
              shop: { ...shop, unread_count: unreadCount },
              customer_count: customers.length,
              last_message: customers[0]?.last_message || null,
              unread_count: unreadCount,
            };
          })
        );
        setConversations(mockConversations);
        const mockStats = await mockApi.getStats();
        setStats({
          totalShops: mockStats.total_shops,
          totalCustomers: mockStats.total_customers,
          unreadMessages: mockStats.total_messages,
        });
        return;
      }

      // 获取所有店铺
      const shopsResponse = await api.get('/api/shops');
      const shops = shopsResponse.data;

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

      // 计算统计数据
      const totalUnread = conversationData.reduce((total, conv) => total + conv.unread_count, 0);
      const totalCustomers = conversationData.reduce((total, conv) => total + conv.customer_count, 0);

      setStats({
        totalShops: shops.length,
        totalCustomers,
        unreadMessages: totalUnread,
      });

    } catch (error) {
      console.error('Error fetching conversations:', error);
      // 如果API失败，使用离线数据
      console.log('API请求失败，切换到离线数据');
  // 离线数据回退：已简化，去除未使用的状态标记
      try {
        const mockShops = await mockApi.getShops();
        const mockConversations = await Promise.all(
          mockShops.map(async (shop) => {
            const customers = await mockApi.getCustomers(shop.id);
            const unreadCount = customers.reduce((total, customer) => total + (customer.unread_count || 0), 0);
            return {
              shop: { ...shop, unread_count: unreadCount },
              customer_count: customers.length,
              last_message: customers[0]?.last_message || null,
              unread_count: unreadCount,
            };
          })
        );
        setConversations(mockConversations);
        const mockStats = await mockApi.getStats();
        setStats({
          totalShops: mockStats.total_shops,
          totalCustomers: mockStats.total_customers,
          unreadMessages: mockStats.total_messages,
        });
      } catch (mockError) {
        toast.error('获取消息列表失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConversationClick = (conversation: Conversation) => {
    navigate(`/shops/${conversation.shop.id}/customers`);
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) {
        return '刚刚';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}分钟前`;
      } else if (diffInMinutes < 1440) {
        return `${Math.floor(diffInMinutes / 60)}小时前`;
      } else {
        const days = Math.floor(diffInMinutes / 1440);
        return `${days}天前`;
      }
    } catch (error) {
      return '未知';
    }
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

      <StatsCard>
        <StatsGrid>
          <StatItem>
            <StatValue>{stats.totalShops}</StatValue>
            <StatLabel>店铺数量</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{stats.totalCustomers}</StatValue>
            <StatLabel>客户数量</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{stats.unreadMessages}</StatValue>
            <StatLabel>未读消息</StatLabel>
          </StatItem>
        </StatsGrid>
      </StatsCard>

      {conversations.length === 0 ? (
        <EmptyState>
          <EmptyIcon>💬</EmptyIcon>
          <h3>暂无对话</h3>
          <p>当有客户发起对话时，会显示在这里</p>
        </EmptyState>
      ) : (
        <ConversationList>
          {conversations.map((conversation) => (
            <ConversationCard
              key={conversation.shop.id}
              onClick={() => handleConversationClick(conversation)}
            >
              <ConversationHeader>
                <ConversationAvatar>
                  🏪
                  {conversation.unread_count > 0 && (
                    <Badge count={conversation.unread_count} />
                  )}
                </ConversationAvatar>
                
                <ConversationInfo>
                  <ConversationTitle>
                    {conversation.shop.shop_name}
                  </ConversationTitle>
                  
                  <ConversationMeta>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiUsers size={12} />
                      {conversation.customer_count} 位客户
                    </div>
                    
                    {conversation.unread_count > 0 && (
                      <>
                        <span>•</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FiMessageCircle size={12} />
                          {conversation.unread_count} 条未读
                        </div>
                      </>
                    )}
                  </ConversationMeta>
                </ConversationInfo>
                
                {conversation.unread_count > 0 && (
                  <UnreadBadge count={conversation.unread_count} />
                )}
              </ConversationHeader>

              {conversation.last_message && (
                <LastMessage>
                  <MessageContent>
                    {conversation.last_message.sender_type === 'customer' ? '' : '[我] '}
                    {conversation.last_message.content}
                  </MessageContent>
                  
                  <MessageTime>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiClock size={12} />
                      {formatTime(conversation.last_message.created_at)}
                    </div>
                  </MessageTime>
                </LastMessage>
              )}
            </ConversationCard>
          ))}
        </ConversationList>
      )}
    </Container>
  );
};

export default MessagesPage;