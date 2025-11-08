import { Router, Request, Response, type IRouter } from 'express';
import { Product } from '../models/Product';
import { logger } from '../logger';
import { authenticate, requireRole } from '../middleware/auth';
import { UserRole } from '../utils/jwt';

const router: IRouter = Router();

/**
 * GET /api/products - Get all products
 * Query params: category, minPrice, maxPrice, search
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, minPrice, maxPrice, search } = req.query;
    logger.info('Fetching all products', { query: req.query });

    const filter: any = {};

    if (category) {
      filter.category = category;
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice as string);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice as string);
    }

    if (search) {
      filter.$text = { $search: search as string };
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    logger.error('Error fetching products', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

/**
 * GET /api/products/:id - Get product by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logger.info('Fetching product by ID', { id });

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        id
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    logger.error('Error fetching product', error as Error, { id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

/**
 * POST /api/products - Create a new product
 * Requires authentication and MERCHANT or ADMIN role
 */
router.post('/', authenticate, requireRole(UserRole.MERCHANT, UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const { name, description, price, category, stock, imageUrl, brand, rating, reviewCount } = req.body;
    logger.info('Creating new product', { body: req.body });

    if (!name || !description || !price || !category || stock === undefined || !imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['name', 'description', 'price', 'category', 'stock', 'imageUrl']
      });
    }

    const userId = (req as any).userId;
    const userEmail = (req as any).userEmail;

    const newProduct = new Product({
      name,
      description,
      price: parseFloat(price),
      category,
      stock: parseInt(stock),
      imageUrl,
      brand,
      rating: rating ? parseFloat(rating) : 0,
      reviewCount: reviewCount ? parseInt(reviewCount) : 0,
      merchantId: userId,
      merchantName: userEmail
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: newProduct
    });
  } catch (error) {
    logger.error('Error creating product', error as Error);

    if ((error as any).name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: (error as any).message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create product'
    });
  }
});

/**
 * PUT /api/products/:id - Update a product
 * Requires authentication
 */
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, stock, imageUrl, brand, rating, reviewCount } = req.body;
    logger.info('Updating product', { id, body: req.body });

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        id
      });
    }

    // Update product fields
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = parseFloat(price);
    if (category !== undefined) product.category = category;
    if (stock !== undefined) product.stock = parseInt(stock);
    if (imageUrl !== undefined) product.imageUrl = imageUrl;
    if (brand !== undefined) product.brand = brand;
    if (rating !== undefined) product.rating = parseFloat(rating);
    if (reviewCount !== undefined) product.reviewCount = parseInt(reviewCount);

    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    logger.error('Error updating product', error as Error, { id: req.params.id });

    if ((error as any).name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: (error as any).message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update product'
    });
  }
});

/**
 * DELETE /api/products/:id - Delete a product
 * Requires authentication
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logger.info('Deleting product', { id });

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        id
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: product
    });
  } catch (error) {
    logger.error('Error deleting product', error as Error, { id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to delete product'
    });
  }
});

export default router;
