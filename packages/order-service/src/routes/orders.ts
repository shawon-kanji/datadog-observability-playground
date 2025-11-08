import { Router, Request, Response, type IRouter } from 'express';
import { Order } from '../models/Order';
import { logger } from '../logger';

const router: IRouter = Router();

/**
 * GET /api/orders - Get all orders
 * Query params:
 *   - status (pending|processing|shipped|delivered|cancelled)
 *   - customerId
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, customerId } = req.query;
    logger.info('Fetching all orders', { query: req.query });

    const filter: any = {};

    // Filter by status if provided
    if (status) {
      filter.status = status;
    }

    // Filter by customerId if provided
    if (customerId) {
      filter.customerId = customerId;
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    logger.error('Error fetching orders', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

/**
 * GET /api/orders/:id - Get order by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logger.info('Fetching order by ID', { id });

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
        id
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    logger.error('Error fetching order', error as Error, { id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order'
    });
  }
});

/**
 * GET /api/orders/:id/status - Get order status by ID
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logger.info('Fetching order status', { id });

    const order = await Order.findById(id).select('status updatedAt');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
        id
      });
    }

    res.json({
      success: true,
      data: {
        orderId: order._id,
        status: order.status,
        updatedAt: order.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error fetching order status', error as Error, { id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order status'
    });
  }
});

/**
 * POST /api/orders - Create a new order
 * Body: { customerId, customerName, customerEmail, items, shippingAddress, paymentMethod }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { customerId, customerName, customerEmail, items, shippingAddress, paymentMethod } = req.body;
    logger.info('Creating new order', { body: req.body });

    // Validate required fields
    if (!customerId || !customerName || !customerEmail || !items || !Array.isArray(items) || items.length === 0 || !shippingAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['customerId', 'customerName', 'customerEmail', 'items (array)', 'shippingAddress']
      });
    }

    // Validate items structure
    for (const item of items) {
      if (!item.productId || !item.productName || !item.quantity || item.price === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Invalid item structure',
          required: ['productId', 'productName', 'quantity', 'price']
        });
      }
    }

    // Calculate total amount
    const totalAmount = items.reduce((sum: number, item: any) =>
      sum + (item.price * item.quantity), 0
    );

    const newOrder = new Order({
      customerId,
      customerName,
      customerEmail,
      items,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      status: 'pending',
      shippingAddress,
      paymentMethod
    });

    await newOrder.save();

    logger.info('Order created successfully', { orderId: newOrder._id, customerId, totalAmount });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: newOrder
    });
  } catch (error) {
    logger.error('Error creating order', error as Error);

    if ((error as any).name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: (error as any).message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create order'
    });
  }
});

/**
 * PUT /api/orders/:id - Update an order
 * Body: { status?, shippingAddress? }
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, shippingAddress } = req.body;
    logger.info('Updating order', { id, body: req.body });

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
        id
      });
    }

    // Update order fields
    if (status !== undefined) {
      order.status = status;
    }

    if (shippingAddress !== undefined) {
      order.shippingAddress = shippingAddress;
    }

    await order.save();

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: order
    });
  } catch (error) {
    logger.error('Error updating order', error as Error, { id: req.params.id });

    if ((error as any).name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: (error as any).message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update order'
    });
  }
});

/**
 * DELETE /api/orders/:id - Cancel an order (soft delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logger.info('Cancelling order', { id });

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
        id
      });
    }

    // Soft delete by changing status to cancelled
    order.status = 'cancelled';
    await order.save();

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });
  } catch (error) {
    logger.error('Error cancelling order', error as Error, { id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order'
    });
  }
});

/**
 * GET /api/orders/customer/:customerId - Get all orders for a customer
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    logger.info('Fetching orders for customer', { customerId });

    const customerOrders = await Order.find({ customerId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: customerOrders.length,
      data: customerOrders
    });
  } catch (error) {
    logger.error('Error fetching customer orders', error as Error, { customerId: req.params.customerId });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer orders'
    });
  }
});

/**
 * GET /api/orders/merchant/:merchantId - Get all orders containing products from a merchant
 */
router.get('/merchant/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    logger.info('Fetching orders for merchant', { merchantId });

    // Find orders that contain items from this merchant
    const merchantOrders = await Order.find({
      'items.merchantId': merchantId
    }).sort({ createdAt: -1 });

    // Calculate merchant-specific stats
    let totalRevenue = 0;
    let itemsSold = 0;

    merchantOrders.forEach((order: any) => {
      order.items.forEach((item: any) => {
        if (item.merchantId === merchantId) {
          totalRevenue += item.price * item.quantity;
          itemsSold += item.quantity;
        }
      });
    });

    res.json({
      success: true,
      count: merchantOrders.length,
      data: {
        orders: merchantOrders,
        stats: {
          totalOrders: merchantOrders.length,
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          itemsSold
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching merchant orders', error as Error, { merchantId: req.params.merchantId });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch merchant orders'
    });
  }
});

export default router;
