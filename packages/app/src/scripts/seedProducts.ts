/**
 * Seed script to populate the database with sample products
 * Run with: pnpm ts-node src/scripts/seedProducts.ts
 */
import dotenv from 'dotenv';
import { Database } from '../config/database';
import { Product } from '../models/Product';
import { logger } from '../logger';

dotenv.config();

const sampleProducts = [
  {
    name: 'Apple MacBook Pro 16"',
    description: 'Powerful laptop with M3 Max chip, 32GB RAM, and stunning Retina display. Perfect for professionals and creators.',
    price: 2499.99,
    category: 'Electronics',
    stock: 15,
    imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80',
    brand: 'Apple',
    rating: 4.8,
    reviewCount: 342,
    merchantName: 'Tech Store Premium'
  },
  {
    name: 'Sony WH-1000XM5 Wireless Headphones',
    description: 'Industry-leading noise cancellation with premium sound quality. Up to 30 hours of battery life.',
    price: 399.99,
    category: 'Electronics',
    stock: 45,
    imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&q=80',
    brand: 'Sony',
    rating: 4.7,
    reviewCount: 1250,
    merchantName: 'Audio Excellence'
  },
  {
    name: 'Classic Denim Jacket',
    description: 'Vintage-style denim jacket with a modern fit. Made from premium cotton denim for lasting comfort.',
    price: 89.99,
    category: 'Clothing',
    stock: 67,
    imageUrl: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800&q=80',
    brand: 'Urban Outfitters',
    rating: 4.5,
    reviewCount: 89,
    merchantName: 'Fashion Hub'
  },
  {
    name: 'The Art of Computer Programming',
    description: 'Complete set of Donald Knuth\'s legendary series. Essential reading for serious programmers.',
    price: 249.99,
    category: 'Books',
    stock: 23,
    imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80',
    brand: 'Addison-Wesley',
    rating: 4.9,
    reviewCount: 456,
    merchantName: 'Book Haven'
  },
  {
    name: 'Instant Pot Duo 7-in-1',
    description: 'Multi-functional pressure cooker that can replace 7 kitchen appliances. Perfect for quick, healthy meals.',
    price: 99.99,
    category: 'Home & Kitchen',
    stock: 89,
    imageUrl: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=800&q=80',
    brand: 'Instant Pot',
    rating: 4.6,
    reviewCount: 2347,
    merchantName: 'Kitchen Essentials'
  },
  {
    name: 'Professional Yoga Mat',
    description: 'Extra-thick, non-slip yoga mat with premium cushioning. Includes carrying strap.',
    price: 49.99,
    category: 'Sports',
    stock: 134,
    imageUrl: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800&q=80',
    brand: 'YogaLife',
    rating: 4.4,
    reviewCount: 567,
    merchantName: 'Fitness Pro'
  },
  {
    name: 'LEGO Architecture Set - Taj Mahal',
    description: 'Detailed replica of the iconic Taj Mahal. Over 5,900 pieces for hours of building enjoyment.',
    price: 369.99,
    category: 'Toys',
    stock: 12,
    imageUrl: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&q=80',
    brand: 'LEGO',
    rating: 4.9,
    reviewCount: 234,
    merchantName: 'Toy Kingdom'
  },
  {
    name: 'Organic Skincare Set',
    description: 'Complete 5-piece skincare routine with natural ingredients. Suitable for all skin types.',
    price: 129.99,
    category: 'Beauty',
    stock: 56,
    imageUrl: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&q=80',
    brand: 'NaturalGlow',
    rating: 4.7,
    reviewCount: 891,
    merchantName: 'Beauty Haven'
  },
  {
    name: 'Car Dash Cam 4K Ultra HD',
    description: 'High-resolution dash camera with night vision and parking mode. Includes 128GB memory card.',
    price: 159.99,
    category: 'Automotive',
    stock: 34,
    imageUrl: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80',
    brand: 'DriveSecure',
    rating: 4.5,
    reviewCount: 423,
    merchantName: 'Auto Accessories Plus'
  },
  {
    name: 'Smart Home Security System',
    description: 'Complete wireless security system with 4 cameras, motion sensors, and mobile app control.',
    price: 299.99,
    category: 'Electronics',
    stock: 28,
    imageUrl: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80',
    brand: 'SecureHome',
    rating: 4.6,
    reviewCount: 678,
    merchantName: 'Smart Home Solutions'
  }
];

async function seedDatabase() {
  try {
    logger.info('Starting database seed...');

    // Connect to database
    const db = Database.getInstance();
    await db.connect();

    // Clear existing products (optional - remove this if you want to keep existing data)
    const deleteResult = await Product.deleteMany({});
    logger.info(`Cleared ${deleteResult.deletedCount} existing products`);

    // Insert sample products
    const products = await Product.insertMany(sampleProducts);
    logger.info(`Successfully seeded ${products.length} products`);

    // Display seeded products
    products.forEach((product: any) => {
      logger.info(`  - ${product.name} ($${product.price}) - ${product.stock} in stock`);
    });

    // Disconnect from database
    await db.disconnect();
    logger.info('Database seed completed successfully');

    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed database', error as Error);
    process.exit(1);
  }
}

seedDatabase();
