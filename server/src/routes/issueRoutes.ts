import { Router } from 'express';
import {
  getIssues,
  getIssueById,
  getIssuesGeoJSON,
  getCategories,
  getIssueStats
} from '../controllers/issueController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get issue categories (public for filter UI)
router.get('/categories', authenticate, getCategories);

// Get issue statistics
router.get('/stats', authenticate, getIssueStats);

// Get issues as GeoJSON for map display
router.get('/geojson', authenticate, getIssuesGeoJSON);

// Get all issues with filters
router.get('/', authenticate, getIssues);

// Get single issue by ID
router.get('/:id', authenticate, getIssueById);

export default router;
