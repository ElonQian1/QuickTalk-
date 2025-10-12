import React from 'react';
import styled from 'styled-components';
import { FiChevronLeft } from 'react-icons/fi';

const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f8f9fa;
  z-index: 1100;
  overflow-y: auto;
`;

const Header = styled.div`
  background: white;
  padding: 16px 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
`;

const BackButton = styled.button`
  background: none;
  border: none;
  padding: 8px;
  margin-right: 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;

  &:hover {
    background: #f8f9fa;
  }

  svg {
    width: 20px;
    height: 20px;
    color: #333;
  }
`;

const HeaderTitle = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
`;

const Content = styled.div`
  padding: 16px 20px 80px;
`;

const Section = styled.div`
  background: white;
  margin: 12px 0;
  padding: 16px 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Container>
      <Header>
        <BackButton onClick={onClose}>
          <FiChevronLeft />
        </BackButton>
        <HeaderTitle>帮助中心</HeaderTitle>
      </Header>

      <Content>
        <Section>
          <h3 style={{ margin: '0 0 8px' }}>使用说明</h3>
          <p style={{ margin: 0, color: '#555', lineHeight: 1.6 }}>
            这里将提供常见问题解答及使用指南。若有紧急问题，可通过管理员渠道反馈。
          </p>
        </Section>

        <Section>
          <h3 style={{ margin: '0 0 8px' }}>常见问题</h3>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#555', lineHeight: 1.8 }}>
            <li>如何查看数据统计？进入“数据统计”页面即可查看概览与趋势。</li>
            <li>如何处理客户消息？在“消息中心”中进入会话处理。</li>
          </ul>
        </Section>
      </Content>
    </Container>
  );
};

export default HelpModal;
