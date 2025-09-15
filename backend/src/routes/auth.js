const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', 
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;

      // Find user by username or email
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username },
            { email: username }
          ],
          isActive: true
        },
        include: {
          role: {
            select: {
              name: true,
              permissions: true
            }
          }
        }
      });

      if (!user) {
        logger.warn(`Failed login attempt for username: ${username}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        logger.warn(`Failed login attempt for user: ${user.username}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT tokens
      const accessToken = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role.name,
          permissions: user.role.permissions 
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // Store refresh token in database
      // TODO: Implementar tabla refreshToken en el esquema
      // await prisma.refreshToken.create({
      //   data: {
      //     token: refreshToken,
      //     userId: user.id,
      //     expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      //   }
      // });

      // Log successful login
      logger.info(`User logged in: ${user.username}`);

      // Return user data and tokens
      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role.name,
          permissions: user.role.permissions
        },
        accessToken,
        refreshToken
      });
    } catch (error) {
      logger.error('Error during login:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', 
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { refreshToken } = req.body;

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      // Check if token exists in database
      const storedToken = await prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          userId: decoded.id,
          expiresAt: { gt: new Date() }
        }
      });

      if (!storedToken) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Get user data
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: {
          role: {
            select: {
              name: true,
              permissions: true
            }
          }
        }
      });

      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      // Generate new access token
      const newAccessToken = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role.name,
          permissions: user.role.permissions 
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      logger.info(`Token refreshed for user: ${user.username}`);
      res.json({ accessToken: newAccessToken });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Refresh token expired' });
      }
      
      logger.error('Error refreshing token:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', 
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { refreshToken } = req.body;

      // Remove refresh token from database
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken }
      });

      logger.info('User logged out successfully');
      res.json({ message: 'Logout successful' });
    } catch (error) {
      logger.error('Error during logout:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 */
router.get('/me', async (req, res) => {
  try {
    // This route should be protected by middleware
    // For now, we'll return a placeholder
    res.json({ message: 'Protected route - implement middleware' });
  } catch (error) {
    logger.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.post('/change-password', 
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // This route should be protected by middleware
      // For now, we'll return a placeholder
      res.json({ message: 'Protected route - implement middleware' });
    } catch (error) {
      logger.error('Error changing password:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset email sent
 */
router.post('/forgot-password', 
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        // Don't reveal if user exists or not
        logger.info(`Password reset requested for email: ${email}`);
        return res.json({ message: 'If the email exists, a password reset link has been sent' });
      }

      // Generate reset token
      const resetToken = jwt.sign(
        { id: user.id, type: 'password_reset' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Store reset token
      await prisma.passwordReset.create({
        data: {
          token: resetToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        }
      });

      // TODO: Send email with reset link
      // For now, just log it
      logger.info(`Password reset token generated for user: ${user.username}`);

      res.json({ message: 'If the email exists, a password reset link has been sent' });
    } catch (error) {
      logger.error('Error requesting password reset:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post('/reset-password', 
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, newPassword } = req.body;

      // Verify reset token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.type !== 'password_reset') {
        return res.status(400).json({ error: 'Invalid reset token' });
      }

      // Check if token exists and is valid
      const resetRecord = await prisma.passwordReset.findFirst({
        where: {
          token,
          userId: decoded.id,
          expiresAt: { gt: new Date() }
        }
      });

      if (!resetRecord) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update user password
      await prisma.user.update({
        where: { id: decoded.id },
        data: { password: hashedPassword }
      });

      // Remove reset token
      await prisma.passwordReset.delete({
        where: { id: resetRecord.id }
      });

      logger.info(`Password reset successful for user ID: ${decoded.id}`);
      res.json({ message: 'Password reset successful' });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(400).json({ error: 'Invalid reset token' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(400).json({ error: 'Reset token expired' });
      }
      
      logger.error('Error resetting password:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Verify email address
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 */
router.post('/verify-email', 
  [
    body('token').notEmpty().withMessage('Verification token is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token } = req.body;

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.type !== 'email_verification') {
        return res.status(400).json({ error: 'Invalid verification token' });
      }

      // Update user email verification status
      await prisma.user.update({
        where: { id: decoded.id },
        data: { emailVerified: true }
      });

      logger.info(`Email verified for user ID: ${decoded.id}`);
      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(400).json({ error: 'Invalid verification token' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(400).json({ error: 'Verification token expired' });
      }
      
      logger.error('Error verifying email:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router; 