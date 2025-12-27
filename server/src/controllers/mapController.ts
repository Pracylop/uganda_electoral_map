import { Request, Response } from 'express';
import prisma from '../config/database';

// Get administrative boundaries as GeoJSON
export const getAdministrativeBoundaries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { level } = req.query;

    const whereClause: any = {};
    if (level) {
      whereClause.level = parseInt(level as string);
    }

    const units = await prisma.administrativeUnit.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        geometry: true,
        registeredVoters: true
      }
    });

    // Convert to GeoJSON FeatureCollection
    const features = units
      .filter(unit => unit.geometry)
      .map(unit => ({
        type: 'Feature',
        id: unit.id,
        properties: {
          id: unit.id,
          name: unit.name,
          code: unit.code,
          level: unit.level,
          registeredVoters: unit.registeredVoters
        },
        geometry: JSON.parse(unit.geometry!)
      }));

    const geojson = {
      type: 'FeatureCollection',
      features
    };

    res.json(geojson);
  } catch (error) {
    console.error('Get boundaries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get election results with geographic data
export const getElectionResultsMap = async (req: Request, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.electionId);

    if (isNaN(electionId)) {
      res.status(400).json({ error: 'Invalid election ID' });
      return;
    }

    // Get all approved results for the election
    const results = await prisma.result.findMany({
      where: {
        electionId,
        status: 'approved'
      },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            party: true,
            partyColor: true
          }
        },
        administrativeUnit: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true,
            geometry: true,
            registeredVoters: true
          }
        }
      }
    });

    // Group results by administrative unit and find winner
    const unitResults: any = {};

    results.forEach(result => {
      const unitId = result.administrativeUnitId;

      if (!unitResults[unitId]) {
        unitResults[unitId] = {
          unit: result.administrativeUnit,
          candidates: [],
          totalVotes: 0,
          winner: null
        };
      }

      unitResults[unitId].candidates.push({
        id: result.candidate.id,
        name: result.candidate.name,
        party: result.candidate.party,
        partyColor: result.candidate.partyColor,
        votes: result.votes
      });

      unitResults[unitId].totalVotes += result.votes;

      // Determine winner
      if (!unitResults[unitId].winner || result.votes > unitResults[unitId].winner.votes) {
        unitResults[unitId].winner = {
          id: result.candidate.id,
          name: result.candidate.name,
          party: result.candidate.party,
          partyColor: result.candidate.partyColor,
          votes: result.votes
        };
      }
    });

    // Convert to GeoJSON with results
    const features = Object.values(unitResults)
      .filter((ur: any) => ur.unit.geometry)
      .map((ur: any) => ({
        type: 'Feature',
        id: ur.unit.id,
        properties: {
          unitId: ur.unit.id,
          unitName: ur.unit.name,
          unitCode: ur.unit.code,
          level: ur.unit.level,
          registeredVoters: ur.unit.registeredVoters,
          totalVotes: ur.totalVotes,
          turnout: ur.unit.registeredVoters
            ? ((ur.totalVotes / ur.unit.registeredVoters) * 100).toFixed(2)
            : null,
          winner: ur.winner,
          candidates: ur.candidates
        },
        geometry: JSON.parse(ur.unit.geometry)
      }));

    const geojson = {
      type: 'FeatureCollection',
      features
    };

    res.json(geojson);
  } catch (error) {
    console.error('Get election results map error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
