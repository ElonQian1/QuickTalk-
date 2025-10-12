import styled from 'styled-components';
import { theme } from '../../styles/globalStyles';

export const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.spacing.xl} ${theme.spacing.md};
  color: ${theme.colors.text.secondary};
`;

export const EmptyIcon = styled.div`
  width: ${theme.spacing.xxl};
  height: ${theme.spacing.xxl};
  margin: 0 auto ${theme.spacing.md};
  background: ${theme.colors.background};
  border-radius: ${theme.borderRadius.round};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.typography.display};
  color: ${theme.colors.text.placeholder};
`;

export const EmptyTitle = styled.h3`
  margin: 0 0 ${theme.spacing.sm};
  color: ${theme.colors.text.primary};
`;

export const EmptyDescription = styled.p`
  margin: 0;
  color: ${theme.colors.text.secondary};
`;