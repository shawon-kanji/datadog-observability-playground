import React from 'react';
import { Navigate } from 'react-router-dom';
import { Spin, Result, Button } from 'antd';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles
}) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access
  if (requiredRoles && user) {
    if (!requiredRoles.includes(user.role)) {
      return (
        <div style={{ padding: '50px', textAlign: 'center' }}>
          <Result
            status="403"
            title="403"
            subTitle="Sorry, you don't have permission to access this page."
            extra={
              <Button type="primary" href="/">
                Back Home
              </Button>
            }
          />
        </div>
      );
    }
  }

  return <>{children}</>;
};
