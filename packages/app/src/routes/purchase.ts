/**
 * Purchase/Buy product routes
 */
import { Router, Request, Response, type IRouter } from 'express';
import { Product } from '../models/Product';
import { logger } from '../logger';
import { authenticate } from '../middleware/auth';

const router: IRouter = Router();

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3001';

/**
 * POST /api/purchase - Purchase products (create order)
 * Requires authentication
 * Body: {
 *   items: [{ productId, quantity }],
 *   shippingAddress: string,
 *   paymentMethod?: string
 * }
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;
    const userId = (req as any).userId;
    const userEmail = (req as any).userEmail;

    logger.info('Processing purchase request', { userId, itemCount: items?.length });

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0 || !shippingAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['items (array)', 'shippingAddress']
      });
    }

    // Validate and fetch product details
    const orderItems = [];
    const stockUpdates = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return res.status(400).json({
          success: false,
          error: 'Invalid item structure',
          required: ['productId', 'quantity (must be >= 1)']
        });
      }

      // Fetch product from database
      const product = await Product.findById(item.productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: `Product not found: ${item.productId}`
        });
      }

      // Check stock availability
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for product: ${product.name}`,
          product: {
            id: product._id,
            name: product.name,
            available: product.stock,
            requested: item.quantity
          }
        });
      }

      // Prepare order item
      orderItems.push({
        productId: String(product._id),
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        imageUrl: product.imageUrl,
        merchantId: product.merchantId,
        merchantName: product.merchantName
      });

      // Prepare stock update
      stockUpdates.push({
        productId: product._id,
        newStock: product.stock - item.quantity
      });
    }

    // Update product stock
    for (const update of stockUpdates) {
      await Product.findByIdAndUpdate(update.productId, {
        stock: update.newStock
      });
    }

    logger.info('Stock updated for purchase', { userId, updates: stockUpdates.length });

    // Create order via order service
    const orderPayload = {
      customerId: userId,
      customerName: userEmail.split('@')[0], // Use email username as name
      customerEmail: userEmail,
      items: orderItems,
      shippingAddress,
      paymentMethod: paymentMethod || 'Credit Card'
    };

    const orderResponse = await fetch(`${ORDER_SERVICE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload)
    });

    if (!orderResponse.ok) {
      // Rollback stock updates if order creation fails
      for (const update of stockUpdates) {
        const product = await Product.findById(update.productId);
        if (product) {
          product.stock = update.newStock + items.find((i: any) => i.productId === String(update.productId))?.quantity || 0;
          await product.save();
        }
      }

      const errorData = await orderResponse.json();
      logger.error('Order creation failed, rolled back stock', undefined, { userId, errorData });

      return res.status(500).json({
        success: false,
        error: 'Failed to create order',
        details: errorData
      });
    }

    const orderData: any = await orderResponse.json();

    logger.info('Purchase completed successfully', {
      userId,
      orderId: orderData.data._id,
      totalAmount: orderData.data.totalAmount
    });

    res.status(201).json({
      success: true,
      message: 'Purchase completed successfully',
      data: {
        order: orderData.data,
        stockUpdated: true
      }
    });

  } catch (error) {
    logger.error('Error processing purchase', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to process purchase'
    });
  }
});

export default router;
