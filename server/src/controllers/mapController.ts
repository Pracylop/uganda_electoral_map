import { Request, Response } from 'express';
import prisma from '../config/database';

// Get administrative boundaries as GeoJSON
export const getAdministrativeBoundaries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { level, parentId } = req.query;

    const whereClause: any = {};
    if (level) {
      whereClause.level = parseInt(level as string);
    }
    if (parentId) {
      whereClause.parentId = parseInt(parentId as string);
    }

    // Fetch in batches to avoid memory issues
    const units = await prisma.administrativeUnit.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        geometry: true,
        registeredVoters: true
      },
      take: 500 // Limit for performance
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

// Get election results with geographic data for choropleth map
export const getElectionResultsMap = async (req: Request, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.electionId);
    const { level } = req.query;

    if (isNaN(electionId)) {
      res.status(400).json({ error: 'Invalid election ID' });
      return;
    }

    // Default to district level (2) for better performance
    const adminLevel = level ? parseInt(level as string) : 2;

    // Step 1: Get results WITHOUT geometry (to avoid large string issues)
    const results = await prisma.result.findMany({
      where: {
        electionId,
        status: 'approved',
        adminUnit: {
          level: adminLevel
        }
      },
      select: {
        adminUnitId: true,
        candidateId: true,
        votes: true,
        votePercent: true,
        candidate: {
          select: {
            id: true,
            person: { select: { fullName: true } },
            party: { select: { abbreviation: true, color: true } }
          }
        },
        adminUnit: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true,
            registeredVoters: true
          }
        }
      }
    });

    // Step 2: Group results by admin unit
    const unitResults: Map<number, any> = new Map();

    results.forEach(result => {
      const unitId = result.adminUnitId;
      const candidateName = result.candidate.person.fullName;
      const partyAbbr = result.candidate.party?.abbreviation || 'IND';
      const partyColor = result.candidate.party?.color || '#808080';

      if (!unitResults.has(unitId)) {
        unitResults.set(unitId, {
          unit: result.adminUnit,
          candidates: [],
          totalVotes: 0,
          winner: null
        });
      }

      const unitData = unitResults.get(unitId)!;
      unitData.totalVotes += result.votes;

      unitData.candidates.push({
        id: result.candidateId,
        name: candidateName,
        party: partyAbbr,
        partyColor: partyColor,
        votes: result.votes,
        votePercent: result.votePercent ? Number(result.votePercent) : null
      });

      // Determine winner (highest votes)
      if (!unitData.winner || result.votes > unitData.winner.votes) {
        unitData.winner = {
          id: result.candidateId,
          name: candidateName,
          party: partyAbbr,
          partyColor: partyColor,
          votes: result.votes
        };
      }
    });

    // Step 3: Get geometry for admin units (in batches if needed)
    const adminUnitIds = Array.from(unitResults.keys());

    // Fetch geometry in batches of 100
    const geometryMap = new Map<number, string>();
    const batchSize = 100;

    for (let i = 0; i < adminUnitIds.length; i += batchSize) {
      const batchIds = adminUnitIds.slice(i, i + batchSize);
      const geometries = await prisma.administrativeUnit.findMany({
        where: { id: { in: batchIds } },
        select: { id: true, geometry: true }
      });

      geometries.forEach(g => {
        if (g.geometry) {
          geometryMap.set(g.id, g.geometry);
        }
      });
    }

    // Step 4: Build GeoJSON features
    const features: any[] = [];

    unitResults.forEach((ur, unitId) => {
      const geometry = geometryMap.get(unitId);
      if (!geometry) return;

      features.push({
        type: 'Feature',
        id: ur.unit.id,
        properties: {
          unitId: ur.unit.id,
          unitName: ur.unit.name,
          unitCode: ur.unit.code,
          level: ur.unit.level,
          registeredVoters: ur.unit.registeredVoters,
          totalVotes: ur.totalVotes,
          winner: ur.winner,
          candidates: ur.candidates.sort((a: any, b: any) => b.votes - a.votes)
        },
        geometry: JSON.parse(geometry)
      });
    });

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

// Helper function to calculate bounding box from GeoJSON features
function calculateBbox(features: any[]): [number, number, number, number] | null {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

  const processCoords = (coords: any) => {
    if (typeof coords[0] === 'number') {
      // This is a coordinate pair [lng, lat]
      minLng = Math.min(minLng, coords[0]);
      maxLng = Math.max(maxLng, coords[0]);
      minLat = Math.min(minLat, coords[1]);
      maxLat = Math.max(maxLat, coords[1]);
    } else {
      // This is an array of coordinates
      coords.forEach(processCoords);
    }
  };

  features.forEach(f => {
    if (f.geometry?.coordinates) {
      processCoords(f.geometry.coordinates);
    }
  });

  if (minLng === Infinity) return null;
  return [minLng, minLat, maxLng, maxLat];
}

// Get aggregated results with dynamic level support for drill-down
export const getAggregatedResults = async (req: Request, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.electionId);
    const targetLevel = parseInt(req.query.level as string) || 2; // Default to District (subregions lack geometry)
    const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : null;

    if (isNaN(electionId)) {
      res.status(400).json({ error: 'Invalid election ID' });
      return;
    }

    // Validate level (1=Subregion, 2=District, 3=Constituency, 4=Subcounty, 5=Parish)
    if (targetLevel < 1 || targetLevel > 5) {
      res.status(400).json({ error: 'Level must be between 1 and 5' });
      return;
    }

    // Get election year for district history inheritance
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      select: { year: true }
    });

    if (!election) {
      res.status(404).json({ error: 'Election not found' });
      return;
    }

    // Build dynamic SQL based on target level
    // We always aggregate from parish level (5) up to the target level
    let aggregatedResults: any[];

    if (targetLevel === 5) {
      // Parish level - no aggregation needed, just get results directly
      const whereClause: any = {
        electionId,
        status: 'approved',
        adminUnit: { level: 5 }
      };

      // Filter by parent (subcounty) if provided
      if (parentId) {
        whereClause.adminUnit.parentId = parentId;
      }

      const results = await prisma.result.findMany({
        where: whereClause,
        select: {
          adminUnitId: true,
          candidateId: true,
          votes: true,
          candidate: {
            select: {
              id: true,
              person: { select: { fullName: true } },
              party: { select: { abbreviation: true, color: true } }
            }
          },
          adminUnit: {
            select: { id: true, name: true }
          }
        }
      });

      aggregatedResults = results.map(r => ({
        unit_id: r.adminUnitId,
        unit_name: r.adminUnit.name,
        candidate_id: r.candidateId,
        candidate_name: r.candidate.person.fullName,
        party: r.candidate.party?.abbreviation || null,
        party_color: r.candidate.party?.color || null,
        total_votes: BigInt(r.votes)
      }));
    } else {
      // For levels 1-4, we need to aggregate from parish level
      // Build the join chain dynamically based on target level
      const joinChain = buildJoinChain(targetLevel);
      const parentFilter = parentId ? `AND target.parent_id = ${parentId}` : '';

      const query = `
        SELECT
          target.id as unit_id,
          target.name as unit_name,
          c.id as candidate_id,
          p.full_name as candidate_name,
          pp.abbreviation as party,
          pp.color as party_color,
          SUM(r.votes) as total_votes
        FROM results r
        ${joinChain}
        JOIN candidates c ON r.candidate_id = c.id
        JOIN persons p ON c.person_id = p.id
        LEFT JOIN political_parties pp ON c.party_id = pp.id
        WHERE r.election_id = ${electionId}
          AND r.status = 'approved'
          AND parish.level = 5
          ${parentFilter}
        GROUP BY target.id, target.name, c.id, p.full_name, pp.abbreviation, pp.color
        ORDER BY target.name, total_votes DESC
      `;

      aggregatedResults = await prisma.$queryRawUnsafe<any[]>(query);
    }

    // Group by admin unit
    const unitMap = new Map<number, any>();

    aggregatedResults.forEach(row => {
      const unitId = row.unit_id;

      if (!unitMap.has(unitId)) {
        unitMap.set(unitId, {
          unitId,
          unitName: row.unit_name,
          candidates: [],
          totalVotes: 0,
          winner: null,
          inherited: false
        });
      }

      const unit = unitMap.get(unitId)!;
      const votes = Number(row.total_votes);

      unit.candidates.push({
        id: row.candidate_id,
        name: row.candidate_name,
        party: row.party || 'IND',
        partyColor: row.party_color || '#808080',
        votes
      });

      unit.totalVotes += votes;

      if (!unit.winner || votes > unit.winner.votes) {
        unit.winner = {
          id: row.candidate_id,
          name: row.candidate_name,
          party: row.party || 'IND',
          partyColor: row.party_color || '#808080',
          votes
        };
      }
    });

    // Get admin units and their geometries
    const whereClause: any = { level: targetLevel };
    if (parentId) {
      whereClause.parentId = parentId;
    }

    const allUnits = await prisma.administrativeUnit.findMany({
      where: whereClause,
      select: { id: true, name: true, geometry: true }
    });

    // Handle inheritance for district level (level 2) only
    if (targetLevel === 2 && !parentId) {
      const districtHistory = await prisma.districtHistory.findMany({
        select: {
          currentDistrictId: true,
          parentDistrictId: true,
          splitYear: true
        }
      });

      const inheritanceMap = new Map<number, { parentId: number; splitYear: number }>();
      districtHistory.forEach(h => {
        inheritanceMap.set(h.currentDistrictId, { parentId: h.parentDistrictId, splitYear: h.splitYear });
      });

      allUnits.forEach(d => {
        if (!unitMap.has(d.id)) {
          const historyEntry = inheritanceMap.get(d.id);
          if (historyEntry && unitMap.has(historyEntry.parentId)) {
            const parentData = unitMap.get(historyEntry.parentId)!;
            unitMap.set(d.id, {
              unitId: d.id,
              unitName: d.name,
              candidates: parentData.candidates,
              totalVotes: parentData.totalVotes,
              winner: parentData.winner,
              inherited: true,
              inheritedFrom: parentData.unitName
            });
          }
        }
      });
    }

    // Build geometry map
    const geometryMap = new Map<number, any>();
    allUnits.forEach(u => {
      if (u.geometry) {
        try {
          geometryMap.set(u.id, { geometry: JSON.parse(u.geometry), name: u.name });
        } catch (e) {
          console.error('Error parsing geometry for', u.id, e);
        }
      }
    });

    // Build GeoJSON features
    const features: any[] = [];

    unitMap.forEach((unit, unitId) => {
      const geoData = geometryMap.get(unitId);
      if (!geoData) return;

      const geometry = geoData.geometry;

      const props = {
        unitId: unitId,
        unitName: unit.unitName,
        level: targetLevel,
        totalVotes: unit.totalVotes,
        winnerColor: unit.winner?.partyColor || '#cccccc',
        winner: unit.winner,
        candidates: unit.candidates,
        inherited: unit.inherited || false,
        inheritedFrom: unit.inheritedFrom || null
      };

      // Explode MultiPolygon into individual Polygon features for better rendering
      if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach((polygonCoords: any, idx: number) => {
          features.push({
            type: 'Feature',
            id: `${unitId}-${idx}`,
            properties: props,
            geometry: {
              type: 'Polygon',
              coordinates: polygonCoords
            }
          });
        });
      } else {
        features.push({
          type: 'Feature',
          id: unitId,
          properties: props,
          geometry: geometry
        });
      }
    });

    // Calculate bounding box for zoom-to-fit
    const bbox = calculateBbox(features);

    res.json({
      type: 'FeatureCollection',
      features,
      bbox,
      metadata: {
        level: targetLevel,
        parentId: parentId,
        unitCount: unitMap.size
      }
    });

  } catch (error) {
    console.error('Get aggregated results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper to build join chain for aggregation at different levels
function buildJoinChain(targetLevel: number): string {
  // Level hierarchy: 1=Subregion, 2=District, 3=Constituency, 4=Subcounty, 5=Parish
  // Results are stored at parish level (5), we join up to target level
  // The target level gets alias "target" for consistent SQL

  switch (targetLevel) {
    case 1: // Subregion
      return `
        JOIN administrative_units parish ON r.admin_unit_id = parish.id
        JOIN administrative_units subcounty ON parish.parent_id = subcounty.id
        JOIN administrative_units constituency ON subcounty.parent_id = constituency.id
        JOIN administrative_units district ON constituency.parent_id = district.id
        JOIN administrative_units target ON district.parent_id = target.id
      `;
    case 2: // District
      return `
        JOIN administrative_units parish ON r.admin_unit_id = parish.id
        JOIN administrative_units subcounty ON parish.parent_id = subcounty.id
        JOIN administrative_units constituency ON subcounty.parent_id = constituency.id
        JOIN administrative_units target ON constituency.parent_id = target.id
      `;
    case 3: // Constituency
      return `
        JOIN administrative_units parish ON r.admin_unit_id = parish.id
        JOIN administrative_units subcounty ON parish.parent_id = subcounty.id
        JOIN administrative_units target ON subcounty.parent_id = target.id
      `;
    case 4: // Subcounty
      return `
        JOIN administrative_units parish ON r.admin_unit_id = parish.id
        JOIN administrative_units target ON parish.parent_id = target.id
      `;
    default:
      return 'JOIN administrative_units target ON r.admin_unit_id = target.id';
  }
}

// Get admin unit details with parent chain for breadcrumb navigation
export const getAdminUnitDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const unitId = parseInt(req.params.unitId);

    if (isNaN(unitId)) {
      res.status(400).json({ error: 'Invalid unit ID' });
      return;
    }

    // Get the unit with parent chain (up to 5 levels deep)
    const unit = await prisma.administrativeUnit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        name: true,
        level: true,
        parent: {
          select: {
            id: true,
            name: true,
            level: true,
            parent: {
              select: {
                id: true,
                name: true,
                level: true,
                parent: {
                  select: {
                    id: true,
                    name: true,
                    level: true,
                    parent: {
                      select: {
                        id: true,
                        name: true,
                        level: true,
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!unit) {
      res.status(404).json({ error: 'Admin unit not found' });
      return;
    }

    // Build breadcrumb array from parent chain
    const breadcrumb: Array<{ id: number; name: string; level: number }> = [];

    // Walk up the parent chain
    let current: any = unit;
    while (current) {
      breadcrumb.unshift({
        id: current.id,
        name: current.name,
        level: current.level
      });
      current = current.parent;
    }

    res.json({
      unit: {
        id: unit.id,
        name: unit.name,
        level: unit.level
      },
      breadcrumb
    });
  } catch (error) {
    console.error('Get admin unit details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get political parties with colors for legend
export const getParties = async (req: Request, res: Response): Promise<void> => {
  try {
    const parties = await prisma.politicalParty.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        abbreviation: true,
        color: true,
        logoUrl: true
      },
      orderBy: { name: 'asc' }
    });

    res.json(parties);
  } catch (error) {
    console.error('Get parties error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get national totals for an election
export const getNationalTotals = async (req: Request, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.electionId);

    if (isNaN(electionId)) {
      res.status(400).json({ error: 'Invalid election ID' });
      return;
    }

    // Get election info
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        electionType: true
      }
    });

    if (!election) {
      res.status(404).json({ error: 'Election not found' });
      return;
    }

    // Aggregate all approved results by candidate
    const candidateTotals = await prisma.result.groupBy({
      by: ['candidateId'],
      where: {
        electionId,
        status: 'approved'
      },
      _sum: {
        votes: true
      }
    });

    // Get candidate details
    const candidates = await prisma.candidate.findMany({
      where: {
        electionId
      },
      include: {
        person: { select: { fullName: true } },
        party: { select: { name: true, abbreviation: true, color: true } }
      }
    });

    // Get total summaries
    const summaryTotals = await prisma.electionSummary.aggregate({
      where: {
        electionId,
        status: 'approved'
      },
      _sum: {
        registeredVoters: true,
        totalVotes: true,
        validVotes: true,
        invalidVotes: true
      },
      _count: true
    });

    // Build response
    const candidateResults = candidateTotals.map(ct => {
      const candidate = candidates.find(c => c.id === ct.candidateId);
      return {
        candidateId: ct.candidateId,
        name: candidate?.person.fullName || 'Unknown',
        party: candidate?.party?.abbreviation || 'IND',
        partyName: candidate?.party?.name || 'Independent',
        partyColor: candidate?.party?.color || '#808080',
        votes: ct._sum.votes || 0
      };
    }).sort((a, b) => b.votes - a.votes);

    const totalVotes = candidateResults.reduce((sum, c) => sum + c.votes, 0);

    // Add percentages
    const candidatesWithPercent = candidateResults.map(c => ({
      ...c,
      percentage: totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(2) : '0.00'
    }));

    res.json({
      election: {
        id: election.id,
        name: election.name,
        year: election.year,
        type: election.electionType.name
      },
      summary: {
        registeredVoters: summaryTotals._sum.registeredVoters || 0,
        totalVotes: summaryTotals._sum.totalVotes || 0,
        validVotes: summaryTotals._sum.validVotes || 0,
        invalidVotes: summaryTotals._sum.invalidVotes || 0,
        reportingUnits: summaryTotals._count,
        turnout: summaryTotals._sum.registeredVoters
          ? ((summaryTotals._sum.totalVotes || 0) / summaryTotals._sum.registeredVoters * 100).toFixed(2)
          : null
      },
      candidates: candidatesWithPercent,
      leader: candidatesWithPercent[0] || null
    });

  } catch (error) {
    console.error('Get national totals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
