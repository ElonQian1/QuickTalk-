import React from 'react';
import styled from 'styled-components';
import { FiTarget, FiAward, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { theme } from '../../styles/globalStyles';
import { StatCard, StatGrid } from './StatCard';
import { formatNumber } from '../../utils/statsUtils';

const Container = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: ${theme.spacing.xl};
  padding: ${theme.spacing.lg};
  margin-bottom: ${theme.spacing.lg};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  margin-bottom: ${theme.spacing.lg};
`;

const Title = styled.h2`
  margin: 0;
  font-size: ${theme.typography.h2};
  font-weight: 600;
  color: #333;
`;

const SummaryGrid = StatGrid;

const SummaryCard = styled(StatCard)<{ variant: 'success' | 'warning' | 'info' | 'neutral' }>`
  background: ${props => {
    switch (props.variant) {
      case 'success': return 'linear-gradient(135deg, #00d4aa 0%, #01a085 100%)';
      case 'warning': return 'linear-gradient(135deg, #ffa726 0%, #f57c00 100%)';
      case 'info': return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      default: return 'linear-gradient(135deg, #90a4ae 0%, #607d8b 100%)';
    }
  }};
`;

const CardIcon = styled.div`
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${theme.spacing.md};
`;

const CardTitle = styled.h3`
  margin: 0 0 ${theme.spacing.xs};
  font-size: ${theme.typography.h3};
  font-weight: 600;
`;

const CardValue = styled.div`
  font-size: ${theme.typography.display};
  font-weight: bold;
  margin-bottom: ${theme.spacing.xs};
`;

const CardDescription = styled.p`
  margin: 0;
  font-size: ${theme.typography.small};
  opacity: 0.9;
  line-height: 1.4;
`;

const RecommendationsSection = styled.div`
  margin-top: ${theme.spacing.lg};
  padding-top: ${theme.spacing.lg};
  border-top: 1px solid #e9ecef;
`;

const RecommendationItem = styled.div<{ priority: 'high' | 'medium' | 'low' }>`
  display: flex;
  align-items: flex-start;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.sm};
  margin-bottom: ${theme.spacing.sm};
  border-radius: ${theme.spacing.md};
  background: ${props => {
    switch (props.priority) {
      case 'high': return '#fff5f5';
      case 'medium': return '#fffaf0';
      default: return '#f0f9ff';
    }
  }};
  border-left: 4px solid ${props => {
    switch (props.priority) {
      case 'high': return '#ff6b6b';
      case 'medium': return '#ffa726';
      default: return '#667eea';
    }
  }};
`;

const RecommendationIcon = styled.div<{ priority: 'high' | 'medium' | 'low' }>`
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: ${props => {
    switch (props.priority) {
      case 'high': return '#ff6b6b';
      case 'medium': return '#ffa726';
      default: return '#667eea';
    }
  }};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
  margin-top: 2px;
`;

const RecommendationText = styled.div`
  font-size: ${theme.typography.small};
  color: #333;
  line-height: 1.4;
`;

interface DataSummaryProps {
  todayMessages: number;
  weekMessages: number;
  monthMessages: number;
  activeCustomers: number;
  pendingChats: number;
  totalShops: number;
}

export const DataSummary: React.FC<DataSummaryProps> = ({
  todayMessages,
  weekMessages,
  monthMessages,
  activeCustomers,
  pendingChats,
  totalShops
}) => {
  // 计算关键指标
  const avgDailyMessages = Math.round(weekMessages / 7);
  const responseRate = totalShops > 0 ? Math.round((activeCustomers / totalShops) * 100) : 0;
  const workloadPerShop = totalShops > 0 ? Math.round(pendingChats / totalShops) : 0;
  const monthlyGrowth = Math.round(Math.random() * 20 + 10); // 模拟增长率

  // 生成建议
  const generateRecommendations = () => {
    const recommendations = [];

    if (pendingChats > totalShops * 3) {
      recommendations.push({
        priority: 'high' as const,
        text: '待处理会话较多，建议增加客服人手或优化响应流程',
        icon: FiAlertCircle
      });
    }

    if (responseRate < 70) {
      recommendations.push({
        priority: 'medium' as const,
        text: '客户响应覆盖率偏低，建议提高服务响应速度',
        icon: FiTarget
      });
    }

    if (todayMessages > avgDailyMessages * 1.5) {
      recommendations.push({
        priority: 'low' as const,
        text: '今日消息量较高，关注服务质量保持',
        icon: FiCheckCircle
      });
    } else {
      recommendations.push({
        priority: 'low' as const,
        text: '消息量保持稳定，可考虑推广活动提升用户活跃度',
        icon: FiAward
      });
    }

    return recommendations;
  };

  const recommendations = generateRecommendations();

  const summaryCards: Array<{
    title: string;
    value: string;
    description: string;
    variant: 'success' | 'warning' | 'info' | 'neutral';
    icon: React.ComponentType<any>;
  }> = [
    {
      title: '服务表现',
      value: `${responseRate}%`,
      description: `覆盖率 ${responseRate}%，${responseRate > 80 ? '表现优秀' : responseRate > 60 ? '表现良好' : '需要改进'}`,
      variant: (responseRate > 80 ? 'success' : responseRate > 60 ? 'info' : 'warning') as 'success' | 'warning' | 'info' | 'neutral',
      icon: responseRate > 80 ? FiCheckCircle : FiTarget
    },
    {
      title: '工作负载',
      value: `${workloadPerShop}`,
      description: `平均每店铺 ${workloadPerShop} 个待处理会话${workloadPerShop > 5 ? '，负载较重' : '，负载适中'}`,
      variant: (workloadPerShop > 5 ? 'warning' : 'success') as 'success' | 'warning' | 'info' | 'neutral',
      icon: workloadPerShop > 5 ? FiAlertCircle : FiCheckCircle
    },
    {
      title: '增长趋势',
      value: `+${monthlyGrowth}%`,
      description: `月度消息增长 ${monthlyGrowth}%，${monthlyGrowth > 15 ? '增长强劲' : '增长稳定'}`,
      variant: (monthlyGrowth > 15 ? 'success' : 'info') as 'success' | 'warning' | 'info' | 'neutral',
      icon: FiAward
    },
    {
      title: '活跃度',
      value: formatNumber(activeCustomers),
      description: `${totalShops} 个店铺中有 ${activeCustomers} 活跃客户`,
      variant: 'neutral' as 'success' | 'warning' | 'info' | 'neutral',
      icon: FiTarget
    }
  ];

  return (
    <Container>
      <Header>
        <FiTarget size={24} color="#667eea" />
        <Title>数据总结与建议</Title>
      </Header>
      
      <SummaryGrid>
        {summaryCards.map((card, index) => (
          <SummaryCard key={index} variant={card.variant}>
            <CardIcon>
              <card.icon size={20} />
            </CardIcon>
            <CardTitle>{card.title}</CardTitle>
            <CardValue>{card.value}</CardValue>
            <CardDescription>{card.description}</CardDescription>
          </SummaryCard>
        ))}
      </SummaryGrid>

      <RecommendationsSection>
        <h3 style={{ margin: `0 0 ${theme.spacing.md}`, color: '#333', fontSize: theme.typography.h3 }}>
          优化建议
        </h3>
        {recommendations.map((rec, index) => (
          <RecommendationItem key={index} priority={rec.priority}>
            <RecommendationIcon priority={rec.priority}>
              <rec.icon size={12} />
            </RecommendationIcon>
            <RecommendationText>{rec.text}</RecommendationText>
          </RecommendationItem>
        ))}
      </RecommendationsSection>
    </Container>
  );
};