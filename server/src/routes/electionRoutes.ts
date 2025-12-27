import { Router } from 'express';
import {
  getAllElections,
  getActiveElection,
  getElectionById,
  createElection,
  updateElection,
  deleteElection,
  getCandidatesByElection
} from '../controllers/electionController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public routes (authenticated)
router.get('/', authenticate, getAllElections);
router.get('/active', authenticate, getActiveElection);
router.get('/:id', authenticate, getElectionById);
router.get('/:id/candidates', authenticate, getCandidatesByElection);

// Admin-only routes
router.post('/', authenticate, authorize('admin'), createElection);
router.put('/:id', authenticate, authorize('admin'), updateElection);
router.delete('/:id', authenticate, authorize('admin'), deleteElection);

export default router;
