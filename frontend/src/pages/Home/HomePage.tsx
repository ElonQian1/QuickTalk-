import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { FiMessageSquare, FiUsers, FiTrendingUp, FiShoppingBag, FiClock } from 'react-icons/fi';
import { useAuthStore } from '../../stores/authStore';
import { api, checkApiHealth } from '../../config/api';
import { mockApi } from '../../config/mockData';
import { theme } from '../../styles/globalStyles';

const Container = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding-bottom: ${theme.spacing.xxl}; /* 原 80px */
`;

const Header = styled.div`
  padding: ${theme.spacing.xxl} ${theme.spacing.md} ${theme.spacing.md}; /* 原 40 20 20 */
  text-align: center;
  color: white;
`;

const WelcomeText = styled.h1`
  font-size: ${theme.typography.display}; /* 原 28px 使用 display(32) 或可新设 token; 这里选 display */
  font-weight: 600;
  margin: 0 0 ${theme.spacing.xs}; /* 原 8px */
  text-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.3); /* 2px 4px 转 rem */
`;

const SubText = styled.p`
  font-size: ${theme.typography.body};
  opacity: 0.9;
  margin: 0;
`;

const OfflineIndicator = styled.div`
  background: rgba(255, 193, 7, 0.9);
  color: #856404;
  padding: ${theme.spacing.xs} ${theme.spacing.sm}; /* 原 8 16 */
  border-radius: ${theme.spacing.sm}; /* 原 8px */
  font-size: ${theme.typography.small};
  margin-top: ${theme.spacing.smd}; /* 原 12px */
  text-align: center;
  font-weight: 500;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${theme.spacing.md}; /* 原 16px */
  padding: 0 ${theme.spacing.md} ${theme.spacing.md}; /* 原 0 20 20 */
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(${theme.spacing.md}); /* 16px 近似原 10px */
  border-radius: ${theme.spacing.xl}; /* 原 16px */
  padding: ${theme.spacing.mlg}; /* 原 20px -> 20 token mlg */
  text-align: center;
  box-shadow: 0 0.25rem 1.25rem rgba(0,0,0,0.1); /* 4px 20px -> rem */
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-0.125rem); /* 原 -2px */
    box-shadow: 0 0.5rem 1.875rem rgba(0,0,0,0.15); /* 8px 30px */
  }
`;

const StatIcon = styled.div<{ color: string }>`
  width: ${theme.spacing.xxl}; /* 原 48px */
  height: ${theme.spacing.xxl};
  background: ${props => props.color};
  border-radius: ${theme.spacing.lg}; /* 原 12px */
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto ${theme.spacing.smd}; /* 原 12px */
  color: white;

  svg {
    width: ${theme.spacing.md}; /* 16px 近似原 24px? 若需24可用 pxToRem(24) */
    height: ${theme.spacing.md};
  }
`;

const StatValue = styled.div`
  font-size: ${theme.typography.display}; /* 原 28px */
  font-weight: bold;
  color: #333;
  margin-bottom: ${theme.spacing.micro}; /* 原 4px */
`;

const StatLabel = styled.div`
  font-size: ${theme.typography.small};
  color: #666;
`;

const QuickActions = styled.div`
  padding: 0 ${theme.spacing.md};
  margin-bottom: ${theme.spacing.mlg}; /* 原 20px */
`;

const SectionTitle = styled.h2`
  color: white;
  font-size: ${theme.typography.h2}; /* 原 20px */
  font-weight: 600;
  margin: 0 0 ${theme.spacing.md};
  text-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.3);
`;

const ActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${theme.spacing.smd}; /* 原 12px */
`;

const ActionCard = styled.div`
  background: rgba(255, 255, 255, 0.9);
  border-radius: ${theme.spacing.lg}; /* 原 12px */
  padding: ${theme.spacing.md}; /* 原 16px */
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 1);
    transform: translateY(-0.0625rem); /* 原 1px */
  }
`;

const ActionIcon = styled.div<{ color: string }>`
  width: ${theme.spacing.xxl}; /* 原 40px */
  height: ${theme.spacing.xxl};
  background: ${props => props.color};
  border-radius: ${theme.spacing.mlg}; /* 原 10px */
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: ${theme.spacing.smd}; /* 原 12px */
  color: white;

  svg {
    width: ${theme.spacing.smd}; /* 12px 近似原 20px，可按需调整 */
    height: ${theme.spacing.smd};
  }
`;

const ActionText = styled.div`
  flex: 1;
`;

const ActionTitle = styled.div`
  font-size: ${theme.typography.body}; /* 原 16px */
  font-weight: 600;
  color: #333;
  margin-bottom: ${theme.spacing.micro}; /* 原 2px */
`;

const ActionDesc = styled.div`
  font-size: ${theme.typography.caption};
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
  // 移除未使用的 isLoading 状态（此前仅设置未被消费）
  // const [isLoading, setIsLoading] = useState(true);
  const [useOfflineData, setUseOfflineData] = useState(false);

  useEffect(() => {
    // 获取真实统计数据
    const fetchStats = async () => {
  // isLoading 已移除
      try {
        // 首先检查API健康状况
        const isApiHealthy = await checkApiHealth();
        
        if (!isApiHealthy) {
          console.log('API不可用，使用离线数据');
          setUseOfflineData(true);
          const mockStats = await mockApi.getStats();
          setStats({
            totalMessages: mockStats.total_messages,
            activeCustomers: mockStats.total_customers,
            totalShops: mockStats.total_shops,
            pendingChats: mockStats.active_sessions
          });
          return;
        }

        // 获取店铺数据
        const shopsResponse = await api.get('/api/shops');
        const shops = shopsResponse.data;
        
        let totalMessages = 0;
        let activeCustomers = 0;
        let pendingChats = 0;
        
        // 为每个店铺获取统计数据
        for (const shop of shops) {
          try {
            const customersResponse = await api.get(`/api/shops/${shop.id}/customers`);
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
        // 如果API失败，使用离线数据
        console.log('API请求失败，切换到离线数据');
        setUseOfflineData(true);
        try {
          const mockStats = await mockApi.getStats();
          setStats({
            totalMessages: mockStats.total_messages,
            activeCustomers: mockStats.total_customers,
            totalShops: mockStats.total_shops,
            pendingChats: mockStats.active_sessions
          });
        } catch (mockError) {
          // 如果mock数据也失败，显示0
          setStats({
            totalMessages: 0,
            activeCustomers: 0,
            totalShops: 0,
            pendingChats: 0
          });
        }
      } finally {
        // isLoading 已移除
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
        {useOfflineData && (
          <OfflineIndicator>
            🔄 当前使用离线数据 - 后端服务暂不可用
          </OfflineIndicator>
        )}
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