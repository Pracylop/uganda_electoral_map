import { Router } from 'express';
import {
  getDemographicsStats,
  getDemographicsByUnit,
  getDemographicsGeoJSON,
} from '../controllers/demographicsController';
import { getDemographicsData } from '../controllers/boundaryController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get national demographics statistics with district breakdown
router.get('/stats', authenticate, getDemographicsStats);

// Get demographics as GeoJSON for map display
router.get('/geojson', authenticate, getDemographicsGeoJSON);

// Get demographics data only (no geometry) - for boundary/data separation
router.get('/data', authenticate, getDemographicsData);

// Get demographics for a specific administrative unit
router.get('/:adminUnitId', authenticate, getDemographicsByUnit);

export default router;
