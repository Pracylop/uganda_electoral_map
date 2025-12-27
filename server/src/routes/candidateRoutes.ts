import { Router } from 'express';
import {
  createCandidate,
  updateCandidate,
  deleteCandidate
} from '../controllers/candidateController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Editor/Admin routes
router.post('/', authenticate, authorize('editor', 'admin'), createCandidate);
router.put('/:id', authenticate, authorize('editor', 'admin'), updateCandidate);

// Admin-only routes
router.delete('/:id', authenticate, authorize('admin'), deleteCandidate);

export default router;
