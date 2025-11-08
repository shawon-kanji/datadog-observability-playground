import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Home } from './pages/Home';
import { ProductDetail } from './pages/ProductDetail';
import { Cart } from './pages/Cart';
import { Orders } from './pages/Orders';
import { MerchantDashboard } from './pages/MerchantDashboard';
import { AdminPanel } from './pages/AdminPanel';
import { ProductForm } from './pages/ProductForm';

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1976d2', // Material Blue
          colorSuccess: '#4caf50', // Material Green
          colorWarning: '#ff9800', // Material Orange
          colorError: '#f44336', // Material Red
          colorInfo: '#2196f3', // Material Light Blue
          colorBgBase: '#ffffff', // White background
          colorBgContainer: '#f5f5f5', // Light grey container
          colorBorder: '#e0e0e0', // Light grey border
          colorText: '#212121', // Dark text
          colorTextSecondary: '#757575', // Grey text
          borderRadius: 8,
          fontSize: 14,
          fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        components: {
          Layout: {
            headerBg: '#1976d2', // Material Blue header
            bodyBg: '#fafafa', // Very light grey body
            siderBg: '#ffffff',
            colorText: '#212121',
          },
          Card: {
            colorBgContainer: '#ffffff',
            colorBorderSecondary: '#e0e0e0',
          },
          Button: {
            colorPrimary: '#1976d2',
            algorithm: true,
          },
          Input: {
            colorBgContainer: '#ffffff',
          },
        },
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Home/Products - Public */}
              <Route
                path="/"
                element={
                  <Layout>
                    <Home />
                  </Layout>
                }
              />

              <Route
                path="/product/:id"
                element={
                  <Layout>
                    <ProductDetail />
                  </Layout>
                }
              />

              {/* Cart - Authenticated */}
              <Route
                path="/cart"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Cart />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Orders - Authenticated */}
              <Route
                path="/orders"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Orders />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Merchant Dashboard - Merchant/Admin only */}
              <Route
                path="/merchant"
                element={
                  <ProtectedRoute requiredRoles={['MERCHANT', 'ADMIN']}>
                    <Layout>
                      <MerchantDashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/merchant/products/new"
                element={
                  <ProtectedRoute requiredRoles={['MERCHANT', 'ADMIN']}>
                    <Layout>
                      <ProductForm />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Admin Panel - Admin only */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRoles={['ADMIN']}>
                    <Layout>
                      <AdminPanel />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
