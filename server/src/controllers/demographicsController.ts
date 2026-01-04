import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Default to 2024 census
const DEFAULT_CENSUS_YEAR = 2024;

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
 */
export async function getDemographicsGeoJSON(req: Request, res: Response) {
  try {
    const level = parseInt(req.query.level as string) || 2; // Default to district level
    const censusYear = parseInt(req.query.censusYear as string) || DEFAULT_CENSUS_YEAR;
    const metric = (req.query.metric as string) || 'population'; // population, votingAge, density
    const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : null;

    // Get admin units at the specified level with demographics
    const unitsWithDemographics = await prisma.$queryRaw<Array<{
      id: number;
      name: string;
      level: number;
      geometry: string | null;
      total_population: bigint;
      male_population: bigint;
      female_population: bigint;
      voting_age_population: bigint;
      youth_population: bigint;
      elderly_population: bigint;
      households: bigint;
      parish_count: bigint;
    }>>`
      WITH unit_demographics AS (
        SELECT
          au.id as unit_id,
          SUM(dem.total_population) as total_population,
          SUM(dem.male_population) as male_population,
          SUM(dem.female_population) as female_population,
          SUM(dem.voting_age_population) as voting_age_population,
          SUM(dem.youth_population) as youth_population,
          SUM(dem.elderly_population) as elderly_population,
          SUM(dem.number_of_households) as households,
          COUNT(dem.id) as parish_count
        FROM administrative_units au
        JOIN administrative_units p ON (
          CASE
            WHEN au.level = 2 THEN p.id IN (
              SELECT p2.id FROM administrative_units p2
              JOIN administrative_units sc ON p2.parent_id = sc.id
              JOIN administrative_units c ON sc.parent_id = c.id
              WHERE c.parent_id = au.id AND p2.level = 5
            )
            WHEN au.level = 3 THEN p.id IN (
              SELECT p2.id FROM administrative_units p2
              JOIN administrative_units sc ON p2.parent_id = sc.id
              WHERE sc.parent_id = au.id AND p2.level = 5
            )
            WHEN au.level = 4 THEN p.parent_id = au.id AND p.level = 5
            WHEN au.level = 5 THEN p.id = au.id
            ELSE FALSE
          END
        )
        JOIN demographics dem ON dem.admin_unit_id = p.id AND dem.census_year = ${censusYear}
        WHERE au.level = ${level}
        GROUP BY au.id
      )
      SELECT
        au.id,
        au.name,
        au.level,
        au.geometry,
        COALESCE(ud.total_population, 0) as total_population,
        COALESCE(ud.male_population, 0) as male_population,
        COALESCE(ud.female_population, 0) as female_population,
        COALESCE(ud.voting_age_population, 0) as voting_age_population,
        COALESCE(ud.youth_population, 0) as youth_population,
        COALESCE(ud.elderly_population, 0) as elderly_population,
        COALESCE(ud.households, 0) as households,
        COALESCE(ud.parish_count, 0) as parish_count
      FROM administrative_units au
      LEFT JOIN unit_demographics ud ON au.id = ud.unit_id
      WHERE au.level = ${level}
        AND au.geometry IS NOT NULL
        ${parentId ? Prisma.sql`AND au.parent_id = ${parentId}` : Prisma.empty}
    `;

    /**
     * Clean geometry by removing empty coordinate arrays at any depth.
     * This fixes issues where MultiPolygon geometries have empty rings.
     */
    const cleanGeometry = (geom: any): any => {
      if (!geom || !geom.type || !geom.coordinates) return null;

      if (geom.type === 'MultiPolygon') {
        // MultiPolygon: [ Polygon1, Polygon2, ... ]
        // Each Polygon: [ Ring1, Ring2, ... ] where Ring = [[lon,lat], ...]
        const cleanedPolygons = geom.coordinates
          .filter((polygon: any) => {
            // Filter out null/undefined polygons
            if (!Array.isArray(polygon)) return false;
            // Filter out empty polygons
            if (polygon.length === 0) return false;
            // Check if outer ring has coordinates
            const outerRing = polygon[0];
            if (!Array.isArray(outerRing) || outerRing.length === 0) return false;
            // Check if first coordinate is valid [lon, lat]
            if (!Array.isArray(outerRing[0]) || outerRing[0].length < 2) return false;
            return true;
          })
          .map((polygon: any) => {
            // For each polygon, filter out empty rings
            return polygon.filter((ring: any) => {
              if (!Array.isArray(ring) || ring.length === 0) return false;
              if (!Array.isArray(ring[0]) || ring[0].length < 2) return false;
              return true;
            });
          })
          .filter((polygon: any) => polygon.length > 0); // Remove polygons with no valid rings

        if (cleanedPolygons.length === 0) return null;
        return { type: 'MultiPolygon', coordinates: cleanedPolygons };
      }

      if (geom.type === 'Polygon') {
        // Polygon: [ Ring1, Ring2, ... ]
        const cleanedRings = geom.coordinates.filter((ring: any) => {
          if (!Array.isArray(ring) || ring.length === 0) return false;
          if (!Array.isArray(ring[0]) || ring[0].length < 2) return false;
          return true;
        });
        if (cleanedRings.length === 0) return null;
        return { type: 'Polygon', coordinates: cleanedRings };
      }

      // For other geometry types, just validate basic structure
      if (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0) return null;
      return geom;
    };

    // Build GeoJSON
    const features = unitsWithDemographics.map(unit => {
      let geometry = null;
      try {
        const parsed = unit.geometry ? JSON.parse(unit.geometry) : null;
        geometry = cleanGeometry(parsed);
      } catch (e) {
        // Invalid geometry
      }

      const totalPop = Number(unit.total_population);
      const votingAgePop = Number(unit.voting_age_population);
      const votingAgePercent = totalPop > 0 ? (votingAgePop / totalPop) * 100 : 0;
      const malePercent = totalPop > 0 ? (Number(unit.male_population) / totalPop) * 100 : 0;

      return {
        type: 'Feature',
        properties: {
          id: unit.id,
          name: unit.name,
          level: unit.level,
          totalPopulation: totalPop,
          malePopulation: Number(unit.male_population),
          femalePopulation: Number(unit.female_population),
          votingAgePopulation: votingAgePop,
          youthPopulation: Number(unit.youth_population),
          elderlyPopulation: Number(unit.elderly_population),
          numberOfHouseholds: Number(unit.households),
          parishCount: Number(unit.parish_count),
          // Calculated percentages
          votingAgePercent: Math.round(votingAgePercent * 10) / 10,
          malePercent: Math.round(malePercent * 10) / 10,
        },
        geometry,
      };
    }).filter(f => f.geometry !== null);

    // Return standard GeoJSON (no properties at FeatureCollection level)
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
