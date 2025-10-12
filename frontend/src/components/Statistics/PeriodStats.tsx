import React from 'react';
import styled from 'styled-components';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';
import { theme } from '../../styles/globalStyles';
import { formatNumber, getGrowthColor } from '../../utils/statsUtils';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${theme.spacing.md};
`;

const Card = styled.div`
  background: #f8f9fa;
  border-radius: ${theme.spacing.lg};
  padding: ${theme.spacing.md};
  border: 1px solid #e9ecef;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const PeriodTitle = styled.h3`
  margin: 0 0 ${theme.spacing.md};
  color: #333;
  font-size: ${theme.typography.h3};
  font-weight: 600;
`;

const MetricRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${theme.spacing.xs} 0;
  border-bottom: 1px solid #e9ecef;

  &:last-child {
    border-bottom: none;
  }
`;

const MetricLabel = styled.span`
  font-size: ${theme.typography.small};
  color: #666;
`;

const MetricValue = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`;

const ValueNumber = styled.span`
  font-size: ${theme.typography.body};
  font-weight: 600;
  color: #333;
`;

const GrowthIndicator = styled.div<{ trend: 'up' | 'down' | 'neutral' }>`
  display: flex;
  align-items: center;
  font-size: ${theme.typography.caption};
  color: ${props => getGrowthColor(
    props.trend === 'up' ? 1 : props.trend === 'down' ? -1 : 0
  )};
`;

interface PeriodMetric {
  label: string;
  value: number;
  growth?: number;
  trend?: 'up' | 'down' | 'neutral';
}

interface PeriodData {
  period: string;
  label: string;
  metrics: PeriodMetric[];
}

interface PeriodStatsProps {
  periods: PeriodData[];
  isLoading?: boolean;
}

export const PeriodStats: React.FC<PeriodStatsProps> = ({ 
  periods, 
  isLoading = false 
}) => {
  const getTrendIcon = (trend?: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up': return <FiTrendingUp size={12} />;
      case 'down': return <FiTrendingDown size={12} />;
      default: return <FiMinus size={12} />;
    }
  };

  if (isLoading) {
    return (
      <Grid>
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <PeriodTitle>加载中...</PeriodTitle>
            <MetricRow>
              <MetricLabel>--</MetricLabel>
              <MetricValue>
                <ValueNumber>--</ValueNumber>
              </MetricValue>
            </MetricRow>
          </Card>
        ))}
      </Grid>
    );
  }

  return (
    <Grid>
      {periods.map((period, index) => (
        <Card key={index}>
          <PeriodTitle>{period.label}</PeriodTitle>
          {period.metrics.map((metric, metricIndex) => (
            <MetricRow key={metricIndex}>
              <MetricLabel>{metric.label}</MetricLabel>
              <MetricValue>
                <ValueNumber>{formatNumber(metric.value)}</ValueNumber>
                {metric.growth !== undefined && (
                  <GrowthIndicator trend={metric.trend || 'neutral'}>
                    {getTrendIcon(metric.trend)}
                    {metric.growth > 0 ? '+' : ''}{metric.growth}%
                  </GrowthIndicator>
                )}
              </MetricValue>
            </MetricRow>
          ))}
        </Card>
      ))}
    </Grid>
  );
};