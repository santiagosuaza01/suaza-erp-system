const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
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
 *         name: type
 *         schema:
 *           type: string
 *         description: Notification type filter
 *       - in: query
 *         name: read
 *         schema:
 *           type: boolean
 *         description: Read status filter
 *     responses:
 *       200:
 *         description: List of notifications
 */
router.get('/', 
  authenticateToken, 
  requirePermission('notifications:read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isString(),
    query('read').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { page = 1, limit = 20, type = '', read = '' } = req.query;
      const skip = (page - 1) * limit;

      const where = { userId: req.user.id };

      if (type) {
        where.type = type;
      }

      if (read !== '') {
        where.read = read === 'true';
      }

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.notification.count({ where })
      ]);

      res.json({
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/notifications/{id}:
 *   get:
 *     summary: Get notification by ID
 *     tags: [Notifications]
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
 *         description: Notification details
 */
router.get('/:id', authenticateToken, requirePermission('notifications:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findFirst({
      where: { 
        id,
        userId: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    logger.error('Error fetching notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     tags: [Notifications]
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
 *         description: Notification marked as read
 */
router.put('/:id/read', authenticateToken, requirePermission('notifications:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findFirst({
      where: { 
        id,
        userId: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { 
        read: true,
        readAt: new Date()
      }
    });

    logger.info(`Notification ${id} marked as read by user ${req.user.username}`);
    res.json(updatedNotification);
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.put('/read-all', authenticateToken, requirePermission('notifications:update'), async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { 
        userId: req.user.id,
        read: false
      },
      data: { 
        read: true,
        readAt: new Date()
      }
    });

    logger.info(`All notifications marked as read by user ${req.user.username}`);
    res.json({ 
      message: 'All notifications marked as read',
      updatedCount: result.count
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
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
 *         description: Notification deleted
 */
router.delete('/:id', authenticateToken, requirePermission('notifications:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findFirst({
      where: { 
        id,
        userId: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.delete({
      where: { id }
    });

    logger.info(`Notification ${id} deleted by user ${req.user.username}`);
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/notifications/clear-read:
 *   delete:
 *     summary: Clear all read notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Read notifications cleared
 */
router.delete('/clear-read', authenticateToken, requirePermission('notifications:delete'), async (req, res) => {
  try {
    const result = await prisma.notification.deleteMany({
      where: { 
        userId: req.user.id,
        read: true
      }
    });

    logger.info(`Read notifications cleared by user ${req.user.username}`);
    res.json({ 
      message: 'Read notifications cleared',
      deletedCount: result.count
    });
  } catch (error) {
    logger.error('Error clearing read notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/notifications/settings:
 *   get:
 *     summary: Get user notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User notification settings
 */
router.get('/settings', authenticateToken, requirePermission('notifications:read'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        notificationPreferences: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Default notification preferences if none set
    const defaultPreferences = {
      email: true,
      push: true,
      sms: false,
      types: {
        inventory: true,
        sales: true,
        purchases: true,
        credits: true,
        security: true,
        system: true
      }
    };

    const settings = {
      ...defaultPreferences,
      ...user.notificationPreferences
    };

    res.json(settings);
  } catch (error) {
    logger.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/notifications/settings:
 *   put:
 *     summary: Update user notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: boolean
 *               push:
 *                 type: boolean
 *               sms:
 *                 type: boolean
 *               types:
 *                 type: object
 *                 properties:
 *                   inventory:
 *                     type: boolean
 *                   sales:
 *                     type: boolean
 *                   purchases:
 *                     type: boolean
 *                   credits:
 *                     type: boolean
 *                   security:
 *                     type: boolean
 *                   system:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Notification settings updated
 */
router.put('/settings', 
  authenticateToken, 
  requirePermission('notifications:update'),
  [
    body('email').optional().isBoolean(),
    body('push').optional().isBoolean(),
    body('sms').optional().isBoolean(),
    body('types.inventory').optional().isBoolean(),
    body('types.sales').optional().isBoolean(),
    body('types.purchases').optional().isBoolean(),
    body('types.credits').optional().isBoolean(),
    body('types.security').optional().isBoolean(),
    body('types.system').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updateData = req.body;

      // Remove undefined fields
      Object.keys(updateData).forEach(key => 
        updateData[key] === undefined && delete updateData[key]
      );

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          notificationPreferences: updateData
        },
        select: {
          id: true,
          username: true,
          notificationPreferences: true
        }
      });

      logger.info(`Notification settings updated by user ${req.user.username}`);
      res.json(user.notificationPreferences);
    } catch (error) {
      logger.error('Error updating notification settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread notification count
 */
router.get('/unread-count', authenticateToken, requirePermission('notifications:read'), async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { 
        userId: req.user.id,
        read: false
      }
    });

    res.json({ unreadCount: count });
  } catch (error) {
    logger.error('Error fetching unread notification count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/notifications/test:
 *   post:
 *     summary: Send test notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               type
 *               message
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [info, success, warning, error]
 *               message:
 *                 type: string
 *               channel:
 *                 type: string
 *                 enum: [email, push, sms]
 *     responses:
 *       201:
 *         description: Test notification sent
 */
router.post('/test', 
  authenticateToken, 
  requirePermission('notifications:create'),
  [
    body('type').isIn(['info', 'success', 'warning', 'error']),
    body('message').isLength({ min: 1 }).trim().escape(),
    body('channel').optional().isIn(['email', 'push', 'sms'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { type, message, channel = 'push' } = req.body;

      // Create test notification
      const notification = await prisma.notification.create({
        data: {
          userId: req.user.id,
          type,
          title: 'Test Notification',
          message,
          channel,
          priority: 'normal',
          read: false
        }
      });

      logger.info(`Test notification sent to user ${req.user.username}: ${message}`);
      res.status(201).json(notification);
    } catch (error) {
      logger.error('Error sending test notification:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router; 