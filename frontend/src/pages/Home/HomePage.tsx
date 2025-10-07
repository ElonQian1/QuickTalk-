import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { FiMessageSquare, FiUsers, FiTrendingUp, FiShoppingBag, FiClock } from 'react-icons/fi';
import { useAuthStore } from '../../stores/authStore';
import axios from 'axios';

const Container = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding-bottom: 80px; /* 为底部导航留出空间 */
`;

const Header = styled.div`
  padding: 40px 20px 20px;
  text-align: center;
  color: white;
`;

const WelcomeText = styled.h1`
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 8px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const SubText = styled.p`
  font-size: 16px;
  opacity: 0.9;
  margin: 0;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 0 20px 20px;
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  }
`;

const StatIcon = styled.div<{ color: string }>`
  width: 48px;
  height: 48px;
  background: ${props => props.color};
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  color: white;

  svg {
    width: 24px;
    height: 24px;
  }
`;

const StatValue = styled.div`
  font-size: 28px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
`;

const StatLabel = styled.div`
  font-size: 14px;
  color: #666;
`;

const QuickActions = styled.div`
  padding: 0 20px;
  margin-bottom: 20px;
`;

const SectionTitle = styled.h2`
  color: white;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const ActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
`;

const ActionCard = styled.div`
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 1);
    transform: translateY(-1px);
  }
`;

const ActionIcon = styled.div<{ color: string }>`
  width: 40px;
  height: 40px;
  background: ${props => props.color};
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  color: white;

  svg {
    width: 20px;
    height: 20px;
  }
`;

const ActionText = styled.div`
  flex: 1;
`;

const ActionTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
`;

const ActionDesc = styled.div`
  font-size: 12px;
  color: #666;
`;

interface DashboardStats {
  totalMessages: number;
  activeCustomers: number;
  totalShops: number;
  pendingChats: number;
}

const HomePage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalMessages: 0,
    activeCustomers: 0,
    totalShops: 0,
    pendingChats: 0
  });

  useEffect(() => {
    // 获取真实统计数据
    const fetchStats = async () => {
      try {
        // 获取店铺数据
        const shopsResponse = await axios.get('/api/shops');
        const shops = shopsResponse.data;
        
        let totalMessages = 0;
        let activeCustomers = 0;
        let pendingChats = 0;
        
        // 为每个店铺获取统计数据
        for (const shop of shops) {
          try {
            const customersResponse = await axios.get(`/api/shops/${shop.id}/customers`);
            const customers = customersResponse.data;
            
            activeCustomers += customers.length;
            
            // 计算未读消息和待处理对话
            for (const customer of customers) {
              if (customer.unread_count) {
                totalMessages += customer.unread_count;
                pendingChats += 1;
              }
            }
          } catch (error) {
            console.error(`获取店铺 ${shop.id} 数据失败:`, error);
          }
        }
        
        setStats({
          totalMessages,
          activeCustomers,
          totalShops: shops.length,
          pendingChats
        });
      } catch (error) {
        console.error('获取统计数据失败:', error);
        // 如果获取失败，显示0而不是模拟数据
        setStats({
          totalMessages: 0,
          activeCustomers: 0,
          totalShops: 0,
          pendingChats: 0
        });
      }
    };

    fetchStats();
  }, []);

  const quickActions = [
    {
      title: '查看消息',
      desc: '处理客户咨询',
      icon: FiMessageSquare,
      color: '#00d4aa',
      onClick: () => navigate('/messages')
    },
    {
      title: '管理店铺',
      desc: '店铺设置管理',
      icon: FiShoppingBag,
      color: '#667eea',
      onClick: () => navigate('/shops')
    },
    {
      title: '客户管理',
      desc: '查看客户列表',
      icon: FiUsers,
      color: '#ff6b6b',
      onClick: () => navigate('/shops')
    },
    {
      title: '数据统计',
      desc: '查看运营数据',
      icon: FiTrendingUp,
      color: '#4ecdc4',
      onClick: () => console.log('数据统计')
    }
  ];

  const statsData = [
    {
      icon: FiMessageSquare,
      value: stats.totalMessages,
      label: '今日消息',
      color: '#00d4aa'
    },
    {
      icon: FiUsers,
      value: stats.activeCustomers,
      label: '活跃客户',
      color: '#667eea'
    },
    {
      icon: FiShoppingBag,
      value: stats.totalShops,
      label: '管理店铺',
      color: '#ff6b6b'
    },
    {
      icon: FiClock,
      value: stats.pendingChats,
      label: '待处理',
      color: '#ffa726'
    }
  ];

  return (
    <Container>
      <Header>
        <WelcomeText>欢迎回来，{user?.username || '管理员'}</WelcomeText>
        <SubText>今天也要为客户提供优质服务哦～</SubText>
      </Header>

      <StatsGrid>
        {statsData.map((stat, index) => (
          <StatCard key={index}>
            <StatIcon color={stat.color}>
              <stat.icon />
            </StatIcon>
            <StatValue>{stat.value}</StatValue>
            <StatLabel>{stat.label}</StatLabel>
          </StatCard>
        ))}
      </StatsGrid>

      <QuickActions>
        <SectionTitle>快速操作</SectionTitle>
        <ActionsGrid>
          {quickActions.map((action, index) => (
            <ActionCard key={index} onClick={action.onClick}>
              <ActionIcon color={action.color}>
                <action.icon />
              </ActionIcon>
              <ActionText>
                <ActionTitle>{action.title}</ActionTitle>
                <ActionDesc>{action.desc}</ActionDesc>
              </ActionText>
            </ActionCard>
          ))}
        </ActionsGrid>
      </QuickActions>
    </Container>
  );
};

export default HomePage;