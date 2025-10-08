import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

const Panel = styled.div`
  position: fixed;
  bottom: 0.5rem;
  right: 0.5rem;
  background: rgba(0,0,0,0.65);
  color: #fff;
  font-size: 0.75rem;
  padding: 0.75rem 0.9rem;
  border-radius: 0.75rem;
  z-index: 4000;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-width: 220px;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
`;

const Button = styled.button`
  background: #07C160;
  color: #fff;
  border: none;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.7rem;
  letter-spacing: .5px;
  &:hover { background:#059246; }
`;

interface DebugDensityPanelProps { enable?: boolean; }

const DebugDensityPanel: React.FC<DebugDensityPanelProps> = ({ enable }) => {
  const [rootFont, setRootFont] = useState('');
  const [vw, setVw] = useState(window.innerWidth);
  const [fixed, setFixed] = useState(false);

  useEffect(() => {
    if (!enable) return;
    const update = () => {
      setRootFont(getComputedStyle(document.documentElement).fontSize);
      setVw(window.innerWidth);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [enable]);

  if (!enable) return null;

  return (
    <Panel>
      <Row><span>VW</span><strong>{vw}</strong></Row>
      <Row><span>Root</span><strong>{rootFont}</strong></Row>
      <Row><span>Scale</span><strong>{(parseFloat(rootFont)/16).toFixed(3)}</strong></Row>
      <Button onClick={() => {
        setFixed(f => !f);
        const root = document.getElementById('root');
        if (root) {
          if (!fixed) root.classList.add('app-fixed-width'); else root.classList.remove('app-fixed-width');
        }
      }}>{fixed ? '宽度自适应' : '锁定基准宽度'}</Button>
    </Panel>
  );
};

export default DebugDensityPanel;
