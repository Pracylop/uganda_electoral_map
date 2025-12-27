import { Request, Response } from 'express';
import prisma from '../config/database';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { createAuditLog } from '../middleware/auditLog';

// Helper to get client IP
const getClientIp = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

// Login
export const login = async (req: Request, res: Response): Promise<void> => {
  const ipAddress = getClientIp(req);

  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      res.status(403).json({ error: 'Account is deactivated' });
      return;
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Log successful login
    await createAuditLog(
      user.id,
      user.role,
      'LOGIN',
      'user',
      user.id,
      null,
      null,
      ipAddress,
      `Successful login for ${username}`
    );

    // Generate token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get current user info
export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Logout (client-side token removal, server could implement token blacklist)
export const logout = async (req: Request, res: Response): Promise<void> => {
  res.json({ message: 'Logout successful' });
};
