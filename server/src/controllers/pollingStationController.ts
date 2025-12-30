import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Get polling stations with filters
 * GET /api/polling-stations
 * Query params: districtId, constituencyId, subcountyId, parishId, electionId, limit, offset
 */
export const getPollingStations = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      districtId,
      constituencyId,
      subcountyId,
      parishId,
      electionId,
      limit = '100',
      offset = '0'
    } = req.query;

    // Build where clause for parish hierarchy
    let parishWhere: any = {};

    if (parishId) {
      parishWhere.id = parseInt(parishId as string);
    } else if (subcountyId) {
      parishWhere.parentId = parseInt(subcountyId as string);
    } else if (constituencyId) {
      parishWhere.parent = { parentId: parseInt(constituencyId as string) };
    } else if (districtId) {
      parishWhere.parent = { parent: { parentId: parseInt(districtId as string) } };
    }

    const where: any = {};
    if (Object.keys(parishWhere).length > 0) {
      where.parish = parishWhere;
    }

    // Filter by election if specified
    if (electionId) {
      where.electionData = {
        some: { electionId: parseInt(electionId as string) }
      };
    }

    const [stations, total] = await Promise.all([
      prisma.pollingStation.findMany({
        where,
        include: {
          parish: {
            select: {
              id: true,
              name: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  parent: {
                    select: {
                      id: true,
                      name: true,
                      parent: {
                        select: { id: true, name: true }
                      }
                    }
                  }
                }
              }
            }
          },
          electionData: {
            select: {
              electionId: true,
              totalVoters: true,
              election: { select: { name: true, year: true } }
            }
          }
        },
        orderBy: { name: 'asc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.pollingStation.count({ where })
    ]);

    res.json({
      stations,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Error fetching polling stations:', error);
    res.status(500).json({ error: 'Failed to fetch polling stations' });
  }
};

/**
 * Get polling stations as GeoJSON for map display
 * GET /api/polling-stations/geojson
 * Uses parish centroid since individual station coordinates aren't available
 */
export const getPollingStationsGeoJSON = async (req: Request, res: Response): Promise<void> => {
  try {
    const { districtId, electionId } = req.query;

    let parishWhere: any = { level: 5 };

    if (districtId) {
      // Get parishes under this district
      parishWhere.parent = {
        parent: {
          parentId: parseInt(districtId as string)
        }
      };
    }

    // Get parishes with their stations
    const parishes = await prisma.administrativeUnit.findMany({
      where: parishWhere,
      select: {
        id: true,
        name: true,
        geometry: true,
        parent: {
          select: {
            name: true,
            parent: {
              select: {
                name: true,
                parent: {
                  select: { name: true }
                }
              }
            }
          }
        },
        pollingStations: {
          select: {
            id: true,
            name: true,
            code: true,
            electionData: electionId ? {
              where: { electionId: parseInt(electionId as string) },
              select: { totalVoters: true }
            } : {
              select: { totalVoters: true, electionId: true }
            }
          }
        }
      }
    });

    // Convert to GeoJSON - one point per parish with aggregated station data
    const features = parishes
      .filter(p => p.pollingStations.length > 0)
      .map(parish => {
        let coordinates: [number, number] = [32.58, 1.37]; // Uganda center default

        // Calculate centroid from parish geometry
        if (parish.geometry) {
          try {
            const geojson = JSON.parse(parish.geometry);
            coordinates = calculateCentroid(geojson);
          } catch (e) {
            // Use default
          }
        }

        const totalStations = parish.pollingStations.length;
        const totalVoters = parish.pollingStations.reduce((sum, s) => {
          const voters = s.electionData.reduce((v, e) => v + (e.totalVoters || 0), 0);
          return sum + voters;
        }, 0);

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates
          },
          properties: {
            parishId: parish.id,
            parishName: parish.name,
            subcounty: parish.parent?.name,
            constituency: parish.parent?.parent?.name,
            district: parish.parent?.parent?.parent?.name,
            stationCount: totalStations,
            totalVoters,
            stations: parish.pollingStations.map(s => ({
              id: s.id,
              name: s.name,
              code: s.code
            }))
          }
        };
      });

    res.json({
      type: 'FeatureCollection',
      features
    });
  } catch (error) {
    console.error('Error fetching polling stations GeoJSON:', error);
    res.status(500).json({ error: 'Failed to fetch polling stations for map' });
  }
};

/**
 * Get polling station statistics
 * GET /api/polling-stations/stats
 */
export const getPollingStationStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { electionId } = req.query;

    const where: any = {};
    if (electionId) {
      where.electionId = parseInt(electionId as string);
    }

    const [
      totalStations,
      totalElectionData,
      byElection,
      topDistricts
    ] = await Promise.all([
      prisma.pollingStation.count(),
      prisma.pollingStationElection.count({ where }),
      prisma.pollingStationElection.groupBy({
        by: ['electionId'],
        _count: true,
        _sum: { totalVoters: true }
      }),
      // Top districts by station count
      prisma.$queryRaw<Array<{ district: string; districtId: number; count: bigint }>>`
        SELECT
          d.name as district,
          d.id as "districtId",
          COUNT(ps.id) as count
        FROM polling_stations ps
        JOIN administrative_units parish ON ps.parish_id = parish.id
        JOIN administrative_units subcounty ON parish.parent_id = subcounty.id
        JOIN administrative_units constituency ON subcounty.parent_id = constituency.id
        JOIN administrative_units d ON constituency.parent_id = d.id
        GROUP BY d.id, d.name
        ORDER BY count DESC
        LIMIT 10
      `
    ]);

    // Get election names for the grouped data
    const electionIds = byElection.map(e => e.electionId);
    const elections = await prisma.election.findMany({
      where: { id: { in: electionIds } },
      select: { id: true, name: true, year: true }
    });
    const electionMap = new Map(elections.map(e => [e.id, e]));

    res.json({
      totalStations,
      totalElectionData,
      byElection: byElection.map(e => ({
        electionId: e.electionId,
        electionName: electionMap.get(e.electionId)?.name || 'Unknown',
        year: electionMap.get(e.electionId)?.year,
        stationCount: e._count,
        totalVoters: e._sum.totalVoters
      })),
      topDistricts: topDistricts.map(d => ({
        district: d.district,
        districtId: d.districtId,
        count: Number(d.count)
      }))
    });
  } catch (error) {
    console.error('Error fetching polling station stats:', error);
    res.status(500).json({ error: 'Failed to fetch polling station statistics' });
  }
};

/**
 * Get single polling station by ID
 * GET /api/polling-stations/:id
 */
export const getPollingStationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const station = await prisma.pollingStation.findUnique({
      where: { id: parseInt(id) },
      include: {
        parish: {
          select: {
            id: true,
            name: true,
            geometry: true,
            parent: {
              select: {
                id: true,
                name: true,
                parent: {
                  select: {
                    id: true,
                    name: true,
                    parent: {
                      select: { id: true, name: true }
                    }
                  }
                }
              }
            }
          }
        },
        electionData: {
          include: {
            election: {
              select: { id: true, name: true, year: true }
            }
          },
          orderBy: { election: { year: 'desc' } }
        }
      }
    });

    if (!station) {
      res.status(404).json({ error: 'Polling station not found' });
      return;
    }

    res.json(station);
  } catch (error) {
    console.error('Error fetching polling station:', error);
    res.status(500).json({ error: 'Failed to fetch polling station' });
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
