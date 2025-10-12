import React from 'react';
import styled from 'styled-components';
import { IconType } from 'react-icons';
import { theme } from '../../styles/globalStyles';

const Card = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(${theme.spacing.md});
  border-radius: ${theme.spacing.xl};
  padding: ${theme.spacing.mlg};
  text-align: center;
  box-shadow: 0 0.25rem 1.25rem rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-0.125rem);
    box-shadow: 0 0.5rem 1.875rem rgba(0,0,0,0.15);
  }
`;

const StatIcon = styled.div<{ color: string }>`
  width: ${theme.spacing.xxl};
  height: ${theme.spacing.xxl};
  background: ${props => props.color};
  border-radius: ${theme.spacing.lg};
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto ${theme.spacing.smd};
  color: white;

  svg {
    width: ${theme.spacing.md};
    height: ${theme.spacing.md};
  }
`;

const StatValue = styled.div<{ isLoading?: boolean }>`
  font-size: ${theme.typography.display};
  font-weight: bold;
  color: #333;
  margin-bottom: ${theme.spacing.micro};
  ${props => props.isLoading && 'opacity: 0.6;'}
`;

const StatLabel = styled.div`
  font-size: ${theme.typography.small};
  color: #666;
`;

const ChangeIndicator = styled.div<{ trend: 'up' | 'down' | 'neutral' }>`
  font-size: ${theme.typography.caption};
  margin-top: ${theme.spacing.micro};
  color: ${props => {
    switch (props.trend) {
      case 'up': return '#00d4aa';
      case 'down': return '#ff6b6b';
      default: return '#666';
    }
  }};
`;

interface StatCardProps {
  icon: IconType;
  value: number;
  label: string;
  color: string;
  change?: number;
  isLoading?: boolean;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  value,
  label,
  color,
  change,
  isLoading = false,
  onClick
}) => {
  const getTrend = (change?: number): 'up' | 'down' | 'neutral' => {
    if (!change) return 'neutral';
    return change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  };

  const formatChange = (change?: number): string => {
    if (!change) return '';
    const prefix = change > 0 ? '+' : '';
    return `${prefix}${change}`;
  };

  return (
    <Card onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <StatIcon color={color}>
        <Icon />
      </StatIcon>
      <StatValue isLoading={isLoading}>
        {isLoading ? '...' : value.toLocaleString()}
      </StatValue>
      <StatLabel>{label}</StatLabel>
      {change !== undefined && (
        <ChangeIndicator trend={getTrend(change)}>
          {formatChange(change)}
        </ChangeIndicator>
      )}
    </Card>
  );
};