const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/audit/logs:
 *   get:
 *     summary: Get audit logs
 *     tags: [Audit]
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
 *         name: action
 *         schema:
 *           type: string
 *         description: Action filter
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: User ID filter
 *       - in: query
 *         name: resourceType
 *         schema:
 *           type: string
 *         description: Resource type filter
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
 *         description: List of audit logs
 */
router.get('/logs', 
  authenticateToken, 
  requirePermission('audit:read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('action').optional().isString(),
    query('userId').optional().isUUID(),
    query('resourceType').optional().isString(),
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
        action = '', 
        userId = '', 
        resourceType = '', 
        startDate = '', 
        endDate = '' 
      } = req.query;

      const skip = (page - 1) * limit;

      const where = {};

      if (action) {
        where.action = action;
      }

      if (userId) {
        where.userId = userId;
      }

      if (resourceType) {
        where.resourceType = resourceType;
      }

      if (startDate && endDate) {
        where.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          include: {
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
        prisma.auditLog.count({ where })
      ]);

      res.json({
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching audit logs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/audit/logs/{id}:
 *   get:
 *     summary: Get audit log by ID
 *     tags: [Audit]
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
 *         description: Audit log details
 */
router.get('/logs/:id', authenticateToken, requirePermission('audit:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const log = await prisma.auditLog.findUnique({
      where: { id },
      include: {
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

    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    res.json(log);
  } catch (error) {
    logger.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/audit/security:
 *   get:
 *     summary: Get security audit logs
 *     tags: [Audit]
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
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Severity filter
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
 *         description: List of security audit logs
 */
router.get('/security', 
  authenticateToken, 
  requirePermission('audit:read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
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
        severity = '', 
        startDate = '', 
        endDate = '' 
      } = req.query;

      const skip = (page - 1) * limit;

      const where = {
        OR: [
          { action: 'LOGIN' },
          { action: 'LOGOUT' },
          { action: 'LOGIN_FAILED' },
          { action: 'PASSWORD_CHANGE' },
          { action: 'PERMISSION_DENIED' },
          { action: 'SUSPICIOUS_ACTIVITY' }
        ]
      };

      if (severity) {
        where.severity = severity;
      }

      if (startDate && endDate) {
        where.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          include: {
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
        prisma.auditLog.count({ where })
      ]);

      res.json({
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching security audit logs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/audit/performance:
 *   get:
 *     summary: Get performance audit logs
 *     tags: [Audit]
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
 *         name: minDuration
 *         schema:
 *           type: integer
 *         description: Minimum duration in milliseconds
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
 *         description: List of performance audit logs
 */
router.get('/performance', 
  authenticateToken, 
  requirePermission('audit:read'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('minDuration').optional().isInt({ min: 0 }),
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
        minDuration = 0, 
        startDate = '', 
        endDate = '' 
      } = req.query;

      const skip = (page - 1) * limit;

      const where = {
        action: 'API_REQUEST'
      };

      if (minDuration > 0) {
        where.duration = {
          gte: parseInt(minDuration)
        };
      }

      if (startDate && endDate) {
        where.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { duration: 'desc' }
        }),
        prisma.auditLog.count({ where })
      ]);

      res.json({
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching performance audit logs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/audit/summary:
 *   get:
 *     summary: Get audit summary statistics
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit summary statistics
 */
router.get('/summary', authenticateToken, requirePermission('audit:read'), async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Get total counts
    const [totalLogs, monthlyLogs, yearlyLogs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({
        where: { createdAt: { gte: startOfMonth } }
      }),
      prisma.auditLog.count({
        where: { createdAt: { gte: startOfYear } }
      })
    ]);

    // Get action breakdown
    const actionBreakdown = await prisma.auditLog.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } }
    });

    // Get severity breakdown
    const severityBreakdown = await prisma.auditLog.groupBy({
      by: ['severity'],
      _count: { severity: true }
    });

    // Get resource type breakdown
    const resourceTypeBreakdown = await prisma.auditLog.groupBy({
      by: ['resourceType'],
      _count: { resourceType: true },
      orderBy: { _count: { resourceType: 'desc' } }
    });

    // Get top users by activity
    const topUsers = await prisma.auditLog.groupBy({
      by: ['userId'],
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10
    });

    // Get top users with names
    const topUsersWithNames = await Promise.all(
      topUsers.map(async (user) => {
        const userInfo = await prisma.user.findUnique({
          where: { id: user.userId },
          select: { username: true, firstName: true, lastName: true }
        });
        return {
          userId: user.userId,
          username: userInfo?.username || 'Unknown',
          firstName: userInfo?.firstName || '',
          lastName: userInfo?.lastName || '',
          count: user._count.userId
        };
      })
    );

    // Get recent critical events
    const recentCriticalEvents = await prisma.auditLog.findMany({
      where: { severity: 'critical' },
      include: {
        user: {
          select: { username: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const summary = {
      counts: {
        total: totalLogs,
        monthly: monthlyLogs,
        yearly: yearlyLogs
      },
      breakdowns: {
        actions: actionBreakdown.map(item => ({
          action: item.action,
          count: item._count.action
        })),
        severity: severityBreakdown.map(item => ({
          severity: item.severity,
          count: item._count.severity
        })),
        resourceTypes: resourceTypeBreakdown.map(item => ({
          resourceType: item.resourceType,
          count: item._count.resourceType
        }))
      },
      topUsers: topUsersWithNames,
      recentCriticalEvents
    };

    res.json(summary);
  } catch (error) {
    logger.error('Error generating audit summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/audit/export:
 *   get:
 *     summary: Export audit logs
 *     tags: [Audit]
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
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Action filter
 *     responses:
 *       200:
 *         description: Exported audit logs
 */
router.get('/export', 
  authenticateToken, 
  requirePermission('audit:export'),
  [
    query('format').isIn(['csv', 'json']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('action').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { format, startDate, endDate, action } = req.query;

      const where = {};

      if (startDate && endDate) {
        where.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      if (action) {
        where.action = action;
      }

      const logs = await prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              username: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (format === 'csv') {
        // Generate CSV
        const csvHeader = 'ID,Action,Resource Type,Resource ID,User,Details,IP Address,User Agent,Severity,Duration,Created At\n';
        const csvRows = logs.map(log => {
          const user = log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Unknown';
          return `${log.id},${log.action},${log.resourceType || ''},${log.resourceId || ''},${user},"${log.details || ''}",${log.ipAddress || ''},"${log.userAgent || ''}",${log.severity || ''},${log.duration || ''},${log.createdAt}`;
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvHeader + csvRows);
      } else {
        // Return JSON
        res.json(logs);
      }
    } catch (error) {
      logger.error('Error exporting audit logs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router; 