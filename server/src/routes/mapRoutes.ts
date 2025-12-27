import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getAdministrativeBoundaries,
  getElectionResultsMap
} from '../controllers/mapController';

const router = Router();

// All map routes require authentication
router.use(authenticate);

// GET /api/map/boundaries - Get administrative boundaries as GeoJSON
router.get('/boundaries', getAdministrativeBoundaries);

// GET /api/map/results/:electionId - Get election results with geographic data
router.get('/results/:electionId', getElectionResultsMap);

export default router;
