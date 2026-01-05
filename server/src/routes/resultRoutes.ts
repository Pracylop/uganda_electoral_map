import { Router } from 'express';
import {
  createResult,
  updateResult,
  deleteResult,
  submitResultForApproval,
  approveResult,
  rejectResult,
  getResultsByElection,
  getPendingResults,
  getNationalTotals,
  getRegionalBreakdown
} from '../controllers/resultController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Get results (all authenticated users can view approved results)
router.get('/election/:electionId', authenticate, getResultsByElection);

// Get national totals for election (for broadcast dashboard)
router.get('/national/:electionId', authenticate, getNationalTotals);

// Get results by subregion (for regional breakdown panel)
router.get('/regional/:electionId', authenticate, getRegionalBreakdown);

// Pending results (Editor/Admin only)
router.get('/pending', authenticate, authorize('editor', 'admin'), getPendingResults);

// Create result (Operator/Editor/Admin)
router.post('/', authenticate, authorize('operator', 'editor', 'admin'), createResult);

// Submit for approval (Operator/Editor/Admin)
router.post('/:id/submit', authenticate, authorize('operator', 'editor', 'admin'), submitResultForApproval);

// Update result (Editor/Admin only - only draft/rejected results)
router.put('/:id', authenticate, authorize('editor', 'admin'), updateResult);

// Delete result (Admin only - only draft/rejected results)
router.delete('/:id', authenticate, authorize('admin'), deleteResult);

// Approve/Reject (Editor/Admin only)
router.post('/:id/approve', authenticate, authorize('editor', 'admin'), approveResult);
router.post('/:id/reject', authenticate, authorize('editor', 'admin'), rejectResult);

export default router;
