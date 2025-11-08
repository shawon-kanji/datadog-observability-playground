import React from 'react';
import { Card, Typography, Tabs } from 'antd';
import { Products } from './Products';

const { Title } = Typography;

export const AdminPanel: React.FC = () => {
  const items = [
    {
      key: 'products',
      label: 'Products',
      children: <Products />,
    },
    {
      key: 'users',
      label: 'Users',
      children: <div>User management coming soon...</div>,
    },
    {
      key: 'orders',
      label: 'Orders',
      children: <div>Order management coming soon...</div>,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Admin Panel</Title>
      <Card>
        <Tabs items={items} />
      </Card>
    </div>
  );
};
