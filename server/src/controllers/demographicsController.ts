import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Default to 2024 census
const DEFAULT_CENSUS_YEAR = 2024;

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
 * Get national demographics statistics with district breakdown
 * GET /api/demographics/stats
 */
export async function getDemographicsStats(req: Request, res: Response) {
  try {
    const censusYear = parseInt(req.query.censusYear as string) || DEFAULT_CENSUS_YEAR;

    // Get national totals
    const nationalTotals = await prisma.demographics.aggregate({
      where: { censusYear },
      _sum: {
        totalPopulation: true,
        malePopulation: true,
        femalePopulation: true,
        votingAgePopulation: true,
        youthPopulation: true,
        elderlyPopulation: true,
        numberOfHouseholds: true,
      },
      _count: true,
    });

    // Get district-level breakdown
    const districtStats = await prisma.$queryRaw<Array<{
      district_id: number;
      district_name: string;
      total_population: bigint;
      male_population: bigint;
      female_population: bigint;
      voting_age_population: bigint;
      youth_population: bigint;
      elderly_population: bigint;
      households: bigint;
      parish_count: bigint;
    }>>`
      SELECT
        d.id as district_id,
        d.name as district_name,
        SUM(dem.total_population) as total_population,
        SUM(dem.male_population) as male_population,
        SUM(dem.female_population) as female_population,
        SUM(dem.voting_age_population) as voting_age_population,
        SUM(dem.youth_population) as youth_population,
        SUM(dem.elderly_population) as elderly_population,
        SUM(dem.number_of_households) as households,
        COUNT(dem.id) as parish_count
      FROM demographics dem
      JOIN administrative_units p ON dem.admin_unit_id = p.id AND p.level = 5
      JOIN administrative_units sc ON p.parent_id = sc.id AND sc.level = 4
      JOIN administrative_units c ON sc.parent_id = c.id AND c.level = 3
      JOIN administrative_units d ON c.parent_id = d.id AND d.level = 2
      WHERE dem.census_year = ${censusYear}
      GROUP BY d.id, d.name
      ORDER BY total_population DESC
    `;

    res.json({
      censusYear,
      national: {
        totalPopulation: Number(nationalTotals._sum.totalPopulation || 0),
        malePopulation: Number(nationalTotals._sum.malePopulation || 0),
        femalePopulation: Number(nationalTotals._sum.femalePopulation || 0),
        votingAgePopulation: Number(nationalTotals._sum.votingAgePopulation || 0),
        youthPopulation: Number(nationalTotals._sum.youthPopulation || 0),
        elderlyPopulation: Number(nationalTotals._sum.elderlyPopulation || 0),
        numberOfHouseholds: Number(nationalTotals._sum.numberOfHouseholds || 0),
        parishCount: nationalTotals._count,
      },
      districts: districtStats.map(d => ({
        districtId: d.district_id,
        districtName: d.district_name,
        totalPopulation: Number(d.total_population),
        malePopulation: Number(d.male_population),
        femalePopulation: Number(d.female_population),
        votingAgePopulation: Number(d.voting_age_population),
        youthPopulation: Number(d.youth_population),
        elderlyPopulation: Number(d.elderly_population),
        numberOfHouseholds: Number(d.households),
        parishCount: Number(d.parish_count),
      })),
    });
  } catch (error) {
    console.error('Error fetching demographics stats:', error);
    res.status(500).json({ error: 'Failed to fetch demographics statistics' });
  }
}

/**
 * Get demographics for a specific administrative unit
 * GET /api/demographics/:adminUnitId
 */
export async function getDemographicsByUnit(req: Request, res: Response) {
  try {
    const adminUnitId = parseInt(req.params.adminUnitId);
    const censusYear = parseInt(req.query.censusYear as string) || DEFAULT_CENSUS_YEAR;

    if (isNaN(adminUnitId)) {
      return res.status(400).json({ error: 'Invalid admin unit ID' });
    }

    // Get the admin unit info
    const adminUnit = await prisma.administrativeUnit.findUnique({
      where: { id: adminUnitId },
      select: { id: true, name: true, level: true },
    });

    if (!adminUnit) {
      return res.status(404).json({ error: 'Administrative unit not found' });
    }

    let demographics;

    if (adminUnit.level === 5) {
      // Parish level - direct lookup
      demographics = await prisma.demographics.findUnique({
        where: {
          adminUnitId_censusYear: { adminUnitId, censusYear },
        },
      });
    } else {
      // Higher level - aggregate from child parishes
      const aggregated = await prisma.$queryRaw<Array<{
        total_population: bigint;
        male_population: bigint;
        female_population: bigint;
        voting_age_population: bigint;
        youth_population: bigint;
        elderly_population: bigint;
        households: bigint;
        parish_count: bigint;
      }>>`
        WITH RECURSIVE descendants AS (
          SELECT id, level FROM administrative_units WHERE id = ${adminUnitId}
          UNION ALL
          SELECT au.id, au.level
          FROM administrative_units au
          JOIN descendants d ON au.parent_id = d.id
        )
        SELECT
          COALESCE(SUM(dem.total_population), 0) as total_population,
          COALESCE(SUM(dem.male_population), 0) as male_population,
          COALESCE(SUM(dem.female_population), 0) as female_population,
          COALESCE(SUM(dem.voting_age_population), 0) as voting_age_population,
          COALESCE(SUM(dem.youth_population), 0) as youth_population,
          COALESCE(SUM(dem.elderly_population), 0) as elderly_population,
          COALESCE(SUM(dem.number_of_households), 0) as households,
          COUNT(dem.id) as parish_count
        FROM descendants d
        JOIN demographics dem ON dem.admin_unit_id = d.id
        WHERE dem.census_year = ${censusYear}
          AND d.level = 5
      `;

      if (aggregated.length > 0) {
        const agg = aggregated[0];
        demographics = {
          adminUnitId,
          censusYear,
          totalPopulation: Number(agg.total_population),
          malePopulation: Number(agg.male_population),
          femalePopulation: Number(agg.female_population),
          votingAgePopulation: Number(agg.voting_age_population),
          youthPopulation: Number(agg.youth_population),
          elderlyPopulation: Number(agg.elderly_population),
          numberOfHouseholds: Number(agg.households),
          parishCount: Number(agg.parish_count),
        };
      }
    }

    if (!demographics) {
      return res.status(404).json({ error: 'No demographics data found for this unit' });
    }

    res.json({
      adminUnit,
      demographics,
    });
  } catch (error) {
    console.error('Error fetching demographics by unit:', error);
    res.status(500).json({ error: 'Failed to fetch demographics' });
  }
}

/**
 * Get demographics as GeoJSON for map display
 * GET /api/demographics/geojson
 *
 * OPTIMIZED VERSION: Uses pre-aggregated demographics data for fast loading.
 * Pattern matches Electoral map's getAggregatedResults approach.
 */
export async function getDemographicsGeoJSON(req: Request, res: Response) {
  try {
    const level = parseInt(req.query.level as string) || 2; // Default to district level
    const censusYear = parseInt(req.query.censusYear as string) || DEFAULT_CENSUS_YEAR;
    const metric = (req.query.metric as string) || 'population';
    const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : null;

    console.log(`Demographics GeoJSON: level=${level}, parentId=${parentId}, censusYear=${censusYear}`);
    const startTime = Date.now();

    // Step 1: Get pre-aggregated demographics (fast - uses indexed lookup)
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

    console.log(`  Aggregates fetched: ${aggregates.length} in ${Date.now() - startTime}ms`);

    // Build lookup map
    const demographicsMap = new Map<number, typeof aggregates[0]>();
    aggregates.forEach(a => demographicsMap.set(a.adminUnitId, a));

    // Step 2: Get admin units with geometry (separate query for efficiency)
    const geoStartTime = Date.now();
    const adminUnitWhere: any = {
      level,
      geometry: { not: null }
    };
    if (parentId !== null) {
      adminUnitWhere.parentId = parentId;
    }

    const adminUnits = await prisma.administrativeUnit.findMany({
      where: adminUnitWhere,
      select: {
        id: true,
        name: true,
        level: true,
        parentId: true,
        geometry: true
      }
    });

    console.log(`  Admin units fetched: ${adminUnits.length} in ${Date.now() - geoStartTime}ms`);

    // Step 3: Build GeoJSON features
    const features: any[] = [];

    for (const unit of adminUnits) {
      // Parse and clean geometry
      let geometry = null;
      try {
        const parsed = unit.geometry ? JSON.parse(unit.geometry) : null;
        geometry = cleanGeometry(parsed);
      } catch (e) {
        continue; // Skip units with invalid geometry
      }

      if (!geometry) continue;

      // Get demographics data from lookup map
      const demo = demographicsMap.get(unit.id);

      const totalPop = demo?.totalPopulation || 0;
      const votingAgePop = demo?.votingAgePopulation || 0;
      const malePop = demo?.malePopulation || 0;
      const votingAgePercent = totalPop > 0 ? (votingAgePop / totalPop) * 100 : 0;
      const malePercent = totalPop > 0 ? (malePop / totalPop) * 100 : 0;

      features.push({
        type: 'Feature',
        properties: {
          id: unit.id,
          name: unit.name,
          level: unit.level,
          parentId: unit.parentId,
          totalPopulation: totalPop,
          malePopulation: malePop,
          femalePopulation: demo?.femalePopulation || 0,
          votingAgePopulation: votingAgePop,
          youthPopulation: demo?.youthPopulation || 0,
          elderlyPopulation: demo?.elderlyPopulation || 0,
          numberOfHouseholds: demo?.numberOfHouseholds || 0,
          parishCount: demo?.parishCount || 0,
          votingAgePercent: Math.round(votingAgePercent * 10) / 10,
          malePercent: Math.round(malePercent * 10) / 10,
        },
        geometry,
      });
    }

    console.log(`  Total time: ${Date.now() - startTime}ms, features: ${features.length}`);

    // Return GeoJSON
    res.json({
      type: 'FeatureCollection',
      features,
      metadata: {
        censusYear,
        level,
        metric,
        featureCount: features.length,
      },
    });
  } catch (error) {
    console.error('Error fetching demographics GeoJSON:', error);
    res.status(500).json({ error: 'Failed to fetch demographics GeoJSON' });
  }
}
