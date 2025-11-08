import { Router, Request, Response, type IRouter } from 'express';
import { logger } from '../logger';

const router: IRouter = Router();

// Order service URL - can be configured via environment variable
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3001';

/**
 * Helper function to make HTTP requests to the order service
 */
async function fetchFromOrderService(path: string, options: RequestInit = {}) {
  const url = `${ORDER_SERVICE_URL}${path}`;
  logger.info('Calling order service', { url, method: options.method || 'GET' });

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error: any) {
    logger.error('Error calling order service', error);
    throw new Error(`Order service communication failed: ${error.message}`);
  }
}

/**
 * GET /api/orders - Get all orders from order service
 * Forwards query parameters to order service
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const queryString = new URLSearchParams(req.query as any).toString();
    const path = `/api/orders${queryString ? `?${queryString}` : ''}`;

    const result = await fetchFromOrderService(path);

    res.status(result.status).json(result.data);
  } catch (error: any) {
    logger.error('Error fetching orders', error);
    res.status(503).json({
      success: false,
      error: 'Service unavailable',
      message: error.message,
    });
  }
});

/**
 * GET /api/orders/:id - Get order by ID from order service
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const queryString = new URLSearchParams(req.query as any).toString();
    const path = `/api/orders/${id}${queryString ? `?${queryString}` : ''}`;

    const result = await fetchFromOrderService(path);

    res.status(result.status).json(result.data);
  } catch (error: any) {
    logger.error('Error fetching order', error);
    res.status(503).json({
      success: false,
      error: 'Service unavailable',
      message: error.message,
    });
  }
});

/**
 * GET /api/orders/:id/status - Get order status from order service
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const queryString = new URLSearchParams(req.query as any).toString();
    const path = `/api/orders/${id}/status${queryString ? `?${queryString}` : ''}`;

    const result = await fetchFromOrderService(path);

    res.status(result.status).json(result.data);
  } catch (error: any) {
    logger.error('Error fetching order status', error);
    res.status(503).json({
      success: false,
      error: 'Service unavailable',
      message: error.message,
    });
  }
});

/**
 * POST /api/orders - Create a new order via order service
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const queryString = new URLSearchParams(req.query as any).toString();
    const path = `/api/orders${queryString ? `?${queryString}` : ''}`;

    const result = await fetchFromOrderService(path, {
      method: 'POST',
      body: JSON.stringify(req.body),
    });

    res.status(result.status).json(result.data);
  } catch (error: any) {
    logger.error('Error creating order', error);
    res.status(503).json({
      success: false,
      error: 'Service unavailable',
      message: error.message,
    });
  }
});

/**
 * PUT /api/orders/:id - Update an order via order service
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const queryString = new URLSearchParams(req.query as any).toString();
    const path = `/api/orders/${id}${queryString ? `?${queryString}` : ''}`;

    const result = await fetchFromOrderService(path, {
      method: 'PUT',
      body: JSON.stringify(req.body),
    });

    res.status(result.status).json(result.data);
  } catch (error: any) {
    logger.error('Error updating order', error);
    res.status(503).json({
      success: false,
      error: 'Service unavailable',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/orders/:id - Cancel an order via order service
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const queryString = new URLSearchParams(req.query as any).toString();
    const path = `/api/orders/${id}${queryString ? `?${queryString}` : ''}`;

    const result = await fetchFromOrderService(path, {
      method: 'DELETE',
    });

    res.status(result.status).json(result.data);
  } catch (error: any) {
    logger.error('Error cancelling order', error);
    res.status(503).json({
      success: false,
      error: 'Service unavailable',
      message: error.message,
    });
  }
});

/**
 * GET /api/orders/customer/:customerId - Get customer orders via order service
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const queryString = new URLSearchParams(req.query as any).toString();
    const path = `/api/orders/customer/${customerId}${queryString ? `?${queryString}` : ''}`;

    const result = await fetchFromOrderService(path);

    res.status(result.status).json(result.data);
  } catch (error: any) {
    logger.error('Error fetching customer orders', error);
    res.status(503).json({
      success: false,
      error: 'Service unavailable',
      message: error.message,
    });
  }
});

export default router;
