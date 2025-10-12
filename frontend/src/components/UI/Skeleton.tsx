import styled, { keyframes } from 'styled-components';
import { theme } from '../../styles/globalStyles';

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

export const Skeleton = styled.div<{ height?: string; width?: string; radius?: string }>`
  width: ${p => p.width || '100%'};
  height: ${p => p.height || '1rem'};
  border-radius: ${p => p.radius || theme.borderRadius.medium};
  background: linear-gradient(90deg, #eceff1 25%, #f5f7f8 50%, #eceff1 75%);
  background-size: 200% 100%;
  animation: ${shimmer} 1.4s ease-in-out infinite;
`;

export const SkeletonLine = styled(Skeleton).attrs({ height: '0.875rem' })``;
export const SkeletonTitle = styled(Skeleton).attrs({ height: '1.25rem' })``;
export const SkeletonBlock = styled(Skeleton).attrs({ height: '3rem' })``;
