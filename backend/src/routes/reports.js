const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/reports/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
router.get('/dashboard', authenticateToken, requirePermission('reports:read'), async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Get counts
    const [totalProducts, totalCustomers, totalSuppliers, totalUsers] = await Promise.all([
      prisma.product.count(),
      prisma.customer.count(),
      prisma.supplier.count(),
      prisma.user.count()
    ]);

    // Get sales statistics
    const [monthlySales, yearlySales, totalSales] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          createdAt: { gte: startOfMonth },
          status: 'completed'
        },
        _sum: { total: true },
        _count: true
      }),
      prisma.sale.aggregate({
        where: {
          createdAt: { gte: startOfYear },
          status: 'completed'
        },
        _sum: { total: true },
        _count: true
      }),
      prisma.sale.aggregate({
        where: { status: 'completed' },
        _sum: { total: true },
        _count: true
      })
    ]);

    // Get purchase statistics
    const [monthlyPurchases, yearlyPurchases, totalPurchases] = await Promise.all([
      prisma.purchase.aggregate({
        where: {
          createdAt: { gte: startOfMonth },
          status: 'received'
        },
        _sum: { total: true },
        _count: true
      }),
      prisma.purchase.aggregate({
        where: {
          createdAt: { gte: startOfYear },
          status: 'received'
        },
        _sum: { total: true },
        _count: true
      }),
      prisma.purchase.aggregate({
        where: { status: 'received' },
        _sum: { total: true },
        _count: true
      })
    ]);

    // Get credit statistics
    const [activeCredits, overdueCredits, totalCredits] = await Promise.all([
      prisma.credit.aggregate({
        where: { status: 'active' },
        _sum: { balance: true },
        _count: true
      }),
      prisma.credit.aggregate({
        where: { status: 'overdue' },
        _sum: { balance: true },
        _count: true
      }),
      prisma.credit.aggregate({
        _sum: { amount: true },
        _count: true
      })
    ]);

    // Get low stock products
    const lowStockProducts = await prisma.product.findMany({
      where: {
        stock: { lte: 10 }
      },
      select: {
        id: true,
        name: true,
        code: true,
        stock: true,
        minStock: true
      },
      orderBy: { stock: 'asc' },
      take: 10
    });

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

    const dashboard = {
      counts: {
        products: totalProducts,
        customers: totalCustomers,
        suppliers: totalSuppliers,
        users: totalUsers
      },
      sales: {
        monthly: {
          total: monthlySales._sum.total || 0,
          count: monthlySales._count || 0
        },
        yearly: {
          total: yearlySales._sum.total || 0,
          count: yearlySales._count || 0
        },
        allTime: {
          total: totalSales._sum.total || 0,
          count: totalSales._count || 0
        }
      },
      purchases: {
        monthly: {
          total: monthlyPurchases._sum.total || 0,
          count: monthlyPurchases._count || 0
        },
        yearly: {
          total: yearlyPurchases._sum.total || 0,
          count: yearlyPurchases._count || 0
        },
        allTime: {
          total: totalPurchases._sum.total || 0,
          count: totalPurchases._count || 0
        }
      },
      credits: {
        active: {
          total: activeCredits._sum.balance || 0,
          count: activeCredits._count || 0
        },
        overdue: {
          total: overdueCredits._sum.balance || 0,
          count: overdueCredits._count || 0
        },
        allTime: {
          total: totalCredits._sum.amount || 0,
          count: totalCredits._count || 0
        }
      },
      alerts: {
        lowStockProducts,
        recentSales,
        recentPurchases
      }
    };

    res.json(dashboard);
  } catch (error) {
    logger.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/reports/sales:
 *   get:
 *     summary: Get sales report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *         description: Customer ID filter
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *         description: Payment method filter
 *     responses:
 *       200:
 *         description: Sales report
 */
router.get('/sales', 
  authenticateToken, 
  requirePermission('reports:read'),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('customerId').optional().isUUID(),
    query('paymentMethod').optional().isIn(['cash', 'card', 'transfer', 'credit'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { startDate, endDate, customerId, paymentMethod } = req.query;

      const where = { status: 'completed' };

      if (startDate && endDate) {
        where.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      if (customerId) {
        where.customerId = customerId;
      }

      if (paymentMethod) {
        where.paymentMethod = paymentMethod;
      }

      const sales = await prisma.sale.findMany({
        where,
        include: {
          customer: {
            select: { name: true, email: true }
          },
          items: {
            include: {
              product: {
                select: { name: true, code: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Calculate totals
      const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
      const totalTax = sales.reduce((sum, sale) => sum + sale.tax, 0);
      const totalSubtotal = sales.reduce((sum, sale) => sum + sale.subtotal, 0);

      // Group by payment method
      const paymentMethodBreakdown = sales.reduce((acc, sale) => {
        acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.total;
        return acc;
      }, {});

      // Group by customer
      const customerBreakdown = sales.reduce((acc, sale) => {
        const customerName = sale.customer.name;
        if (!acc[customerName]) {
          acc[customerName] = { total: 0, count: 0, sales: [] };
        }
        acc[customerName].total += sale.total;
        acc[customerName].count += 1;
        acc[customerName].sales.push(sale);
        return acc;
      }, {});

      const report = {
        summary: {
          totalSales,
          totalTax,
          totalSubtotal,
          count: sales.length,
          averageSale: sales.length > 0 ? totalSales / sales.length : 0
        },
        paymentMethodBreakdown,
        customerBreakdown,
        sales
      };

      res.json(report);
    } catch (error) {
      logger.error('Error generating sales report:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/reports/inventory:
 *   get:
 *     summary: Get inventory report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inventory report
 */
router.get('/inventory', authenticateToken, requirePermission('reports:read'), async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: {
          select: { name: true }
        },
        supplier: {
          select: { name: true }
        }
      },
      orderBy: { stock: 'asc' }
    });

    // Calculate inventory value
    const totalValue = products.reduce((sum, product) => sum + (product.stock * product.cost), 0);
    const lowStockProducts = products.filter(p => p.stock <= p.minStock);
    const outOfStockProducts = products.filter(p => p.stock === 0);

    // Group by category
    const categoryBreakdown = products.reduce((acc, product) => {
      const categoryName = product.category?.name || 'Sin categoría';
      if (!acc[categoryName]) {
        acc[categoryName] = { count: 0, totalValue: 0, products: [] };
      }
      acc[categoryName].count += 1;
      acc[categoryName].totalValue += product.stock * product.cost;
      acc[categoryName].products.push(product);
      return acc;
    }, {});

    // Group by supplier
    const supplierBreakdown = products.reduce((acc, product) => {
      const supplierName = product.supplier?.name || 'Sin proveedor';
      if (!acc[supplierName]) {
        acc[supplierName] = { count: 0, totalValue: 0, products: [] };
      }
      acc[supplierName].count += 1;
      acc[supplierName].totalValue += product.stock * product.cost;
      acc[supplierName].products.push(product);
      return acc;
    }, {});

    const report = {
      summary: {
        totalProducts: products.length,
        totalValue,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length
      },
      categoryBreakdown,
      supplierBreakdown,
      lowStockProducts,
      outOfStockProducts,
      products
    };

    res.json(report);
  } catch (error) {
    logger.error('Error generating inventory report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/reports/credits:
 *   get:
 *     summary: Get credits report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, overdue, defaulted, paid]
 *         description: Credit status filter
 *     responses:
 *       200:
 *         description: Credits report
 */
router.get('/credits', 
  authenticateToken, 
  requirePermission('reports:read'),
  [
    query('status').optional().isIn(['active', 'overdue', 'defaulted', 'paid'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { status } = req.query;

      const where = {};
      if (status) {
        where.status = status;
      }

      const credits = await prisma.credit.findMany({
        where,
        include: {
          customer: {
            select: { name: true, email: true, phone: true }
          },
          sale: {
            select: { invoiceNumber: true, total: true }
          },
          payments: {
            select: { amount: true, paymentDate: true }
          }
        },
        orderBy: { dueDate: 'asc' }
      });

      // Calculate statistics
      const totalAmount = credits.reduce((sum, credit) => sum + credit.amount, 0);
      const totalBalance = credits.reduce((sum, credit) => sum + credit.balance, 0);
      const totalPaid = totalAmount - totalBalance;

      // Group by status
      const statusBreakdown = credits.reduce((acc, credit) => {
        acc[credit.status] = (acc[credit.status] || 0) + 1;
        return acc;
      }, {});

      // Group by customer
      const customerBreakdown = credits.reduce((acc, credit) => {
        const customerName = credit.customer.name;
        if (!acc[customerName]) {
          acc[customerName] = { totalAmount: 0, totalBalance: 0, credits: [] };
        }
        acc[customerName].totalAmount += credit.amount;
        acc[customerName].totalBalance += credit.balance;
        acc[customerName].credits.push(credit);
        return acc;
      }, {});

      // Overdue credits
      const overdueCredits = credits.filter(credit => {
        const isOverdue = new Date() > new Date(credit.dueDate) && credit.balance > 0;
        return isOverdue;
      });

      const report = {
        summary: {
          totalCredits: credits.length,
          totalAmount,
          totalBalance,
          totalPaid,
          overdueCount: overdueCredits.length
        },
        statusBreakdown,
        customerBreakdown,
        overdueCredits,
        credits
      };

      res.json(report);
    } catch (error) {
      logger.error('Error generating credits report:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/reports/purchases:
 *   get:
 *     summary: Get purchases report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date
 *       - in: query
 *         name: supplierId
 *         schema:
 *           type: string
 *         description: Supplier ID filter
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Purchase status filter
 *     responses:
 *       200:
 *         description: Purchases report
 */
router.get('/purchases', 
  authenticateToken, 
  requirePermission('reports:read'),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('supplierId').optional().isUUID(),
    query('status').optional().isIn(['pending', 'partially_received', 'received', 'cancelled'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { startDate, endDate, supplierId, status } = req.query;

      const where = {};

      if (startDate && endDate) {
        where.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      if (supplierId) {
        where.supplierId = supplierId;
      }

      if (status) {
        where.status = status;
      }

      const purchases = await prisma.purchase.findMany({
        where,
        include: {
          supplier: {
            select: { name: true, email: true }
          },
          items: {
            include: {
              product: {
                select: { name: true, code: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Calculate totals
      const totalPurchases = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
      const totalTax = purchases.reduce((sum, purchase) => sum + purchase.tax, 0);
      const totalSubtotal = purchases.reduce((sum, purchase) => sum + purchase.subtotal, 0);

      // Group by status
      const statusBreakdown = purchases.reduce((acc, purchase) => {
        acc[purchase.status] = (acc[purchase.status] || 0) + purchase.total;
        return acc;
      }, {});

      // Group by supplier
      const supplierBreakdown = purchases.reduce((acc, purchase) => {
        const supplierName = purchase.supplier.name;
        if (!acc[supplierName]) {
          acc[supplierName] = { total: 0, count: 0, purchases: [] };
        }
        acc[supplierName].total += purchase.total;
        acc[supplierName].count += 1;
        acc[supplierName].purchases.push(purchase);
        return acc;
      }, {});

      const report = {
        summary: {
          totalPurchases,
          totalTax,
          totalSubtotal,
          count: purchases.length,
          averagePurchase: purchases.length > 0 ? totalPurchases / purchases.length : 0
        },
        statusBreakdown,
        supplierBreakdown,
        purchases
      };

      res.json(report);
    } catch (error) {
      logger.error('Error generating purchases report:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router; 