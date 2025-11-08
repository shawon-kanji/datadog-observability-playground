import React, { useEffect, useState } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Button,
  Card,
  Typography,
  message,
  Space,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { productsApi } from '../api';
import type { CreateProductData } from '../types';

const { Title } = Typography;

export const ProductForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const isEditMode = !!id;

  useEffect(() => {
    if (isEditMode) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    if (!id) return;
    setFetching(true);
    try {
      const response = await productsApi.getById(id);
      form.setFieldsValue(response.data);
    } catch (error: any) {
      message.error('Failed to fetch product details');
      navigate('/products');
    } finally {
      setFetching(false);
    }
  };

  const onFinish = async (values: CreateProductData) => {
    setLoading(true);
    try {
      if (isEditMode && id) {
        await productsApi.update(id, values);
        message.success('Product updated successfully');
      } else {
        await productsApi.create(values);
        message.success('Product created successfully');
      }
      navigate('/products');
    } catch (error: any) {
      message.error(
        error.response?.data?.error ||
          `Failed to ${isEditMode ? 'update' : 'create'} product`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card loading={fetching}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/products')}
          >
            Back
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            {isEditMode ? 'Edit Product' : 'Create New Product'}
          </Title>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{ maxWidth: 600 }}
        >
          <Form.Item
            label="Product Name"
            name="name"
            rules={[{ required: true, message: 'Please input product name!' }]}
          >
            <Input placeholder="Enter product name" size="large" />
          </Form.Item>

          <Form.Item
            label="Category"
            name="category"
            rules={[{ required: true, message: 'Please input category!' }]}
          >
            <Input placeholder="e.g., Electronics, Furniture" size="large" />
          </Form.Item>

          <Form.Item
            label="Price"
            name="price"
            rules={[
              { required: true, message: 'Please input price!' },
              { type: 'number', min: 0, message: 'Price must be positive!' },
            ]}
          >
            <InputNumber
              prefix="$"
              placeholder="0.00"
              style={{ width: '100%' }}
              size="large"
              precision={2}
            />
          </Form.Item>

          <Form.Item
            label="Stock"
            name="stock"
            rules={[
              { required: true, message: 'Please input stock quantity!' },
              {
                type: 'number',
                min: 0,
                message: 'Stock must be a positive number!',
              },
            ]}
          >
            <InputNumber
              placeholder="0"
              style={{ width: '100%' }}
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}
                size="large"
              >
                {isEditMode ? 'Update Product' : 'Create Product'}
              </Button>
              <Button size="large" onClick={() => navigate('/products')}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Space>
    </Card>
  );
};
