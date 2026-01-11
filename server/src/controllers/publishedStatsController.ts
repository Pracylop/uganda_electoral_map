/**
 * Published Statistics Controller
 *
 * Serves official/published statistics from authoritative sources.
 * These are the "source of truth" for summary displays.
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get all published election summaries
 * GET /api/published/elections
 */
export const getPublishedElections = async (req: Request, res: Response) => {
  try {
    const summaries = await prisma.publishedElectionSummary.findMany({
      orderBy: { year: 'desc' },
      include: {
        candidateResults: {
          orderBy: { position: 'asc' },
          take: 5, // Top 5 candidates
        },
      },
    });

    res.json(summaries);
  } catch (error) {
    console.error('Error fetching published elections:', error);
    res.status(500).json({ error: 'Failed to fetch published elections' });
  }
};

/**
 * Get published election by year
 * GET /api/published/elections/:year
 */
export const getPublishedElectionByYear = async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year);
    const electionType = req.query.type as string || 'Presidential';

    const summary = await prisma.publishedElectionSummary.findUnique({
      where: {
        year_electionType: { year, electionType },
      },
      include: {
        candidateResults: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!summary) {
      return res.status(404).json({ error: 'Election not found' });
    }

    res.json(summary);
  } catch (error) {
    console.error('Error fetching published election:', error);
    res.status(500).json({ error: 'Failed to fetch published election' });
  }
};

/**
 * Get all published parliament summaries
 * GET /api/published/parliament
 */
export const getPublishedParliaments = async (req: Request, res: Response) => {
  try {
    const parliaments = await prisma.publishedParliamentSummary.findMany({
      orderBy: { year: 'desc' },
      include: {
        partySeats: {
          orderBy: { seats: 'desc' },
        },
      },
    });

    res.json(parliaments);
  } catch (error) {
    console.error('Error fetching published parliaments:', error);
    res.status(500).json({ error: 'Failed to fetch published parliaments' });
  }
};

/**
 * Get published parliament by year
 * GET /api/published/parliament/:year
 */
export const getPublishedParliamentByYear = async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year);

    const parliament = await prisma.publishedParliamentSummary.findUnique({
      where: { year },
      include: {
        partySeats: {
          orderBy: { seats: 'desc' },
        },
      },
    });

    if (!parliament) {
      return res.status(404).json({ error: 'Parliament not found' });
    }

    res.json(parliament);
  } catch (error) {
    console.error('Error fetching published parliament:', error);
    res.status(500).json({ error: 'Failed to fetch published parliament' });
  }
};

/**
 * Get women's representation trend
 * GET /api/published/women-representation
 */
export const getWomenRepresentation = async (req: Request, res: Response) => {
  try {
    const data = await prisma.publishedWomenRepresentation.findMany({
      orderBy: { year: 'asc' },
    });

    // Calculate trend
    const trend = data.map((item, index, arr) => {
      const prevItem = index > 0 ? arr[index - 1] : null;
      const change = prevItem
        ? Number(item.womenPercentage) - Number(prevItem.womenPercentage)
        : 0;

      return {
        ...item,
        womenPercentage: Number(item.womenPercentage),
        change: parseFloat(change.toFixed(2)),
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      };
    });

    res.json({
      data: trend,
      summary: {
        earliest: trend[0],
        latest: trend[trend.length - 1],
        peak: trend.reduce((max, item) =>
          Number(item.womenPercentage) > Number(max.womenPercentage) ? item : max,
          trend[0]
        ),
        totalGrowth: trend.length > 1
          ? parseFloat((Number(trend[trend.length - 1].womenPercentage) - Number(trend[0].womenPercentage)).toFixed(2))
          : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching women representation:', error);
    res.status(500).json({ error: 'Failed to fetch women representation' });
  }
};

/**
 * Get all published incident summaries
 * GET /api/published/incidents
 */
export const getPublishedIncidents = async (req: Request, res: Response) => {
  try {
    const incidents = await prisma.publishedIncidentSummary.findMany({
      orderBy: { year: 'desc' },
    });

    // Calculate totals
    const totals = incidents.reduce(
      (acc, item) => ({
        totalDeaths: acc.totalDeaths + (item.deathsReported || 0),
        totalInjuries: acc.totalInjuries + (item.injuriesReported || 0),
        totalArrests: acc.totalArrests + (item.arrestsReported || 0),
        totalPetitions: acc.totalPetitions + (item.petitionsFiled || 0),
        successfulPetitions: acc.successfulPetitions + (item.petitionsSuccessful || 0),
      }),
      { totalDeaths: 0, totalInjuries: 0, totalArrests: 0, totalPetitions: 0, successfulPetitions: 0 }
    );

    res.json({
      data: incidents,
      totals,
    });
  } catch (error) {
    console.error('Error fetching published incidents:', error);
    res.status(500).json({ error: 'Failed to fetch published incidents' });
  }
};

/**
 * Get published incident by year
 * GET /api/published/incidents/:year
 */
export const getPublishedIncidentByYear = async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year);

    const incident = await prisma.publishedIncidentSummary.findUnique({
      where: { year },
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident summary not found' });
    }

    res.json(incident);
  } catch (error) {
    console.error('Error fetching published incident:', error);
    res.status(500).json({ error: 'Failed to fetch published incident' });
  }
};

/**
 * Get LC chairpersons summaries
 * GET /api/published/lc-chairpersons
 */
export const getPublishedLCChairpersons = async (req: Request, res: Response) => {
  try {
    const level = req.query.level ? parseInt(req.query.level as string) : undefined;

    const chairpersons = await prisma.publishedLCChairpersons.findMany({
      where: level ? { level } : undefined,
      orderBy: [{ level: 'desc' }, { year: 'desc' }],
    });

    res.json(chairpersons);
  } catch (error) {
    console.error('Error fetching LC chairpersons:', error);
    res.status(500).json({ error: 'Failed to fetch LC chairpersons' });
  }
};

/**
 * Get comprehensive summary for a specific election year
 * GET /api/published/summary/:year
 */
export const getYearSummary = async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year);

    const [election, parliament, women, incidents, lcChairpersons] = await Promise.all([
      prisma.publishedElectionSummary.findUnique({
        where: { year_electionType: { year, electionType: 'Presidential' } },
        include: { candidateResults: { orderBy: { position: 'asc' }, take: 5 } },
      }),
      prisma.publishedParliamentSummary.findUnique({
        where: { year },
        include: { partySeats: { orderBy: { seats: 'desc' } } },
      }),
      prisma.publishedWomenRepresentation.findUnique({
        where: { year },
      }),
      prisma.publishedIncidentSummary.findUnique({
        where: { year },
      }),
      prisma.publishedLCChairpersons.findMany({
        where: { year },
      }),
    ]);

    res.json({
      year,
      election,
      parliament,
      womenRepresentation: women,
      incidents,
      lcChairpersons,
    });
  } catch (error) {
    console.error('Error fetching year summary:', error);
    res.status(500).json({ error: 'Failed to fetch year summary' });
  }
};

/**
 * Get available years with published data
 * GET /api/published/years
 */
export const getAvailableYears = async (req: Request, res: Response) => {
  try {
    const [elections, parliaments, incidents] = await Promise.all([
      prisma.publishedElectionSummary.findMany({
        select: { year: true },
        distinct: ['year'],
        orderBy: { year: 'desc' },
      }),
      prisma.publishedParliamentSummary.findMany({
        select: { year: true },
        orderBy: { year: 'desc' },
      }),
      prisma.publishedIncidentSummary.findMany({
        select: { year: true },
        orderBy: { year: 'desc' },
      }),
    ]);

    // Combine unique years
    const allYears = new Set([
      ...elections.map(e => e.year),
      ...parliaments.map(p => p.year),
      ...incidents.map(i => i.year),
    ]);

    const sortedYears = Array.from(allYears).sort((a, b) => b - a);

    res.json({
      years: sortedYears,
      hasElectionData: elections.map(e => e.year),
      hasParliamentData: parliaments.map(p => p.year),
      hasIncidentData: incidents.map(i => i.year),
    });
  } catch (error) {
    console.error('Error fetching available years:', error);
    res.status(500).json({ error: 'Failed to fetch available years' });
  }
};
