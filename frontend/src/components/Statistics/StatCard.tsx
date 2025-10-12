import styled from 'styled-components';
import { theme } from '../../styles/globalStyles';

export const StatCard = styled.div<{ gradient?: string }>`
  background: ${({ gradient }) => gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
  border-radius: ${theme.spacing.xl};
  padding: ${theme.spacing.lg};
  color: white;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(0,0,0,0.18);
  }
`;

export const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: ${theme.spacing.lg};
`;
