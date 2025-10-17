import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { FiMessageSquare, FiUsers, FiTrendingUp, FiShoppingBag, FiClock, FiRefreshCw } from 'react-icons/fi';
import { useAuthStore } from '../../stores/authStore';
import { theme } from '../../styles/globalStyles';
import { useConversationsStore } from '../../stores/conversationsStore';
import { useNotificationsStore } from '../../stores/notificationsStore';
import { StatsGrid, StatData } from '../../components/Dashboard';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { formatTime } from '../../utils/statsUtils';

const Container = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding-bottom: ${theme.spacing.xxl}; /* 原 80px */
`;

const Header = styled.div`
  padding: ${theme.spacing.xxl} ${theme.spacing.md} ${theme.spacing.md}; /* 原 40 20 20 */
  text-align: center;
  color: white;
  position: relative;
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

const RefreshButton = styled.button`
  position: absolute;
  top: ${theme.spacing.md};
  right: ${theme.spacing.md};
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: ${theme.spacing.md};
  color: white;
  padding: ${theme.spacing.xs} ${theme.spacing.smd};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  font-size: ${theme.typography.small};
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  svg {
    animation: ${props => props.disabled ? 'spin 1s linear infinite' : 'none'};
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const LastUpdated = styled.div`
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: ${theme.typography.caption};
  margin-top: ${theme.spacing.xs};
`;

// OfflineIndicator 已移除（不再提供离线数据模式）

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

const HomePage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const totalUnreadNotif = useNotificationsStore(state => state.totalUnread);
  const totalUnreadLegacy = useConversationsStore(state => state.totalUnread);
  
  // 使用自定义hook获取统计数据
  const { stats, isLoading, isRefreshing, refreshStats, lastUpdated } = useDashboardStats({
    autoRefreshInterval: 30000, // 30秒自动刷新
    enableAutoRefresh: true
  });

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
      title: '个人中心',
      desc: '查看个人信息',
      icon: FiUsers,
      color: '#ff6b6b',
      onClick: () => navigate('/profile')
    },
    {
      title: '数据统计',
      desc: '查看运营数据',
      icon: FiTrendingUp,
      color: '#4ecdc4',
      onClick: () => navigate('/statistics')
    }
  ];

  const statsData: StatData[] = [
    {
      icon: FiMessageSquare,
      value: (totalUnreadNotif || totalUnreadLegacy || 0) || stats.totalMessages,
      label: '今日消息总数',
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
        {lastUpdated && (
          <LastUpdated>
            最后更新: {formatTime(lastUpdated)}
          </LastUpdated>
        )}
      </Header>

      <StatsGrid 
        stats={statsData} 
        isLoading={isLoading}
        isRefreshing={isRefreshing}
      />

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