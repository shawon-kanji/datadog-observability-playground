/**
 * Merchant-specific routes for viewing their products and earnings
 */
import { Router, Request, Response, type IRouter } from 'express';
import { Product } from '../models/Product';
import { logger } from '../logger';
import { authenticate, requireRole } from '../middleware/auth';
import { UserRole } from '../utils/jwt';

const router: IRouter = Router();

/**
 * GET /api/merchant/products - Get all products for the authenticated merchant
 */
router.get('/products', authenticate, requireRole(UserRole.MERCHANT, UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).userId;
    logger.info('Fetching merchant products', { merchantId });

    const products = await Product.find({ merchantId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    logger.error('Error fetching merchant products', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch merchant products'
    });
  }
});

/**
 * GET /api/merchant/sales - Get sales information for the authenticated merchant
 * This endpoint will be called from the order service
 */
router.get('/sales', authenticate, requireRole(UserRole.MERCHANT, UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).userId;
    const { startDate, endDate } = req.query;

    logger.info('Fetching merchant sales data', { merchantId, startDate, endDate });

    // This will be populated once we integrate with order service
    // For now, just return merchant's product information
    const products = await Product.find({ merchantId });

    const totalProducts = products.length;
    const totalInventoryValue = products.reduce((sum: number, p: any) => sum + (p.price * p.stock), 0);
    const lowStockProducts = products.filter((p: any) => p.stock < 10);

    res.json({
      success: true,
      data: {
        merchantId,
        totalProducts,
        totalInventoryValue,
        lowStockCount: lowStockProducts.length,
        lowStockProducts: lowStockProducts.map((p: any) => ({
          id: p._id,
          name: p.name,
          stock: p.stock,
          price: p.price
        })),
        // These will be populated from order service
        totalSales: 0,
        totalRevenue: 0,
        orderCount: 0
      }
    });
  } catch (error) {
    logger.error('Error fetching merchant sales', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch merchant sales data'
    });
  }
});

export default router;
