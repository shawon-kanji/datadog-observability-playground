import React, { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  message,
  Spin,
  Empty,
  List,
  Tag,
  Divider,
} from 'antd';

const { Title, Text } = Typography;

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

interface Order {
  _id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  shippingAddress: string;
  paymentMethod: string;
  createdAt: string;
}

export const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_ORDER_SERVICE_URL || 'http://localhost:3001'}/api/orders/my-orders`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }

        const data = await response.json();
        setOrders(data.data || []);
      } catch (error: any) {
        message.error('Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'orange',
      processing: 'blue',
      shipped: 'cyan',
      delivered: 'green',
      cancelled: 'red',
    };
    return colors[status.toLowerCase()] || 'default';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>My Orders</Title>

      {orders.length === 0 ? (
        <Card>
          <Empty description="No orders found" />
        </Card>
      ) : (
        <List
          dataSource={orders}
          renderItem={(order) => (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <Text strong>Order ID: </Text>
                  <Text code>{order._id}</Text>
                </div>
                <Tag color={getStatusColor(order.status)}>{order.status.toUpperCase()}</Tag>
              </div>

              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">
                  Placed on {new Date(order.createdAt).toLocaleString()}
                </Text>
              </div>

              <Divider />

              <List
                size="small"
                dataSource={order.items}
                renderItem={(item) => (
                  <List.Item>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                      <Text>
                        {item.productName} x {item.quantity}
                      </Text>
                      <Text strong>${(item.price * item.quantity).toFixed(2)}</Text>
                    </div>
                  </List.Item>
                )}
              />

              <Divider />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>Shipping Address: </Text>
                  <Text>{order.shippingAddress}</Text>
                </div>
                <div>
                  <Text strong>Total: </Text>
                  <Text style={{ fontSize: 18, color: '#FF9900' }}>
                    ${order.totalAmount.toFixed(2)}
                  </Text>
                </div>
              </div>
            </Card>
          )}
        />
      )}
    </div>
  );
};
