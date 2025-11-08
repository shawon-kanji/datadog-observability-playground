import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  List,
  InputNumber,
  message,
  Empty,
  Space,
  Divider,
  Form,
  Input,
} from 'antd';
import { DeleteOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useCart } from '../context/CartContext';

const { Title, Text } = Typography;

export const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart, getCartTotal } = useCart();
  const [loading, setLoading] = useState(false);
  const [checkoutForm] = Form.useForm();

  const handleCheckout = async (values: any) => {
    setLoading(true);
    try {
      // Create order payload
      const items = Object.entries(cartItems).map(([productId, item]) => ({
        productId,
        quantity: item.quantity,
      }));

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          items,
          shippingAddress: values.shippingAddress,
          paymentMethod: values.paymentMethod || 'Credit Card',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create order');
      }

      const data = await response.json();
      message.success('Order placed successfully!');
      clearCart();
      navigate('/orders');
    } catch (error: any) {
      message.error(error.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const cartItemsArray = Object.values(cartItems);

  if (cartItemsArray.length === 0) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <Empty
            description="Your cart is empty"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={() => navigate('/')}>
              Continue Shopping
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Shopping Cart</Title>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <Card>
          <List
            itemLayout="horizontal"
            dataSource={cartItemsArray}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <InputNumber
                    min={1}
                    max={item.product.stock}
                    value={item.quantity}
                    onChange={(value) => updateQuantity(item.product.id, value || 1)}
                  />,
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeFromCart(item.product.id)}
                  >
                    Remove
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }}
                    />
                  }
                  title={item.product.name}
                  description={
                    <>
                      <Text>${item.product.price.toFixed(2)} each</Text>
                      <br />
                      <Text strong>
                        Subtotal: ${(item.product.price * item.quantity).toFixed(2)}
                      </Text>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        <div>
          <Card title="Order Summary" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Items:</Text>
                <Text>{cartItemsArray.reduce((sum, item) => sum + item.quantity, 0)}</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Title level={4}>Total:</Title>
                <Title level={4} style={{ color: '#FF9900' }}>
                  ${getCartTotal().toFixed(2)}
                </Title>
              </div>
            </Space>
          </Card>

          <Card title="Checkout">
            <Form form={checkoutForm} layout="vertical" onFinish={handleCheckout}>
              <Form.Item
                label="Shipping Address"
                name="shippingAddress"
                rules={[{ required: true, message: 'Please enter shipping address' }]}
              >
                <Input.TextArea rows={3} placeholder="Enter your shipping address" />
              </Form.Item>

              <Form.Item label="Payment Method" name="paymentMethod">
                <Input placeholder="Credit Card" />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                icon={<ShoppingOutlined />}
                loading={loading}
                block
                size="large"
              >
                Place Order
              </Button>
            </Form>
          </Card>
        </div>
      </div>
    </div>
  );
};
