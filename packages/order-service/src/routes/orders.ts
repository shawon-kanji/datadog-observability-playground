import { Router, Request, Response, type IRouter } from 'express';
import { orders, Order, OrderItem } from '../data';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';

const router: IRouter = Router();

/**
 * GET /api/orders - Get all orders
 * Query params:
 *   - scenario (error|internal-error|long-latency|random-latency|timeout|normal)
 *   - status (pending|processing|shipped|delivered|cancelled)
 *   - customerId
 */
router.get('/', (req: Request, res: Response) => {
  const { status, customerId } = req.query;
  logger.info('Fetching all orders', { query: req.query });

  let filteredOrders = orders;

  // Filter by status if provided
  if (status) {
    filteredOrders = filteredOrders.filter(order => order.status === status);
  }

  // Filter by customerId if provided
  if (customerId) {
    filteredOrders = filteredOrders.filter(order => order.customerId === customerId);
  }

  res.json({
    success: true,
    count: filteredOrders.length,
    data: filteredOrders
  });
});

/**
 * GET /api/orders/:id - Get order by ID
 * Query params: scenario (error|internal-error|long-latency|random-latency|timeout|normal)
 */
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Fetching order by ID', { id, query: req.query });

  const order = orders.find(o => o.id === id);

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
});

/**
 * GET /api/orders/:id/status - Get order status by ID
 * Query params: scenario (error|internal-error|long-latency|random-latency|timeout|normal)
 */
router.get('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Fetching order status', { id, query: req.query });

  const order = orders.find(o => o.id === id);

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
      orderId: order.id,
      status: order.status,
      updatedAt: order.updatedAt
    }
  });
});

/**
 * POST /api/orders - Create a new order
 * Query params: scenario (error|internal-error|long-latency|random-latency|timeout|normal)
 * Body: { customerId, customerName, items, shippingAddress }
 */
router.post('/', (req: Request, res: Response) => {
  const { customerId, customerName, items, shippingAddress } = req.body;
  logger.info('Creating new order', { body: req.body, query: req.query });

  // Validate required fields
  if (!customerId || !customerName || !items || !Array.isArray(items) || items.length === 0 || !shippingAddress) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      required: ['customerId', 'customerName', 'items (array)', 'shippingAddress']
    });
  }

  // Validate items structure
  for (const item of items) {
    if (!item.productId || !item.productName || !item.quantity || !item.price) {
      return res.status(400).json({
        success: false,
        error: 'Invalid item structure',
        required: ['productId', 'productName', 'quantity', 'price']
      });
    }
  }

  // Calculate total amount
  const totalAmount = items.reduce((sum: number, item: OrderItem) =>
    sum + (item.price * item.quantity), 0
  );

  const newOrder: Order = {
    id: `ORD-${uuidv4().substring(0, 8).toUpperCase()}`,
    customerId,
    customerName,
    items,
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    status: 'pending',
    shippingAddress,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  orders.push(newOrder);

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: newOrder
  });
});

/**
 * PUT /api/orders/:id - Update an order
 * Query params: scenario (error|internal-error|long-latency|random-latency|timeout|normal)
 * Body: { status?, shippingAddress? }
 */
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, shippingAddress } = req.body;
  logger.info('Updating order', { id, body: req.body, query: req.query });

  const orderIndex = orders.findIndex(o => o.id === id);

  if (orderIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Order not found',
      id
    });
  }

  // Update order fields
  if (status !== undefined) {
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        validStatuses
      });
    }
    orders[orderIndex].status = status;
  }

  if (shippingAddress !== undefined) {
    orders[orderIndex].shippingAddress = shippingAddress;
  }

  orders[orderIndex].updatedAt = new Date();

  res.json({
    success: true,
    message: 'Order updated successfully',
    data: orders[orderIndex]
  });
});

/**
 * DELETE /api/orders/:id - Cancel an order (soft delete)
 * Query params: scenario (error|internal-error|long-latency|random-latency|timeout|normal)
 */
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Cancelling order', { id, query: req.query });

  const orderIndex = orders.findIndex(o => o.id === id);

  if (orderIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Order not found',
      id
    });
  }

  // Soft delete by changing status to cancelled
  orders[orderIndex].status = 'cancelled';
  orders[orderIndex].updatedAt = new Date();

  res.json({
    success: true,
    message: 'Order cancelled successfully',
    data: orders[orderIndex]
  });
});

/**
 * GET /api/orders/customer/:customerId - Get all orders for a customer
 * Query params: scenario (error|internal-error|long-latency|random-latency|timeout|normal)
 */
router.get('/customer/:customerId', (req: Request, res: Response) => {
  const { customerId } = req.params;
  logger.info('Fetching orders for customer', { customerId, query: req.query });

  const customerOrders = orders.filter(o => o.customerId === customerId);

  res.json({
    success: true,
    count: customerOrders.length,
    data: customerOrders
  });
});

export default router;
