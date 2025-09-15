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
const customerValidationRules = {
  create: [
    body('name').isLength({ min: 2 }).trim().escape().withMessage('Name must be at least 2 characters'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('phone').optional().trim().escape(),
    body('address').optional().trim().escape(),
    body('city').optional().trim().escape(),
    body('documentType').optional().isIn(['CC', 'CE', 'NIT', 'RUT', 'PASSPORT']).withMessage('Invalid document type'),
    body('documentNumber').isLength({ min: 5 }).trim().escape().withMessage('Document number must be at least 5 characters'),
    body('creditLimit').optional().isFloat({ min: 0 }).withMessage('Credit limit must be a positive number')
  ],
  update: [
    body('name').optional().isLength({ min: 2 }).trim().escape(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim().escape(),
    body('address').optional().trim().escape(),
    body('city').optional().trim().escape(),
    body('documentType').optional().isIn(['CC', 'CE', 'NIT', 'RUT', 'PASSPORT']),
    body('documentNumber').optional().isLength({ min: 5 }).trim().escape(),
    body('creditLimit').optional().isFloat({ min: 0 })
  ]
};

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Get all customers
 *     tags: [Customers]
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
 *         description: List of customers
 */
/**
 * Get all customers with pagination and search
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build search conditions
    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { taxId: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    // Fetch customers and total count in parallel
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { name: 'asc' }
      }),
      prisma.customer.count({ where })
    ]);

    res.json({
      customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching customers:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
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
 *         description: Customer details
 */
/**
 * Get a specific customer by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: { sales: true, credits: true }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ 
        error: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

    res.json(customer);
  } catch (error) {
    logger.error('Error fetching customer:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: Create new customer
 *     tags: [Customers]
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
 *               - email
 *               - documentType
 *               - documentNumber
 *             properties:
 *               name:
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
 *               documentType:
 *                 type: string
 *                 enum: [CC, CE, NIT, RUT, PASSPORT]
 *               documentNumber:
 *                 type: string
 *               creditLimit:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Customer created successfully
 */
// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * Create a new customer
 */
router.post('/', authenticateToken, customerValidationRules.create, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { 
      name, 
      email, 
      phone, 
      address, 
      city, 
      documentType, 
      documentNumber, 
      creditLimit 
    } = req.body;

    // Check if customer email already exists (if provided)
    if (email) {
      const existingCustomerByEmail = await prisma.customer.findFirst({
        where: { email }
      });

      if (existingCustomerByEmail) {
        return res.status(400).json({ 
          error: 'Customer email already exists',
          code: 'EMAIL_EXISTS'
        });
      }
    }

    // Check if customer taxId already exists
    const existingCustomerByDoc = await prisma.customer.findFirst({
      where: { taxId: documentNumber }
    });

    if (existingCustomerByDoc) {
      return res.status(400).json({ 
        error: 'Customer document number already exists',
        code: 'DOCUMENT_EXISTS'
      });
    }

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        name,
        email,
        phone,
        address,
        city,
        taxId: documentNumber,
        creditLimit: creditLimit || 0
      }
    });

    logger.info(`Customer created: ${name} (ID: ${customer.id})`);
    res.status(201).json(customer);
  } catch (error) {
    logger.error('Error creating customer:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/customers/{id}:
 *   put:
 *     summary: Update customer
 *     tags: [Customers]
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
 *               documentType:
 *                 type: string
 *               documentNumber:
 *                 type: string
 *               creditLimit:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Customer updated successfully
 */
/**
 * Update an existing customer
 */
router.put('/:id', authenticateToken, customerValidationRules.update, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Remove undefined fields
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!existingCustomer) {
      return res.status(404).json({ 
        error: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

    // Check if email already exists (if updating email)
    if (updateData.email) {
      const emailExists = await prisma.customer.findFirst({
        where: {
          email: updateData.email,
          id: { not: id }
        }
      });

      if (emailExists) {
        return res.status(400).json({ 
          error: 'Customer email already exists',
          code: 'EMAIL_EXISTS'
        });
      }
    }

    // Check if document number already exists (if updating document number)
    if (updateData.documentNumber) {
      const docExists = await prisma.customer.findFirst({
        where: {
          taxId: updateData.documentNumber,
          id: { not: id }
        }
      });

      if (docExists) {
        return res.status(400).json({ 
          error: 'Customer document number already exists',
          code: 'DOCUMENT_EXISTS'
        });
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData
    });

    logger.info(`Customer updated: ${customer.name} (ID: ${id})`);
    res.json(customer);
  } catch (error) {
    logger.error('Error updating customer:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/customers/{id}:
 *   delete:
 *     summary: Delete customer
 *     tags: [Customers]
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
 *         description: Customer deleted successfully
 */
/**
 * Delete a customer
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!customer) {
      return res.status(404).json({ 
        error: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

    // Check if customer has associated sales or credits
    const [salesCount, creditsCount] = await Promise.all([
      prisma.sale.count({ where: { customerId: id } }),
      prisma.credit.count({ where: { customerId: id } })
    ]);

    if (salesCount > 0 || creditsCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete customer with associated sales or credits',
        code: 'CUSTOMER_HAS_RELATIONS',
        details: {
          salesCount,
          creditsCount
        }
      });
    }

    // Delete customer
    await prisma.customer.delete({
      where: { id }
    });

    logger.info(`Customer deleted: ${customer.name} (ID: ${id})`);
    res.json({ 
      message: 'Customer deleted successfully',
      deletedCustomer: {
        id: customer.id,
        name: customer.name
      }
    });
  } catch (error) {
    logger.error('Error deleting customer:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router; 