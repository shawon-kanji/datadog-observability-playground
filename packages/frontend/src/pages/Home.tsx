import React, { useEffect, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Typography,
  message,
  Spin,
  Empty,
  Input,
  Select,
} from 'antd';
import { ShoppingCartOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { productsApi } from '../api';
import { useCart } from '../context/CartContext';
import type { Product } from '../types';

const { Title, Text, Paragraph } = Typography;
const { Meta } = Card;
const { Option } = Select;

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await productsApi.getAll();
      setProducts(response.data);
    } catch (error: any) {
      message.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const categories = ['all', ...new Set(products.map((p) => p.category))];

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    message.success(`${product.name} added to cart`);
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
      <Title level={2}>Products</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={16}>
          <Input
            placeholder="Search products..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="large"
          />
        </Col>
        <Col xs={24} sm={8}>
          <Select
            value={selectedCategory}
            onChange={setSelectedCategory}
            style={{ width: '100%' }}
            size="large"
          >
            {categories.map((cat) => (
              <Option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </Option>
            ))}
          </Select>
        </Col>
      </Row>

      {filteredProducts.length === 0 ? (
        <Empty description="No products found" />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredProducts.map((product) => (
            <Col key={product.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                cover={
                  <img
                    alt={product.name}
                    src={product.imageUrl}
                    style={{ height: 200, objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => navigate(`/product/${product.id}`)}
                  />
                }
                actions={[
                  <Button
                    type="primary"
                    icon={<ShoppingCartOutlined />}
                    onClick={() => handleAddToCart(product)}
                    disabled={product.stock === 0}
                  >
                    Add to Cart
                  </Button>,
                ]}
              >
                <Meta
                  title={
                    <div
                      onClick={() => navigate(`/product/${product.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      {product.name}
                    </div>
                  }
                  description={
                    <>
                      <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
                        {product.description}
                      </Paragraph>
                      <div>
                        <Text strong style={{ fontSize: 18, color: '#FF9900' }}>
                          ${product.price.toFixed(2)}
                        </Text>
                      </div>
                      <div>
                        <Text type="secondary">
                          {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                        </Text>
                      </div>
                    </>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};
