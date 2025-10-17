import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { FiClock } from 'react-icons/fi';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { api } from '../config/api';
import { Card, Badge, LoadingSpinner } from '../styles/globalStyles';
import { EmptyState, EmptyIcon, EmptyTitle, EmptyDescription } from '../components/UI';
import { theme } from '../styles/globalStyles';
import toast from 'react-hot-toast';
import { useConversationsStore } from '../stores/conversationsStore';
import { useNotificationsStore } from '../stores/notificationsStore';

const Container = styled.div`
  height: 100%;
  overflow-y: auto;
`;

const CustomerList = styled.div`
  padding: ${theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.hair}; /* 原 1px */
  background: ${theme.colors.divider};
`;

const CustomerCard = styled(Card)`
  padding: ${theme.spacing.md};
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 0;
  
  &:first-child {
    border-top-left-radius: ${theme.borderRadius.medium};
    border-top-right-radius: ${theme.borderRadius.medium};
  }
  
  &:last-child {
    border-bottom-left-radius: ${theme.borderRadius.medium};
    border-bottom-right-radius: ${theme.borderRadius.medium};
  }
  
  &:hover {
    background: #f8f8f8;
  }
  
  &:active {
    background: #f0f0f0;
  }
`;

const CustomerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  margin-bottom: ${theme.spacing.sm};
`;

const CustomerAvatar = styled.div<{ $src?: string }>`
  position: relative;
  width: ${theme.spacing.xxl}; /* 40->xxl(40), 原 48px 这里用 xxl(40) 更紧凑; 如需保持48可改用 pxToRem(48) */
  height: ${theme.spacing.xxl};
  border-radius: ${theme.borderRadius.round};
  background: ${props => props.$src ? `url(${props.$src})` : theme.colors.primary};
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.white};
  font-size: ${theme.typography.h2}; /* 原 16px -> body(16) 或 h2(20); 选 h2 提升识别度 */
  font-weight: 600;
  flex-shrink: 0;
`;

const CustomerInfo = styled.div`
  flex: 1;
  overflow: hidden;
`;

const CustomerName = styled.div`
  font-size: ${theme.typography.body};
  font-weight: 600;
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.micro}; /* 原 2px */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CustomerMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  font-size: ${theme.typography.small};
  color: ${theme.colors.text.secondary};
`;

const OnlineStatus = styled.div<{ online?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.micro}; /* 原 4px */
  font-size: ${theme.typography.caption};
  color: ${props => props.online ? theme.colors.online : theme.colors.text.placeholder};
  
  &::before {
    content: '';
    width: ${theme.spacing.sm}; /* 8px 近似原 6px，保留更大的点击区域，如需精确可用 pxToRem(6) */
    height: ${theme.spacing.sm};
    border-radius: 50%;
    background: ${props => props.online ? theme.colors.online : theme.colors.offline};
  }
`;

const LastMessage = styled.div`
  margin-top: ${theme.spacing.sm};
  padding-top: ${theme.spacing.sm};
  border-top: 1px solid ${theme.colors.divider};
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

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: ${theme.spacing.xxl}; /* 原 200px 这里只是示意：应考虑使用 viewport 或专用 loader 高度，此处暂替换为 token */
`;

interface Customer {
  id: number;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_avatar?: string;
  last_active_at: string;
  status: number;
}

interface Session {
  id: number;
  session_status: string;
  created_at: string;
  last_message_at: string;
}

interface Message {
  id: number;
  content: string;
  message_type: string;
  sender_type: string;
  created_at: string;
}

interface CustomerWithSession {
  customer: Customer;
  session?: Session | null;
  last_message?: Message | null;
  unread_count: number;
}

type LegacyCustomer = {
  id: number;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_avatar?: string;
  last_active_at?: string;
  created_at?: string;
  updated_at?: string;
  status?: number;
  unread_count?: number;
};

type ApiCustomer = CustomerWithSession | LegacyCustomer;

const normalizeCustomer = (entry: ApiCustomer): CustomerWithSession => {
  if (entry && typeof entry === 'object' && 'customer' in entry) {
    const typed = entry as CustomerWithSession;
    return {
      customer: typed.customer,
      session: typed.session ?? null,
      last_message: typed.last_message ?? null,
      unread_count:
        typeof typed.unread_count === 'number' ? typed.unread_count : 0,
    };
  }

  const legacy = entry as LegacyCustomer;
  const lastActive =
    legacy.last_active_at ||
    legacy.updated_at ||
    legacy.created_at ||
    new Date().toISOString();

  return {
    customer: {
      id: legacy.id,
      customer_id: legacy.customer_id,
      customer_name: legacy.customer_name,
      customer_email: legacy.customer_email,
      customer_avatar: legacy.customer_avatar,
      last_active_at: lastActive,
  status: legacy.status ?? 1,
    } as Customer,
    session: null,
    last_message: null,
    unread_count:
      typeof legacy.unread_count === 'number' ? legacy.unread_count : 0,
  };
};

const CustomerListPage: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const [customers, setCustomers] = useState<CustomerWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const resetShopUnread = useConversationsStore(state => state.resetShopUnread);
  const resetShopUnreadNotif = useNotificationsStore(state => state.resetShopUnread);

  useEffect(() => {
    if (shopId) {
      fetchCustomers(parseInt(shopId));
    }
  }, [shopId]);

  const fetchCustomers = async (shopId: number) => {
    try {
      const response = await api.get(`/api/shops/${shopId}/customers`);
      const payload = Array.isArray(response.data) ? response.data : [];
      const normalized = payload.map((entry) =>
        normalizeCustomer(entry as ApiCustomer)
      );
      setCustomers(normalized);

      // 进入该店铺客户列表后，批量标记为已读（一次请求）
      const hasUnread = normalized.some(c => (c.unread_count || 0) > 0);
      if (hasUnread) {
        api.post(`/api/shops/${shopId}/customers/read_all`).finally(() => {
          resetShopUnread(shopId);
          try { resetShopUnreadNotif(shopId); } catch {}
        });
      }
    } catch (error) {
      toast.error('获取客户列表失败');
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerClick = (customer: CustomerWithSession) => {
    if (customer.session) {
      navigate(`/chat/${customer.session.id}`);
    } else {
      // 如果没有会话，需要创建一个新会话
      toast.success('正在创建新的对话...');
    }
  };

  const formatLastActiveTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) {
        return '刚刚';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}分钟前`;
      } else if (diffInMinutes < 1440) { // 24 hours
        return `${Math.floor(diffInMinutes / 60)}小时前`;
      } else {
        return format(date, 'MM/dd HH:mm', { locale: zhCN });
      }
    } catch (error) {
      return '未知';
    }
  };

  const getCustomerDisplayName = (customer: Customer) => {
    return customer.customer_name || customer.customer_email || `用户${customer.customer_id.slice(-4)}`;
  };

  const getCustomerAvatar = (customer: Customer) => {
    if (customer.customer_avatar) {
      return customer.customer_avatar;
    }
    
    const name = getCustomerDisplayName(customer);
    return name.charAt(0).toUpperCase();
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
      {customers.length === 0 ? (
        <EmptyState>
          <EmptyIcon>👥</EmptyIcon>
          <EmptyTitle>暂无客户</EmptyTitle>
          <EmptyDescription>当有客户通过网站发起对话时，会显示在这里</EmptyDescription>
        </EmptyState>
      ) : (
        <CustomerList>
          {customers.map((item) => {
            // 安全检查，防止 undefined 错误
            if (!item || !item.customer) {
              return null;
            }
            
            return (
              <CustomerCard
                key={item.customer.id}
                onClick={() => handleCustomerClick(item)}
                className="fade-in"
              >
                <CustomerHeader>
                  <CustomerAvatar $src={item.customer.customer_avatar}>
                    {typeof getCustomerAvatar(item.customer) === 'string' && 
                     !item.customer.customer_avatar && 
                     getCustomerAvatar(item.customer)
                    }
                    {item.unread_count > 0 && (
                      <Badge count={item.unread_count} />
                    )}
                  </CustomerAvatar>
                
                <CustomerInfo>
                  <CustomerName>
                    {getCustomerDisplayName(item.customer)}
                  </CustomerName>
                  
                  <CustomerMeta>
                    <OnlineStatus online={item.customer.status === 1}>
                      {item.customer.status === 1 ? '在线' : '离线'}
                    </OnlineStatus>
                    
                    <span>•</span>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiClock size={12} />
                      {formatLastActiveTime(item.customer.last_active_at)}
                    </div>
                  </CustomerMeta>
                </CustomerInfo>
                
                {item.unread_count > 0 && (
                  <UnreadBadge count={item.unread_count} />
                )}
              </CustomerHeader>

              {item.last_message && (
                <LastMessage>
                  <MessageContent>
                    {item.last_message.sender_type === 'customer' ? '' : '[我] '}
                    {item.last_message.message_type === 'text' 
                      ? item.last_message.content 
                      : `[${item.last_message.message_type === 'image' ? '图片' : '文件'}]`
                    }
                  </MessageContent>
                  
                  <MessageTime>
                    {formatLastActiveTime(item.last_message.created_at)}
                  </MessageTime>
                </LastMessage>
              )}
            </CustomerCard>
            );
          })}
        </CustomerList>
      )}
    </Container>
  );
};

export default CustomerListPage;