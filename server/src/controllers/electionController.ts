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

// Get all elections
export const getAllElections = async (req: Request, res: Response): Promise<void> => {
  try {
    const elections = await prisma.election.findMany({
      include: {
        electionType: {
          select: {
            name: true,
            code: true,
            electoralLevel: true
          }
        },
        _count: {
          select: {
            candidates: true,
            results: true
          }
        }
      },
      orderBy: { electionDate: 'desc' }
    });

    // Transform to include electionType name as a top-level field for backwards compatibility
    const transformed = elections.map(e => ({
      ...e,
      electionTypeName: e.electionType.name,
      electionTypeCode: e.electionType.code
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get elections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get active election
export const getActiveElection = async (req: Request, res: Response): Promise<void> => {
  try {
    const election = await prisma.election.findFirst({
      where: { isActive: true },
      include: {
        electionType: true,
        candidates: {
          include: {
            person: { select: { fullName: true } },
            party: { select: { name: true, abbreviation: true, color: true } }
          }
        }
      }
    });

    if (!election) {
      res.status(404).json({ error: 'No active election found' });
      return;
    }

    res.json(election);
  } catch (error) {
    console.error('Get active election error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get election by ID with candidates
export const getElectionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.id);

    if (isNaN(electionId)) {
      res.status(400).json({ error: 'Invalid election ID' });
      return;
    }

    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        electionType: true,
        candidates: {
          include: {
            person: { select: { fullName: true } },
            party: { select: { name: true, abbreviation: true, color: true } }
          }
        },
        _count: {
          select: { results: true }
        }
      }
    });

    if (!election) {
      res.status(404).json({ error: 'Election not found' });
      return;
    }

    res.json(election);
  } catch (error) {
    console.error('Get election error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create election (Admin only)
export const createElection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, year, electionDate, electionTypeId, isActive } = req.body;

    if (!name || !year || !electionDate || !electionTypeId) {
      res.status(400).json({ error: 'Name, year, date, and election type ID are required' });
      return;
    }

    // Verify election type exists
    const electionType = await prisma.electionType.findUnique({
      where: { id: parseInt(electionTypeId) }
    });

    if (!electionType) {
      res.status(404).json({ error: 'Election type not found' });
      return;
    }

    const election = await prisma.election.create({
      data: {
        name,
        year: parseInt(year),
        electionDate: new Date(electionDate),
        electionTypeId: parseInt(electionTypeId),
        isActive: isActive || false
      },
      include: {
        electionType: true
      }
    });

    // Audit log
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'CREATE_ELECTION',
      'election',
      election.id,
      null,
      { name: election.name, year: election.year, type: election.electionType.name, isActive: election.isActive },
      getClientIp(req),
      `Created election: ${election.name} (${election.electionType.name})`
    );

    res.status(201).json({
      message: 'Election created successfully',
      election
    });
  } catch (error) {
    console.error('Create election error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update election (Admin only)
export const updateElection = async (req: Request, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.id);
    const { name, year, electionDate, electionTypeId, isActive } = req.body;

    if (isNaN(electionId)) {
      res.status(400).json({ error: 'Invalid election ID' });
      return;
    }

    // Fetch old election data for audit log
    const oldElection = await prisma.election.findUnique({
      where: { id: electionId },
      include: { electionType: true }
    });

    if (!oldElection) {
      res.status(404).json({ error: 'Election not found' });
      return;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (year !== undefined) updateData.year = parseInt(year);
    if (electionDate !== undefined) updateData.electionDate = new Date(electionDate);
    if (electionTypeId !== undefined) {
      // Verify election type exists
      const electionType = await prisma.electionType.findUnique({
        where: { id: parseInt(electionTypeId) }
      });
      if (!electionType) {
        res.status(404).json({ error: 'Election type not found' });
        return;
      }
      updateData.electionTypeId = parseInt(electionTypeId);
    }
    if (isActive !== undefined) updateData.isActive = isActive;

    const election = await prisma.election.update({
      where: { id: electionId },
      data: updateData,
      include: {
        electionType: true
      }
    });

    // Build change description
    const changes: string[] = [];
    if (name !== undefined && name !== oldElection.name) changes.push('name');
    if (year !== undefined && parseInt(year) !== oldElection.year) changes.push('year');
    if (electionDate !== undefined) changes.push('date');
    if (isActive !== undefined && isActive !== oldElection.isActive) {
      changes.push(isActive ? 'activated' : 'deactivated');
    }

    // Audit log
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'UPDATE_ELECTION',
      'election',
      election.id,
      { name: oldElection.name, year: oldElection.year, isActive: oldElection.isActive },
      { name: election.name, year: election.year, isActive: election.isActive },
      getClientIp(req),
      `Updated election ${election.name}: ${changes.join(', ') || 'no changes'}`
    );

    res.json({
      message: 'Election updated successfully',
      election
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Election not found' });
      return;
    }
    console.error('Update election error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete election (Admin only)
export const deleteElection = async (req: Request, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.id);

    if (isNaN(electionId)) {
      res.status(400).json({ error: 'Invalid election ID' });
      return;
    }

    // Fetch election data for audit log before deletion
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: { electionType: true }
    });

    if (!election) {
      res.status(404).json({ error: 'Election not found' });
      return;
    }

    await prisma.election.delete({
      where: { id: electionId }
    });

    // Audit log
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'DELETE_ELECTION',
      'election',
      electionId,
      { name: election.name, year: election.year, type: election.electionType.name },
      null,
      getClientIp(req),
      `Deleted election: ${election.name} (${election.year})`
    );

    res.json({ message: 'Election deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Election not found' });
      return;
    }
    if (error.code === 'P2003') {
      res.status(400).json({ error: 'Cannot delete election with existing candidates or results' });
      return;
    }
    console.error('Delete election error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get party summary (seats won by each party) for an election
export const getPartySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.id);
    const districtId = req.query.districtId ? parseInt(req.query.districtId as string) : null;

    if (isNaN(electionId)) {
      res.status(400).json({ error: 'Invalid election ID' });
      return;
    }

    // Get election details
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: { electionType: true }
    });

    if (!election) {
      res.status(404).json({ error: 'Election not found' });
      return;
    }

    // Only applicable for elections at level 2 (District) or 3 (Constituency)
    const electoralLevel = election.electionType.electoralLevel;
    if (electoralLevel === 0) {
      // Presidential - return single winner
      res.json({
        electionId,
        electionName: election.name,
        electoralLevel,
        message: 'Presidential elections have a single national winner',
        partySummary: []
      });
      return;
    }

    // For Constituency MP elections, get constituencies within the selected district
    let validElectoralAreas: Set<number> | null = null;
    if (electoralLevel === 3 && districtId) {
      // Get all constituencies within this district
      const constituencies = await prisma.administrativeUnit.findMany({
        where: { level: 3, parentId: districtId },
        select: { id: true }
      });
      validElectoralAreas = new Set(constituencies.map(c => c.id));
    }

    // Get all approved results with candidate and party info
    const results = await prisma.result.findMany({
      where: {
        electionId,
        status: 'approved'
      },
      include: {
        candidate: {
          include: {
            party: { select: { id: true, name: true, abbreviation: true, color: true } }
          }
        }
      }
    });

    // Get unique electoral areas from candidates
    const candidates = await prisma.candidate.findMany({
      where: { electionId },
      select: {
        id: true,
        electoralAreaId: true,
        partyId: true,
        party: { select: { id: true, name: true, abbreviation: true, color: true } }
      }
    });

    // Group results by electoral area and find winner
    const votesByAreaAndCandidate = new Map<number, Map<number, number>>();

    for (const result of results) {
      const candidate = candidates.find(c => c.id === result.candidateId);
      if (!candidate || !candidate.electoralAreaId) continue;

      const areaId = candidate.electoralAreaId;

      // If filtering by district, skip areas not in the district
      if (validElectoralAreas && !validElectoralAreas.has(areaId)) continue;

      if (!votesByAreaAndCandidate.has(areaId)) {
        votesByAreaAndCandidate.set(areaId, new Map());
      }

      const areaVotes = votesByAreaAndCandidate.get(areaId)!;
      const currentVotes = areaVotes.get(result.candidateId) || 0;
      areaVotes.set(result.candidateId, currentVotes + result.votes);
    }

    // Find winner per area
    const winners: Array<{ candidateId: number; partyId: number | null }> = [];

    for (const [areaId, candidateVotes] of votesByAreaAndCandidate) {
      let maxVotes = 0;
      let winnerId: number | null = null;

      for (const [candidateId, votes] of candidateVotes) {
        if (votes > maxVotes) {
          maxVotes = votes;
          winnerId = candidateId;
        }
      }

      if (winnerId) {
        const candidate = candidates.find(c => c.id === winnerId);
        winners.push({
          candidateId: winnerId,
          partyId: candidate?.partyId || null
        });
      }
    }

    // Group winners by party
    const partySeats = new Map<number | null, number>();
    for (const winner of winners) {
      const current = partySeats.get(winner.partyId) || 0;
      partySeats.set(winner.partyId, current + 1);
    }

    // Get party details and build summary
    const parties = await prisma.politicalParty.findMany({
      where: { id: { in: Array.from(partySeats.keys()).filter(id => id !== null) as number[] } }
    });

    const partyMap = new Map(parties.map(p => [p.id, p]));
    const totalSeats = winners.length;

    const partySummary = Array.from(partySeats.entries())
      .map(([partyId, seatsWon]) => {
        if (partyId === null) {
          return {
            partyId: null,
            partyName: 'Independent',
            abbreviation: 'IND',
            color: '#808080',
            seatsWon,
            percentage: totalSeats > 0 ? Math.round((seatsWon / totalSeats) * 10000) / 100 : 0
          };
        }
        const party = partyMap.get(partyId);
        return {
          partyId,
          partyName: party?.name || 'Unknown',
          abbreviation: party?.abbreviation || '?',
          color: party?.color || '#808080',
          seatsWon,
          percentage: totalSeats > 0 ? Math.round((seatsWon / totalSeats) * 10000) / 100 : 0
        };
      })
      .sort((a, b) => b.seatsWon - a.seatsWon);

    res.json({
      electionId,
      electionName: election.name,
      electoralLevel,
      totalSeats,
      partySummary
    });
  } catch (error) {
    console.error('Get party summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all candidates for an election
export const getCandidatesByElection = async (req: Request, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.id);

    if (isNaN(electionId)) {
      res.status(400).json({ error: 'Invalid election ID' });
      return;
    }

    const candidates = await prisma.candidate.findMany({
      where: { electionId },
      include: {
        person: { select: { fullName: true } },
        party: { select: { name: true, abbreviation: true, color: true } },
        electoralArea: { select: { name: true, code: true } },
        _count: {
          select: { results: true }
        }
      },
      orderBy: { ballotOrder: 'asc' }
    });

    res.json(candidates);
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
