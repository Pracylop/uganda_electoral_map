import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Get all electoral issues with filters
 * GET /api/issues
 * Query params: electionId, categoryId, districtId, severity, status, startDate, endDate
 */
export const getIssues = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      electionId,
      categoryId,
      districtId,
      severity,
      status,
      startDate,
      endDate,
      limit = '100',
      offset = '0'
    } = req.query;

    const where: any = {};

    if (electionId) {
      where.electionId = parseInt(electionId as string);
    }

    if (categoryId) {
      where.issueCategoryId = parseInt(categoryId as string);
    }

    if (districtId) {
      where.districtId = parseInt(districtId as string);
    }

    if (severity) {
      where.severity = parseInt(severity as string);
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.date.lte = new Date(endDate as string);
      }
    }

    const [issues, total] = await Promise.all([
      prisma.electoralIssue.findMany({
        where,
        include: {
          issueCategory: {
            select: { id: true, name: true, code: true, severity: true, color: true }
          },
          district: {
            select: { id: true, name: true }
          },
          constituency: {
            select: { id: true, name: true }
          },
          subcounty: {
            select: { id: true, name: true }
          },
          parish: {
            select: { id: true, name: true }
          }
        },
        orderBy: { date: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.electoralIssue.count({ where })
    ]);

    res.json({
      issues,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ error: 'Failed to fetch electoral issues' });
  }
};

/**
 * Get issue by ID
 * GET /api/issues/:id
 */
export const getIssueById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const issue = await prisma.electoralIssue.findUnique({
      where: { id: parseInt(id) },
      include: {
        issueCategory: true,
        election: {
          select: { id: true, name: true, year: true }
        },
        district: {
          select: { id: true, name: true }
        },
        constituency: {
          select: { id: true, name: true }
        },
        subcounty: {
          select: { id: true, name: true }
        },
        parish: {
          select: { id: true, name: true }
        },
        candidatesInvolved: {
          include: {
            candidate: {
              include: {
                person: { select: { fullName: true } },
                party: { select: { name: true, abbreviation: true, color: true } }
              }
            }
          }
        }
      }
    });

    if (!issue) {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }

    res.json(issue);
  } catch (error) {
    console.error('Error fetching issue:', error);
    res.status(500).json({ error: 'Failed to fetch electoral issue' });
  }
};

/**
 * Get issues for map display (GeoJSON format)
 * GET /api/issues/geojson
 * Returns issues with coordinates or centroid of their admin unit
 */
export const getIssuesGeoJSON = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId, districtId, startDate, endDate } = req.query;

    const where: any = {};

    if (categoryId) {
      where.issueCategoryId = parseInt(categoryId as string);
    }

    if (districtId) {
      where.districtId = parseInt(districtId as string);
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.date.lte = new Date(endDate as string);
      }
    }

    const issues = await prisma.electoralIssue.findMany({
      where,
      include: {
        issueCategory: {
          select: { id: true, name: true, code: true, severity: true, color: true }
        },
        district: {
          select: { id: true, name: true, geometry: true }
        },
        constituency: {
          select: { id: true, name: true, geometry: true }
        }
      },
      orderBy: { date: 'desc' },
      take: 500 // Limit for map performance
    });

    // Convert to GeoJSON
    const features = issues.map(issue => {
      let coordinates: [number, number] | null = null;

      // Use explicit coordinates if available
      if (issue.latitude && issue.longitude) {
        coordinates = [
          parseFloat(issue.longitude.toString()),
          parseFloat(issue.latitude.toString())
        ];
      } else {
        // Calculate centroid from district geometry
        const geometry = issue.district?.geometry || issue.constituency?.geometry;
        if (geometry) {
          try {
            const geojson = JSON.parse(geometry);
            if (geojson.coordinates) {
              coordinates = calculateCentroid(geojson);
            }
          } catch (e) {
            // Fallback to Uganda center
            coordinates = [32.58, 1.37];
          }
        } else {
          // Fallback to Uganda center
          coordinates = [32.58, 1.37];
        }
      }

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates
        },
        properties: {
          id: issue.id,
          date: issue.date,
          time: issue.time,
          category: issue.issueCategory.name,
          categoryCode: issue.issueCategory.code,
          categoryColor: issue.issueCategory.color || getDefaultColor(issue.issueCategory.code),
          severity: issue.severity || issue.issueCategory.severity,
          summary: issue.summary,
          location: issue.location || issue.village,
          district: issue.district?.name,
          districtId: issue.districtId,
          constituency: issue.constituency?.name,
          status: issue.status
        }
      };
    });

    res.json({
      type: 'FeatureCollection',
      features
    });
  } catch (error) {
    console.error('Error fetching issues GeoJSON:', error);
    res.status(500).json({ error: 'Failed to fetch issues for map' });
  }
};

/**
 * Get issue categories
 * GET /api/issues/categories
 */
export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.issueCategory.findMany({
      where: { isActive: true },
      orderBy: { severity: 'desc' }
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch issue categories' });
  }
};

/**
 * Get issue statistics
 * GET /api/issues/stats
 */
export const getIssueStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { districtId } = req.query;

    const where: any = {};
    if (districtId) {
      where.districtId = parseInt(districtId as string);
    }

    const [
      totalIssues,
      byCategory,
      byStatus,
      byDistrict
    ] = await Promise.all([
      prisma.electoralIssue.count({ where }),
      prisma.electoralIssue.groupBy({
        by: ['issueCategoryId'],
        where,
        _count: true
      }),
      prisma.electoralIssue.groupBy({
        by: ['status'],
        where,
        _count: true
      }),
      prisma.electoralIssue.groupBy({
        by: ['districtId'],
        where: { ...where, districtId: { not: null } },
        _count: true,
        orderBy: { _count: { districtId: 'desc' } },
        take: 10
      })
    ]);

    // Get category names
    const categories = await prisma.issueCategory.findMany();
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    // Get district names
    const districtIds = byDistrict.map(d => d.districtId).filter(Boolean) as number[];
    const districts = await prisma.administrativeUnit.findMany({
      where: { id: { in: districtIds } },
      select: { id: true, name: true }
    });
    const districtMap = new Map(districts.map(d => [d.id, d.name]));

    res.json({
      total: totalIssues,
      byCategory: byCategory.map(item => ({
        category: categoryMap.get(item.issueCategoryId)?.name || 'Unknown',
        categoryCode: categoryMap.get(item.issueCategoryId)?.code,
        color: categoryMap.get(item.issueCategoryId)?.color,
        count: item._count
      })),
      byStatus: byStatus.map(item => ({
        status: item.status,
        count: item._count
      })),
      topDistricts: byDistrict.map(item => ({
        district: districtMap.get(item.districtId!) || 'Unknown',
        districtId: item.districtId,
        count: item._count
      }))
    });
  } catch (error) {
    console.error('Error fetching issue stats:', error);
    res.status(500).json({ error: 'Failed to fetch issue statistics' });
  }
};

// Helper function to calculate polygon centroid
function calculateCentroid(geojson: any): [number, number] {
  try {
    let coords: number[][][] = [];

    if (geojson.type === 'Polygon') {
      coords = [geojson.coordinates[0]];
    } else if (geojson.type === 'MultiPolygon') {
      coords = geojson.coordinates.map((poly: number[][][]) => poly[0]);
    }

    if (coords.length === 0) {
      return [32.58, 1.37]; // Uganda center fallback
    }

    // Use first polygon's centroid
    const ring = coords[0];
    let sumX = 0, sumY = 0;
    for (const coord of ring) {
      sumX += coord[0];
      sumY += coord[1];
    }

    return [sumX / ring.length, sumY / ring.length];
  } catch (e) {
    return [32.58, 1.37]; // Uganda center fallback
  }
}

// Default colors for categories
function getDefaultColor(code: string): string {
  const colors: Record<string, string> = {
    'campaign_blockage': '#FFA500', // Orange
    'violence': '#FF0000',          // Red
    'court_case': '#4169E1',        // Royal Blue
    'voter_intimidation': '#8B0000', // Dark Red
    'ballot_tampering': '#800080',   // Purple
    'media_interference': '#20B2AA', // Light Sea Green
    'registration_issue': '#DAA520', // Goldenrod
    'arrest_detention': '#DC143C',   // Crimson
    'property_damage': '#8B4513',    // Saddle Brown
    'bribery': '#228B22',            // Forest Green
    'hate_speech': '#FF6347',        // Tomato
    'other': '#808080'               // Gray
  };
  return colors[code] || '#808080';
}
