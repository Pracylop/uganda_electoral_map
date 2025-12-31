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

    // Get election info including type to determine result storage level
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      select: {
        year: true,
        electionType: {
          select: {
            code: true
          }
        }
      }
    });

    if (!election) {
      res.status(404).json({ error: 'Election not found' });
      return;
    }

    // Determine the level at which results are stored based on election type
    // Presidential (PRES): results at parish level (5), aggregate to any level
    // Constituency MP (CONST_MP): results at constituency level (3)
    // District Woman MP (WOMAN_MP): results at district level (2)
    const electionTypeCode = election.electionType?.code;
    const resultsStoredAtLevel = electionTypeCode === 'PRES' ? 5 :
                                  electionTypeCode === 'CONST_MP' ? 3 :
                                  electionTypeCode === 'WOMAN_MP' ? 2 : 5;

    // Build dynamic SQL based on target level and where results are stored
    let aggregatedResults: any[];

    // Case 1: Results are at or above target level - query directly without aggregation
    // This handles: Woman MP at district (2), Constituency MP at constituency (3), or parish-level target
    if (resultsStoredAtLevel <= targetLevel) {
      const whereClause: any = {
        electionId,
        status: 'approved',
        adminUnit: { level: resultsStoredAtLevel }
      };

      // Filter by parent if provided
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

    // Build GeoJSON features - iterate over ALL units, not just those with data
    // This ensures districts without results still appear (with gray color)
    const features: any[] = [];

    allUnits.forEach(u => {
      const geoData = geometryMap.get(u.id);
      if (!geoData) return;

      const geometry = geoData.geometry;
      const unit = unitMap.get(u.id);

      const props = {
        unitId: u.id,
        unitName: unit?.unitName || u.name,
        level: targetLevel,
        totalVotes: unit?.totalVotes || 0,
        winnerColor: unit?.winner?.partyColor || '#cccccc',
        winner: unit?.winner || null,
        candidates: unit?.candidates || [],
        inherited: unit?.inherited || false,
        inheritedFrom: unit?.inheritedFrom || null,
        noData: !unit
      };

      // Explode MultiPolygon into individual Polygon features for better rendering
      if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach((polygonCoords: any, idx: number) => {
          features.push({
            type: 'Feature',
            id: `${u.id}-${idx}`,
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
          id: u.id,
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

// Calculate election swing between two elections
export const getElectionSwing = async (req: Request, res: Response): Promise<void> => {
  try {
    const election1Id = parseInt(req.params.election1Id);
    const election2Id = parseInt(req.params.election2Id);
    const { level, parentId } = req.query;

    if (isNaN(election1Id) || isNaN(election2Id)) {
      res.status(400).json({ error: 'Invalid election IDs' });
      return;
    }

    const targetLevel = level ? parseInt(level as string) : 2;
    const parentIdNum = parentId ? parseInt(parentId as string) : null;

    // Get winner data for election 1
    const election1Winners = await getWinnersForElection(election1Id, targetLevel, parentIdNum);

    // Get winner data for election 2
    const election2Winners = await getWinnersForElection(election2Id, targetLevel, parentIdNum);

    // Get geometries for admin units
    const whereClause: any = { level: targetLevel };
    if (parentIdNum) {
      whereClause.parentId = parentIdNum;
    }

    const units = await prisma.administrativeUnit.findMany({
      where: whereClause,
      select: { id: true, name: true, code: true, geometry: true }
    });

    // Calculate bounding box
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

    // Build swing features
    const features = units
      .filter(unit => unit.geometry)
      .map((unit, index) => {
        const winner1 = election1Winners.get(unit.id);
        const winner2 = election2Winners.get(unit.id);

        let swingType = 'no_data';
        let swingColor = '#808080'; // Gray for no data
        let swingValue = 0;
        let swingParty = null;

        if (winner1 && winner2) {
          if (winner1.party !== winner2.party) {
            swingType = 'changed';
            // Color based on new winner
            swingColor = winner2.partyColor || '#ffffff';
            swingParty = winner2.party;
          } else {
            // Same winner - calculate vote share change
            swingValue = (winner2.votePercent || 0) - (winner1.votePercent || 0);
            swingType = swingValue > 0 ? 'gained' : swingValue < 0 ? 'lost' : 'stable';
            swingColor = winner2.partyColor || '#808080';
            swingParty = winner2.party;
          }
        } else if (winner2) {
          swingType = 'new';
          swingColor = winner2.partyColor || '#808080';
          swingParty = winner2.party;
        }

        // Parse geometry and update bounds
        let geometry;
        try {
          geometry = JSON.parse(unit.geometry!);
          updateBounds(geometry, (lng: number, lat: number) => {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          });
        } catch (e) {
          console.warn(`Invalid geometry for unit ${unit.id}`);
          return null;
        }

        return {
          type: 'Feature',
          id: index,
          properties: {
            unitId: unit.id,
            unitName: unit.name,
            level: targetLevel,
            // Election 1 data
            winner1Name: winner1?.name || null,
            winner1Party: winner1?.party || null,
            winner1Votes: winner1?.votes || 0,
            winner1Percent: winner1?.votePercent?.toFixed(1) || null,
            // Election 2 data
            winner2Name: winner2?.name || null,
            winner2Party: winner2?.party || null,
            winner2Votes: winner2?.votes || 0,
            winner2Percent: winner2?.votePercent?.toFixed(1) || null,
            // Swing data
            swingType,
            swingValue: swingValue.toFixed(1),
            swingParty,
            swingColor
          },
          geometry
        };
      })
      .filter(f => f !== null);

    const bbox = [minLng, minLat, maxLng, maxLat];

    res.json({
      type: 'FeatureCollection',
      features,
      bbox
    });

  } catch (error) {
    console.error('Get election swing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper: Get winners for each admin unit in an election
async function getWinnersForElection(
  electionId: number,
  targetLevel: number,
  parentId: number | null
): Promise<Map<number, { name: string; party: string; partyColor: string; votes: number; votePercent: number }>> {
  const parentFilter = parentId ? `AND target.parent_id = ${parentId}` : '';

  const query = `
    WITH vote_totals AS (
      SELECT
        target.id as unit_id,
        c.id as candidate_id,
        p.full_name as candidate_name,
        pp.abbreviation as party,
        pp.color as party_color,
        SUM(r.votes) as total_votes
      FROM results r
      JOIN administrative_units parish ON r.admin_unit_id = parish.id
      ${buildJoinChain(targetLevel).replace('JOIN administrative_units parish ON r.admin_unit_id = parish.id', '')}
      JOIN candidates c ON r.candidate_id = c.id
      JOIN persons p ON c.person_id = p.id
      LEFT JOIN political_parties pp ON c.party_id = pp.id
      WHERE r.election_id = ${electionId}
        AND r.status = 'approved'
        AND parish.level = 5
        ${parentFilter}
      GROUP BY target.id, c.id, p.full_name, pp.abbreviation, pp.color
    ),
    unit_totals AS (
      SELECT unit_id, SUM(total_votes) as all_votes
      FROM vote_totals
      GROUP BY unit_id
    ),
    ranked AS (
      SELECT
        vt.*,
        ut.all_votes,
        CASE WHEN ut.all_votes > 0 THEN (vt.total_votes::float / ut.all_votes * 100) ELSE 0 END as vote_percent,
        ROW_NUMBER() OVER (PARTITION BY vt.unit_id ORDER BY vt.total_votes DESC) as rn
      FROM vote_totals vt
      JOIN unit_totals ut ON vt.unit_id = ut.unit_id
    )
    SELECT unit_id, candidate_name, party, party_color, total_votes, vote_percent
    FROM ranked
    WHERE rn = 1
  `;

  const results = await prisma.$queryRawUnsafe<any[]>(query);

  const winnersMap = new Map();
  results.forEach(row => {
    winnersMap.set(row.unit_id, {
      name: row.candidate_name,
      party: row.party || 'IND',
      partyColor: row.party_color || '#808080',
      votes: Number(row.total_votes),
      votePercent: Number(row.vote_percent)
    });
  });

  return winnersMap;
}

// Helper: Update bounding box from geometry coordinates
function updateBounds(geometry: any, update: (lng: number, lat: number) => void) {
  if (!geometry) return;

  const processCoords = (coords: any[]) => {
    if (typeof coords[0] === 'number') {
      update(coords[0], coords[1]);
    } else {
      coords.forEach(c => processCoords(c));
    }
  };

  if (geometry.coordinates) {
    processCoords(geometry.coordinates);
  }
}

// Point-in-polygon lookup: Find admin unit containing given coordinates
export const getAdminUnitAtPoint = async (req: Request, res: Response): Promise<void> => {
  try {
    const lng = parseFloat(req.query.lng as string);
    const lat = parseFloat(req.query.lat as string);
    const level = req.query.level ? parseInt(req.query.level as string) : null;

    console.log('Point lookup request:', { lng, lat, level });

    if (isNaN(lng) || isNaN(lat)) {
      console.log('Point lookup: Invalid coordinates');
      res.status(400).json({ error: 'Invalid coordinates. Provide lng and lat as numbers.' });
      return;
    }

    // Validate coordinates are roughly within Uganda bounds
    if (lng < 29 || lng > 36 || lat < -2 || lat > 5) {
      console.log('Point lookup: Coordinates outside Uganda bounds');
      res.status(400).json({ error: 'Coordinates outside Uganda bounds' });
      return;
    }

    // Use raw SQL for point-in-polygon query since Prisma doesn't support ST_Contains
    // We check if the point is within any admin unit's geometry
    const levelFilter = level ? `AND level = ${level}` : '';

    const query = `
      SELECT
        id,
        name,
        code,
        level,
        parent_id as "parentId"
      FROM administrative_units
      WHERE geometry IS NOT NULL
        ${levelFilter}
        AND ST_Contains(
          ST_SetSRID(geometry::geometry, 4326),
          ST_SetSRID(ST_MakePoint($1, $2), 4326)
        )
      ORDER BY level DESC
      LIMIT 5
    `;

    console.log('Point lookup query:', query.replace(/\s+/g, ' ').trim());
    console.log('Point lookup params:', [lng, lat]);

    const results = await prisma.$queryRawUnsafe<any[]>(query, lng, lat);
    console.log('Point lookup results count:', results.length);

    if (results.length === 0) {
      res.status(404).json({
        error: 'No admin unit found at this location',
        coordinates: { lng, lat }
      });
      return;
    }

    // Return all matching units (from most specific to least)
    // Usually: parish -> subcounty -> constituency -> district -> subregion
    res.json({
      coordinates: { lng, lat },
      units: results.map(r => ({
        id: r.id,
        name: r.name,
        code: r.code,
        level: r.level,
        parentId: r.parentId
      })),
      // Convenience: most specific unit
      primary: {
        id: results[0].id,
        name: results[0].name,
        code: results[0].code,
        level: results[0].level,
        parentId: results[0].parentId
      }
    });

  } catch (error) {
    console.error('Point lookup error:', error);

    // Check if error is due to missing PostGIS extension
    const errorMessage = (error as Error).message || '';
    if (errorMessage.includes('ST_Contains') || errorMessage.includes('function st_')) {
      res.status(500).json({
        error: 'Spatial query not supported. PostGIS extension may not be installed.',
        fallback: 'Use boundary-based navigation instead.'
      });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
}
