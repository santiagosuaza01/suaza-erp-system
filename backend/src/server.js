// ==========================
// DEPENDENCIAS PRINCIPALES
// ==========================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');

// ==========================
// CONFIGURACIÓN DE PRISMA
// ==========================
const prisma = new PrismaClient();

// ==========================
// APP Y PUERTO
// ==========================
const app = express();
const PORT = process.env.PORT || 3001;

// ==========================
// SEGURIDAD Y PERFORMANCE
// ==========================
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));
app.use(compression());

// ==========================
// LIMITES Y PROTECCIONES
// ==========================
// Rate limiting deshabilitado para desarrollo
if (process.env.NODE_ENV === 'production') {
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100,
    message: { error: 'Demasiadas solicitudes, intente más tarde.' },
  }));
  app.use('/api', slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    delayMs: 500,
  }));
}

// ==========================
// LOGGING Y PARSEO
// ==========================
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================
// RUTAS PÚBLICAS
// ==========================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ==========================
// DOCUMENTACIÓN SWAGGER
// ==========================
if (process.env.NODE_ENV !== 'production') {
  const swaggerJsdoc = require('swagger-jsdoc');
  const swaggerUi = require('swagger-ui-express');
  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Suaza API',
        version: '1.0.0',
        description: 'API del Sistema Integral de Gestión para Agropecuarias',
      },
      servers: [{ url: `http://localhost:${PORT}` }],
    },
    apis: ['./src/routes/*.js'],
  };
  const specs = swaggerJsdoc(options);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
}

// ==========================
// RUTAS DE LA API
// ==========================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', authenticateToken, require('./routes/users'));
app.use('/api/products', authenticateToken, require('./routes/products'));
app.use('/api/categories', authenticateToken, require('./routes/categories'));
app.use('/api/inventory', authenticateToken, require('./routes/inventory'));
app.use('/api/suppliers', authenticateToken, require('./routes/suppliers'));
app.use('/api/purchases', authenticateToken, require('./routes/purchases'));
app.use('/api/customers', authenticateToken, require('./routes/customers'));
app.use('/api/sales', authenticateToken, require('./routes/sales'));
app.use('/api/credits', authenticateToken, require('./routes/credits'));
app.use('/api/payments', authenticateToken, require('./routes/payments'));
app.use('/api/reports', authenticateToken, require('./routes/reports'));
app.use('/api/dian', authenticateToken, require('./routes/dian'));
app.use('/api/notifications', authenticateToken, require('./routes/notifications'));
app.use('/api/system', authenticateToken, require('./routes/system'));
app.use('/api/dashboard', authenticateToken, require('./routes/dashboard'));

// ==========================
// MANEJO DE ERRORES
// ==========================
app.use('*', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use(errorHandler);

// ==========================
// INICIAR SERVIDOR
// ==========================
async function startServer() {
  try {
    await prisma.$connect();
    logger.info('✅ Conexión a base de datos establecida');

    app.listen(PORT, () => {
      logger.info(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      logger.info(`📚 Swagger Docs: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}
startServer();

module.exports = app;
