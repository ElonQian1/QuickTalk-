import React from 'react';
import styled from 'styled-components';
import { FiMessageCircle, FiClock, FiUsers } from 'react-icons/fi';
import { Card, Badge } from '../../styles/globalStyles';
import { theme } from '../../styles/globalStyles';

const StyledConversationCard = styled(Card)`
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
  width: ${theme.spacing.xxl};
  height: ${theme.spacing.xxl};
  border-radius: ${theme.borderRadius.round};
  background: ${props => props.src ? `url(${props.src})` : theme.colors.primary};
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.white};
  font-size: ${theme.typography.h2};
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
  margin-bottom: ${theme.spacing.micro};
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
  margin-bottom: ${theme.spacing.micro};
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

interface ConversationCardProps {
  shopName: string;
  customerCount: number;
  unreadCount: number;
  lastMessage?: {
    content: string;
    created_at: string;
    sender_type: string;
  } | null;
  onClick: () => void;
}

export const ConversationCard: React.FC<ConversationCardProps> = ({
  shopName,
  customerCount,
  unreadCount,
  lastMessage,
  onClick
}) => {
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

  return (
    <StyledConversationCard onClick={onClick}>
      <ConversationHeader>
        <ConversationAvatar>
          {shopName.charAt(0)}
        </ConversationAvatar>
        <ConversationInfo>
          <ConversationTitle>{shopName}</ConversationTitle>
          <ConversationMeta>
            <span>
              <FiUsers size={12} />
              {customerCount} 个客户
            </span>
            {unreadCount > 0 && (
              <UnreadBadge>{unreadCount}</UnreadBadge>
            )}
          </ConversationMeta>
        </ConversationInfo>
      </ConversationHeader>
      
      {lastMessage && (
        <LastMessage>
          <MessageContent>
            {lastMessage.sender_type === 'customer' ? '客户' : '客服'}: {lastMessage.content}
          </MessageContent>
          <MessageTime>
            <span>
              <FiClock size={12} />
              {formatTime(lastMessage.created_at)}
            </span>
            {lastMessage.sender_type === 'customer' && (
              <span>
                <FiMessageCircle size={12} />
                客户消息
              </span>
            )}
          </MessageTime>
        </LastMessage>
      )}
    </StyledConversationCard>
  );
};