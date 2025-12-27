import { Request, Response } from 'express';
import prisma from '../config/database';
import { hashPassword } from '../utils/auth';

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
