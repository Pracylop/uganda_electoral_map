import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getAdministrativeBoundaries,
  getElectionResultsMap,
  getAggregatedResults,
  getAdminUnitDetails,
  getParties,
  getNationalTotals,
  getElectionSwing
} from '../controllers/mapController';

const router = Router();

// All map routes require authentication
router.use(authenticate);

// GET /api/map/boundaries - Get administrative boundaries as GeoJSON
router.get('/boundaries', getAdministrativeBoundaries);

// GET /api/map/results/:electionId - Get election results with geographic data
router.get('/results/:electionId', getElectionResultsMap);

// GET /api/map/aggregated/:electionId - Get aggregated results with drill-down support
// Query params: level (1-5), parentId (optional)
router.get('/aggregated/:electionId', getAggregatedResults);

// GET /api/map/admin-unit/:unitId - Get admin unit details with parent chain for breadcrumb
router.get('/admin-unit/:unitId', getAdminUnitDetails);

// GET /api/map/parties - Get political parties with colors for legend
router.get('/parties', getParties);

// GET /api/map/national/:electionId - Get national totals for an election
router.get('/national/:electionId', getNationalTotals);

// GET /api/map/swing/:election1Id/:election2Id - Get swing analysis between two elections
// Query params: level (1-5), parentId (optional)
router.get('/swing/:election1Id/:election2Id', getElectionSwing);

export default router;
