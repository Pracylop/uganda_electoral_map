import { Router } from 'express';
import {
  createResult,
  submitResultForApproval,
  approveResult,
  rejectResult,
  getResultsByElection,
  getPendingResults,
  getNationalTotals
} from '../controllers/resultController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Get results (all authenticated users can view approved results)
router.get('/election/:electionId', authenticate, getResultsByElection);

// Get national totals for election (for broadcast dashboard)
router.get('/national/:electionId', authenticate, getNationalTotals);

// Pending results (Editor/Admin only)
router.get('/pending', authenticate, authorize('editor', 'admin'), getPendingResults);

// Create result (Operator/Editor/Admin)
router.post('/', authenticate, authorize('operator', 'editor', 'admin'), createResult);

// Submit for approval (Operator/Editor/Admin)
router.post('/:id/submit', authenticate, authorize('operator', 'editor', 'admin'), submitResultForApproval);

// Approve/Reject (Editor/Admin only)
router.post('/:id/approve', authenticate, authorize('editor', 'admin'), approveResult);
router.post('/:id/reject', authenticate, authorize('editor', 'admin'), rejectResult);

export default router;
