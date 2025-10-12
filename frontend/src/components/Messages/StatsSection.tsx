import styled from 'styled-components';
import { theme } from '../../styles/globalStyles';

export const StatsSection = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(${theme.spacing.md});
  border-radius: ${theme.spacing.xl};
  padding: ${theme.spacing.lg};
  margin-bottom: ${theme.spacing.lg};
  box-shadow: 0 0.25rem 1.25rem rgba(0,0,0,0.1);
`;

export const StatsSectionTitle = styled.h3`
  color: #333;
  font-size: ${theme.typography.h3};
  font-weight: 600;
  margin: 0 0 ${theme.spacing.md};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs};
`;