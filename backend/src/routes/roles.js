const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Get all roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 */
router.get('/', authenticateToken, requirePermission('roles:read'), async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: { users: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(roles);
  } catch (error) {
    logger.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     tags: [Roles]
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
 *         description: Role details
 */
router.get('/:id', authenticateToken, requirePermission('roles:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true
          }
        },
        _count: {
          select: { users: true }
        }
      }
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.json(role);
  } catch (error) {
    logger.error('Error fetching role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Create new role
 *     tags: [Roles]
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
 *               - permissions
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Role created successfully
 */
router.post('/', 
  authenticateToken, 
  requirePermission('roles:create'),
  [
    body('name').isLength({ min: 2 }).trim().escape(),
    body('description').optional().trim().escape(),
    body('permissions').isArray({ min: 1 }),
    body('permissions.*').isString(),
    body('isActive').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, permissions, isActive = true } = req.body;

      // Check if role name already exists
      const existingRole = await prisma.role.findFirst({
        where: { name }
      });

      if (existingRole) {
        return res.status(400).json({ error: 'Role name already exists' });
      }

      // Create role
      const role = await prisma.role.create({
        data: {
          name,
          description,
          permissions,
          isActive
        }
      });

      logger.info(`Role created: ${name} with ${permissions.length} permissions`);
      res.status(201).json(role);
    } catch (error) {
      logger.error('Error creating role:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/roles/{id}:
 *   put:
 *     summary: Update role
 *     tags: [Roles]
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
 *               description:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Role updated successfully
 */
router.put('/:id', 
  authenticateToken, 
  requirePermission('roles:update'),
  [
    body('name').optional().isLength({ min: 2 }).trim().escape(),
    body('description').optional().trim().escape(),
    body('permissions').optional().isArray({ min: 1 }),
    body('permissions.*').optional().isString(),
    body('isActive').optional().isBoolean()
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

      // Check if name already exists (if updating name)
      if (updateData.name) {
        const existingRole = await prisma.role.findFirst({
          where: {
            name: updateData.name,
            id: { not: id }
          }
        });

        if (existingRole) {
          return res.status(400).json({ error: 'Role name already exists' });
        }
      }

      const role = await prisma.role.update({
        where: { id },
        data: updateData
      });

      logger.info(`Role updated: ${role.name}`);
      res.json(role);
    } catch (error) {
      logger.error('Error updating role:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/roles/{id}:
 *   delete:
 *     summary: Delete role
 *     tags: [Roles]
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
 *         description: Role deleted successfully
 */
router.delete('/:id', authenticateToken, requirePermission('roles:delete'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id }
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Check if role has associated users
    const usersCount = await prisma.user.count({
      where: { roleId: id }
    });

    if (usersCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete role with associated users' 
      });
    }

    // Delete role
    await prisma.role.delete({
      where: { id }
    });

    logger.info(`Role deleted: ${role.name}`);
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    logger.error('Error deleting role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/roles/{id}/permissions:
 *   get:
 *     summary: Get role permissions
 *     tags: [Roles]
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
 *         description: Role permissions
 */
router.get('/:id/permissions', authenticateToken, requirePermission('roles:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const role = await prisma.role.findUnique({
      where: { id },
      select: { id: true, name: true, permissions: true }
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.json({
      roleId: role.id,
      roleName: role.name,
      permissions: role.permissions
    });
  } catch (error) {
    logger.error('Error fetching role permissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/roles/{id}/permissions:
 *   put:
 *     summary: Update role permissions
 *     tags: [Roles]
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
 *               - permissions
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Role permissions updated
 */
router.put('/:id/permissions', 
  authenticateToken, 
  requirePermission('roles:update'),
  [
    body('permissions').isArray({ min: 1 }),
    body('permissions.*').isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { permissions } = req.body;

      // Check if role exists
      const role = await prisma.role.findUnique({
        where: { id }
      });

      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }

      // Update role permissions
      const updatedRole = await prisma.role.update({
        where: { id },
        data: { permissions }
      });

      logger.info(`Role permissions updated: ${role.name} - ${permissions.length} permissions`);
      res.json(updatedRole);
    } catch (error) {
      logger.error('Error updating role permissions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/roles/permissions/available:
 *   get:
 *     summary: Get available permissions
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available permissions list
 */
router.get('/permissions/available', authenticateToken, requirePermission('roles:read'), async (req, res) => {
  try {
    // Define all available permissions in the system
    const availablePermissions = {
      // User management
      'users:read': 'Read user information',
      'users:create': 'Create new users',
      'users:update': 'Update user information',
      'users:delete': 'Delete users',
      
      // Role management
      'roles:read': 'Read role information',
      'roles:create': 'Create new roles',
      'roles:update': 'Update role information',
      'roles:delete': 'Delete roles',
      
      // Product management
      'products:read': 'Read product information',
      'products:create': 'Create new products',
      'products:update': 'Update product information',
      'products:delete': 'Delete products',
      
      // Category management
      'categories:read': 'Read category information',
      'categories:create': 'Create new categories',
      'categories:update': 'Update category information',
      'categories:delete': 'Delete categories',
      
      // Supplier management
      'suppliers:read': 'Read supplier information',
      'suppliers:create': 'Create new suppliers',
      'suppliers:update': 'Update supplier information',
      'suppliers:delete': 'Delete suppliers',
      
      // Customer management
      'customers:read': 'Read customer information',
      'customers:create': 'Create new customers',
      'customers:update': 'Update customer information',
      'customers:delete': 'Delete customers',
      
      // Sales management
      'sales:read': 'Read sales information',
      'sales:create': 'Create new sales',
      'sales:update': 'Update sales information',
      'sales:delete': 'Delete sales',
      
      // Purchase management
      'purchases:read': 'Read purchase information',
      'purchases:create': 'Create new purchases',
      'purchases:update': 'Update purchase information',
      'purchases:delete': 'Delete purchases',
      
      // Credit management
      'credits:read': 'Read credit information',
      'credits:create': 'Create new credits',
      'credits:update': 'Update credit information',
      'credits:delete': 'Delete credits',
      
      // Inventory management
      'inventory:read': 'Read inventory information',
      'inventory:update': 'Update inventory',
      
      // Reports
      'reports:read': 'Access reports and analytics',
      'reports:export': 'Export reports',
      
      // Audit
      'audit:read': 'Read audit logs',
      'audit:export': 'Export audit logs',
      
      // Notifications
      'notifications:read': 'Read notifications',
      'notifications:create': 'Create notifications',
      'notifications:update': 'Update notifications',
      'notifications:delete': 'Delete notifications',
      
      // System administration
      'system:admin': 'Full system administration access',
      'system:backup': 'System backup and restore',
      'system:config': 'System configuration'
    };

    res.json(availablePermissions);
  } catch (error) {
    logger.error('Error fetching available permissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/roles/{id}/users:
 *   get:
 *     summary: Get users with this role
 *     tags: [Roles]
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
 *         description: Users with this role
 */
router.get('/:id/users', authenticateToken, requirePermission('roles:read'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id }
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Get users with this role
    const users = await prisma.user.findMany({
      where: { roleId: id },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true
      },
      orderBy: { username: 'asc' }
    });

    res.json({
      roleId: role.id,
      roleName: role.name,
      users
    });
  } catch (error) {
    logger.error('Error fetching role users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/roles/{id}/clone:
 *   post:
 *     summary: Clone role
 *     tags: [Roles]
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
 *               - newName
 *             properties:
 *               newName:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Role cloned successfully
 */
router.post('/:id/clone', 
  authenticateToken, 
  requirePermission('roles:create'),
  [
    body('newName').isLength({ min: 2 }).trim().escape(),
    body('description').optional().trim().escape()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { newName, description } = req.body;

      // Check if source role exists
      const sourceRole = await prisma.role.findUnique({
        where: { id }
      });

      if (!sourceRole) {
        return res.status(404).json({ error: 'Source role not found' });
      }

      // Check if new role name already exists
      const existingRole = await prisma.role.findFirst({
        where: { name: newName }
      });

      if (existingRole) {
        return res.status(400).json({ error: 'Role name already exists' });
      }

      // Clone role
      const clonedRole = await prisma.role.create({
        data: {
          name: newName,
          description: description || `Cloned from ${sourceRole.name}`,
          permissions: sourceRole.permissions,
          isActive: true
        }
      });

      logger.info(`Role cloned: ${sourceRole.name} -> ${newName}`);
      res.status(201).json(clonedRole);
    } catch (error) {
      logger.error('Error cloning role:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router; 