import { apiClient, authClient } from './client';
import type {
  AuthResponse,
  RegisterData,
  LoginData,
  ProductsResponse,
  ProductResponse,
  CreateProductData,
  UpdateProductData,
} from '../types';

// Auth API
export const authApi = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await authClient.post<AuthResponse>('/api/auth/register', data);
    return response.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await authClient.post<AuthResponse>('/api/auth/login', data);
    return response.data;
  },

  getProfile: async () => {
    const response = await authClient.get('/api/auth/me');
    return response.data;
  },
};

// Products API
export const productsApi = {
  getAll: async (): Promise<ProductsResponse> => {
    const response = await apiClient.get<ProductsResponse>('/api/products');
    return response.data;
  },

  getById: async (id: string): Promise<ProductResponse> => {
    const response = await apiClient.get<ProductResponse>(`/api/products/${id}`);
    return response.data;
  },

  create: async (data: CreateProductData): Promise<ProductResponse> => {
    const response = await apiClient.post<ProductResponse>('/api/products', data);
    return response.data;
  },

  update: async (id: string, data: UpdateProductData): Promise<ProductResponse> => {
    const response = await apiClient.put<ProductResponse>(`/api/products/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<ProductResponse> => {
    const response = await apiClient.delete<ProductResponse>(`/api/products/${id}`);
    return response.data;
  },
};
