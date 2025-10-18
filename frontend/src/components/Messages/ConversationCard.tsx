import React from 'react';
import styled from 'styled-components';
import { FiMessageCircle, FiClock, FiUsers } from 'react-icons/fi';
import { Card, Badge } from '../../styles/globalStyles';
import { theme } from '../../styles/globalStyles';
import { formatBadgeCount } from '../../utils/format';
import { formatRelativeTime, formatMessagePreview } from '../../utils/display';

const StyledConversationCard = styled(Card)`
  padding: ${theme.spacing.md};
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 0;
  position: relative;
  
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

const TopRightBadge = styled(Badge)`
  position: absolute;
  top: 8px;
  right: 8px;
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
  return (
    <StyledConversationCard onClick={onClick}>
      {(() => { const t = formatBadgeCount(unreadCount); return t ? (<TopRightBadge>{t}</TopRightBadge>) : null; })()}
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
            {(() => { const t = formatBadgeCount(unreadCount); return t ? (<UnreadBadge>{t}</UnreadBadge>) : null; })()}
          </ConversationMeta>
        </ConversationInfo>
      </ConversationHeader>
      
      {lastMessage && (
        <LastMessage>
          <MessageContent>
            {lastMessage.sender_type === 'customer' ? '客户' : '客服'}: {formatMessagePreview(lastMessage as any)}
          </MessageContent>
          <MessageTime>
            <span>
              <FiClock size={12} />
              {formatRelativeTime(lastMessage.created_at)}
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