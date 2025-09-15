const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { body, query: validateQuery, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/system/health:
 *   get:
 *     summary: Get system health status
 *     tags: [System]
 */
router.get('/health', authenticateToken, requirePermission('system:read'), async (req, res) => {
  try {
    let dbStatus = 'healthy';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      dbStatus = 'unhealthy';
      logger.error('Database health check failed:', error);
    }

    const systemInfo = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    };

    res.json({
      status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      system: systemInfo
    });
  } catch (error) {
    logger.error('Error checking system health:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/system/info:
 *   get:
 *     summary: Get system information
 *     tags: [System]
 */
router.get('/info', authenticateToken, requirePermission('system:read'), async (req, res) => {
  try {
    const dbStats = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `;

    const config = {
      database: {
        url: process.env.DATABASE_URL ? 'Configured' : 'Not configured',
        maxConnections: process.env.DATABASE_MAX_CONNECTIONS || 'Default',
        ssl: process.env.DATABASE_SSL === 'true'
      },
      security: {
        jwtSecret: process.env.JWT_SECRET ? 'Configured' : 'Not configured',
        jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ? 'Configured' : 'Not configured',
        corsOrigin: process.env.FRONTEND_URL || 'http://localhost:3000'
      },
      email: {
        host: process.env.EMAIL_HOST || 'Not configured',
        port: process.env.EMAIL_PORT || 'Not configured',
        secure: process.env.EMAIL_SECURE === 'true'
      },
      whatsapp: {
        apiKey: process.env.WHATSAPP_API_KEY ? 'Configured' : 'Not configured',
        phoneNumber: process.env.WHATSAPP_PHONE_NUMBER || 'Not configured'
      }
    };

    res.json({
      version: '1.0.0',
      name: 'Suaza Sistema Integral de Gestión',
      description: 'Sistema de gestión integral para agropecuarias',
      database: {
        stats: dbStats,
        tables: dbStats.length
      },
      configuration: config,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Error fetching system info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/system/logs:
 *   get:
 *     summary: Get system logs
 *     tags: [System]
 */
router.get('/logs',
  authenticateToken,
  requirePermission('system:logs'),
  [
    validateQuery('level').optional().isIn(['error', 'warn', 'info', 'debug']),
    validateQuery('startDate').optional().isISO8601(),
    validateQuery('endDate').optional().isISO8601(),
    validateQuery('limit').optional().isInt({ min: 1, max: 1000 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { level = '', startDate = '', endDate = '', limit = 100 } = req.query;

      // Aquí deberías traer logs reales de la DB en el futuro
      const logs = [
        {
          timestamp: new Date(),
          level: 'info',
          message: 'System startup completed',
          source: 'system'
        },
        {
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          level: 'info',
          message: 'User login successful',
          source: 'auth',
          details: { userId: 'user-123', username: 'admin' }
        }
      ];

      res.json({ logs, total: logs.length, filters: { level, startDate, endDate, limit } });
    } catch (error) {
      logger.error('Error fetching system logs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
