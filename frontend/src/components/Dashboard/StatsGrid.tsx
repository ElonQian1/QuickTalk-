import React from 'react';
import styled from 'styled-components';
import { theme } from '../../styles/globalStyles';
import { StatCard } from './StatCard';
import { IconType } from 'react-icons';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${theme.spacing.md};
  padding: 0 ${theme.spacing.md} ${theme.spacing.md};

  @media (min-width: 768px) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

const LoadingOverlay = styled.div`
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.8);
    border-radius: ${theme.spacing.xl};
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  &.refreshing::after {
    opacity: 1;
  }
`;

export interface StatData {
  icon: IconType;
  value: number;
  label: string;
  color: string;
  change?: number;
  onClick?: () => void;
}

interface StatsGridProps {
  stats: StatData[];
  isLoading?: boolean;
  isRefreshing?: boolean;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ 
  stats, 
  isLoading = false,
  isRefreshing = false 
}) => {
  return (
    <Grid>
      {stats.map((stat, index) => (
        <LoadingOverlay 
          key={index} 
          className={isRefreshing ? 'refreshing' : ''}
        >
          <StatCard
            icon={stat.icon}
            value={stat.value}
            label={stat.label}
            color={stat.color}
            change={stat.change}
            isLoading={isLoading}
            onClick={stat.onClick}
          />
        </LoadingOverlay>
      ))}
    </Grid>
  );
};