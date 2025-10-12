import React from 'react';
import styled from 'styled-components';
import { FiRefreshCw } from 'react-icons/fi';
import { theme } from '../../styles/globalStyles';

const RefreshButton = styled.button<{ isRefreshing: boolean }>`
  width: 100%;
  padding: ${theme.spacing.md};
  background: ${props => props.isRefreshing ? '#ccc' : 'rgba(255, 255, 255, 0.9)'};
  color: ${props => props.isRefreshing ? 'white' : '#333'};
  border: none;
  border-radius: ${theme.spacing.md};
  fontSize: ${theme.typography.body};
  cursor: ${props => props.isRefreshing ? 'not-allowed' : 'pointer'};
  transition: all 0.2s;
  backdrop-filter: blur(10px);
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.xs};

  &:hover {
    background: ${props => props.isRefreshing ? '#ccc' : 'rgba(255, 255, 255, 1)'};
    transform: ${props => props.isRefreshing ? 'none' : 'translateY(-1px)'};
    box-shadow: ${props => props.isRefreshing ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.15)'};
  }

  &:active {
    transform: ${props => props.isRefreshing ? 'none' : 'translateY(0)'};
  }
`;

const RefreshIcon = styled(FiRefreshCw)<{ isRefreshing: boolean }>`
  animation: ${props => props.isRefreshing ? 'spin 1s linear infinite' : 'none'};
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

interface RefreshStatsButtonProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  className?: string;
}

export const RefreshStatsButton: React.FC<RefreshStatsButtonProps> = ({
  onRefresh,
  isRefreshing,
  className
}) => {
  return (
    <RefreshButton
      onClick={onRefresh}
      disabled={isRefreshing}
      isRefreshing={isRefreshing}
      className={className}
    >
      <RefreshIcon size={16} isRefreshing={isRefreshing} />
      {isRefreshing ? '刷新中...' : '立即刷新数据'}
    </RefreshButton>
  );
};