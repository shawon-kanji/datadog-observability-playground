import { Router, Request, Response, type IRouter } from 'express';
import { products, Product } from '../data';
import { v4 as uuidv4 } from 'uuid';

const router: IRouter = Router();

/**
 * GET /api/products - Get all products
 * Query params: scenario (error|internal-error|long-latency|random-latency|timeout|normal)
 */
router.get('/', (req: Request, res: Response) => {
  console.log('Fetching all products', { query: req.query });

  res.json({
    success: true,
    count: products.length,
    data: products
  });
});

/**
 * GET /api/products/:id - Get product by ID
 * Query params: scenario (error|internal-error|long-latency|random-latency|timeout|normal)
 */
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  console.log('Fetching product by ID', { id, query: req.query });

  const product = products.find(p => p.id === id);

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
});

/**
 * POST /api/products - Create a new product
 * Query params: scenario (error|internal-error|long-latency|random-latency|timeout|normal)
 */
router.post('/', (req: Request, res: Response) => {
  const { name, price, category, stock } = req.body;
  console.log('Creating new product', { body: req.body, query: req.query });

  if (!name || !price || !category || stock === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      required: ['name', 'price', 'category', 'stock']
    });
  }

  const newProduct: Product = {
    id: uuidv4(),
    name,
    price: parseFloat(price),
    category,
    stock: parseInt(stock),
    createdAt: new Date()
  };

  products.push(newProduct);

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: newProduct
  });
});

/**
 * PUT /api/products/:id - Update a product
 * Query params: scenario (error|internal-error|long-latency|random-latency|timeout|normal)
 */
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, price, category, stock } = req.body;
  console.log('Updating product', { id, body: req.body, query: req.query });

  const productIndex = products.findIndex(p => p.id === id);

  if (productIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Product not found',
      id
    });
  }

  // Update product fields
  if (name !== undefined) products[productIndex].name = name;
  if (price !== undefined) products[productIndex].price = parseFloat(price);
  if (category !== undefined) products[productIndex].category = category;
  if (stock !== undefined) products[productIndex].stock = parseInt(stock);

  res.json({
    success: true,
    message: 'Product updated successfully',
    data: products[productIndex]
  });
});

/**
 * DELETE /api/products/:id - Delete a product
 * Query params: scenario (error|internal-error|long-latency|random-latency|timeout|normal)
 */
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  console.log('Deleting product', { id, query: req.query });

  const productIndex = products.findIndex(p => p.id === id);

  if (productIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Product not found',
      id
    });
  }

  const deletedProduct = products.splice(productIndex, 1)[0];

  res.json({
    success: true,
    message: 'Product deleted successfully',
    data: deletedProduct
  });
});

export default router;
