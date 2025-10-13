import React from 'react';
import styled from 'styled-components';
import { FiTrendingUp, FiTrendingDown, FiActivity, FiPieChart } from 'react-icons/fi';
import { theme } from '../../styles/globalStyles';
import { formatNumber } from '../../utils/statsUtils';

const Container = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.spacing.lg};
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: ${theme.spacing.md};
  }
`;

const InsightCard = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: ${theme.spacing.xl};
  padding: ${theme.spacing.lg};
  color: white;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    z-index: 0;
  }
  
  & > * {
    position: relative;
    z-index: 1;
  }
`;

const MetricCard = styled.div`
  background: rgba(255, 255, 255, 0.95);
  border-radius: ${theme.spacing.lg};
  padding: ${theme.spacing.lg};
  color: #333;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.spacing.md};
`;

const CardTitle = styled.h3`
  margin: 0;
  font-size: ${theme.typography.h3};
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`;

const CardIcon = styled.div<{ color?: string }>`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: ${theme.spacing.md};
  background: ${props => props.color || 'rgba(255, 255, 255, 0.2)'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
`;

const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.spacing.md};
  margin-top: ${theme.spacing.md};
`;

const MetricItem = styled.div`
  text-align: center;
`;

const MetricValue = styled.div`
  font-size: ${theme.typography.h1};
  font-weight: bold;
  color: #333;
  margin-bottom: ${theme.spacing.xs};
`;

const MetricLabel = styled.div`
  font-size: ${theme.typography.small};
  color: #666;
`;

const TrendIndicator = styled.div<{ trend: 'up' | 'down' | 'neutral' }>`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
  font-size: ${theme.typography.small};
  color: ${props => {
    switch (props.trend) {
      case 'up': return '#00d4aa';
      case 'down': return '#ff6b6b';
      default: return '#666';
    }
  }};
  margin-top: ${theme.spacing.xs};
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  overflow: hidden;
  margin-top: ${theme.spacing.sm};
`;

const ProgressFill = styled.div<{ percentage: number; color: string }>`
  height: 100%;
  width: ${props => props.percentage}%;
  background: ${props => props.color};
  border-radius: 4px;
  transition: width 0.8s ease;
`;

const Description = styled.p`
  margin: ${theme.spacing.sm} 0 0;
  font-size: ${theme.typography.small};
  opacity: 0.9;
  line-height: 1.4;
`;

interface DataInsightsProps {
  todayMessages: number;
  weekMessages: number;
  monthMessages: number;
  activeCustomers: number;
  pendingChats: number;
  totalShops: number;
}

export const DataInsights: React.FC<DataInsightsProps> = ({
  todayMessages,
  weekMessages,
  monthMessages,
  activeCustomers,
  pendingChats,
  totalShops
}) => {
  // 计算洞察数据
  const avgMessagesPerDay = Math.round(weekMessages / 7);
  const responseEfficiency = totalShops > 0 ? Math.round((activeCustomers / totalShops) * 100) : 0;
  const dailyGrowth = avgMessagesPerDay > 0 ? Math.round(((todayMessages - avgMessagesPerDay) / avgMessagesPerDay) * 100) : 0;
  const workloadLevel = pendingChats / Math.max(totalShops, 1);

  return (
    <Container>
      {/* 消息活跃度洞察 */}
      <InsightCard>
        <CardHeader>
          <CardTitle>
            <FiActivity />
            消息活跃度
          </CardTitle>
          <CardIcon>
            <FiTrendingUp />
          </CardIcon>
        </CardHeader>
        
        <MetricGrid>
          <MetricItem>
            <MetricValue>{formatNumber(todayMessages)}</MetricValue>
            <MetricLabel>今日消息总数</MetricLabel>
            <TrendIndicator trend={dailyGrowth > 0 ? 'up' : dailyGrowth < 0 ? 'down' : 'neutral'}>
              {dailyGrowth > 0 ? <FiTrendingUp size={14} /> : <FiTrendingDown size={14} />}
              {dailyGrowth > 0 ? '+' : ''}{dailyGrowth}%
            </TrendIndicator>
          </MetricItem>
          
          <MetricItem>
            <MetricValue>{formatNumber(avgMessagesPerDay)}</MetricValue>
            <MetricLabel>日均消息</MetricLabel>
          </MetricItem>
        </MetricGrid>
        
        <ProgressBar>
          <ProgressFill 
            percentage={Math.min((todayMessages / Math.max(avgMessagesPerDay * 2, 1)) * 100, 100)} 
            color="rgba(255, 255, 255, 0.8)"
          />
        </ProgressBar>
        
        <Description>
          {dailyGrowth > 0 
            ? `今日消息量较日均增长 ${dailyGrowth}%，用户活跃度良好` 
            : dailyGrowth < 0 
            ? `今日消息量较日均下降 ${Math.abs(dailyGrowth)}%，关注用户参与度`
            : '今日消息量保持稳定'}
        </Description>
      </InsightCard>

      {/* 服务效率洞察 */}
      <MetricCard>
        <CardHeader>
          <CardTitle>
            <FiPieChart />
            服务效率
          </CardTitle>
          <CardIcon color="#667eea">
            <FiActivity />
          </CardIcon>
        </CardHeader>
        
        <MetricGrid>
          <MetricItem>
            <MetricValue>{responseEfficiency}%</MetricValue>
            <MetricLabel>响应覆盖率</MetricLabel>
          </MetricItem>
          
          <MetricItem>
            <MetricValue>{Math.round(workloadLevel)}</MetricValue>
            <MetricLabel>平均待处理</MetricLabel>
          </MetricItem>
        </MetricGrid>
        
        <ProgressBar>
          <ProgressFill 
            percentage={responseEfficiency} 
            color={responseEfficiency > 80 ? '#00d4aa' : responseEfficiency > 60 ? '#ffa726' : '#ff6b6b'}
          />
        </ProgressBar>
        
        <Description>
          {responseEfficiency > 80 
            ? '服务响应效率优秀，继续保持'
            : responseEfficiency > 60
            ? '服务响应效率良好，可进一步优化'
            : '建议提高服务响应效率'}
        </Description>
      </MetricCard>
    </Container>
  );
};