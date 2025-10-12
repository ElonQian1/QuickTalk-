import React from 'react';
import { FiMessageSquare, FiUsers, FiShoppingBag } from 'react-icons/fi';
import { StatsGrid } from '../Dashboard';
import { StatsSection } from './StatsSection';

interface MessageStatsProps {
  totalShops: number;
  totalCustomers: number;
  unreadMessages: number;
}

export const MessageStats: React.FC<MessageStatsProps> = ({
  totalShops,
  totalCustomers,
  unreadMessages
}) => {
  return (
    <StatsSection>
      <StatsGrid 
        stats={[
          {
            icon: FiShoppingBag,
            value: totalShops,
            label: '店铺数量',
            color: '#667eea'
          },
          {
            icon: FiUsers,
            value: totalCustomers,
            label: '客户数量',
            color: '#764ba2'
          },
          {
            icon: FiMessageSquare,
            value: unreadMessages,
            label: '未读消息',
            color: '#ff6b6b'
          }
        ]}
      />
    </StatsSection>
  );
};