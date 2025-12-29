import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { UserRole } from '@prisma/client';

// Helper to get client IP address
const getClientIp = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

// Create audit log entry
export const createAuditLog = async (
  userId: number,
  userRole: string,
  actionType: string,
  entityType: string,
  entityId?: number,
  oldValue?: any,
  newValue?: any,
  ipAddress?: string,
  comment?: string
): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        userRole: userRole as UserRole,
        actionType,
        entityType,
        entityId,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        ipAddress,
        comment
      }
    });
  } catch (error) {
    console.error('Audit log error:', error);
    // Don't throw - audit logging shouldn't break the app
  }
};

// Middleware to log all authenticated actions
export const auditLogMiddleware = (
  actionType: string,
  entityType: string
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next();
      return;
    }

    // Store original json function
    const originalJson = res.json.bind(res);

    // Override json function to capture response
    res.json = function (body: any) {
      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId = parseInt(req.params.id) || body?.user?.id || body?.id;

        createAuditLog(
          req.user!.userId,
          req.user!.role,
          actionType,
          entityType,
          entityId,
          null, // oldValue - would need to fetch before update
          body,
          getClientIp(req),
          undefined
        ).catch(console.error);
      }

      return originalJson(body);
    };

    next();
  };
};

// Log login attempts
export const logLogin = async (
  username: string,
  success: boolean,
  userId?: number,
  ipAddress?: string
): Promise<void> => {
  try {
    // If login failed, we don't have a userId, so we'll use a system user ID or skip
    if (!userId && !success) {
      console.log(`Failed login attempt for username: ${username} from ${ipAddress}`);
      return;
    }

    if (userId) {
      await prisma.auditLog.create({
        data: {
          userId,
          userRole: 'viewer' as UserRole, // Default role for login tracking
          actionType: success ? 'LOGIN' : 'LOGIN_FAILED',
          entityType: 'user',
          entityId: userId,
          ipAddress,
          comment: `Login ${success ? 'successful' : 'failed'} for ${username}`
        }
      });
    }
  } catch (error) {
    console.error('Login audit log error:', error);
  }
};
