/**
 * Boundary Routes
 *
 * Endpoints for administrative boundary geometries only (no data).
 * Part of the boundary/data separation architecture.
 *
 * See: Documentation/Boundary_Data_Separation.md
 */

import { Router } from 'express';
import { getBoundaries } from '../controllers/boundaryController';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/boundaries?level=2 - Get admin boundaries for a level
router.get('/', authenticate, getBoundaries);

export default router;
