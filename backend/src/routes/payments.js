const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get all payments
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: creditId
 *         schema:
 *           type: string
 *         description: Credit ID filter
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *         description: Payment method filter
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *     responses:
 *       200:
 *         description: List of payments
 */
router.get('/', 
  authenticateToken, 
  requirePermission('payments:read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('creditId').optional().isUUID(),
    query('paymentMethod').optional().isIn(['cash', 'card', 'transfer', 'check']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        page = 1, 
        limit = 20, 
        creditId = '', 
        paymentMethod = '', 
        startDate = '', 
        endDate = '' 
      } = req.query;

      const skip = (page - 1) * limit;

      const where = {};

      if (creditId) {
        where.creditId = creditId;
      }

      if (paymentMethod) {
        where.paymentMethod = paymentMethod;
      }

      if (startDate && endDate) {
        where.paymentDate = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          include: {
            credit: {
              include: {
                customer: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            },
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { paymentDate: 'desc' }
        }),
        prisma.payment.count({ where })
      ]);

      res.json({
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching payments:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Get payment by ID
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment details
 */
router.get('/:id', authenticateToken, requirePermission('payments:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        credit: {
          include: {
            customer: true,
            sale: {
              select: {
                id: true,
                invoiceNumber: true,
                total: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(payment);
  } catch (error) {
    logger.error('Error fetching payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create new payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - creditId
 *               - amount
 *               - paymentMethod
 *             properties:
 *               creditId:
 *                 type: string
 *               amount:
 *                 type: number
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, card, transfer, check]
 *               paymentDate:
 *                 type: string
 *                 format: date
 *               reference:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment created successfully
 */
router.post('/', 
  authenticateToken, 
  requirePermission('payments:create'),
  [
    body('creditId').isUUID(),
    body('amount').isFloat({ min: 0.01 }),
    body('paymentMethod').isIn(['cash', 'card', 'transfer', 'check']),
    body('paymentDate').optional().isISO8601(),
    body('reference').optional().trim().escape(),
    body('notes').optional().trim().escape()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { creditId, amount, paymentMethod, paymentDate, reference, notes } = req.body;

      // Check if credit exists
      const credit = await prisma.credit.findUnique({
        where: { id: creditId },
        include: {
          customer: true,
          payments: true
        }
      });

      if (!credit) {
        return res.status(400).json({ error: 'Credit not found' });
      }

      if (credit.status === 'paid') {
        return res.status(400).json({ error: 'Credit is already paid' });
      }

      // Calculate current balance
      const totalPaid = credit.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const currentBalance = credit.amount - totalPaid;

      if (amount > currentBalance) {
        return res.status(400).json({ 
          error: `Payment amount exceeds remaining balance. Remaining: ${currentBalance}` 
        });
      }

      // Create payment
      const payment = await prisma.payment.create({
        data: {
          creditId,
          amount,
          paymentMethod,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          reference,
          notes,
          userId: req.user.id
        }
      });

      // Update credit balance and status
      const newTotalPaid = totalPaid + amount;
      const newBalance = credit.amount - newTotalPaid;
      
      let newStatus = credit.status;
      if (newBalance <= 0) {
        newStatus = 'paid';
      } else if (new Date() > new Date(credit.dueDate)) {
        newStatus = 'overdue';
      }

      await prisma.credit.update({
        where: { id: creditId },
        data: {
          balance: newBalance,
          status: newStatus
        }
      });

      logger.info(`Payment created: ${amount} for credit ${creditId} by ${req.user.username}`);
      res.status(201).json(payment);
    } catch (error) {
      logger.error('Error creating payment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/payments/{id}:
 *   put:
 *     summary: Update payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               paymentMethod:
 *                 type: string
 *               paymentDate:
 *                 type: string
 *                 format: date
 *               reference:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment updated successfully
 */
router.put('/:id', 
  authenticateToken, 
  requirePermission('payments:update'),
  [
    body('amount').optional().isFloat({ min: 0.01 }),
    body('paymentMethod').optional().isIn(['cash', 'card', 'transfer', 'check']),
    body('paymentDate').optional().isISO8601(),
    body('reference').optional().trim().escape(),
    body('notes').optional().trim().escape()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updateData = req.body;

      // Remove undefined fields
      Object.keys(updateData).forEach(key => 
        updateData[key] === undefined && delete updateData[key]
      );

      // Convert paymentDate to Date object if provided
      if (updateData.paymentDate) {
        updateData.paymentDate = new Date(updateData.paymentDate);
      }

      const payment = await prisma.payment.update({
        where: { id },
        data: updateData,
        include: {
          credit: {
            include: {
              customer: true
            }
          }
        }
      });

      logger.info(`Payment ${id} updated by ${req.user.username}`);
      res.json(payment);
    } catch (error) {
      logger.error('Error updating payment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/payments/{id}:
 *   delete:
 *     summary: Delete payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment deleted successfully
 */
router.delete('/:id', authenticateToken, requirePermission('payments:delete'), async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await prisma.credit.findUnique({
      where: { id },
      include: {
        credit: true
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Delete payment and update credit balance
    await prisma.$transaction(async (prisma) => {
      // Delete payment
      await prisma.payment.delete({
        where: { id }
      });

      // Recalculate credit balance
      const credit = await prisma.credit.findUnique({
        where: { id: payment.creditId },
        include: {
          payments: true
        }
      });

      if (credit) {
        const totalPaid = credit.payments.reduce((sum, p) => sum + p.amount, 0);
        const newBalance = credit.amount - totalPaid;
        
        let newStatus = credit.status;
        if (newBalance <= 0) {
          newStatus = 'paid';
        } else if (new Date() > new Date(credit.dueDate)) {
          newStatus = 'overdue';
        } else {
          newStatus = 'active';
        }

        await prisma.credit.update({
          where: { id: payment.creditId },
          data: {
            balance: newBalance,
            status: newStatus
          }
        });
      }
    });

    logger.info(`Payment ${id} deleted by ${req.user.username}`);
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    logger.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/payments/summary:
 *   get:
 *     summary: Get payment summary statistics
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment summary statistics
 */
router.get('/summary', authenticateToken, requirePermission('payments:read'), async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Get payment statistics
    const [totalPayments, monthlyPayments, yearlyPayments] = await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true
      }),
      prisma.payment.aggregate({
        where: {
          paymentDate: { gte: startOfMonth }
        },
        _sum: { amount: true },
        _count: true
      }),
      prisma.payment.aggregate({
        where: {
          paymentDate: { gte: startOfYear }
        },
        _sum: { amount: true },
        _count: true
      })
    ]);

    // Get payment method breakdown
    const paymentMethodBreakdown = await prisma.payment.groupBy({
      by: ['paymentMethod'],
      _sum: { amount: true },
      _count: true
    });

    // Get recent payments
    const recentPayments = await prisma.payment.findMany({
      include: {
        credit: {
          include: {
            customer: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { paymentDate: 'desc' },
      take: 5
    });

    const summary = {
      totals: {
        allTime: {
          amount: totalPayments._sum.amount || 0,
          count: totalPayments._count || 0
        },
        monthly: {
          amount: monthlyPayments._sum.amount || 0,
          count: monthlyPayments._count || 0
        },
        yearly: {
          amount: yearlyPayments._sum.amount || 0,
          count: yearlyPayments._count || 0
        }
      },
      paymentMethods: paymentMethodBreakdown.map(item => ({
        method: item.paymentMethod,
        amount: item._sum.amount || 0,
        count: item._count || 0
      })),
      recentPayments
    };

    res.json(summary);
  } catch (error) {
    logger.error('Error generating payment summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/payments/export:
 *   get:
 *     summary: Export payments
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *         description: Export format
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *     responses:
 *       200:
 *         description: Exported payments
 */
router.get('/export', 
  authenticateToken, 
  requirePermission('payments:export'),
  [
    query('format').isIn(['csv', 'json']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { format, startDate, endDate } = req.query;

      const where = {};

      if (startDate && endDate) {
        where.paymentDate = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      const payments = await prisma.payment.findMany({
        where,
        include: {
          credit: {
            include: {
              customer: {
                select: { name: true, email: true }
              }
            }
          },
          user: {
            select: { username: true }
          }
        },
        orderBy: { paymentDate: 'desc' }
      });

      if (format === 'csv') {
        // Generate CSV
        const csvHeader = 'ID,Amount,Payment Method,Payment Date,Reference,Notes,Customer,Credit ID,User,Created At\n';
        const csvRows = payments.map(payment => {
          const customer = payment.credit?.customer?.name || 'Unknown';
          const user = payment.user?.username || 'Unknown';
          return `${payment.id},${payment.amount},${payment.paymentMethod},${payment.paymentDate},${payment.reference || ''},"${payment.notes || ''}",${customer},${payment.creditId},${user},${payment.createdAt}`;
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="payments-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvHeader + csvRows);
      } else {
        // Return JSON
        res.json(payments);
      }
    } catch (error) {
      logger.error('Error exporting payments:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router; 