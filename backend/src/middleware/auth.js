const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Middleware de autenticación JWT
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Token de acceso requerido',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar usuario en base de datos
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        role: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Usuario inactivo',
        code: 'USER_INACTIVE'
      });
    }

    // Verificar si el usuario está bloqueado
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(401).json({
        error: 'Usuario bloqueado temporalmente',
        code: 'USER_LOCKED',
        lockedUntil: user.lockedUntil
      });
    }

    // Actualizar último login (comentado temporalmente para debug)
    // await prisma.user.update({
    //   where: { id: user.id },
    //   data: { lastLogin: new Date() }
    // });

    // Agregar información del usuario al request
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      permissions: user.role.permissions
    };

    // Log de auditoría (comentado temporalmente para debug)
    // logger.audit('LOGIN', user.id, {
    //   ip: req.ip,
    //   userAgent: req.get('User-Agent'),
    //   success: true
    // });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.security('INVALID_TOKEN', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: error.message
      });

      return res.status(401).json({
        error: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      logger.security('EXPIRED_TOKEN', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(401).json({
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }

    logger.error('Error en autenticación:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware para verificar permisos específicos
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Autenticación requerida',
          code: 'AUTH_REQUIRED'
        });
      }

      const userPermissions = req.user.permissions || [];
      
      // Verificar si tiene el permiso específico
      if (userPermissions.includes(permission)) {
        return next();
      }

      // Verificar si tiene permiso wildcard (ej: products.*)
      const wildcardPermission = permission.split('.')[0] + '.*';
      if (userPermissions.includes(wildcardPermission)) {
        return next();
      }

      // Verificar si es administrador
      if (userPermissions.includes('*')) {
        return next();
      }

      logger.security('INSUFFICIENT_PERMISSIONS', {
        userId: req.user.id,
        requiredPermission: permission,
        userPermissions: userPermissions,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(403).json({
        error: 'Permisos insuficientes',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission
      });
    } catch (error) {
      logger.error('Error verificando permisos:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

/**
 * Middleware para verificar rol específico
 */
const requireRole = (roleName) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Autenticación requerida',
          code: 'AUTH_REQUIRED'
        });
      }

      if (req.user.role.name === roleName || req.user.role.name === 'ADMIN') {
        return next();
      }

      logger.security('INSUFFICIENT_ROLE', {
        userId: req.user.id,
        requiredRole: roleName,
        userRole: req.user.role.name,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(403).json({
        error: 'Rol insuficiente',
        code: 'INSUFFICIENT_ROLE',
        required: roleName
      });
    } catch (error) {
      logger.error('Error verificando rol:', error);
      return res.status(500).json({
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

/**
 * Middleware para verificar 2FA si está habilitado
 */
const require2FA = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Autenticación requerida',
        code: 'AUTH_REQUIRED'
      });
    }

    // Buscar usuario actualizado
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (user.twoFactorEnabled) {
      const twoFactorToken = req.headers['x-2fa-token'];
      
      if (!twoFactorToken) {
        return res.status(401).json({
          error: 'Token 2FA requerido',
          code: '2FA_REQUIRED'
        });
      }

      // Aquí se implementaría la verificación del token 2FA
      // Por ahora, solo verificamos que esté presente
      // TODO: Implementar verificación real con TOTP
    }

    next();
  } catch (error) {
    logger.error('Error verificando 2FA:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware para logging de auditoría
 */
const auditLog = (action) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log después de que se complete la respuesta
      setTimeout(() => {
        try {
          const responseData = JSON.parse(data);
          const success = res.statusCode >= 200 && res.statusCode < 300;
          
          logger.audit(action, req.user?.id, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            success,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            requestBody: req.body,
            responseData: success ? responseData : null
          });
        } catch (error) {
          logger.error('Error en audit log:', error);
        }
      }, 0);
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * Middleware para rate limiting específico por usuario
 */
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const userData = userRequests.get(userId) || { count: 0, resetTime: now + windowMs };

    // Reset si la ventana de tiempo ha expirado
    if (now > userData.resetTime) {
      userData.count = 0;
      userData.resetTime = now + windowMs;
    }

    userData.count++;

    if (userData.count > maxRequests) {
      logger.security('USER_RATE_LIMIT_EXCEEDED', {
        userId,
        count: userData.count,
        maxRequests,
        ip: req.ip
      });

      return res.status(429).json({
        error: 'Demasiadas solicitudes',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((userData.resetTime - now) / 1000)
      });
    }

    userRequests.set(userId, userData);
    next();
  };
};

module.exports = {
  authenticateToken,
  requirePermission,
  requireRole,
  require2FA,
  auditLog,
  userRateLimit
}; 