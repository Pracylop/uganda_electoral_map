import { Request, Response } from 'express';
import prisma from '../config/database';
import { createAuditLog } from '../middleware/auditLog';
import { websocketService } from '../services/websocketService';

// Helper to get client IP
const getClientIp = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

// Create or update result (Operator/Editor/Admin)
export const createResult = async (req: Request, res: Response): Promise<void> => {
  const ipAddress = getClientIp(req);

  try {
    const {
      electionId,
      candidateId,
      administrativeUnitId,
      votes,
      validVotes,
      invalidVotes,
      turnout
    } = req.body;

    if (!electionId || !candidateId || !administrativeUnitId || votes === undefined) {
      res.status(400).json({
        error: 'Election ID, candidate ID, administrative unit ID, and votes are required'
      });
      return;
    }

    // Verify election, candidate, and admin unit exist
    const [election, candidate, adminUnit] = await Promise.all([
      prisma.election.findUnique({ where: { id: parseInt(electionId) } }),
      prisma.candidate.findUnique({ where: { id: parseInt(candidateId) } }),
      prisma.administrativeUnit.findUnique({ where: { id: parseInt(administrativeUnitId) } })
    ]);

    if (!election) {
      res.status(404).json({ error: 'Election not found' });
      return;
    }

    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    if (!adminUnit) {
      res.status(404).json({ error: 'Administrative unit not found' });
      return;
    }

    // Create result (defaults to 'draft' status)
    const result = await prisma.result.create({
      data: {
        electionId: parseInt(electionId),
        candidateId: parseInt(candidateId),
        adminUnitId: parseInt(administrativeUnitId),
        votes: parseInt(votes),
        status: 'draft',
        enteredBy: req.user!.userId
      },
      include: {
        election: true,
        candidate: true,
        administrativeUnit: true
      }
    });

    // Log the action
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'CREATE_RESULT',
      'result',
      result.id,
      null,
      result,
      ipAddress,
      `Created result for ${candidate.name} in ${adminUnit.name}`
    );

    res.status(201).json({
      message: 'Result created successfully',
      result
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Result already exists for this combination' });
      return;
    }
    console.error('Create result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Submit result for approval (Operator/Editor changes status from draft to pending)
export const submitResultForApproval = async (req: Request, res: Response): Promise<void> => {
  const ipAddress = getClientIp(req);

  try {
    const resultId = parseInt(req.params.id);

    if (isNaN(resultId)) {
      res.status(400).json({ error: 'Invalid result ID' });
      return;
    }

    const existingResult = await prisma.result.findUnique({
      where: { id: resultId },
      include: {
        candidate: true,
        administrativeUnit: true
      }
    });

    if (!existingResult) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    if (existingResult.status !== 'draft') {
      res.status(400).json({ error: 'Only draft results can be submitted for approval' });
      return;
    }

    const result = await prisma.result.update({
      where: { id: resultId },
      data: {
        status: 'pending'
      },
      include: {
        election: true,
        candidate: true,
        administrativeUnit: true
      }
    });

    // Log the action
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'SUBMIT_RESULT',
      'result',
      result.id,
      { status: 'draft' },
      { status: 'pending' },
      ipAddress,
      `Submitted result for approval`
    );

    // Notify editors/admins via WebSocket
    websocketService.broadcastToRoles(
      {
        type: 'RESULT_SUBMITTED',
        payload: {
          resultId: result.id,
          candidate: result.candidate.name,
          location: result.administrativeUnit.name
        }
      },
      ['editor', 'admin']
    );

    res.json({
      message: 'Result submitted for approval',
      result
    });
  } catch (error) {
    console.error('Submit result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Approve result (Editor/Admin only)
export const approveResult = async (req: Request, res: Response): Promise<void> => {
  const ipAddress = getClientIp(req);

  try {
    const resultId = parseInt(req.params.id);

    if (isNaN(resultId)) {
      res.status(400).json({ error: 'Invalid result ID' });
      return;
    }

    const existingResult = await prisma.result.findUnique({
      where: { id: resultId },
      include: {
        candidate: true,
        administrativeUnit: true
      }
    });

    if (!existingResult) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    if (existingResult.status !== 'pending') {
      res.status(400).json({ error: 'Only pending results can be approved' });
      return;
    }

    const result = await prisma.result.update({
      where: { id: resultId },
      data: {
        status: 'approved',
        verifiedAt: new Date(),
        verifiedBy: req.user!.userId
      },
      include: {
        election: true,
        candidate: true,
        administrativeUnit: true
      }
    });

    // Log the action
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'APPROVE_RESULT',
      'result',
      result.id,
      { status: 'pending' },
      { status: 'approved' },
      ipAddress,
      `Approved result`
    );

    // Broadcast update to all connected clients
    websocketService.broadcast({
      type: 'RESULT_APPROVED',
      payload: {
        resultId: result.id,
        electionId: result.electionId,
        candidateId: result.candidateId,
        adminUnitId: result.adminUnitId,
        votes: result.votes
      }
    });

    // Also broadcast a national totals update (for dashboard)
    websocketService.broadcast({
      type: 'NATIONAL_TOTALS_UPDATED',
      payload: {
        electionId: result.electionId
      }
    });

    res.json({
      message: 'Result approved successfully',
      result
    });
  } catch (error) {
    console.error('Approve result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reject result (Editor/Admin only)
export const rejectResult = async (req: Request, res: Response): Promise<void> => {
  const ipAddress = getClientIp(req);

  try {
    const resultId = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(resultId)) {
      res.status(400).json({ error: 'Invalid result ID' });
      return;
    }

    const existingResult = await prisma.result.findUnique({
      where: { id: resultId }
    });

    if (!existingResult) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    if (existingResult.status !== 'pending') {
      res.status(400).json({ error: 'Only pending results can be rejected' });
      return;
    }

    const result = await prisma.result.update({
      where: { id: resultId },
      data: {
        status: 'rejected',
        verifiedAt: new Date(),
        verifiedBy: req.user!.userId,
        rejectionComment: reason
      },
      include: {
        election: true,
        candidate: true,
        administrativeUnit: true
      }
    });

    // Log the action
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'REJECT_RESULT',
      'result',
      result.id,
      { status: 'pending' },
      { status: 'rejected', reason },
      ipAddress,
      `Rejected result: ${reason || 'No reason provided'}`
    );

    // Notify submitter
    if (result.enteredBy) {
      websocketService.sendToUser(result.enteredBy, {
        type: 'RESULT_REJECTED',
        payload: {
          resultId: result.id,
          reason: reason || 'No reason provided'
        }
      });
    }

    res.json({
      message: 'Result rejected',
      result
    });
  } catch (error) {
    console.error('Reject result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get results by election (all statuses for Editor/Admin, only approved for others)
export const getResultsByElection = async (req: Request, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.electionId);

    if (isNaN(electionId)) {
      res.status(400).json({ error: 'Invalid election ID' });
      return;
    }

    const userRole = req.user?.role || 'viewer';
    const whereClause: any = { electionId };

    // Viewers and Operators only see approved results
    if (!['editor', 'admin'].includes(userRole)) {
      whereClause.status = 'approved';
    }

    const results = await prisma.result.findMany({
      where: whereClause,
      include: {
        candidate: true,
        administrativeUnit: true
      },
      orderBy: [
        { administrativeUnit: { name: 'asc' } },
        { candidate: { name: 'asc' } }
      ]
    });

    res.json(results);
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get pending results (Editor/Admin only)
export const getPendingResults = async (req: Request, res: Response): Promise<void> => {
  try {
    const results = await prisma.result.findMany({
      where: { status: 'pending' },
      include: {
        election: true,
        candidate: true,
        administrativeUnit: true
      },
      orderBy: { updatedAt: 'asc' }
    });

    res.json(results);
  } catch (error) {
    console.error('Get pending results error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get national totals for an election (for broadcast dashboard)
export const getNationalTotals = async (req: Request, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.electionId);

    if (isNaN(electionId)) {
      res.status(400).json({ error: 'Invalid election ID' });
      return;
    }

    // Verify election exists
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        candidates: true
      }
    });

    if (!election) {
      res.status(404).json({ error: 'Election not found' });
      return;
    }

    // Get all approved results for this election
    const results = await prisma.result.findMany({
      where: {
        electionId,
        status: 'approved'
      },
      include: {
        candidate: true
      }
    });

    // Aggregate votes by candidate
    const candidateTotals = new Map<number, {
      candidateId: number;
      candidateName: string;
      party: string;
      partyColor: string | null;
      totalVotes: number;
    }>();

    let totalVotesCast = 0;

    results.forEach(result => {
      totalVotesCast += result.votes;

      const existing = candidateTotals.get(result.candidateId);
      if (existing) {
        existing.totalVotes += result.votes;
      } else {
        candidateTotals.set(result.candidateId, {
          candidateId: result.candidateId,
          candidateName: result.candidate.name,
          party: result.candidate.party,
          partyColor: result.candidate.partyColor,
          totalVotes: result.votes
        });
      }
    });

    // Convert to array and calculate percentages
    const candidateResults = Array.from(candidateTotals.values())
      .map(candidate => ({
        ...candidate,
        percentage: totalVotesCast > 0 ? (candidate.totalVotes / totalVotesCast) * 100 : 0
      }))
      .sort((a, b) => b.totalVotes - a.totalVotes); // Sort by votes descending

    // Get total registered voters (sum across all admin units at national level)
    const registeredVotersResult = await prisma.administrativeUnit.aggregate({
      _sum: {
        registeredVoters: true
      },
      where: {
        level: 0 // National level, or we could sum all lowest levels
      }
    });

    const totalRegisteredVoters = registeredVotersResult._sum.registeredVoters || 0;

    // Calculate turnout
    const turnoutPercentage = totalRegisteredVoters > 0
      ? (totalVotesCast / totalRegisteredVoters) * 100
      : 0;

    // Determine winner (if any candidate has >50%)
    const winner = candidateResults.find(c => c.percentage > 50) || null;

    // Count reporting areas
    const reportingAreasCount = await prisma.result.groupBy({
      by: ['adminUnitId'],
      where: {
        electionId,
        status: 'approved'
      }
    });

    const totalAreasCount = await prisma.administrativeUnit.count({
      where: {
        level: { in: [3, 4, 5] } // Constituencies, subcounties, and parishes
      }
    });

    res.json({
      electionId,
      electionName: election.name,
      electionDate: election.electionDate,
      totalVotesCast,
      totalRegisteredVoters,
      turnoutPercentage: parseFloat(turnoutPercentage.toFixed(2)),
      reportingAreas: reportingAreasCount.length,
      totalAreas: totalAreasCount,
      reportingPercentage: totalAreasCount > 0
        ? parseFloat(((reportingAreasCount.length / totalAreasCount) * 100).toFixed(2))
        : 0,
      candidateResults,
      winner: winner ? {
        candidateId: winner.candidateId,
        candidateName: winner.candidateName,
        party: winner.party,
        totalVotes: winner.totalVotes,
        percentage: parseFloat(winner.percentage.toFixed(2))
      } : null
    });
  } catch (error) {
    console.error('Get national totals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
