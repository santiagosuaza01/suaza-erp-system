// ============================================================================
// DEPENDENCIES
// ============================================================================
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// ============================================================================
// CONFIGURATION
// ============================================================================
const router = express.Router();
const prisma = new PrismaClient();

// ============================================================================
// VALIDATION RULES
// ============================================================================
const productValidationRules = {
  create: [
    body('name').isLength({ min: 2 }).trim().escape().withMessage('Name must be at least 2 characters'),
    body('code').isLength({ min: 3 }).trim().escape().withMessage('Code must be at least 3 characters'),
    body('description').optional().trim().escape(),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    body('unit').optional().trim().escape(),
    body('categoryId').optional().isUUID().withMessage('Invalid category ID')
  ],
  update: [
    body('name').optional().isLength({ min: 2 }).trim().escape(),
    body('code').optional().isLength({ min: 3 }).trim().escape(),
    body('description').optional().trim().escape(),
    body('price').optional().isFloat({ min: 0 }),
    body('stock').optional().isInt({ min: 0 }),
    body('unit').optional().trim().escape(),
    body('categoryId').optional().isUUID()
  ]
};

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
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
 *     responses:
 *       200:
 *         description: List of products
 */
// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * Get all products with pagination and search
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build search conditions
    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    // Fetch products and total count in parallel
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          category: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
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
 *         description: Product details
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        supplier: true
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    logger.error('Error fetching product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create new product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *               - price
 *               - categoryId
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               cost:
 *                 type: number
 *               stock:
 *                 type: integer
 *               minStock:
 *                 type: integer
 *               categoryId:
 *                 type: string
 *               supplierId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Product created successfully
 */
router.post('/', 
  authenticateToken, 
  [
    body('name').isLength({ min: 2 }).trim().escape(),
    body('code').isLength({ min: 2 }).trim().escape(),
    body('price').isFloat({ min: 0 }),
    body('cost').optional().isFloat({ min: 0 }),
    body('stock').optional().isInt({ min: 0 }),
    body('minStock').optional().isInt({ min: 0 }),
    body('categoryId').isUUID(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, code, description, price, cost, stock, minStock, categoryId } = req.body;

      // Check if product code already exists
      const existingProduct = await prisma.product.findFirst({
        where: { code }
      });

      if (existingProduct) {
        return res.status(400).json({ error: 'Product code already exists' });
      }

      // Create product
      const product = await prisma.product.create({
        data: {
          name,
          code,
          description,
          price,
          cost: cost || 0,
          stock: stock || 0,
          minStock: minStock || 0,
          categoryId
        },
        include: {
          category: true,
        }
      });

      logger.info(`Product created: ${name} (${code})`);
      res.status(201).json(product);
    } catch (error) {
      logger.error('Error creating product:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update product
 *     tags: [Products]
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
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               cost:
 *                 type: number
 *               stock:
 *                 type: integer
 *               minStock:
 *                 type: integer
 *               categoryId:
 *                 type: string
 *               supplierId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product updated successfully
 */
router.put('/:id', 
  authenticateToken, 
  [
    body('name').optional().isLength({ min: 2 }).trim().escape(),
    body('code').optional().isLength({ min: 2 }).trim().escape(),
    body('price').optional().isFloat({ min: 0 }),
    body('cost').optional().isFloat({ min: 0 }),
    body('stock').optional().isInt({ min: 0 }),
    body('minStock').optional().isInt({ min: 0 }),
    body('categoryId').optional().isUUID(),
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

      // Check if code already exists (if updating code)
      if (updateData.code) {
        const existingProduct = await prisma.product.findFirst({
          where: {
            code: updateData.code,
            id: { not: id }
          }
        });

        if (existingProduct) {
          return res.status(400).json({ error: 'Product code already exists' });
        }
      }

      const product = await prisma.product.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
        }
      });

      logger.info(`Product updated: ${product.name} (${product.code})`);
      res.json(product);
    } catch (error) {
      logger.error('Error updating product:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete product
 *     tags: [Products]
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
 *         description: Product deleted successfully
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if product has associated sales or purchases
    const [salesCount, purchasesCount] = await Promise.all([
      prisma.saleItem.count({ where: { productId: id } }),
      prisma.purchaseItem.count({ where: { productId: id } })
    ]);

    if (salesCount > 0 || purchasesCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete product with associated sales or purchases' 
      });
    }

    // Delete product
    await prisma.product.delete({
      where: { id }
    });

    logger.info(`Product deleted: ${product.name} (${product.code})`);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    logger.error('Error deleting product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 