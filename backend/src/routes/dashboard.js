const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/dashboard/overview:
 *   get:
 *     summary: Get dashboard overview statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *         description: Time period for statistics
 *     responses:
 *       200:
 *         description: Dashboard overview statistics
 */
router.get('/overview', 
  authenticateToken, 
  requirePermission('dashboard:read'),
  [
    query('period').optional().isIn(['today', 'week', 'month', 'year'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { period = 'month' } = req.query;
      
      // Calculate date range based on period
      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Get sales statistics
      const salesStats = await prisma.sale.aggregate({
        where: {
          createdAt: { gte: startDate },
          status: 'completed'
        },
        _sum: { total: true },
        _count: true
      });

      // Get purchase statistics
      const purchaseStats = await prisma.purchase.aggregate({
        where: {
          createdAt: { gte: startDate },
          status: 'received'
        },
        _sum: { total: true },
        _count: true
      });

      // Get credit statistics
      const creditStats = await prisma.credit.aggregate({
        where: {
          createdAt: { gte: startDate }
        },
        _sum: { amount: true, balance: true },
        _count: true
      });

      // Get product statistics
      const productStats = await prisma.product.aggregate({
        _sum: { stock: true },
        _count: true
      });

      // Get low stock products count
      const lowStockCount = await prisma.product.count({
        where: {
          stock: { lte: prisma.product.fields.minStock }
        }
      });

      // Get out of stock products count
      const outOfStockCount = await prisma.product.count({
        where: { stock: 0 }
      });

      // Get customer count
      const customerCount = await prisma.customer.count();

      // Get supplier count
      const supplierCount = await prisma.supplier.count();

      // Get recent sales
      const recentSales = await prisma.sale.findMany({
        where: { status: 'completed' },
        include: {
          customer: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      // Get recent purchases
      const recentPurchases = await prisma.purchase.findMany({
        where: { status: 'received' },
        include: {
          supplier: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      // Get top selling products
      const topProducts = await prisma.saleItem.groupBy({
        by: ['productId'],
        where: {
          sale: {
            status: 'completed',
            createdAt: { gte: startDate }
          }
        },
        _sum: { quantity: true },
        orderBy: {
          _sum: {
            quantity: 'desc'
          }
        },
        take: 5
      });

      // Get top products with names
      const topProductsWithNames = await Promise.all(
        topProducts.map(async (item) => {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: { name: true, code: true }
          });
          return {
            productId: item.productId,
            name: product?.name || 'Unknown',
            code: product?.code || 'Unknown',
            totalQuantity: item._sum.quantity || 0
          };
        })
      );

      const overview = {
        period,
        sales: {
          total: salesStats._sum.total || 0,
          count: salesStats._count || 0
        },
        purchases: {
          total: purchaseStats._sum.total || 0,
          count: purchaseStats._count || 0
        },
        credits: {
          total: creditStats._sum.amount || 0,
          balance: creditStats._sum.balance || 0,
          count: creditStats._count || 0
        },
        inventory: {
          totalProducts: productStats._count || 0,
          totalStock: productStats._sum.stock || 0,
          lowStockCount,
          outOfStockCount
        },
        customers: customerCount,
        suppliers: supplierCount,
        recentSales,
        recentPurchases,
        topProducts: topProductsWithNames
      };

      res.json(overview);
    } catch (error) {
      logger.error('Error generating dashboard overview:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/dashboard/charts:
 *   get:
 *     summary: Get chart data for dashboard
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year]
 *         description: Time period for chart data
 *     responses:
 *       200:
 *         description: Chart data for dashboard
 */
router.get('/charts', 
  authenticateToken, 
  requirePermission('dashboard:read'),
  [
    query('period').isIn(['week', 'month', 'year'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { period } = req.query;
      
      // Calculate date range
      const now = new Date();
      let startDate;
      let interval;
      
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          interval = 'day';
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          interval = 'day';
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          interval = 'month';
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          interval = 'day';
      }

      // Get sales data by period
      const salesData = await prisma.sale.groupBy({
        by: interval === 'day' ? ['createdAt'] : ['createdAt'],
        where: {
          createdAt: { gte: startDate },
          status: 'completed'
        },
        _sum: { total: true },
        _count: true
      });

      // Get purchase data by period
      const purchaseData = await prisma.purchase.groupBy({
        by: interval === 'day' ? ['createdAt'] : ['createdAt'],
        where: {
          createdAt: { gte: startDate },
          status: 'received'
        },
        _sum: { total: true },
        _count: true
      });

      // Get credit data by period
      const creditData = await prisma.credit.groupBy({
        by: interval === 'day' ? ['createdAt'] : ['createdAt'],
        where: {
          createdAt: { gte: startDate }
        },
        _sum: { amount: true, balance: true }
      });

      // Process data for charts
      const processChartData = (data, interval) => {
        const chartData = [];
        
        if (interval === 'day') {
          // Group by day
          const dailyData = {};
          data.forEach(item => {
            const date = item.createdAt.toISOString().split('T')[0];
            if (!dailyData[date]) {
              dailyData[date] = { total: 0, count: 0 };
            }
            dailyData[date].total += item._sum.total || 0;
            dailyData[date].count += item._count || 0;
          });
          
          Object.keys(dailyData).forEach(date => {
            chartData.push({
              date,
              total: dailyData[date].total,
              count: dailyData[date].count
            });
          });
        } else {
          // Group by month
          const monthlyData = {};
          data.forEach(item => {
            const month = item.createdAt.toISOString().slice(0, 7);
            if (!monthlyData[month]) {
              monthlyData[month] = { total: 0, count: 0 };
            }
            monthlyData[month].total += item._sum.total || 0;
            monthlyData[month].count += item._count || 0;
          });
          
          Object.keys(monthlyData).forEach(month => {
            chartData.push({
              month,
              total: monthlyData[month].total,
              count: monthlyData[month].count
            });
          });
        }
        
        return chartData.sort((a, b) => a.date?.localeCompare(b.date) || a.month?.localeCompare(b.month));
      };

      // Get category distribution
      const categoryDistribution = await prisma.product.groupBy({
        by: ['categoryId'],
        _sum: { stock: true },
        _count: true
      });

      const categoryData = await Promise.all(
        categoryDistribution.map(async (item) => {
          const category = await prisma.category.findUnique({
            where: { id: item.categoryId },
            select: { name: true, color: true }
          });
          return {
            category: category?.name || 'Unknown',
            color: category?.color || '#1976d2',
            stock: item._sum.stock || 0,
            count: item._count || 0
          };
        })
      );

      // Get payment method distribution
      const paymentMethodDistribution = await prisma.sale.groupBy({
        by: ['paymentMethod'],
        where: {
          createdAt: { gte: startDate },
          status: 'completed'
        },
        _sum: { total: true },
        _count: true
      });

      const charts = {
        period,
        sales: processChartData(salesData, interval),
        purchases: processChartData(purchaseData, interval),
        credits: processChartData(creditData, interval),
        categories: categoryData,
        paymentMethods: paymentMethodDistribution.map(item => ({
          method: item.paymentMethod,
          total: item._sum.total || 0,
          count: item._count || 0
        }))
      };

      res.json(charts);
    } catch (error) {
      logger.error('Error generating chart data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/dashboard/alerts:
 *   get:
 *     summary: Get dashboard alerts and notifications
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard alerts
 */
router.get('/alerts', authenticateToken, requirePermission('dashboard:read'), async (req, res) => {
  try {
    const alerts = [];

    // Check for low stock products
    const lowStockProducts = await prisma.product.findMany({
      where: {
        stock: { lte: prisma.product.fields.minStock },
        stock: { gt: 0 }
      },
      select: {
        id: true,
        name: true,
        code: true,
        stock: true,
        minStock: true
      },
      take: 10
    });

    if (lowStockProducts.length > 0) {
      alerts.push({
        type: 'warning',
        title: 'Productos con Stock Bajo',
        message: `${lowStockProducts.length} productos tienen stock bajo`,
        items: lowStockProducts.map(product => ({
          id: product.id,
          name: product.name,
          code: product.code,
          stock: product.stock,
          minStock: product.minStock
        }))
      });
    }

    // Check for out of stock products
    const outOfStockProducts = await prisma.product.findMany({
      where: { stock: 0 },
      select: {
        id: true,
        name: true,
        code: true
      },
      take: 10
    });

    if (outOfStockProducts.length > 0) {
      alerts.push({
        type: 'error',
        title: 'Productos Sin Stock',
        message: `${outOfStockProducts.length} productos están sin stock`,
        items: outOfStockProducts.map(product => ({
          id: product.id,
          name: product.name,
          code: product.code
        }))
      });
    }

    // Check for overdue credits
    const overdueCredits = await prisma.credit.findMany({
      where: {
        status: 'active',
        dueDate: { lt: new Date() }
      },
      include: {
        customer: {
          select: { name: true, email: true }
        }
      },
      take: 10
    });

    if (overdueCredits.length > 0) {
      alerts.push({
        type: 'error',
        title: 'Créditos Vencidos',
        message: `${overdueCredits.length} créditos están vencidos`,
        items: overdueCredits.map(credit => ({
          id: credit.id,
          customerName: credit.customer.name,
          customerEmail: credit.customer.email,
          amount: credit.amount,
          balance: credit.balance,
          dueDate: credit.dueDate
        }))
      });
    }

    // Check for pending purchases
    const pendingPurchases = await prisma.purchase.findMany({
      where: {
        status: 'pending',
        expectedDeliveryDate: { lt: new Date() }
      },
      include: {
        supplier: {
          select: { name: true, email: true }
        }
      },
      take: 10
    });

    if (pendingPurchases.length > 0) {
      alerts.push({
        type: 'warning',
        title: 'Compras Pendientes Vencidas',
        message: `${pendingPurchases.length} compras han pasado su fecha de entrega esperada`,
        items: pendingPurchases.map(purchase => ({
          id: purchase.id,
          orderNumber: purchase.orderNumber,
          supplierName: purchase.supplier.name,
          supplierEmail: purchase.supplier.email,
          expectedDeliveryDate: purchase.expectedDeliveryDate,
          total: purchase.total
        }))
      });
    }

    res.json(alerts);
  } catch (error) {
    logger.error('Error generating dashboard alerts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/dashboard/performance:
 *   get:
 *     summary: Get system performance metrics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System performance metrics
 */
router.get('/performance', authenticateToken, requirePermission('dashboard:read'), async (req, res) => {
  try {
    // Get user activity
    const activeUsers = await prisma.user.count({
      where: { isActive: true }
    });

    const totalUsers = await prisma.user.count();

    // Get recent activity
    const recentActivity = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: {
          select: { username: true, firstName: true, lastName: true }
        }
      }
    });

    // Get system health metrics
    const systemHealth = {
      database: 'healthy',
      api: 'healthy',
      memory: 'normal',
      uptime: process.uptime()
    };

    const performance = {
      users: {
        active: activeUsers,
        total: totalUsers,
        activePercentage: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0
      },
      recentActivity,
      systemHealth
    };

    res.json(performance);
  } catch (error) {
    logger.error('Error generating performance metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 