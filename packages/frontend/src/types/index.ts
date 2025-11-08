export type UserRole = 'USER' | 'MERCHANT' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  imageUrl: string;
  brand?: string;
  rating?: number;
  reviewCount?: number;
  merchantId?: string;
  merchantName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductsResponse {
  success: boolean;
  count: number;
  data: Product[];
}

export interface ProductResponse {
  success: boolean;
  message?: string;
  data: Product;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface CreateProductData {
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  imageUrl: string;
  brand?: string;
  rating?: number;
  reviewCount?: number;
}

export interface UpdateProductData {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  stock?: number;
  imageUrl?: string;
  brand?: string;
  rating?: number;
  reviewCount?: number;
}

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  imageUrl: string;
  merchantId?: string;
  merchantName?: string;
}

export interface OrderItem extends CartItem {}

export interface Order {
  _id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseData {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress: string;
  paymentMethod?: string;
}
