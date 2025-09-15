const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/purchases:
 *   get:
 *     summary: Get all purchases
 *     tags: [Purchases]
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
 *           enum: [pending, received, cancelled]
 *         description: Purchase status
 *     responses:
 *       200:
 *         description: List of purchases
 */
router.get('/', authenticateToken, requirePermission('purchases:read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = '' } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { supplier: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (status) {
      where.status = status;
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        include: {
          supplier: {
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
                  cost: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.purchase.count({ where })
    ]);

    res.json({
      purchases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/purchases/{id}:
 *   get:
 *     summary: Get purchase by ID
 *     tags: [Purchases]
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
 *         description: Purchase details
 */
router.get('/:id', authenticateToken, requirePermission('purchases:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    res.json(purchase);
  } catch (error) {
    logger.error('Error fetching purchase:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/purchases:
 *   post:
 *     summary: Create new purchase
 *     tags: [Purchases]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supplierId
 *               - items
 *               - expectedDeliveryDate
 *             properties:
 *               supplierId:
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
 *                     unitCost:
 *                       type: number
 *               expectedDeliveryDate:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *               paymentTerms:
 *                 type: string
 *     responses:
 *       201:
 *         description: Purchase created successfully
 */
router.post('/', 
  authenticateToken, 
  requirePermission('purchases:create'),
  [
    body('supplierId').isUUID(),
    body('items').isArray({ min: 1 }),
    body('items.*.productId').isUUID(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('items.*.unitCost').isFloat({ min: 0 }),
    body('expectedDeliveryDate').isISO8601(),
    body('notes').optional().trim().escape(),
    body('paymentTerms').optional().trim().escape()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { supplierId, items, expectedDeliveryDate, notes, paymentTerms } = req.body;

      // Check if supplier exists
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId }
      });

      if (!supplier) {
        return res.status(400).json({ error: 'Supplier not found' });
      }

      // Check if products exist
      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) {
          return res.status(400).json({ error: `Product ${item.productId} not found` });
        }
      }

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
      const tax = subtotal * 0.19; // 19% IVA Colombia
      const total = subtotal + tax;

      // Generate order number
      const orderNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Create purchase
      const purchase = await prisma.purchase.create({
        data: {
          orderNumber,
          supplierId,
          subtotal,
          tax,
          total,
          status: 'pending',
          expectedDeliveryDate: new Date(expectedDeliveryDate),
          notes,
          paymentTerms,
          userId: req.user.id
        }
      });

      // Create purchase items
      for (const item of items) {
        await prisma.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            total: item.quantity * item.unitCost
          }
        });
      }

      logger.info(`Purchase created: ${orderNumber} from supplier ${supplier.name}`);
      res.status(201).json(purchase);
    } catch (error) {
      logger.error('Error creating purchase:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/purchases/{id}/receive:
 *   post:
 *     summary: Receive purchase items
 *     tags: [Purchases]
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
 *               - receivedItems
 *             properties:
 *               receivedItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     receivedQuantity:
 *                       type: integer
 *                     receivedCost:
 *                       type: number
 *     responses:
 *       200:
 *         description: Purchase items received successfully
 */
router.post('/:id/receive', 
  authenticateToken, 
  requirePermission('purchases:update'),
  [
    body('receivedItems').isArray({ min: 1 }),
    body('receivedItems.*.itemId').isUUID(),
    body('receivedItems.*.receivedQuantity').isInt({ min: 1 }),
    body('receivedItems.*.receivedCost').isFloat({ min: 0 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { receivedItems } = req.body;

      const purchase = await prisma.purchase.findUnique({
        where: { id },
        include: {
          items: true,
          supplier: true
        }
      });

      if (!purchase) {
        return res.status(404).json({ error: 'Purchase not found' });
      }

      if (purchase.status === 'received') {
        return res.status(400).json({ error: 'Purchase already received' });
      }

      // Receive items and update inventory
      await prisma.$transaction(async (prisma) => {
        for (const receivedItem of receivedItems) {
          const purchaseItem = purchase.items.find(item => item.id === receivedItem.itemId);
          
          if (!purchaseItem) {
            throw new Error(`Purchase item ${receivedItem.itemId} not found`);
          }

          if (receivedItem.receivedQuantity > purchaseItem.quantity) {
            throw new Error(`Received quantity exceeds ordered quantity for item ${receivedItem.itemId}`);
          }

          // Update purchase item
          await prisma.purchaseItem.update({
            where: { id: receivedItem.itemId },
            data: {
              receivedQuantity: receivedItem.receivedQuantity,
              receivedCost: receivedItem.receivedCost,
              receivedAt: new Date()
            }
          });

          // Update product stock and cost
          await prisma.product.update({
            where: { id: purchaseItem.productId },
            data: {
              stock: {
                increment: receivedItem.receivedQuantity
              },
              cost: receivedItem.receivedCost
            }
          });

          // Create inventory movement
          await prisma.inventoryMovement.create({
            data: {
              productId: purchaseItem.productId,
              type: 'PURCHASE',
              quantity: receivedItem.receivedQuantity,
              reference: `Purchase ${purchase.orderNumber}`,
              userId: req.user.id
            }
          });
        }

        // Update purchase status
        const allItemsReceived = purchase.items.every(item => 
          receivedItems.some(ri => ri.itemId === item.id && ri.receivedQuantity === item.quantity)
        );

        await prisma.purchase.update({
          where: { id },
          data: {
            status: allItemsReceived ? 'received' : 'partially_received',
            receivedAt: new Date()
          }
        });
      });

      logger.info(`Purchase ${purchase.orderNumber} items received`);
      res.json({ message: 'Purchase items received successfully' });
    } catch (error) {
      logger.error('Error receiving purchase items:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/purchases/{id}/status:
 *   put:
 *     summary: Update purchase status
 *     tags: [Purchases]
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
 *                 enum: [pending, partially_received, received, cancelled]
 *     responses:
 *       200:
 *         description: Purchase status updated successfully
 */
router.put('/:id/status', 
  authenticateToken, 
  requirePermission('purchases:update'),
  [
    body('status').isIn(['pending', 'partially_received', 'received', 'cancelled'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { status } = req.body;

      const purchase = await prisma.purchase.findUnique({
        where: { id }
      });

      if (!purchase) {
        return res.status(404).json({ error: 'Purchase not found' });
      }

      const updatedPurchase = await prisma.purchase.update({
        where: { id },
        data: { status },
        include: {
          supplier: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      logger.info(`Purchase ${purchase.orderNumber} status updated to ${status}`);
      res.json(updatedPurchase);
    } catch (error) {
      logger.error('Error updating purchase status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/purchases/{id}:
 *   delete:
 *     summary: Delete purchase
 *     tags: [Purchases]
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
 *         description: Purchase deleted successfully
 */
router.delete('/:id', authenticateToken, requirePermission('purchases:delete'), async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        items: true
      }
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    if (purchase.status === 'received') {
      return res.status(400).json({ 
        error: 'Cannot delete received purchase' 
      });
    }

    // Delete purchase items
    await prisma.purchaseItem.deleteMany({
      where: { purchaseId: id }
    });

    // Delete purchase
    await prisma.purchase.delete({
      where: { id }
    });

    logger.info(`Purchase ${purchase.orderNumber} deleted`);
    res.json({ message: 'Purchase deleted successfully' });
  } catch (error) {
    logger.error('Error deleting purchase:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 