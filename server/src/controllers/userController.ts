import { Request, Response } from 'express';
import prisma from '../config/database';
import { hashPassword } from '../utils/auth';
import { createAuditLog } from '../middleware/auditLog';

// Helper to get client IP address
const getClientIp = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

// Get all users (Admin only)
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get single user by ID (Admin only)
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
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

// Create new user (Admin only)
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, fullName, role } = req.body;

    // Validation
    if (!username || !password || !fullName || !role) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    // Validate role
    const validRoles = ['viewer', 'operator', 'editor', 'admin'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role', validRoles });
      return;
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        fullName,
        role,
        isActive: true
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    // Audit log
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'CREATE_USER',
      'user',
      user.id,
      null,
      { username: user.username, fullName: user.fullName, role: user.role },
      getClientIp(req),
      `Created user: ${user.username} (${user.role})`
    );

    res.status(201).json({
      message: 'User created successfully',
      user
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update user (Admin only)
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);
    const { fullName, role, isActive, password } = req.body;

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Fetch old user data for audit log
    const oldUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true
      }
    });

    if (!oldUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Build update data
    const updateData: any = {};

    if (fullName !== undefined) updateData.fullName = fullName;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (role !== undefined) {
      const validRoles = ['viewer', 'operator', 'editor', 'admin'];
      if (!validRoles.includes(role)) {
        res.status(400).json({ error: 'Invalid role', validRoles });
        return;
      }
      updateData.role = role;
    }

    if (password) {
      updateData.passwordHash = await hashPassword(password);
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    // Build change description
    const changes: string[] = [];
    if (fullName !== undefined && fullName !== oldUser.fullName) changes.push('name');
    if (role !== undefined && role !== oldUser.role) changes.push(`role: ${oldUser.role} → ${role}`);
    if (isActive !== undefined && isActive !== oldUser.isActive) changes.push(isActive ? 'activated' : 'deactivated');
    if (password) changes.push('password');

    // Audit log
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'UPDATE_USER',
      'user',
      user.id,
      { fullName: oldUser.fullName, role: oldUser.role, isActive: oldUser.isActive },
      { fullName: user.fullName, role: user.role, isActive: user.isActive, passwordChanged: !!password },
      getClientIp(req),
      `Updated user ${user.username}: ${changes.join(', ') || 'no changes'}`
    );

    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete user (Admin only) - Soft delete by deactivating
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Prevent deleting yourself
    if (req.user && req.user.userId === userId) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    // Soft delete by deactivating
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true
      }
    });

    // Audit log
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'DELETE_USER',
      'user',
      user.id,
      { isActive: true },
      { isActive: false },
      getClientIp(req),
      `Deactivated user: ${user.username} (${user.role})`
    );

    res.json({
      message: 'User deactivated successfully',
      user
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
