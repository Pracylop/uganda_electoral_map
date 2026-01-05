import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getAuditLogs,
  getActionTypes,
  getEntityTypes,
  getAuditStats,
  exportAuditLogs
} from '../controllers/auditController';

const router = Router();

// All audit routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// Get audit logs with filtering
router.get('/', getAuditLogs);

// Get filter options
router.get('/action-types', getActionTypes);
router.get('/entity-types', getEntityTypes);

// Get statistics
router.get('/stats', getAuditStats);

// Export as CSV
router.get('/export', exportAuditLogs);

export default router;
