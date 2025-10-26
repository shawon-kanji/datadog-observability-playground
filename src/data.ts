export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  createdAt: Date;
}

export const products: Product[] = [
  {
    id: '1',
    name: 'Laptop',
    price: 999.99,
    category: 'Electronics',
    stock: 50,
    createdAt: new Date('2024-01-15')
  },
  {
    id: '2',
    name: 'Wireless Mouse',
    price: 29.99,
    category: 'Electronics',
    stock: 200,
    createdAt: new Date('2024-02-10')
  },
  {
    id: '3',
    name: 'Desk Chair',
    price: 249.99,
    category: 'Furniture',
    stock: 30,
    createdAt: new Date('2024-01-20')
  },
  {
    id: '4',
    name: 'Monitor',
    price: 399.99,
    category: 'Electronics',
    stock: 75,
    createdAt: new Date('2024-03-01')
  },
  {
    id: '5',
    name: 'Keyboard',
    price: 79.99,
    category: 'Electronics',
    stock: 150,
    createdAt: new Date('2024-02-15')
  }
];
