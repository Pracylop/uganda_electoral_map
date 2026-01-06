import { Request, Response } from 'express';
import prisma from '../config/database';
import { createAuditLog } from '../middleware/auditLog';

// Helper to get client IP address
const getClientIp = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

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

      // Calculate total casualties for marker sizing
      const totalCasualties = (issue.injuryCount || 0) + (issue.deathCount || 0) + (issue.arrestCount || 0);

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates
        },
        properties: {
          id: issue.id,
          caseId: issue.caseId,
          date: issue.date,
          time: issue.time,
          category: issue.issueCategory.name,
          categoryCode: issue.issueCategory.code,
          categoryColor: issue.issueCategory.color || getDefaultColor(issue.issueCategory.code),
          severity: issue.severity || issue.issueCategory.severity,
          summary: issue.summary,
          protagonist: issue.protagonist,
          targetCategory: issue.targetCategory,
          targetName: issue.targetName,
          injuryCount: issue.injuryCount || 0,
          deathCount: issue.deathCount || 0,
          arrestCount: issue.arrestCount || 0,
          totalCasualties,
          location: issue.location || issue.village,
          district: issue.district?.name,
          districtId: issue.districtId,
          constituency: issue.constituency?.name,
          source: issue.source,
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
 * Query params: districtId, level, adminUnitId, categoryIds, startDate, endDate
 * - districtId: Legacy parameter for district-level filtering
 * - level: Admin level (2=district, 3=constituency, 4=subcounty, 5=parish)
 * - adminUnitId: ID of the admin unit to filter by (used with level)
 */
export const getIssueStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { districtId, level, adminUnitId, categoryIds, startDate, endDate } = req.query;

    const where: any = {};

    // Support multi-level filtering with level + adminUnitId
    if (level && adminUnitId) {
      const adminLevel = parseInt(level as string);
      const unitId = parseInt(adminUnitId as string);

      const levelFieldMap: Record<number, string> = {
        2: 'districtId',
        3: 'constituencyId',
        4: 'subcountyId',
        5: 'parishId'
      };

      const fieldName = levelFieldMap[adminLevel];
      if (fieldName) {
        where[fieldName] = unitId;
      }
    } else if (districtId) {
      // Legacy: filter by districtId only
      where.districtId = parseInt(districtId as string);
    }

    // Support multiple category IDs (comma-separated)
    if (categoryIds) {
      const ids = (categoryIds as string).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) {
        where.issueCategoryId = { in: ids };
      }
    }

    // Date range filter
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.date.lte = new Date(endDate as string);
      }
    }

    const [
      totalIssues,
      byCategory,
      byStatus,
      byDistrict,
      casualtyTotals
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
      }),
      prisma.electoralIssue.aggregate({
        where,
        _sum: {
          injuryCount: true,
          deathCount: true,
          arrestCount: true
        }
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
      casualties: {
        injuries: casualtyTotals._sum.injuryCount || 0,
        deaths: casualtyTotals._sum.deathCount || 0,
        arrests: casualtyTotals._sum.arrestCount || 0,
        total: (casualtyTotals._sum.injuryCount || 0) +
               (casualtyTotals._sum.deathCount || 0) +
               (casualtyTotals._sum.arrestCount || 0)
      },
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

/**
 * Create a new electoral issue (Editor/Admin)
 * POST /api/issues
 */
export const createIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      electionId,
      issueCategoryId,
      districtId,
      constituencyId,
      subcountyId,
      parishId,
      date,
      time,
      summary,
      fullText,
      protagonist,
      targetCategory,
      targetName,
      injuryCount,
      deathCount,
      arrestCount,
      source,
      location,
      village,
      latitude,
      longitude,
      severity,
      status
    } = req.body;

    // Validate required fields
    if (!issueCategoryId || !districtId || !date || !summary) {
      res.status(400).json({
        error: 'Category, district, date, and summary are required'
      });
      return;
    }

    // Verify category exists
    const category = await prisma.issueCategory.findUnique({
      where: { id: parseInt(issueCategoryId) }
    });

    if (!category) {
      res.status(404).json({ error: 'Issue category not found' });
      return;
    }

    // Verify district exists
    const district = await prisma.administrativeUnit.findUnique({
      where: { id: parseInt(districtId) }
    });

    if (!district) {
      res.status(404).json({ error: 'District not found' });
      return;
    }

    const issue = await prisma.electoralIssue.create({
      data: {
        electionId: electionId ? parseInt(electionId) : null,
        issueCategoryId: parseInt(issueCategoryId),
        districtId: parseInt(districtId),
        constituencyId: constituencyId ? parseInt(constituencyId) : null,
        subcountyId: subcountyId ? parseInt(subcountyId) : null,
        parishId: parishId ? parseInt(parishId) : null,
        date: new Date(date),
        time: time || null,
        summary,
        fullText: fullText || null,
        protagonist: protagonist || null,
        targetCategory: targetCategory || null,
        targetName: targetName || null,
        injuryCount: injuryCount ? parseInt(injuryCount) : 0,
        deathCount: deathCount ? parseInt(deathCount) : 0,
        arrestCount: arrestCount ? parseInt(arrestCount) : 0,
        source: source || null,
        location: location || null,
        village: village || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        severity: severity ? parseInt(severity) : category.severity,
        status: status || 'reported'
      },
      include: {
        issueCategory: { select: { name: true, code: true } },
        district: { select: { name: true } }
      }
    });

    // Audit log
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'CREATE_ISSUE',
      'electoral_issue',
      issue.id,
      null,
      {
        category: issue.issueCategory.name,
        district: issue.district?.name,
        summary: issue.summary,
        severity: issue.severity
      },
      getClientIp(req),
      `Created issue: ${issue.issueCategory.name} in ${issue.district?.name}`
    );

    res.status(201).json({
      message: 'Issue created successfully',
      issue
    });
  } catch (error) {
    console.error('Create issue error:', error);
    res.status(500).json({ error: 'Failed to create electoral issue' });
  }
};

/**
 * Update an electoral issue (Editor/Admin)
 * PUT /api/issues/:id
 */
export const updateIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const issueId = parseInt(req.params.id);
    const {
      issueCategoryId,
      districtId,
      constituencyId,
      subcountyId,
      parishId,
      date,
      time,
      summary,
      fullText,
      protagonist,
      targetCategory,
      targetName,
      injuryCount,
      deathCount,
      arrestCount,
      source,
      location,
      village,
      latitude,
      longitude,
      severity,
      status
    } = req.body;

    if (isNaN(issueId)) {
      res.status(400).json({ error: 'Invalid issue ID' });
      return;
    }

    // Fetch existing issue for audit log
    const existingIssue = await prisma.electoralIssue.findUnique({
      where: { id: issueId },
      include: {
        issueCategory: { select: { name: true } },
        district: { select: { name: true } }
      }
    });

    if (!existingIssue) {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }

    // Build update data
    const updateData: any = {};
    if (issueCategoryId !== undefined) updateData.issueCategoryId = parseInt(issueCategoryId);
    if (districtId !== undefined) updateData.districtId = parseInt(districtId);
    if (constituencyId !== undefined) updateData.constituencyId = constituencyId ? parseInt(constituencyId) : null;
    if (subcountyId !== undefined) updateData.subcountyId = subcountyId ? parseInt(subcountyId) : null;
    if (parishId !== undefined) updateData.parishId = parishId ? parseInt(parishId) : null;
    if (date !== undefined) updateData.date = new Date(date);
    if (time !== undefined) updateData.time = time || null;
    if (summary !== undefined) updateData.summary = summary;
    if (fullText !== undefined) updateData.fullText = fullText || null;
    if (protagonist !== undefined) updateData.protagonist = protagonist || null;
    if (targetCategory !== undefined) updateData.targetCategory = targetCategory || null;
    if (targetName !== undefined) updateData.targetName = targetName || null;
    if (injuryCount !== undefined) updateData.injuryCount = parseInt(injuryCount) || 0;
    if (deathCount !== undefined) updateData.deathCount = parseInt(deathCount) || 0;
    if (arrestCount !== undefined) updateData.arrestCount = parseInt(arrestCount) || 0;
    if (source !== undefined) updateData.source = source || null;
    if (location !== undefined) updateData.location = location || null;
    if (village !== undefined) updateData.village = village || null;
    if (latitude !== undefined) updateData.latitude = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined) updateData.longitude = longitude ? parseFloat(longitude) : null;
    if (severity !== undefined) updateData.severity = parseInt(severity);
    if (status !== undefined) updateData.status = status;

    const issue = await prisma.electoralIssue.update({
      where: { id: issueId },
      data: updateData,
      include: {
        issueCategory: { select: { name: true, code: true } },
        district: { select: { name: true } }
      }
    });

    // Audit log
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'UPDATE_ISSUE',
      'electoral_issue',
      issue.id,
      {
        category: existingIssue.issueCategory.name,
        district: existingIssue.district?.name,
        summary: existingIssue.summary,
        status: existingIssue.status
      },
      {
        category: issue.issueCategory.name,
        district: issue.district?.name,
        summary: issue.summary,
        status: issue.status
      },
      getClientIp(req),
      `Updated issue: ${issue.issueCategory.name} in ${issue.district?.name}`
    );

    res.json({
      message: 'Issue updated successfully',
      issue
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }
    console.error('Update issue error:', error);
    res.status(500).json({ error: 'Failed to update electoral issue' });
  }
};

/**
 * Delete an electoral issue (Admin only)
 * DELETE /api/issues/:id
 */
export const deleteIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const issueId = parseInt(req.params.id);

    if (isNaN(issueId)) {
      res.status(400).json({ error: 'Invalid issue ID' });
      return;
    }

    // Fetch existing issue for audit log before deletion
    const existingIssue = await prisma.electoralIssue.findUnique({
      where: { id: issueId },
      include: {
        issueCategory: { select: { name: true } },
        district: { select: { name: true } }
      }
    });

    if (!existingIssue) {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }

    await prisma.electoralIssue.delete({
      where: { id: issueId }
    });

    // Audit log
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'DELETE_ISSUE',
      'electoral_issue',
      issueId,
      {
        category: existingIssue.issueCategory.name,
        district: existingIssue.district?.name,
        summary: existingIssue.summary,
        date: existingIssue.date
      },
      null,
      getClientIp(req),
      `Deleted issue: ${existingIssue.issueCategory.name} in ${existingIssue.district?.name}`
    );

    res.json({ message: 'Issue deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }
    console.error('Delete issue error:', error);
    res.status(500).json({ error: 'Failed to delete electoral issue' });
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

/**
 * Get issues choropleth data (admin unit polygons with issue counts)
 * GET /api/issues/choropleth
 * Query params:
 *   - level: Admin level (2=district, 3=constituency, 4=subcounty, 5=parish). Default: 2
 *   - parentId: Filter to children of this parent admin unit
 *   - categoryIds, categoryId, startDate, endDate, severity: Issue filters
 * Returns GeoJSON FeatureCollection with admin unit geometries and issue statistics
 */
export const getIssuesChoropleth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { level, parentId, categoryIds, categoryId, startDate, endDate, severity } = req.query;

    // Parse admin level (default to district level 2)
    const adminLevel = level ? parseInt(level as string) : 2;
    const parentUnitId = parentId ? parseInt(parentId as string) : null;

    // Determine which field to group by based on level
    const levelFieldMap: Record<number, string> = {
      2: 'districtId',
      3: 'constituencyId',
      4: 'subcountyId',
      5: 'parishId'
    };
    const groupField = levelFieldMap[adminLevel] || 'districtId';

    // Build where clause for issues
    const where: any = {
      [groupField]: { not: null }
    };

    // If we have a parent filter, add constraints based on level
    if (parentUnitId) {
      if (adminLevel === 3) {
        // Constituencies within a district
        where.districtId = parentUnitId;
      } else if (adminLevel === 4) {
        // Subcounties within a constituency
        where.constituencyId = parentUnitId;
      } else if (adminLevel === 5) {
        // Parishes within a subcounty
        where.subcountyId = parentUnitId;
      }
    }

    // Support multiple category IDs (comma-separated) or single categoryId
    if (categoryIds) {
      const ids = (categoryIds as string).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) {
        where.issueCategoryId = { in: ids };
      }
    } else if (categoryId) {
      where.issueCategoryId = parseInt(categoryId as string);
    }

    if (severity) {
      where.issueCategory = {
        severity: parseInt(severity as string)
      };
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

    // Get all issues with category and casualty data for detailed breakdown
    const issues = await prisma.electoralIssue.findMany({
      where,
      select: {
        districtId: true,
        constituencyId: true,
        subcountyId: true,
        parishId: true,
        date: true,
        injuryCount: true,
        deathCount: true,
        arrestCount: true,
        issueCategory: {
          select: { id: true, name: true, code: true }
        }
      }
    });

    // Get all categories for reference
    const categories = await prisma.issueCategory.findMany({
      select: { id: true, name: true, code: true }
    });

    // Create a map of admin unit ID to detailed issue data
    interface UnitData {
      count: number;
      lastDate: Date | null;
      injuries: number;
      deaths: number;
      arrests: number;
      byCategory: Record<string, number>; // categoryName -> count
    }
    const countMap = new Map<number, UnitData>();
    let maxCount = 0;

    // Get the unit ID based on level
    const getUnitId = (issue: any): number | null => {
      switch (adminLevel) {
        case 2: return issue.districtId;
        case 3: return issue.constituencyId;
        case 4: return issue.subcountyId;
        case 5: return issue.parishId;
        default: return issue.districtId;
      }
    };

    issues.forEach(issue => {
      const unitId = getUnitId(issue);
      if (!unitId) return;

      let data = countMap.get(unitId);
      if (!data) {
        data = {
          count: 0,
          lastDate: null,
          injuries: 0,
          deaths: 0,
          arrests: 0,
          byCategory: {}
        };
        countMap.set(unitId, data);
      }

      data.count++;
      if (!data.lastDate || (issue.date && issue.date > data.lastDate)) {
        data.lastDate = issue.date;
      }
      data.injuries += issue.injuryCount || 0;
      data.deaths += issue.deathCount || 0;
      data.arrests += issue.arrestCount || 0;

      const catName = issue.issueCategory?.name || 'Other';
      data.byCategory[catName] = (data.byCategory[catName] || 0) + 1;

      maxCount = Math.max(maxCount, data.count);
    });

    // Build where clause for admin units
    const unitWhere: any = { level: adminLevel };
    if (parentUnitId) {
      unitWhere.parentId = parentUnitId;
    }

    // Get admin units at the specified level with geometry
    const adminUnits = await prisma.administrativeUnit.findMany({
      where: unitWhere,
      select: {
        id: true,
        name: true,
        code: true,
        geometry: true,
        parentId: true
      }
    });

    // Helper to clean geometry by removing empty polygon arrays
    const cleanGeometry = (geometry: any): any => {
      if (!geometry || !geometry.coordinates) return null;

      if (geometry.type === 'MultiPolygon') {
        // Filter out empty polygons
        const cleanedCoords = geometry.coordinates.filter((polygon: any) =>
          Array.isArray(polygon) && polygon.length > 0 &&
          Array.isArray(polygon[0]) && polygon[0].length > 0
        );
        if (cleanedCoords.length === 0) return null;
        return { ...geometry, coordinates: cleanedCoords };
      } else if (geometry.type === 'Polygon') {
        // Ensure polygon has valid rings
        if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return null;
        if (!Array.isArray(geometry.coordinates[0]) || geometry.coordinates[0].length === 0) return null;
        return geometry;
      }
      return geometry;
    };

    // Build GeoJSON features
    const features: any[] = [];

    for (const unit of adminUnits) {
      // Skip units without geometry
      if (!unit.geometry) continue;

      try {
        const rawGeometry = JSON.parse(unit.geometry);

        // Basic validation
        if (!rawGeometry || !rawGeometry.coordinates || !rawGeometry.type) {
          continue;
        }

        // Clean geometry to remove empty polygon arrays that break MapLibre
        const geometry = cleanGeometry(rawGeometry);
        if (!geometry) {
          continue;
        }

        const issueData = countMap.get(unit.id) || {
          count: 0,
          lastDate: null,
          injuries: 0,
          deaths: 0,
          arrests: 0,
          byCategory: {}
        };
        const count = issueData.count;

        // Calculate color based on issue count (0 = green, max = red)
        const intensity = maxCount > 0 ? count / maxCount : 0;
        const color = getIssueIntensityColor(intensity, count);

        // Get top categories for this unit (sorted by count)
        const topCategories = Object.entries(issueData.byCategory)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, cnt]) => ({ name, count: cnt }));

        features.push({
          type: 'Feature' as const,
          id: unit.id,
          properties: {
            unitId: unit.id,
            unitName: unit.name,
            unitCode: unit.code,
            level: adminLevel,
            parentId: unit.parentId,
            issueCount: count,
            lastIssueDate: issueData.lastDate,
            injuries: issueData.injuries,
            deaths: issueData.deaths,
            arrests: issueData.arrests,
            totalCasualties: issueData.injuries + issueData.deaths + issueData.arrests,
            topCategories: JSON.stringify(topCategories),
            fillColor: color,
            intensity: intensity
          },
          geometry: geometry
        });
      } catch (e) {
        // Skip invalid geometry
      }
    }

    console.log(`[Issues Choropleth] Level ${adminLevel}: ${features.length} features, ${countMap.size} with issues`);

    res.json({
      type: 'FeatureCollection',
      features,
      metadata: {
        totalIssues: issues.length,
        unitsWithIssues: countMap.size,
        maxIssuesPerUnit: maxCount,
        level: adminLevel,
        parentId: parentUnitId
      }
    });
  } catch (error) {
    console.error('Error fetching issues choropleth:', error);
    res.status(500).json({ error: 'Failed to fetch issues choropleth data' });
  }
};

// Helper function to get color based on issue intensity
// Uses a sequential color scale from light (few issues) to dark red (many issues)
function getIssueIntensityColor(intensity: number, count: number): string {
  if (count === 0) {
    return '#d1d5db'; // Light gray for no issues
  }

  // Sequential scale: light yellow -> yellow -> orange -> red -> dark red
  if (intensity < 0.1) {
    return '#fef3c7'; // Very light yellow - minimal issues (1-2)
  } else if (intensity < 0.25) {
    return '#fde047'; // Yellow - few issues
  } else if (intensity < 0.5) {
    return '#f59e0b'; // Amber/Orange - moderate issues
  } else if (intensity < 0.75) {
    return '#ea580c'; // Dark orange - many issues
  } else {
    return '#dc2626'; // Red - critical level
  }
}
