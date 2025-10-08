import React, { useState } from 'react';
import styled from 'styled-components';
import { theme } from '../styles/globalStyles';

interface CreateShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (shopName: string, shopUrl?: string) => Promise<void>;
}

const Overlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div`
  background: ${theme.colors.white};
  border-radius: ${theme.borderRadius.large};
  padding: ${theme.spacing.xl};
  width: 90%;
  max-width: 500px;
  box-shadow: ${theme.shadows.modal};
  position: relative;
  max-height: 90vh;
  overflow-y: auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${theme.spacing.lg};
`;

const Title = styled.h2`
  font-size: ${theme.typography.h3};
  font-weight: 600;
  color: ${theme.colors.text.primary};
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  color: ${theme.colors.text.secondary};
  cursor: pointer;
  padding: 4px;
  
  &:hover {
    color: ${theme.colors.text.primary};
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`;

const Label = styled.label`
  font-size: ${theme.typography.small};
  font-weight: 500;
  color: ${theme.colors.text.primary};
`;

const RequiredMark = styled.span`
  color: ${theme.colors.danger};
  margin-left: 4px;
`;

const Input = styled.input<{ hasError?: boolean }>`
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border: 2px solid ${props => props.hasError ? theme.colors.danger : theme.colors.border};
  border-radius: ${theme.borderRadius.medium};
  font-size: ${theme.typography.body};
  transition: border-color 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: ${props => props.hasError ? theme.colors.danger : theme.colors.primary};
  }
  
  &::placeholder {
    color: ${theme.colors.text.placeholder};
  }
`;

const ErrorMessage = styled.div`
  color: ${theme.colors.danger};
  font-size: ${theme.typography.caption};
  margin-top: 4px;
`;

const HelpText = styled.div`
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.caption};
  margin-top: 4px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${theme.spacing.sm};
  justify-content: flex-end;
  margin-top: ${theme.spacing.lg};
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  border: none;
  border-radius: ${theme.borderRadius.medium};
  font-size: ${theme.typography.body};
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${props => props.variant === 'primary' ? `
    background: ${theme.colors.primary};
    color: ${theme.colors.white};
    
    &:hover:not(:disabled) {
      background: #059A47;
    }
    
    &:disabled {
      background: ${theme.colors.text.placeholder};
      cursor: not-allowed;
    }
  ` : `
    background: ${theme.colors.background};
    color: ${theme.colors.text.primary};
    border: 1px solid ${theme.colors.border};
    
    &:hover {
      background: ${theme.colors.text.placeholder}20;
    }
  `}
`;

const LoadingSpinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 8px;
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const CreateShopModal: React.FC<CreateShopModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    shopName: '',
    shopUrl: ''
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateUrl = (url: string): boolean => {
    if (!url) return true; // URL是可选的
    
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return true;
    
    // 基本格式检查：至少包含一个点，且不能只是单个词
    if (!trimmedUrl.includes('.') || trimmedUrl.split('.').length < 2) {
      return false;
    }
    
    // 尝试各种URL格式
    const urlsToTry = [
      trimmedUrl, // 原始输入
      `https://${trimmedUrl}`, // 添加https://
      `http://${trimmedUrl}`, // 添加http://
    ];
    
    // 如果输入已经包含协议，只验证原始URL
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      try {
        const parsed = new URL(trimmedUrl);
        return !!(parsed.hostname && parsed.hostname.includes('.'));
      } catch {
        return false;
      }
    }
    
    // 对于没有协议的URL，尝试添加协议后验证
    for (const testUrl of urlsToTry) {
      try {
        const parsed = new URL(testUrl);
        // 确保域名部分看起来合理：包含点且至少有两个部分
        if (parsed.hostname && parsed.hostname.includes('.')) {
          const parts = parsed.hostname.split('.');
          if (parts.length >= 2 && parts.every(part => part.length > 0)) {
            return true;
          }
        }
      } catch {
        continue;
      }
    }
    
    return false;
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    // 店铺名称验证
    if (!formData.shopName.trim()) {
      newErrors.shopName = '店铺名称是必填的';
    } else if (formData.shopName.trim().length < 2) {
      newErrors.shopName = '店铺名称至少需要2个字符';
    } else if (formData.shopName.trim().length > 50) {
      newErrors.shopName = '店铺名称不能超过50个字符';
    }
    
    // URL验证
    if (formData.shopUrl && !validateUrl(formData.shopUrl)) {
      newErrors.shopUrl = '请输入有效的网址（如：example.com 或 https://example.com）';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await onSubmit(
        formData.shopName.trim(),
        formData.shopUrl.trim() || undefined
      );
      
      // 成功后重置表单并关闭模态框
      setFormData({ shopName: '', shopUrl: '' });
      setErrors({});
      onClose();
    } catch (error) {
      console.error('创建店铺失败:', error);
      // 错误处理由父组件负责
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // 清除该字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({ shopName: '', shopUrl: '' });
      setErrors({});
      onClose();
    }
  };

  return (
    <Overlay isOpen={isOpen} onClick={handleClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>添加新店铺</Title>
          <CloseButton onClick={handleClose} disabled={isSubmitting}>
            ×
          </CloseButton>
        </Header>
        
        <Form onSubmit={handleSubmit}>
          <FormGroup>
            <Label htmlFor="shopName">
              店铺名称
              <RequiredMark>*</RequiredMark>
            </Label>
            <Input
              id="shopName"
              type="text"
              placeholder="请输入店铺名称"
              value={formData.shopName}
              onChange={(e) => handleInputChange('shopName', e.target.value)}
              hasError={!!errors.shopName}
              disabled={isSubmitting}
            />
            {errors.shopName && <ErrorMessage>{errors.shopName}</ErrorMessage>}
            <HelpText>为您的店铺起一个容易识别的名称</HelpText>
          </FormGroup>
          
          <FormGroup>
            <Label htmlFor="shopUrl">店铺网址</Label>
            <Input
              id="shopUrl"
              type="text"
              placeholder="example.com 或 https://example.com（可选）"
              value={formData.shopUrl}
              onChange={(e) => handleInputChange('shopUrl', e.target.value)}
              hasError={!!errors.shopUrl}
              disabled={isSubmitting}
            />
            {errors.shopUrl && <ErrorMessage>{errors.shopUrl}</ErrorMessage>}
            <HelpText>您的店铺网站地址，支持多种格式（example.com、www.example.com、https://example.com）</HelpText>
          </FormGroup>
          
          <ButtonGroup>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
              取消
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting && <LoadingSpinner />}
              {isSubmitting ? '创建中...' : '创建店铺'}
            </Button>
          </ButtonGroup>
        </Form>
      </Modal>
    </Overlay>
  );
};

export default CreateShopModal;