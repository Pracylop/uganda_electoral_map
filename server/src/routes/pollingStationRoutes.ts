import { Router } from 'express';
import {
  getPollingStations,
  getPollingStationById,
  getPollingStationsGeoJSON,
  getPollingStationStats
} from '../controllers/pollingStationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get polling station statistics
router.get('/stats', authenticate, getPollingStationStats);

// Get polling stations as GeoJSON for map display
router.get('/geojson', authenticate, getPollingStationsGeoJSON);

// Get all polling stations with filters
router.get('/', authenticate, getPollingStations);

// Get single polling station by ID
router.get('/:id', authenticate, getPollingStationById);

export default router;
