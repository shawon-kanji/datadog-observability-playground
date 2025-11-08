import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Typography,
  message,
  Spin,
  Row,
  Col,
  Divider,
  InputNumber,
} from 'antd';
import { ShoppingCartOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { productsApi } from '../api';
import { useCart } from '../context/CartContext';
import type { Product } from '../types';

const { Title, Text, Paragraph } = Typography;

export const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const response = await productsApi.getById(id);
        setProduct(response.data);
      } catch (error: any) {
        message.error('Failed to fetch product details');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, navigate]);

  const handleAddToCart = () => {
    if (product) {
      for (let i = 0; i < quantity; i++) {
        addToCart(product);
      }
      message.success(`${quantity} x ${product.name} added to cart`);
    }
  };

  if (loading || !product) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/')}
        style={{ marginBottom: 16 }}
      >
        Back to Products
      </Button>

      <Row gutter={24}>
        <Col xs={24} md={10}>
          <img
            alt={product.name}
            src={product.imageUrl}
            style={{ width: '100%', borderRadius: 8 }}
          />
        </Col>
        <Col xs={24} md={14}>
          <Card>
            <Title level={2}>{product.name}</Title>
            <Text type="secondary">{product.category}</Text>

            <Divider />

            <Title level={3} style={{ color: '#FF9900' }}>
              ${product.price.toFixed(2)}
            </Title>

            <Paragraph>{product.description}</Paragraph>

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Text strong>Stock: </Text>
              <Text type={product.stock > 0 ? 'success' : 'danger'}>
                {product.stock > 0 ? `${product.stock} available` : 'Out of stock'}
              </Text>
            </div>

            {product.brand && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>Brand: </Text>
                <Text>{product.brand}</Text>
              </div>
            )}

            {product.merchantName && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>Sold by: </Text>
                <Text>{product.merchantName}</Text>
              </div>
            )}

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ marginRight: 16 }}>Quantity:</Text>
              <InputNumber
                min={1}
                max={product.stock}
                value={quantity}
                onChange={(value) => setQuantity(value || 1)}
                disabled={product.stock === 0}
              />
            </div>

            <Button
              type="primary"
              size="large"
              icon={<ShoppingCartOutlined />}
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              block
            >
              Add to Cart
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
