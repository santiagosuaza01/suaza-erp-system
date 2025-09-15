const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/dian/invoice:
 *   post:
 *     summary: Generate electronic invoice
 *     tags: [DIAN]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - saleId
 *               - customerId
 *             properties:
 *               saleId:
 *                 type: string
 *               customerId:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Electronic invoice generated successfully
 */
router.post('/invoice', 
  authenticateToken, 
  requirePermission('dian:create'),
  [
    body('saleId').isUUID().withMessage('Valid sale ID is required'),
    body('customerId').isUUID().withMessage('Valid customer ID is required'),
    body('notes').optional().trim().escape()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { saleId, customerId, notes } = req.body;

      // Get sale details
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
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

      if (sale.status !== 'completed') {
        return res.status(400).json({ error: 'Sale must be completed to generate invoice' });
      }

      // Get customer details
      const customer = await prisma.customer.findUnique({
        where: { id: customerId }
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      // Generate DIAN invoice number
      const invoiceNumber = `FE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Calculate totals
      const subtotal = sale.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const tax = subtotal * 0.19; // 19% IVA Colombia
      const total = subtotal + tax;

      // Create DIAN invoice record
      const dianInvoice = await prisma.dianInvoice.create({
        data: {
          invoiceNumber,
          saleId,
          customerId,
          subtotal,
          tax,
          total,
          status: 'pending',
          notes,
          userId: req.user.id
        }
      });

      // TODO: Integrate with DIAN API for electronic signature
      // For now, just mark as generated
      await prisma.dianInvoice.update({
        where: { id: dianInvoice.id },
        data: { status: 'generated' }
      });

      logger.info(`DIAN invoice generated: ${invoiceNumber} for sale ${saleId}`);
      res.status(201).json({
        message: 'Electronic invoice generated successfully',
        invoice: dianInvoice
      });
    } catch (error) {
      logger.error('Error generating DIAN invoice:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/dian/invoice/{id}:
 *   get:
 *     summary: Get DIAN invoice by ID
 *     tags: [DIAN]
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
 *         description: DIAN invoice details
 */
router.get('/invoice/:id', authenticateToken, requirePermission('dian:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.dianInvoice.findUnique({
      where: { id },
      include: {
        sale: {
          include: {
            customer: true,
            items: {
              include: {
                product: true
              }
            }
          }
        },
        customer: true,
        user: {
          select: {
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'DIAN invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    logger.error('Error fetching DIAN invoice:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/dian/invoice:
 *   get:
 *     summary: Get all DIAN invoices
 *     tags: [DIAN]
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
 *           enum: [pending, generated, sent, accepted, rejected]
 *         description: Invoice status filter
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
 *         description: List of DIAN invoices
 */
router.get('/invoice', 
  authenticateToken, 
  requirePermission('dian:read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'generated', 'sent', 'accepted', 'rejected']),
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
        status = '', 
        startDate = '', 
        endDate = '' 
      } = req.query;

      const skip = (page - 1) * limit;

      const where = {};

      if (status) {
        where.status = status;
      }

      if (startDate && endDate) {
        where.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      const [invoices, total] = await Promise.all([
        prisma.dianInvoice.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          include: {
            sale: {
              select: {
                invoiceNumber: true,
                total: true
              }
            },
            customer: {
              select: {
                name: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.dianInvoice.count({ where })
      ]);

      res.json({
        invoices,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching DIAN invoices:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/dian/invoice/{id}/send:
 *   post:
 *     summary: Send invoice to DIAN
 *     tags: [DIAN]
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
 *         description: Invoice sent to DIAN successfully
 */
router.post('/invoice/:id/send', authenticateToken, requirePermission('dian:send'), async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.dianInvoice.findUnique({
      where: { id },
      include: {
        sale: {
          include: {
            customer: true,
            items: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'DIAN invoice not found' });
    }

    if (invoice.status !== 'generated') {
      return res.status(400).json({ error: 'Invoice must be generated before sending to DIAN' });
    }

    // TODO: Integrate with DIAN API to send invoice
    // For now, just update status
    await prisma.dianInvoice.update({
      where: { id },
      data: { 
        status: 'sent',
        sentAt: new Date()
      }
    });

    logger.info(`DIAN invoice ${invoice.invoiceNumber} sent to DIAN`);
    res.json({ message: 'Invoice sent to DIAN successfully' });
  } catch (error) {
    logger.error('Error sending invoice to DIAN:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/dian/invoice/{id}/status:
 *   get:
 *     summary: Check DIAN invoice status
 *     tags: [DIAN]
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
 *         description: DIAN invoice status
 */
router.get('/invoice/:id/status', authenticateToken, requirePermission('dian:read'), async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.dianInvoice.findUnique({
      where: { id }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'DIAN invoice not found' });
    }

    // TODO: Query DIAN API for real-time status
    // For now, return stored status
    const status = {
      invoiceId: id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      lastChecked: new Date(),
      dianResponse: 'Mock response - implement DIAN API integration'
    };

    res.json(status);
  } catch (error) {
    logger.error('Error checking DIAN invoice status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/dian/invoice/{id}/download:
 *   get:
 *     summary: Download DIAN invoice PDF
 *     tags: [DIAN]
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
 *         description: Invoice PDF file
 */
router.get('/invoice/:id/download', authenticateToken, requirePermission('dian:read'), async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.dianInvoice.findUnique({
      where: { id },
      include: {
        sale: {
          include: {
            customer: true,
            items: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'DIAN invoice not found' });
    }

    // TODO: Generate PDF using a library like puppeteer or jsPDF
    // For now, return a placeholder response
    res.json({
      message: 'PDF generation not implemented yet',
      invoice: invoice
    });
  } catch (error) {
    logger.error('Error downloading DIAN invoice:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/dian/invoice/{id}/cancel:
 *   post:
 *     summary: Cancel DIAN invoice
 *     tags: [DIAN]
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invoice cancelled successfully
 */
router.post('/invoice/:id/cancel', 
  authenticateToken, 
  requirePermission('dian:cancel'),
  [
    body('reason').notEmpty().trim().escape().withMessage('Cancellation reason is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { reason } = req.body;

      const invoice = await prisma.dianInvoice.findUnique({
        where: { id }
      });

      if (!invoice) {
        return res.status(404).json({ error: 'DIAN invoice not found' });
      }

      if (invoice.status === 'accepted') {
        return res.status(400).json({ error: 'Cannot cancel accepted invoice' });
      }

      // TODO: Send cancellation request to DIAN API
      // For now, just update status
      await prisma.dianInvoice.update({
        where: { id },
        data: { 
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: reason
        }
      });

      logger.info(`DIAN invoice ${invoice.invoiceNumber} cancelled: ${reason}`);
      res.json({ message: 'Invoice cancelled successfully' });
    } catch (error) {
      logger.error('Error cancelling DIAN invoice:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/dian/settings:
 *   get:
 *     summary: Get DIAN configuration settings
 *     tags: [DIAN]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: DIAN configuration settings
 */
router.get('/settings', authenticateToken, requirePermission('dian:read'), async (req, res) => {
  try {
    // TODO: Get DIAN settings from database or environment
    const settings = {
      testMode: process.env.DIAN_TEST_MODE === 'true',
      apiUrl: process.env.DIAN_API_URL || 'https://api.dian.gov.co',
      username: process.env.DIAN_USERNAME || 'Not configured',
      password: '***',
      certificatePath: process.env.DIAN_CERTIFICATE_PATH || 'Not configured',
      environment: process.env.NODE_ENV || 'development'
    };

    res.json(settings);
  } catch (error) {
    logger.error('Error fetching DIAN settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/dian/settings:
 *   put:
 *     summary: Update DIAN configuration settings
 *     tags: [DIAN]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               testMode:
 *                 type: boolean
 *               apiUrl:
 *                 type: string
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               certificatePath:
 *                 type: string
 *     responses:
 *       200:
 *         description: DIAN settings updated successfully
 */
router.put('/settings', 
  authenticateToken, 
  requirePermission('dian:update'),
  [
    body('testMode').optional().isBoolean(),
    body('apiUrl').optional().isURL(),
    body('username').optional().trim().escape(),
    body('password').optional().trim(),
    body('certificatePath').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // TODO: Update DIAN settings in database or environment
      // For now, just return success
      logger.info('DIAN settings updated');
      res.json({ message: 'DIAN settings updated successfully' });
    } catch (error) {
      logger.error('Error updating DIAN settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router; 