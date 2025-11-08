import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  message,
  Spin,
  Row,
  Col,
  Statistic,
  Table,
  Button,
} from 'antd';
import { ShopOutlined, DollarOutlined, ProductOutlined, PlusOutlined } from '@ant-design/icons';
import type { Product } from '../types';

const { Title } = Typography;

interface MerchantStats {
  totalProducts: number;
  totalInventoryValue: number;
  lowStockCount: number;
  lowStockProducts: Product[];
}

export const MerchantDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/merchant/sales`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch merchant stats');
        }

        const data = await response.json();
        setStats(data.data);
      } catch (error: any) {
        message.error('Failed to fetch merchant statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading || !stats) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  const columns = [
    {
      title: 'Product',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Stock',
      dataIndex: 'stock',
      key: 'stock',
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => `$${price.toFixed(2)}`,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={2}>Merchant Dashboard</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/merchant/products/new')}
        >
          Add Product
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Products"
              value={stats.totalProducts}
              prefix={<ProductOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Inventory Value"
              value={stats.totalInventoryValue}
              prefix={<DollarOutlined />}
              precision={2}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Low Stock Items"
              value={stats.lowStockCount}
              prefix={<ShopOutlined />}
              valueStyle={{ color: stats.lowStockCount > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      {stats.lowStockProducts.length > 0 && (
        <Card title="Low Stock Products">
          <Table
            dataSource={stats.lowStockProducts}
            columns={columns}
            rowKey="id"
            pagination={false}
          />
        </Card>
      )}
    </div>
  );
};
