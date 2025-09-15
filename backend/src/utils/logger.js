const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Configurar colores para consola
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Formato personalizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Formato para archivos (sin colores)
const fileLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Crear directorio de logs si no existe
const fs = require('fs');
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configurar transportes
const transports = [
  // Consola
  new winston.transports.Console({
    format: logFormat,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  }),
];

// Agregar archivos de log solo en producción
if (process.env.NODE_ENV === 'production') {
  // Log general
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: fileLogFormat,
      level: 'info',
    })
  );

  // Log de errores
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: fileLogFormat,
      level: 'error',
    })
  );

  // Log de auditoría
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '90d',
      format: fileLogFormat,
      level: 'info',
    })
  );
}

// Crear logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: fileLogFormat,
  transports,
  exitOnError: false,
});

// Función para log de auditoría
logger.audit = (action, userId, details) => {
  logger.info('AUDIT', {
    action,
    userId,
    details,
    timestamp: new Date().toISOString(),
    ip: details.ip || 'unknown',
    userAgent: details.userAgent || 'unknown',
  });
};

// Función para log de seguridad
logger.security = (event, details) => {
  logger.warn('SECURITY', {
    event,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Función para log de performance
logger.performance = (operation, duration, details) => {
  logger.info('PERFORMANCE', {
    operation,
    duration: `${duration}ms`,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Función para log de integración DIAN
logger.dian = (operation, status, details) => {
  logger.info('DIAN', {
    operation,
    status,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Función para log de notificaciones
logger.notification = (type, recipient, status, details) => {
  logger.info('NOTIFICATION', {
    type,
    recipient,
    status,
    details,
    timestamp: new Date().toISOString(),
  });
};

module.exports = logger; 