export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

export const orders: Order[] = [
  {
    id: 'ORD-001',
    customerId: 'CUST-123',
    customerName: 'John Doe',
    items: [
      {
        productId: '1',
        productName: 'Laptop',
        quantity: 1,
        price: 999.99
      },
      {
        productId: '2',
        productName: 'Wireless Mouse',
        quantity: 2,
        price: 29.99
      }
    ],
    totalAmount: 1059.97,
    status: 'delivered',
    shippingAddress: '123 Main St, New York, NY 10001',
    createdAt: new Date('2024-01-15T10:30:00'),
    updatedAt: new Date('2024-01-20T14:45:00')
  },
  {
    id: 'ORD-002',
    customerId: 'CUST-456',
    customerName: 'Jane Smith',
    items: [
      {
        productId: '3',
        productName: 'Desk Chair',
        quantity: 1,
        price: 249.99
      },
      {
        productId: '4',
        productName: 'Monitor',
        quantity: 2,
        price: 399.99
      }
    ],
    totalAmount: 1049.97,
    status: 'shipped',
    shippingAddress: '456 Oak Ave, Los Angeles, CA 90001',
    createdAt: new Date('2024-02-10T09:15:00'),
    updatedAt: new Date('2024-02-12T16:30:00')
  },
  {
    id: 'ORD-003',
    customerId: 'CUST-789',
    customerName: 'Bob Johnson',
    items: [
      {
        productId: '5',
        productName: 'Keyboard',
        quantity: 1,
        price: 79.99
      }
    ],
    totalAmount: 79.99,
    status: 'processing',
    shippingAddress: '789 Pine Rd, Chicago, IL 60601',
    createdAt: new Date('2024-03-01T14:20:00'),
    updatedAt: new Date('2024-03-01T14:20:00')
  },
  {
    id: 'ORD-004',
    customerId: 'CUST-321',
    customerName: 'Alice Brown',
    items: [
      {
        productId: '1',
        productName: 'Laptop',
        quantity: 2,
        price: 999.99
      },
      {
        productId: '4',
        productName: 'Monitor',
        quantity: 2,
        price: 399.99
      },
      {
        productId: '5',
        productName: 'Keyboard',
        quantity: 2,
        price: 79.99
      }
    ],
    totalAmount: 2959.94,
    status: 'pending',
    shippingAddress: '321 Elm St, Boston, MA 02101',
    createdAt: new Date('2024-03-05T11:00:00'),
    updatedAt: new Date('2024-03-05T11:00:00')
  },
  {
    id: 'ORD-005',
    customerId: 'CUST-654',
    customerName: 'Charlie Davis',
    items: [
      {
        productId: '2',
        productName: 'Wireless Mouse',
        quantity: 5,
        price: 29.99
      },
      {
        productId: '5',
        productName: 'Keyboard',
        quantity: 3,
        price: 79.99
      }
    ],
    totalAmount: 389.92,
    status: 'delivered',
    shippingAddress: '654 Maple Dr, Seattle, WA 98101',
    createdAt: new Date('2024-02-20T08:45:00'),
    updatedAt: new Date('2024-02-25T10:15:00')
  }
];
