const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/suppliers:
 *   get:
 *     summary: Get all suppliers
 *     tags: [Suppliers]
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
 *         description: List of suppliers
 */
router.get('/', authenticateToken, requirePermission('suppliers:read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (page - 1) * limit;

    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { name: 'asc' }
      }),
      prisma.supplier.count({ where })
    ]);

    res.json({
      suppliers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/suppliers/{id}:
 *   get:
 *     summary: Get supplier by ID
 *     tags: [Suppliers]
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
 *         description: Supplier details
 */
router.get('/:id', authenticateToken, requirePermission('suppliers:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true, purchases: true }
        }
      }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(supplier);
  } catch (error) {
    logger.error('Error fetching supplier:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/suppliers:
 *   post:
 *     summary: Create new supplier
 *     tags: [Suppliers]
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
 *               - contactPerson
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *               contactPerson:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               country:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               taxId:
 *                 type: string
 *               paymentTerms:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Supplier created successfully
 */
router.post('/', 
  authenticateToken, 
  requirePermission('suppliers:create'),
  [
    body('name').isLength({ min: 2 }).trim().escape(),
    body('contactPerson').isLength({ min: 2 }).trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('phone').optional().trim().escape(),
    body('address').optional().trim().escape(),
    body('city').optional().trim().escape(),
    body('state').optional().trim().escape(),
    body('country').optional().trim().escape(),
    body('postalCode').optional().trim().escape(),
    body('taxId').optional().trim().escape(),
    body('paymentTerms').optional().trim().escape(),
    body('notes').optional().trim().escape()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { 
        name, 
        contactPerson, 
        email, 
        phone, 
        address, 
        city, 
        state, 
        country, 
        postalCode, 
        taxId, 
        paymentTerms, 
        notes 
      } = req.body;

      // Check if supplier email already exists
      const existingSupplier = await prisma.supplier.findFirst({
        where: { email }
      });

      if (existingSupplier) {
        return res.status(400).json({ error: 'Supplier email already exists' });
      }

      // Create supplier
      const supplier = await prisma.supplier.create({
        data: {
          name,
          contactPerson,
          email,
          phone,
          address,
          city,
          state,
          country,
          postalCode,
          taxId,
          paymentTerms,
          notes
        }
      });

      logger.info(`Supplier created: ${name}`);
      res.status(201).json(supplier);
    } catch (error) {
      logger.error('Error creating supplier:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   put:
 *     summary: Update supplier
 *     tags: [Suppliers]
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
 *               contactPerson:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               country:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               taxId:
 *                 type: string
 *               paymentTerms:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Supplier updated successfully
 */
router.put('/:id', 
  authenticateToken, 
  requirePermission('suppliers:update'),
  [
    body('name').optional().isLength({ min: 2 }).trim().escape(),
    body('contactPerson').optional().isLength({ min: 2 }).trim().escape(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim().escape(),
    body('address').optional().trim().escape(),
    body('city').optional().trim().escape(),
    body('state').optional().trim().escape(),
    body('country').optional().trim().escape(),
    body('postalCode').optional().trim().escape(),
    body('taxId').optional().trim().escape(),
    body('paymentTerms').optional().trim().escape(),
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

      // Check if email already exists (if updating email)
      if (updateData.email) {
        const existingSupplier = await prisma.supplier.findFirst({
          where: {
            email: updateData.email,
            id: { not: id }
          }
        });

        if (existingSupplier) {
          return res.status(400).json({ error: 'Supplier email already exists' });
        }
      }

      const supplier = await prisma.supplier.update({
        where: { id },
        data: updateData
      });

      logger.info(`Supplier updated: ${supplier.name}`);
      res.json(supplier);
    } catch (error) {
      logger.error('Error updating supplier:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   delete:
 *     summary: Delete supplier
 *     tags: [Suppliers]
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
 *         description: Supplier deleted successfully
 */
router.delete('/:id', authenticateToken, requirePermission('suppliers:delete'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Check if supplier has associated products or purchases
    const [productsCount, purchasesCount] = await Promise.all([
      prisma.product.count({ where: { supplierId: id } }),
      prisma.purchase.count({ where: { supplierId: id } })
    ]);

    if (productsCount > 0 || purchasesCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete supplier with associated products or purchases' 
      });
    }

    // Delete supplier
    await prisma.supplier.delete({
      where: { id }
    });

    logger.info(`Supplier deleted: ${supplier.name}`);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    logger.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 