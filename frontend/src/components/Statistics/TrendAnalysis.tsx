import React from 'react';
import styled from 'styled-components';
import { FiBarChart, FiCalendar, FiUsers } from 'react-icons/fi';
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

const TrendGrid = styled(StatGrid)`
  grid-template-columns: repeat(3, 1fr);
  @media (max-width: 768px) { grid-template-columns: 1fr; }
`;

const TrendCard = styled(StatCard)`
  background: #f8f9fa;
  color: ${theme.colors.text.primary};
`;

const TrendHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.spacing.sm};
`;

const TrendLabel = styled.div`
  font-size: ${theme.typography.small};
  color: #666;
  font-weight: 500;
`;

const TrendIcon = styled.div<{ color: string }>`
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: ${props => props.color};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
`;

const TrendValue = styled.div`
  font-size: ${theme.typography.h1};
  font-weight: bold;
  color: #333;
  margin-bottom: ${theme.spacing.xs};
`;

const TrendSubtext = styled.div`
  font-size: ${theme.typography.caption};
  color: #666;
  margin-bottom: ${theme.spacing.sm};
`;

const BarChart = styled.div`
  display: flex;
  align-items: end;
  gap: 4px;
  height: 40px;
  margin-top: ${theme.spacing.sm};
`;

const Bar = styled.div<{ height: number; color: string }>`
  flex: 1;
  background: ${props => props.color};
  height: ${props => props.height}%;
  border-radius: 2px 2px 0 0;
  transition: height 0.6s ease;
  min-height: 8px;
`;

const ComparisonText = styled.div<{ trend: 'positive' | 'negative' | 'neutral' }>`
  font-size: ${theme.typography.caption};
  color: ${props => {
    switch (props.trend) {
      case 'positive': return '#00d4aa';
      case 'negative': return '#ff6b6b';
      default: return '#666';
    }
  }};
  font-weight: 500;
`;

interface TrendAnalysisProps {
  todayMessages: number;
  weekMessages: number;
  monthMessages: number;
  todayCustomers: number;
  activeCustomers: number;
}

export const TrendAnalysis: React.FC<TrendAnalysisProps> = ({
  todayMessages,
  weekMessages,
  monthMessages,
  todayCustomers,
  activeCustomers
}) => {
  // 计算趋势数据
  const avgDailyMessages = Math.round(weekMessages / 7);
  const avgWeeklyMessages = Math.round(monthMessages / 4);
  const dailyGrowth = avgDailyMessages > 0 ? Math.round(((todayMessages - avgDailyMessages) / avgDailyMessages) * 100) : 0;
  const weeklyGrowth = avgWeeklyMessages > 0 ? Math.round(((weekMessages - avgWeeklyMessages) / avgWeeklyMessages) * 100) : 0;

  // 生成柱状图数据 (最近7天的模拟数据)
  const generateBarData = (total: number) => {
    const bars = [];
    for (let i = 6; i >= 0; i--) {
      const variation = Math.random() * 0.4 + 0.8; // 80%-120%的变化
      const value = Math.round((total / 7) * variation);
      bars.push(value);
    }
    // 确保最后一天是今日数据
    bars[6] = todayMessages;
    return bars;
  };

  const messageBarData = generateBarData(weekMessages);
  const maxBarValue = Math.max(...messageBarData);

  const trends = [
    {
      label: '今日表现',
      value: todayMessages,
      subtext: `vs 日均 ${avgDailyMessages}`,
      comparison: dailyGrowth,
      icon: FiCalendar,
      color: '#667eea',
      showBars: true,
      barData: messageBarData
    },
    {
      label: '本周趋势',
      value: weekMessages,
      subtext: `vs 月均周 ${avgWeeklyMessages}`,
      comparison: weeklyGrowth,
      icon: FiBarChart,
      color: '#00d4aa',
      showBars: false
    },
    {
      label: '客户参与',
      value: activeCustomers,
      subtext: `今日新增 ${todayCustomers}`,
      comparison: todayCustomers > 0 ? 15 : 0, // 假设15%增长
      icon: FiUsers,
      color: '#ffa726',
      showBars: false
    }
  ];

  const getTrendType = (value: number): 'positive' | 'negative' | 'neutral' => {
    if (value > 5) return 'positive';
    if (value < -5) return 'negative';
    return 'neutral';
  };

  const formatComparison = (value: number) => {
    if (value > 0) return `+${value}%`;
    if (value < 0) return `${value}%`;
    return '持平';
  };

  return (
    <Container>
      <Header>
        <FiBarChart size={24} color="#667eea" />
        <Title>趋势分析</Title>
      </Header>
      
      <TrendGrid>
        {trends.map((trend, index) => (
          <TrendCard key={index}>
            <TrendHeader>
              <TrendLabel>{trend.label}</TrendLabel>
              <TrendIcon color={trend.color}>
                <trend.icon size={16} />
              </TrendIcon>
            </TrendHeader>
            
            <TrendValue>{formatNumber(trend.value)}</TrendValue>
            <TrendSubtext>{trend.subtext}</TrendSubtext>
            
            {trend.showBars && (
              <BarChart>
                {trend.barData!.map((value, i) => (
                  <Bar 
                    key={i} 
                    height={(value / maxBarValue) * 100} 
                    color={i === 6 ? trend.color : `${trend.color}66`}
                  />
                ))}
              </BarChart>
            )}
            
            <ComparisonText trend={getTrendType(trend.comparison)}>
              {formatComparison(trend.comparison)}
            </ComparisonText>
          </TrendCard>
        ))}
      </TrendGrid>
    </Container>
  );
};