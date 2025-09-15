const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/credits:
 *   get:
 *     summary: Get all credits
 *     tags: [Credits]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, paid, overdue, defaulted]
 *         description: Credit status
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *         description: Customer ID filter
 *     responses:
 *       200:
 *         description: List of credits
 */
router.get('/', authenticateToken, requirePermission('credits:read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '', customerId = '' } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    
    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    const [credits, total] = await Promise.all([
      prisma.credit.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              documentNumber: true
            }
          },
          sale: {
            select: {
              id: true,
              invoiceNumber: true,
              total: true
            }
          },
          payments: {
            select: {
              id: true,
              amount: true,
              paymentDate: true
            }
          }
        },
        orderBy: { dueDate: 'asc' }
      }),
      prisma.credit.count({ where })
    ]);

    // Calculate current balance and status for each credit
    const creditsWithBalance = credits.map(credit => {
      const totalPaid = credit.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const currentBalance = credit.amount - totalPaid;
      const isOverdue = new Date() > new Date(credit.dueDate) && currentBalance > 0;
      
      let calculatedStatus = credit.status;
      if (currentBalance <= 0) {
        calculatedStatus = 'paid';
      } else if (isOverdue) {
        calculatedStatus = 'overdue';
      }

      return {
        ...credit,
        currentBalance,
        totalPaid,
        calculatedStatus,
        isOverdue
      };
    });

    res.json({
      credits: creditsWithBalance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching credits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/credits/{id}:
 *   get:
 *     summary: Get credit by ID
 *     tags: [Credits]
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
 *         description: Credit details
 */
router.get('/:id', authenticateToken, requirePermission('credits:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const credit = await prisma.credit.findUnique({
      where: { id },
      include: {
        customer: true,
        sale: {
          include: {
            items: {
              include: {
                product: true
              }
            }
          }
        },
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      }
    });

    if (!credit) {
      return res.status(404).json({ error: 'Credit not found' });
    }

    // Calculate current balance
    const totalPaid = credit.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const currentBalance = credit.amount - totalPaid;
    const isOverdue = new Date() > new Date(credit.dueDate) && currentBalance > 0;

    const creditWithBalance = {
      ...credit,
      currentBalance,
      totalPaid,
      isOverdue
    };

    res.json(creditWithBalance);
  } catch (error) {
    logger.error('Error fetching credit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/credits:
 *   post:
 *     summary: Create new credit
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - amount
 *               - dueDate
 *             properties:
 *               customerId:
 *                 type: string
 *               saleId:
 *                 type: string
 *               amount:
 *                 type: number
 *               dueDate:
 *                 type: string
 *                 format: date
 *               interestRate:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Credit created successfully
 */
router.post('/', 
  authenticateToken, 
  requirePermission('credits:create'),
  [
    body('customerId').isUUID(),
    body('saleId').optional().isUUID(),
    body('amount').isFloat({ min: 0 }),
    body('dueDate').isISO8601(),
    body('interestRate').optional().isFloat({ min: 0, max: 100 }),
    body('notes').optional().trim().escape()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { customerId, saleId, amount, dueDate, interestRate, notes } = req.body;

      // Check if customer exists
      const customer = await prisma.customer.findUnique({
        where: { id: customerId }
      });

      if (!customer) {
        return res.status(400).json({ error: 'Customer not found' });
      }

      // Check if sale exists (if provided)
      if (saleId) {
        const sale = await prisma.sale.findUnique({
          where: { id: saleId }
        });

        if (!sale) {
          return res.status(400).json({ error: 'Sale not found' });
        }
      }

      // Create credit
      const credit = await prisma.credit.create({
        data: {
          customerId,
          saleId,
          amount,
          balance: amount,
          dueDate: new Date(dueDate),
          interestRate: interestRate || 0,
          status: 'active',
          notes,
          userId: req.user.id
        },
        include: {
          customer: true,
          sale: true
        }
      });

      logger.info(`Credit created: ${amount} for customer ${customer.name}`);
      res.status(201).json(credit);
    } catch (error) {
      logger.error('Error creating credit:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/credits/{id}/payments:
 *   post:
 *     summary: Add payment to credit
 *     tags: [Credits]
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
 *             required:
 *               - amount
 *               - paymentMethod
 *             properties:
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
 *         description: Payment added successfully
 */
router.post('/:id/payments', 
  authenticateToken, 
  requirePermission('credits:update'),
  [
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

      const { id } = req.params;
      const { amount, paymentMethod, paymentDate, reference, notes } = req.body;

      const credit = await prisma.credit.findUnique({
        where: { id },
        include: {
          customer: true,
          payments: true
        }
      });

      if (!credit) {
        return res.status(404).json({ error: 'Credit not found' });
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
          creditId: id,
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
        where: { id },
        data: {
          balance: newBalance,
          status: newStatus
        }
      });

      logger.info(`Payment added to credit ${id}: ${amount} by ${req.user.username}`);
      res.status(201).json(payment);
    } catch (error) {
      logger.error('Error adding payment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/credits/{id}:
 *   put:
 *     summary: Update credit
 *     tags: [Credits]
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
 *               dueDate:
 *                 type: string
 *                 format: date
 *               interestRate:
 *                 type: number
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, overdue, defaulted, paid]
 *     responses:
 *       200:
 *         description: Credit updated successfully
 */
router.put('/:id', 
  authenticateToken, 
  requirePermission('credits:update'),
  [
    body('dueDate').optional().isISO8601(),
    body('interestRate').optional().isFloat({ min: 0, max: 100 }),
    body('notes').optional().trim().escape(),
    body('status').optional().isIn(['active', 'overdue', 'defaulted', 'paid'])
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

      // Convert dueDate to Date object if provided
      if (updateData.dueDate) {
        updateData.dueDate = new Date(updateData.dueDate);
      }

      const credit = await prisma.credit.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          sale: true
        }
      });

      logger.info(`Credit ${id} updated`);
      res.json(credit);
    } catch (error) {
      logger.error('Error updating credit:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/credits/{id}:
 *   delete:
 *     summary: Delete credit
 *     tags: [Credits]
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
 *         description: Credit deleted successfully
 */
router.delete('/:id', authenticateToken, requirePermission('credits:delete'), async (req, res) => {
  try {
    const { id } = req.params;

    const credit = await prisma.credit.findUnique({
      where: { id },
      include: {
        customer: true,
        payments: true
      }
    });

    if (!credit) {
      return res.status(404).json({ error: 'Credit not found' });
    }

    if (credit.payments.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete credit with associated payments' 
      });
    }

    // Delete credit
    await prisma.credit.delete({
      where: { id }
    });

    logger.info(`Credit ${id} deleted for customer ${credit.customer.name}`);
    res.json({ message: 'Credit deleted successfully' });
  } catch (error) {
    logger.error('Error deleting credit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 