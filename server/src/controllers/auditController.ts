import { Request, Response } from 'express';
import prisma from '../config/database';

// Get audit logs with filtering and pagination
export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userId,
      actionType,
      entityType,
      startDate,
      endDate,
      limit = '50',
      offset = '0'
    } = req.query;

    const where: any = {};

    if (userId) {
      where.userId = parseInt(userId as string);
    }

    if (actionType) {
      where.actionType = actionType as string;
    }

    if (entityType) {
      where.entityType = entityType as string;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate as string);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      logs,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get unique action types for filtering
export const getActionTypes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const actionTypes = await prisma.auditLog.findMany({
      select: { actionType: true },
      distinct: ['actionType'],
      orderBy: { actionType: 'asc' }
    });

    res.json(actionTypes.map(a => a.actionType));
  } catch (error) {
    console.error('Get action types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get unique entity types for filtering
export const getEntityTypes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const entityTypes = await prisma.auditLog.findMany({
      select: { entityType: true },
      distinct: ['entityType'],
      orderBy: { entityType: 'asc' }
    });

    res.json(entityTypes.map(e => e.entityType));
  } catch (error) {
    console.error('Get entity types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get audit log statistics
export const getAuditStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [total, byActionType, byUser, recentActivity] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.groupBy({
        by: ['actionType'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
      }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      }),
      prisma.auditLog.findMany({
        take: 5,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: { username: true, fullName: true }
          }
        }
      })
    ]);

    // Get user details for top users
    const userIds = byUser.map(u => u.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, fullName: true }
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    res.json({
      total,
      byActionType: byActionType.map(a => ({
        actionType: a.actionType,
        count: a._count.id
      })),
      byUser: byUser.map(u => ({
        userId: u.userId,
        username: userMap.get(u.userId)?.username || 'Unknown',
        fullName: userMap.get(u.userId)?.fullName || 'Unknown',
        count: u._count.id
      })),
      recentActivity
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Export audit logs as CSV
export const exportAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userId,
      actionType,
      entityType,
      startDate,
      endDate
    } = req.query;

    const where: any = {};

    if (userId) where.userId = parseInt(userId as string);
    if (actionType) where.actionType = actionType as string;
    if (entityType) where.entityType = entityType as string;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { username: true, fullName: true }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    // Generate CSV
    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Comment'];
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.user.fullName || log.user.username,
      log.userRole,
      log.actionType,
      log.entityType,
      log.entityId?.toString() || '',
      log.ipAddress || '',
      log.comment || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
