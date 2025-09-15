const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth-simple');
const { body, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/sales:
 *   get:
 *     summary: Get all sales
 *     tags: [Sales]
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *         description: Sale status
 *     responses:
 *       200:
 *         description: List of sales
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = '' } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (status) {
      where.status = status;
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  price: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.sale.count({ where })
    ]);

    res.json({
      sales,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/sales/{id}:
 *   get:
 *     summary: Get sale by ID
 *     tags: [Sales]
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
 *         description: Sale details
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json(sale);
  } catch (error) {
    logger.error('Error fetching sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/sales:
 *   post:
 *     summary: Create new sale
 *     tags: [Sales]
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
 *               - items
 *               - paymentMethod
 *             properties:
 *               customerId:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                     unitPrice:
 *                       type: number
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, card, transfer, credit]
 *               notes:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Sale created successfully
 */
router.post('/', 
  authenticateToken, 
  [
    body('customerId').optional(),
    body('customerName').optional().trim().escape(),
    body('items').isArray({ min: 1 }).withMessage('Items must be an array with at least 1 item'),
    body('items.*.productId').notEmpty().withMessage('Product ID is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
    body('paymentMethod').isIn(['cash', 'card', 'transfer', 'credit']).withMessage('Invalid payment method'),
    body('notes').optional().trim().escape()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { customerId, customerName, items, paymentMethod, notes } = req.body;

      // Check if customer exists (only if customerId is provided)
      let customer = null;
      if (customerId) {
        customer = await prisma.customer.findUnique({
          where: { id: customerId }
        });

        if (!customer) {
          return res.status(400).json({ error: 'Customer not found' });
        }
      }

      // Check if products exist and have sufficient stock
      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) {
          return res.status(400).json({ error: `Product ${item.productId} not found` });
        }

        if (product.stock < item.quantity) {
          return res.status(400).json({ 
            error: `Insufficient stock for product ${product.name}. Available: ${product.stock}` 
          });
        }
      }

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const tax = subtotal * 0.19; // 19% IVA Colombia
      const total = subtotal + tax;

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Create sale transaction
      const result = await prisma.$transaction(async (prisma) => {
        // Create sale
        const sale = await prisma.sale.create({
          data: {
            invoiceNumber,
            customerId: customerId || null,
            customerName: customerName || 'Cliente General',
            subtotal,
            taxAmount: tax,
            totalAmount: total,
            paymentMethod,
            status: paymentMethod === 'credit' ? 'PENDING' : 'PAID',
            notes,
            userId: req.user.id
          }
        });

        // Create sale items and update inventory
        for (const item of items) {
          await prisma.saleItem.create({
            data: {
              saleId: sale.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice
            }
          });

          // Get current stock before update
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: { stock: true }
          });
          const previousStock = product.stock;
          const newStock = previousStock - item.quantity;

          // Update product stock
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                decrement: item.quantity
              }
            }
          });

          // Create inventory movement
          await prisma.inventoryMovement.create({
            data: {
              productId: item.productId,
              type: 'SALE',
              quantity: -item.quantity,
              previousStock: previousStock,
              newStock: newStock,
              reference: `Sale ${invoiceNumber}`,
              userId: req.user.id
            }
          });
        }

        // If credit sale, create credit record (only if customer exists)
        if (paymentMethod === 'credit' && customerId) {
          await prisma.credit.create({
            data: {
              customerId,
              amount: total,
              interestRate: 0,
              term: 30,
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
              status: 'ACTIVE',
              notes: `Crédito por venta ${invoiceNumber}`
            }
          });
        }

        return sale;
      });

      logger.info(`Sale created: ${invoiceNumber} for customer ${customer?.name || customerName || 'Cliente General'}`);
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating sale:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/sales/{id}/status:
 *   put:
 *     summary: Update sale status
 *     tags: [Sales]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, completed, cancelled]
 *     responses:
 *       200:
 *         description: Sale status updated successfully
 */
router.put('/:id/status', 
  authenticateToken, 
  [
    body('status').isIn(['pending', 'completed', 'cancelled'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { status } = req.body;

      const sale = await prisma.sale.findUnique({
        where: { id },
        include: {
          items: true,
          customer: true
        }
      });

      if (!sale) {
        return res.status(404).json({ error: 'Sale not found' });
      }

      // If cancelling, restore inventory
      if (status === 'cancelled' && sale.status !== 'cancelled') {
        await prisma.$transaction(async (prisma) => {
          for (const item of sale.items) {
            // Restore product stock
            await prisma.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  increment: item.quantity
                }
              }
            });

            // Create inventory movement
            await prisma.inventoryMovement.create({
              data: {
                productId: item.productId,
                type: 'SALE_CANCELLATION',
                quantity: item.quantity,
                reference: `Sale ${sale.invoiceNumber} cancelled`,
                userId: req.user.id
              }
            });
          }
        });
      }

      const updatedSale = await prisma.sale.update({
        where: { id },
        data: { status },
        include: {
          customer: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      logger.info(`Sale ${sale.invoiceNumber} status updated to ${status}`);
      res.json(updatedSale);
    } catch (error) {
      logger.error('Error updating sale status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/sales/{id}:
 *   delete:
 *     summary: Delete sale
 *     tags: [Sales]
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
 *         description: Sale deleted successfully
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true
      }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    if (sale.status === 'completed') {
      return res.status(400).json({ 
        error: 'Cannot delete completed sale' 
      });
    }

    // Delete sale and restore inventory
    await prisma.$transaction(async (prisma) => {
      for (const item of sale.items) {
        // Restore product stock
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity
            }
          }
        });
      }

      // Delete sale items
      await prisma.saleItem.deleteMany({
        where: { saleId: id }
      });

      // Delete sale
      await prisma.sale.delete({
        where: { id }
      });
    });

    logger.info(`Sale ${sale.invoiceNumber} deleted`);
    res.json({ message: 'Sale deleted successfully' });
  } catch (error) {
    logger.error('Error deleting sale:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 