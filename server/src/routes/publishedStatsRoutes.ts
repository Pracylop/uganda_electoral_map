/**
 * Published Statistics Routes
 *
 * Serves official/published statistics from authoritative sources.
 */

import { Router } from 'express';
import {
  getPublishedElections,
  getPublishedElectionByYear,
  getPublishedParliaments,
  getPublishedParliamentByYear,
  getWomenRepresentation,
  getPublishedIncidents,
  getPublishedIncidentByYear,
  getPublishedLCChairpersons,
  getYearSummary,
  getAvailableYears,
} from '../controllers/publishedStatsController';

const router = Router();

// Available years
router.get('/years', getAvailableYears);

// Election summaries
router.get('/elections', getPublishedElections);
router.get('/elections/:year', getPublishedElectionByYear);

// Parliament summaries
router.get('/parliament', getPublishedParliaments);
router.get('/parliament/:year', getPublishedParliamentByYear);

// Women's representation
router.get('/women-representation', getWomenRepresentation);

// Incident summaries
router.get('/incidents', getPublishedIncidents);
router.get('/incidents/:year', getPublishedIncidentByYear);

// LC Chairpersons
router.get('/lc-chairpersons', getPublishedLCChairpersons);

// Comprehensive year summary
router.get('/summary/:year', getYearSummary);

export default router;
