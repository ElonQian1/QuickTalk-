import React from 'react';
import styled from 'styled-components';
import { theme } from '../../../styles/globalStyles';

export interface StaffMember { id: number; username: string; role?: string; }

interface StaffListProps {
  data: StaffMember[];
  loading?: boolean;
  onRefresh?: () => void;
  onSelect?: (staff: StaffMember) => void;
}

const List = styled.ul`
  list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px;
`;

const Item = styled.li`
  background:${theme.colors.background}; border:1px solid ${theme.colors.border};
  padding:10px 14px; border-radius:${theme.borderRadius.small};
  display:flex; justify-content:space-between; align-items:center; font-size:${theme.typography.small};
`;

const Role = styled.span`
  color:${theme.colors.text.secondary}; font-size:12px;
`;

const Empty = styled.div`
  text-align:center; color:${theme.colors.text.secondary}; font-size:${theme.typography.small}; padding:24px 0;
`;

const StaffList: React.FC<StaffListProps> = ({ data, loading, onSelect }) => {
  if (loading) return <Empty>加载中...</Empty>;
  if (!data.length) return <Empty>暂无员工</Empty>;
  return (
    <List>
      {data.map(s => (
        <Item key={s.id} onClick={() => onSelect?.(s)}>
          <span>{s.username}</span>
          <Role>{s.role || '成员'}</Role>
        </Item>
      ))}
    </List>
  );
};

export default StaffList;
