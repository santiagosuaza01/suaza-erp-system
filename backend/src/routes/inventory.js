const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/inventory/movements:
 *   get:
 *     summary: Get inventory movements
 *     tags: [Inventory]
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
 *         name: productId
 *         schema:
 *           type: string
 *         description: Product ID filter
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Movement type filter
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
 *         description: List of inventory movements
 */
router.get('/movements', authenticateToken, requirePermission('inventory:read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, productId = '', type = '', startDate = '', endDate = '' } = req.query;
    const skip = (page - 1) * limit;

    const where = {};

    if (productId) {
      where.productId = productId;
    }

    if (type) {
      where.type = type;
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        include: {
          product: {
            select: {
              id: true,
              name: true,
              code: true
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
        orderBy: { createdAt: 'desc' }
      }),
      prisma.inventoryMovement.count({ where })
    ]);

    res.json({
      movements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching inventory movements:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/inventory/adjustment:
 *   post:
 *     summary: Create inventory adjustment
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *               - type
 *               - reason
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *               type:
 *                 type: string
 *                 enum: [ADJUSTMENT, DAMAGED, EXPIRED, LOST, FOUND]
 *               reason:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Inventory adjustment created successfully
 */
router.post('/adjustment', 
  authenticateToken, 
  requirePermission('inventory:update'),
  [
    body('productId').isUUID(),
    body('quantity').isInt(),
    body('type').isIn(['ADJUSTMENT', 'DAMAGED', 'EXPIRED', 'LOST', 'FOUND']),
    body('reason').isLength({ min: 3 }).trim().escape(),
    body('notes').optional().trim().escape()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId, quantity, type, reason, notes } = req.body;

      // Check if product exists
      const product = await prisma.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
        return res.status(400).json({ error: 'Product not found' });
      }

      // Calculate new stock
      let newStock = product.stock;
      if (type === 'ADJUSTMENT' || type === 'FOUND') {
        newStock += quantity;
      } else if (type === 'DAMAGED' || type === 'EXPIRED' || type === 'LOST') {
        newStock -= Math.abs(quantity);
        if (newStock < 0) {
          return res.status(400).json({ 
            error: 'Adjustment would result in negative stock' 
          });
        }
      }

      // Create inventory movement and update product stock
      const result = await prisma.$transaction(async (prisma) => {
        // Create inventory movement
        const movement = await prisma.inventoryMovement.create({
          data: {
            productId,
            type,
            quantity: type === 'ADJUSTMENT' || type === 'FOUND' ? quantity : -Math.abs(quantity),
            reference: reason,
            notes,
            userId: req.user.id
          }
        });

        // Update product stock
        await prisma.product.update({
          where: { id: productId },
          data: { stock: newStock }
        });

        return movement;
      });

      logger.info(`Inventory adjustment created: ${type} for product ${product.name}, quantity: ${quantity}`);
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating inventory adjustment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/inventory/transfer:
 *   post:
 *     summary: Create inventory transfer
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromProductId
 *               - toProductId
 *               - quantity
 *               - reason
 *             properties:
 *               fromProductId:
 *                 type: string
 *               toProductId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *               reason:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Inventory transfer created successfully
 */
router.post('/transfer', 
  authenticateToken, 
  requirePermission('inventory:update'),
  [
    body('fromProductId').isUUID(),
    body('toProductId').isUUID(),
    body('quantity').isInt({ min: 1 }),
    body('reason').isLength({ min: 3 }).trim().escape(),
    body('notes').optional().trim().escape()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fromProductId, toProductId, quantity, reason, notes } = req.body;

      if (fromProductId === toProductId) {
        return res.status(400).json({ error: 'Cannot transfer to the same product' });
      }

      // Check if products exist
      const [fromProduct, toProduct] = await Promise.all([
        prisma.product.findUnique({ where: { id: fromProductId } }),
        prisma.product.findUnique({ where: { id: toProductId } })
      ]);

      if (!fromProduct || !toProduct) {
        return res.status(400).json({ error: 'One or both products not found' });
      }

      // Check if source product has sufficient stock
      if (fromProduct.stock < quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock in source product. Available: ${fromProduct.stock}` 
        });
      }

      // Create inventory movements and update product stocks
      const result = await prisma.$transaction(async (prisma) => {
        // Create outbound movement
        const outboundMovement = await prisma.inventoryMovement.create({
          data: {
            productId: fromProductId,
            type: 'TRANSFER_OUT',
            quantity: -quantity,
            reference: `Transfer to ${toProduct.name}`,
            notes: `${reason} - ${notes || ''}`,
            userId: req.user.id
          }
        });

        // Create inbound movement
        const inboundMovement = await prisma.inventoryMovement.create({
          data: {
            productId: toProductId,
            type: 'TRANSFER_IN',
            quantity: quantity,
            reference: `Transfer from ${fromProduct.name}`,
            notes: `${reason} - ${notes || ''}`,
            userId: req.user.id
          }
        });

        // Update source product stock
        await prisma.product.update({
          where: { id: fromProductId },
          data: { stock: { decrement: quantity } }
        });

        // Update destination product stock
        await prisma.product.update({
          where: { id: toProductId },
          data: { stock: { increment: quantity } }
        });

        return {
          outboundMovement,
          inboundMovement
        };
      });

      logger.info(`Inventory transfer created: ${quantity} units from ${fromProduct.name} to ${toProduct.name}`);
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating inventory transfer:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/inventory/stocktake:
 *   post:
 *     summary: Create stocktake adjustment
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - adjustments
 *             properties:
 *               adjustments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     actualStock:
 *                       type: integer
 *                     notes:
 *                       type: string
 *     responses:
 *       201:
 *         description: Stocktake adjustment created successfully
 */
router.post('/stocktake', 
  authenticateToken, 
  requirePermission('inventory:update'),
  [
    body('adjustments').isArray({ min: 1 }),
    body('adjustments.*.productId').isUUID(),
    body('adjustments.*.actualStock').isInt({ min: 0 }),
    body('adjustments.*.notes').optional().trim().escape()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { adjustments } = req.body;

      // Validate all products exist
      const productIds = adjustments.map(adj => adj.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } }
      });

      if (products.length !== productIds.length) {
        return res.status(400).json({ error: 'One or more products not found' });
      }

      // Create stocktake adjustments
      const result = await prisma.$transaction(async (prisma) => {
        const movements = [];

        for (const adjustment of adjustments) {
          const product = products.find(p => p.id === adjustment.productId);
          const difference = adjustment.actualStock - product.stock;

          if (difference !== 0) {
            // Create inventory movement
            const movement = await prisma.inventoryMovement.create({
              data: {
                productId: adjustment.productId,
                type: 'STOCKTAKE',
                quantity: difference,
                reference: 'Stocktake adjustment',
                notes: adjustment.notes || `Adjusted from ${product.stock} to ${adjustment.actualStock}`,
                userId: req.user.id
              }
            });

            movements.push(movement);

            // Update product stock
            await prisma.product.update({
              where: { id: adjustment.productId },
              data: { stock: adjustment.actualStock }
            });
          }
        }

        return movements;
      });

      logger.info(`Stocktake adjustment created for ${result.length} products`);
      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating stocktake adjustment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/inventory/low-stock:
 *   get:
 *     summary: Get low stock products
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of low stock products
 */
router.get('/low-stock', authenticateToken, requirePermission('inventory:read'), async (req, res) => {
  try {
    const lowStockProducts = await prisma.product.findMany({
      where: {
        stock: { lte: 10 }
      },
      include: {
        category: {
          select: { name: true }
        },
        supplier: {
          select: { name: true, email: true, phone: true }
        }
      },
      orderBy: { stock: 'asc' }
    });

    res.json(lowStockProducts);
  } catch (error) {
    logger.error('Error fetching low stock products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/inventory/out-of-stock:
 *   get:
 *     summary: Get out of stock products
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of out of stock products
 */
router.get('/out-of-stock', authenticateToken, requirePermission('inventory:read'), async (req, res) => {
  try {
    const outOfStockProducts = await prisma.product.findMany({
      where: {
        stock: 0
      },
      include: {
        category: {
          select: { name: true }
        },
        supplier: {
          select: { name: true, email: true, phone: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(outOfStockProducts);
  } catch (error) {
    logger.error('Error fetching out of stock products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/inventory/value:
 *   get:
 *     summary: Get inventory value report
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inventory value report
 */
router.get('/value', authenticateToken, requirePermission('inventory:read'), async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: {
          select: { name: true }
        },
        supplier: {
          select: { name: true }
        }
      }
    });

    // Calculate inventory value
    const totalValue = products.reduce((sum, product) => sum + (product.stock * product.cost), 0);
    const totalCost = products.reduce((sum, product) => sum + (product.stock * product.cost), 0);
    const totalRetailValue = products.reduce((sum, product) => sum + (product.stock * product.price), 0);

    // Group by category
    const categoryBreakdown = products.reduce((acc, product) => {
      const categoryName = product.category?.name || 'Sin categoría';
      if (!acc[categoryName]) {
        acc[categoryName] = { count: 0, totalValue: 0, totalCost: 0, totalRetailValue: 0, products: [] };
      }
      acc[categoryName].count += 1;
      acc[categoryName].totalValue += product.stock * product.cost;
      acc[categoryName].totalCost += product.stock * product.cost;
      acc[categoryName].totalRetailValue += product.stock * product.price;
      acc[categoryName].products.push(product);
      return acc;
    }, {});

    // Group by supplier
    const supplierBreakdown = products.reduce((acc, product) => {
      const supplierName = product.supplier?.name || 'Sin proveedor';
      if (!acc[supplierName]) {
        acc[supplierName] = { count: 0, totalValue: 0, totalCost: 0, totalRetailValue: 0, products: [] };
      }
      acc[supplierName].count += 1;
      acc[supplierName].totalValue += product.stock * product.cost;
      acc[supplierName].totalCost += product.stock * product.cost;
      acc[supplierName].totalRetailValue += product.stock * product.price;
      acc[supplierName].products.push(product);
      return acc;
    }, {});

    const report = {
      summary: {
        totalProducts: products.length,
        totalValue,
        totalCost,
        totalRetailValue,
        averageValue: products.length > 0 ? totalValue / products.length : 0
      },
      categoryBreakdown,
      supplierBreakdown,
      products
    };

    res.json(report);
  } catch (error) {
    logger.error('Error generating inventory value report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 