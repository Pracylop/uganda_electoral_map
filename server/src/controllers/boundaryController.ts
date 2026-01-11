/**
 * Boundary Controller
 *
 * Provides endpoints for administrative boundary geometries ONLY.
 * Data (election results, demographics, incidents) is fetched separately
 * and joined client-side for optimal memory usage.
 *
 * See: Documentation/Boundary_Data_Separation.md
 */

import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clean geometry by removing empty coordinate arrays at any depth.
 * This fixes issues where MultiPolygon geometries have empty rings.
 */
function cleanGeometry(geom: any): any {
  if (!geom || !geom.type || !geom.coordinates) return null;

  if (geom.type === 'MultiPolygon') {
    const cleanedPolygons = geom.coordinates
      .filter((polygon: any) => {
        if (!Array.isArray(polygon) || polygon.length === 0) return false;
        const outerRing = polygon[0];
        if (!Array.isArray(outerRing) || outerRing.length === 0) return false;
        if (!Array.isArray(outerRing[0]) || outerRing[0].length < 2) return false;
        return true;
      })
      .map((polygon: any) => polygon.filter((ring: any) =>
        Array.isArray(ring) && ring.length > 0 &&
        Array.isArray(ring[0]) && ring[0].length >= 2
      ))
      .filter((polygon: any) => polygon.length > 0);

    if (cleanedPolygons.length === 0) return null;
    return { type: 'MultiPolygon', coordinates: cleanedPolygons };
  }

  if (geom.type === 'Polygon') {
    const cleanedRings = geom.coordinates.filter((ring: any) =>
      Array.isArray(ring) && ring.length > 0 &&
      Array.isArray(ring[0]) && ring[0].length >= 2
    );
    if (cleanedRings.length === 0) return null;
    return { type: 'Polygon', coordinates: cleanedRings };
  }

  if (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0) return null;
  return geom;
}

/**
 * Get administrative boundaries (geometry only, no data)
 * GET /api/boundaries
 *
 * Query params:
 *   level: Admin level (2=District, 3=Constituency, 4=Subcounty, 5=Parish)
 *   parentId: Optional - filter to children of this parent unit
 *
 * Response: GeoJSON FeatureCollection with properties:
 *   - unitId: number
 *   - name: string
 *   - code: string (if available)
 *   - level: number
 *   - parentId: number | null
 *   - geometry: MultiPolygon/Polygon
 */
export async function getBoundaries(req: Request, res: Response) {
  try {
    const level = parseInt(req.query.level as string);
    const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : null;

    if (isNaN(level) || level < 2 || level > 5) {
      return res.status(400).json({
        error: 'Invalid level parameter. Must be 2 (District), 3 (Constituency), 4 (Subcounty), or 5 (Parish)'
      });
    }

    console.log(`Boundaries: level=${level}, parentId=${parentId}`);
    const startTime = Date.now();

    // Build query
    const whereClause: any = {
      level,
      geometry: { not: null }
    };

    if (parentId !== null) {
      whereClause.parentId = parentId;
    }

    // Fetch admin units with geometry
    const adminUnits = await prisma.administrativeUnit.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        parentId: true,
        geometry: true
      },
      orderBy: { name: 'asc' }
    });

    console.log(`  Fetched ${adminUnits.length} units in ${Date.now() - startTime}ms`);

    // Convert to GeoJSON features
    const features: any[] = [];
    let skipped = 0;

    for (const unit of adminUnits) {
      let geometry = null;
      try {
        const parsed = unit.geometry ? JSON.parse(unit.geometry) : null;
        geometry = cleanGeometry(parsed);
      } catch (e) {
        skipped++;
        continue;
      }

      if (!geometry) {
        skipped++;
        continue;
      }

      features.push({
        type: 'Feature',
        properties: {
          unitId: unit.id,
          name: unit.name,
          code: unit.code || null,
          level: unit.level,
          parentId: unit.parentId,
        },
        geometry,
      });
    }

    console.log(`  Total time: ${Date.now() - startTime}ms, features: ${features.length}, skipped: ${skipped}`);

    // Return GeoJSON FeatureCollection
    res.json({
      type: 'FeatureCollection',
      metadata: {
        level,
        parentId,
        count: features.length,
        generatedAt: new Date().toISOString(),
      },
      features,
    });
  } catch (error) {
    console.error('Error fetching boundaries:', error);
    res.status(500).json({ error: 'Failed to fetch boundaries' });
  }
}

/**
 * Get demographics data only (no geometry)
 * GET /api/demographics/data
 *
 * Query params:
 *   level: Admin level (2-5)
 *   parentId: Optional - filter to children of this parent unit
 *   censusYear: Optional - defaults to 2024
 *
 * Response: Array of demographic records with unitId for client-side join
 */
export async function getDemographicsData(req: Request, res: Response) {
  try {
    const level = parseInt(req.query.level as string);
    const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : null;
    const censusYear = parseInt(req.query.censusYear as string) || 2024;

    if (isNaN(level) || level < 2 || level > 5) {
      return res.status(400).json({
        error: 'Invalid level parameter. Must be 2-5'
      });
    }

    console.log(`Demographics data: level=${level}, parentId=${parentId}, censusYear=${censusYear}`);
    const startTime = Date.now();

    // Get pre-aggregated demographics
    const whereClause: any = {
      level,
      censusYear
    };

    const aggregates = await prisma.demographicsAggregate.findMany({
      where: whereClause,
      select: {
        adminUnitId: true,
        totalPopulation: true,
        malePopulation: true,
        femalePopulation: true,
        votingAgePopulation: true,
        youthPopulation: true,
        elderlyPopulation: true,
        numberOfHouseholds: true,
        parishCount: true,
      }
    });

    // If parentId specified, filter to units that belong to that parent
    let filteredData = aggregates;
    if (parentId !== null) {
      // Get the list of unit IDs that have this parent
      const childUnits = await prisma.administrativeUnit.findMany({
        where: {
          level,
          parentId
        },
        select: { id: true }
      });
      const childIds = new Set(childUnits.map(u => u.id));
      filteredData = aggregates.filter(a => childIds.has(a.adminUnitId));
    }

    // Also get unit names for convenience
    const unitIds = filteredData.map(a => a.adminUnitId);
    const units = await prisma.administrativeUnit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, name: true, parentId: true }
    });
    const unitMap = new Map(units.map(u => [u.id, u]));

    // Build response data
    const data = filteredData.map(a => {
      const unit = unitMap.get(a.adminUnitId);
      const totalPop = a.totalPopulation || 0;
      const votingAgePop = a.votingAgePopulation || 0;
      const malePop = a.malePopulation || 0;

      return {
        unitId: a.adminUnitId,
        unitName: unit?.name || 'Unknown',
        parentId: unit?.parentId || null,
        totalPopulation: totalPop,
        malePopulation: malePop,
        femalePopulation: a.femalePopulation || 0,
        votingAgePopulation: votingAgePop,
        youthPopulation: a.youthPopulation || 0,
        elderlyPopulation: a.elderlyPopulation || 0,
        numberOfHouseholds: a.numberOfHouseholds || 0,
        parishCount: a.parishCount || 0,
        votingAgePercent: totalPop > 0 ? Math.round((votingAgePop / totalPop) * 1000) / 10 : 0,
        malePercent: totalPop > 0 ? Math.round((malePop / totalPop) * 1000) / 10 : 0,
      };
    });

    console.log(`  Total time: ${Date.now() - startTime}ms, records: ${data.length}`);

    res.json({
      level,
      parentId,
      censusYear,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('Error fetching demographics data:', error);
    res.status(500).json({ error: 'Failed to fetch demographics data' });
  }
}

/**
 * Get election results data only (no geometry)
 * GET /api/elections/:electionId/results
 *
 * Path params:
 *   electionId: Election ID
 *
 * Query params:
 *   level: Admin level (2-5)
 *   parentId: Optional - filter to children of this parent unit
 *
 * Response: Array of election results with unitId for client-side join
 */
export async function getElectionResultsData(req: Request, res: Response) {
  try {
    const electionId = parseInt(req.params.id);
    const level = parseInt(req.query.level as string) || 2;
    const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : null;

    if (isNaN(electionId)) {
      return res.status(400).json({ error: 'Invalid election ID' });
    }

    console.log(`Election results data: electionId=${electionId}, level=${level}, parentId=${parentId}`);
    const startTime = Date.now();

    // Get election info
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      select: {
        id: true,
        name: true,
        year: true,
        electionType: { select: { code: true, name: true } }
      }
    });

    if (!election) {
      return res.status(404).json({ error: 'Election not found' });
    }

    // Get all parties for color mapping
    const parties = await prisma.politicalParty.findMany({
      select: { id: true, name: true, abbreviation: true, color: true }
    });
    const partyMap = new Map(parties.map(p => [p.id, p]));

    // Determine result storage level based on election type
    const electionTypeCode = election.electionType?.code;
    const resultsStoredAtLevel = electionTypeCode === 'PRES' ? 5 :
                                  electionTypeCode === 'CONST_MP' ? 3 :
                                  electionTypeCode === 'WOMAN_MP' ? 2 : 5;

    // Get admin units at target level
    const whereClause: any = { level };
    if (parentId !== null) {
      whereClause.parentId = parentId;
    }

    const adminUnits = await prisma.administrativeUnit.findMany({
      where: whereClause,
      select: { id: true, name: true, parentId: true }
    });

    // Aggregate results
    let data: any[] = [];

    if (resultsStoredAtLevel <= level) {
      // Results are at or above target level - direct query
      const results = await prisma.result.findMany({
        where: {
          electionId,
          adminUnit: { level }
        },
        include: {
          adminUnit: { select: { id: true, name: true, parentId: true } },
          candidate: {
            select: {
              id: true,
              person: { select: { fullName: true } },
              partyId: true
            }
          }
        }
      });

      // Group by admin unit
      const resultsByUnit = new Map<number, typeof results>();
      for (const r of results) {
        const unitId = r.adminUnitId;
        if (!resultsByUnit.has(unitId)) {
          resultsByUnit.set(unitId, []);
        }
        resultsByUnit.get(unitId)!.push(r);
      }

      // Build data for each admin unit
      for (const unit of adminUnits) {
        const unitResults = resultsByUnit.get(unit.id) || [];

        if (unitResults.length === 0) {
          data.push({
            unitId: unit.id,
            unitName: unit.name,
            parentId: unit.parentId,
            totalVotes: 0,
            noData: true,
            candidates: []
          });
          continue;
        }

        // Calculate totals and find winner
        let totalVotes = 0;
        const candidates: any[] = [];
        let winner = { votes: 0, name: '', color: '#999' };

        for (const r of unitResults) {
          const party = partyMap.get(r.candidate.partyId || 0);
          const candidateData = {
            candidateId: r.candidateId,
            name: r.candidate.person?.fullName || 'Unknown',
            partyId: r.candidate.partyId,
            partyName: party?.abbreviation || party?.name || 'IND',
            partyColor: party?.color || '#999',
            votes: r.votes
          };
          candidates.push(candidateData);
          totalVotes += r.votes;

          if (r.votes > winner.votes) {
            winner = {
              votes: r.votes,
              name: candidateData.partyName,
              color: candidateData.partyColor
            };
          }
        }

        // Sort candidates by votes
        candidates.sort((a, b) => b.votes - a.votes);

        data.push({
          unitId: unit.id,
          unitName: unit.name,
          parentId: unit.parentId,
          totalVotes,
          winner: winner.name,
          winnerVotes: winner.votes,
          winnerColor: winner.color,
          margin: totalVotes > 0 ? Math.round((winner.votes / totalVotes - (candidates[1]?.votes || 0) / totalVotes) * 100) / 100 : 0,
          candidates
        });
      }
    } else {
      // Results are below target level - need aggregation
      // Use recursive CTE to get all descendants
      const parentFilter = parentId !== null
        ? Prisma.sql`AND au.parent_id = ${parentId}`
        : Prisma.empty;

      const aggregatedData = await prisma.$queryRaw<Array<{
        unit_id: number;
        unit_name: string;
        parent_id: number | null;
        candidate_id: number;
        candidate_name: string;
        party_id: number | null;
        party_name: string | null;
        party_color: string | null;
        total_votes: bigint;
      }>>(Prisma.sql`
        WITH RECURSIVE descendants AS (
          SELECT id, name, parent_id, id as root_id FROM administrative_units WHERE level = ${level}
          UNION ALL
          SELECT au.id, au.name, au.parent_id, d.root_id
          FROM administrative_units au
          JOIN descendants d ON au.parent_id = d.id
        )
        SELECT
          au.id as unit_id,
          au.name as unit_name,
          au.parent_id,
          r.candidate_id,
          p.full_name as candidate_name,
          c.party_id,
          pp.abbreviation as party_name,
          pp.color as party_color,
          SUM(r.votes) as total_votes
        FROM administrative_units au
        JOIN descendants d ON d.root_id = au.id
        JOIN results r ON r.admin_unit_id = d.id AND r.election_id = ${electionId}
        JOIN candidates c ON c.id = r.candidate_id
        JOIN persons p ON p.id = c.person_id
        LEFT JOIN political_parties pp ON pp.id = c.party_id
        WHERE au.level = ${level}
          ${parentFilter}
        GROUP BY au.id, au.name, au.parent_id, r.candidate_id, p.full_name, c.party_id, pp.abbreviation, pp.color
        ORDER BY au.id, total_votes DESC
      `);

      // Group by admin unit
      const resultsByUnit = new Map<number, any[]>();
      for (const row of aggregatedData) {
        const unitId = row.unit_id;
        if (!resultsByUnit.has(unitId)) {
          resultsByUnit.set(unitId, []);
        }
        resultsByUnit.get(unitId)!.push({
          candidateId: row.candidate_id,
          name: row.candidate_name,
          partyId: row.party_id,
          partyName: row.party_name || 'IND',
          partyColor: row.party_color || '#999',
          votes: Number(row.total_votes)
        });
      }

      // Build data
      for (const unit of adminUnits) {
        const candidates = resultsByUnit.get(unit.id) || [];

        if (candidates.length === 0) {
          data.push({
            unitId: unit.id,
            unitName: unit.name,
            parentId: unit.parentId,
            totalVotes: 0,
            noData: true,
            candidates: []
          });
          continue;
        }

        const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
        const winner = candidates[0];

        data.push({
          unitId: unit.id,
          unitName: unit.name,
          parentId: unit.parentId,
          totalVotes,
          winner: winner.partyName,
          winnerVotes: winner.votes,
          winnerColor: winner.partyColor,
          margin: totalVotes > 0 ? Math.round((winner.votes / totalVotes - (candidates[1]?.votes || 0) / totalVotes) * 100) / 100 : 0,
          candidates
        });
      }
    }

    console.log(`  Total time: ${Date.now() - startTime}ms, records: ${data.length}`);

    res.json({
      electionId,
      electionName: election.name,
      electionYear: election.year,
      level,
      parentId,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('Error fetching election results data:', error);
    res.status(500).json({ error: 'Failed to fetch election results data' });
  }
}

/**
 * Get issues/incidents data only (no geometry)
 * GET /api/issues/data
 *
 * Query params:
 *   level: Admin level (2-5)
 *   parentId: Optional - filter to children of this parent unit
 *
 * Response: Array of issue counts with unitId for client-side join
 */
export async function getIssuesData(req: Request, res: Response) {
  try {
    const level = parseInt(req.query.level as string) || 2;
    const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : null;

    console.log(`Issues data: level=${level}, parentId=${parentId}`);
    const startTime = Date.now();

    // Build the admin unit join based on level
    let locationField: string;
    switch (level) {
      case 2: locationField = 'district_id'; break;
      case 3: locationField = 'constituency_id'; break;
      case 4: locationField = 'subcounty_id'; break;
      case 5: locationField = 'parish_id'; break;
      default: locationField = 'district_id';
    }

    // Aggregate issues by admin unit with category breakdown
    const issueStats = await prisma.$queryRawUnsafe<Array<{
      unit_id: number;
      unit_name: string;
      parent_id: number | null;
      issue_count: bigint;
      deaths: bigint;
      injuries: bigint;
      arrests: bigint;
    }>>(`
      SELECT
        au.id as unit_id,
        au.name as unit_name,
        au.parent_id,
        COUNT(i.id) as issue_count,
        COALESCE(SUM(i.death_count), 0) as deaths,
        COALESCE(SUM(i.injury_count), 0) as injuries,
        COALESCE(SUM(i.arrest_count), 0) as arrests
      FROM administrative_units au
      LEFT JOIN electoral_issues i ON i.${locationField} = au.id
      WHERE au.level = $1
        ${parentId !== null ? `AND au.parent_id = $2` : ''}
      GROUP BY au.id, au.name, au.parent_id
      ORDER BY issue_count DESC
    `, level, ...(parentId !== null ? [parentId] : []));

    // Get category breakdown for each unit
    const categoryStats = await prisma.$queryRawUnsafe<Array<{
      unit_id: number;
      category_name: string;
      count: bigint;
    }>>(`
      SELECT
        au.id as unit_id,
        ic.name as category_name,
        COUNT(i.id) as count
      FROM administrative_units au
      LEFT JOIN electoral_issues i ON i.${locationField} = au.id
      LEFT JOIN issue_categories ic ON i.issue_category_id = ic.id
      WHERE au.level = $1
        ${parentId !== null ? `AND au.parent_id = $2` : ''}
        AND i.id IS NOT NULL
      GROUP BY au.id, ic.name
      ORDER BY count DESC
    `, level, ...(parentId !== null ? [parentId] : []));

    // Build category map by unit
    const categoryByUnit = new Map<number, { name: string; count: number }[]>();
    for (const cat of categoryStats) {
      if (!categoryByUnit.has(cat.unit_id)) {
        categoryByUnit.set(cat.unit_id, []);
      }
      categoryByUnit.get(cat.unit_id)!.push({
        name: cat.category_name || 'Uncategorized',
        count: Number(cat.count)
      });
    }

    // Calculate max for color scaling
    const maxIssues = Math.max(...issueStats.map(s => Number(s.issue_count)), 1);

    // Color scale function (matches frontend logic)
    const getColor = (count: number): string => {
      if (count === 0) return '#d1d5db'; // gray-300
      const ratio = count / maxIssues;
      if (ratio > 0.75) return '#dc2626'; // red-600
      if (ratio > 0.5) return '#ea580c'; // orange-600
      if (ratio > 0.25) return '#f59e0b'; // amber-500
      return '#fde047'; // yellow-300
    };

    const data = issueStats.map(s => {
      const issueCount = Number(s.issue_count);
      const topCategories = (categoryByUnit.get(s.unit_id) || []).slice(0, 5);

      return {
        unitId: s.unit_id,
        unitName: s.unit_name,
        parentId: s.parent_id,
        issueCount,
        deaths: Number(s.deaths),
        injuries: Number(s.injuries),
        arrests: Number(s.arrests),
        fillColor: getColor(issueCount),
        topCategories: JSON.stringify(topCategories),
        level,
      };
    });

    // Calculate metadata
    const totalIssues = data.reduce((sum, d) => sum + d.issueCount, 0);
    const unitsWithIssues = data.filter(d => d.issueCount > 0).length;
    const maxIssuesPerUnit = Math.max(...data.map(d => d.issueCount));

    console.log(`  Total time: ${Date.now() - startTime}ms, records: ${data.length}`);

    res.json({
      level,
      parentId,
      count: data.length,
      metadata: {
        totalIssues,
        unitsWithIssues,
        maxIssuesPerUnit
      },
      data,
    });
  } catch (error) {
    console.error('Error fetching issues data:', error);
    res.status(500).json({ error: 'Failed to fetch issues data' });
  }
}
