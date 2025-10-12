import React from 'react';
import styled from 'styled-components';
import { theme } from '../../styles/globalStyles';

const StickyBar = styled.div`
  background: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  padding: ${theme.spacing.md};
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 10;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  color: white;
`;

const LastUpdated = styled.div`
  color: rgba(255, 255, 255, 0.85);
  font-size: ${theme.typography.small};
`;

export interface StatsHeaderProps {
  lastUpdated: Date | null;
}

export const StatsHeader: React.FC<StatsHeaderProps> = ({ lastUpdated }) => {
  const formatTime = (date: Date) =>
    date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <StickyBar>
      <Row>
        <LastUpdated>{lastUpdated ? formatTime(lastUpdated) : ''}</LastUpdated>
      </Row>
    </StickyBar>
  );
};

export default StatsHeader;
