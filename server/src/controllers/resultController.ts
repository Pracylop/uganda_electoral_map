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
      adminUnitId,
      votes
    } = req.body;

    if (!electionId || !candidateId || !adminUnitId || votes === undefined) {
      res.status(400).json({
        error: 'Election ID, candidate ID, admin unit ID, and votes are required'
      });
      return;
    }

    // Verify election, candidate, and admin unit exist
    const [election, candidate, adminUnit] = await Promise.all([
      prisma.election.findUnique({ where: { id: parseInt(electionId) } }),
      prisma.candidate.findUnique({
        where: { id: parseInt(candidateId) },
        include: { person: { select: { fullName: true } } }
      }),
      prisma.administrativeUnit.findUnique({ where: { id: parseInt(adminUnitId) } })
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
        adminUnitId: parseInt(adminUnitId),
        votes: parseInt(votes),
        status: 'draft',
        enteredBy: req.user!.userId
      },
      include: {
        election: true,
        candidate: {
          include: {
            person: { select: { fullName: true } },
            party: { select: { abbreviation: true, color: true } }
          }
        },
        adminUnit: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true
          }
        }
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
      `Created result for ${candidate.person.fullName} in ${adminUnit.name}`
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
        candidate: {
          include: {
            person: { select: { fullName: true } }
          }
        },
        adminUnit: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true
          }
        }
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
        candidate: {
          include: {
            person: { select: { fullName: true } },
            party: { select: { abbreviation: true, color: true } }
          }
        },
        adminUnit: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true
          }
        }
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
          candidate: result.candidate.person.fullName,
          location: result.adminUnit.name
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
        candidate: {
          include: { person: { select: { fullName: true } } }
        },
        adminUnit: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true
          }
        }
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
        candidate: {
          include: {
            person: { select: { fullName: true } },
            party: { select: { abbreviation: true, color: true } }
          }
        },
        adminUnit: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true
          }
        }
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
        candidate: {
          include: {
            person: { select: { fullName: true } },
            party: { select: { abbreviation: true, color: true } }
          }
        },
        adminUnit: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true
          }
        }
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

// Update result (Editor/Admin only - can only update draft or rejected results)
export const updateResult = async (req: Request, res: Response): Promise<void> => {
  const ipAddress = getClientIp(req);

  try {
    const resultId = parseInt(req.params.id);
    const { votes } = req.body;

    if (isNaN(resultId)) {
      res.status(400).json({ error: 'Invalid result ID' });
      return;
    }

    if (votes === undefined) {
      res.status(400).json({ error: 'Votes count is required' });
      return;
    }

    // Fetch existing result
    const existingResult = await prisma.result.findUnique({
      where: { id: resultId },
      include: {
        candidate: {
          include: { person: { select: { fullName: true } } }
        },
        adminUnit: { select: { name: true } }
      }
    });

    if (!existingResult) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    // Can only update draft or rejected results
    if (!['draft', 'rejected'].includes(existingResult.status)) {
      res.status(400).json({
        error: 'Only draft or rejected results can be updated',
        currentStatus: existingResult.status
      });
      return;
    }

    const result = await prisma.result.update({
      where: { id: resultId },
      data: {
        votes: parseInt(votes),
        status: 'draft', // Reset to draft if it was rejected
        rejectionComment: null
      },
      include: {
        election: true,
        candidate: {
          include: {
            person: { select: { fullName: true } },
            party: { select: { abbreviation: true, color: true } }
          }
        },
        adminUnit: {
          select: { id: true, name: true, code: true, level: true }
        }
      }
    });

    // Log the action
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'UPDATE_RESULT',
      'result',
      result.id,
      { votes: existingResult.votes, status: existingResult.status },
      { votes: result.votes, status: result.status },
      ipAddress,
      `Updated result for ${existingResult.candidate.person.fullName} in ${existingResult.adminUnit.name}: ${existingResult.votes} → ${result.votes} votes`
    );

    res.json({
      message: 'Result updated successfully',
      result
    });
  } catch (error) {
    console.error('Update result error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete result (Admin only - can only delete draft or rejected results)
export const deleteResult = async (req: Request, res: Response): Promise<void> => {
  const ipAddress = getClientIp(req);

  try {
    const resultId = parseInt(req.params.id);

    if (isNaN(resultId)) {
      res.status(400).json({ error: 'Invalid result ID' });
      return;
    }

    // Fetch existing result before deletion
    const existingResult = await prisma.result.findUnique({
      where: { id: resultId },
      include: {
        candidate: {
          include: { person: { select: { fullName: true } } }
        },
        adminUnit: { select: { name: true } },
        election: { select: { name: true } }
      }
    });

    if (!existingResult) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    // Can only delete draft or rejected results (not pending or approved)
    if (!['draft', 'rejected'].includes(existingResult.status)) {
      res.status(400).json({
        error: 'Only draft or rejected results can be deleted',
        currentStatus: existingResult.status
      });
      return;
    }

    await prisma.result.delete({
      where: { id: resultId }
    });

    // Log the action
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'DELETE_RESULT',
      'result',
      resultId,
      {
        candidateName: existingResult.candidate.person.fullName,
        adminUnit: existingResult.adminUnit.name,
        votes: existingResult.votes,
        status: existingResult.status
      },
      null,
      ipAddress,
      `Deleted result for ${existingResult.candidate.person.fullName} in ${existingResult.adminUnit.name} (${existingResult.votes} votes)`
    );

    res.json({ message: 'Result deleted successfully' });
  } catch (error) {
    console.error('Delete result error:', error);
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
        candidate: {
          include: {
            person: { select: { fullName: true } },
            party: { select: { name: true, abbreviation: true, color: true } }
          }
        },
        adminUnit: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true
          }
        }
      },
      orderBy: [
        { adminUnit: { name: 'asc' } },
        { candidate: { person: { fullName: 'asc' } } }
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
        candidate: {
          include: {
            person: { select: { fullName: true } },
            party: { select: { name: true, abbreviation: true, color: true } }
          }
        },
        adminUnit: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true
          }
        }
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
        candidate: {
          include: {
            person: { select: { fullName: true } },
            party: { select: { abbreviation: true, color: true } }
          }
        }
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
          candidateName: result.candidate.person.fullName,
          party: result.candidate.party?.abbreviation || 'IND',
          partyColor: result.candidate.party?.color || null,
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

    // Get total registered voters and invalid votes from election summaries
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
      }
    });

    const totalRegisteredVoters = summaryTotals._sum.registeredVoters || 0;
    const totalInvalidVotes = summaryTotals._sum.invalidVotes || 0;
    const totalValidVotes = summaryTotals._sum.validVotes || totalVotesCast;

    // Calculate turnout
    const turnoutPercentage = totalRegisteredVoters > 0
      ? (totalVotesCast / totalRegisteredVoters) * 100
      : 0;

    // Determine winner (if any candidate has >50%)
    const winner = candidateResults.find(c => c.percentage > 50) || null;

    // Calculate margin of victory (difference between 1st and 2nd place)
    let marginOfVictory = null;
    if (candidateResults.length >= 2) {
      const first = candidateResults[0];
      const second = candidateResults[1];
      marginOfVictory = {
        votes: first.totalVotes - second.totalVotes,
        percentage: parseFloat((first.percentage - second.percentage).toFixed(2)),
        leadingCandidate: first.candidateName,
        runnerUp: second.candidateName
      };
    }

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
      electionType: {
        code: election.electionType.code,
        name: election.electionType.name,
        electoralLevel: election.electionType.electoralLevel
      },
      totalVotesCast,
      totalValidVotes,
      totalInvalidVotes,
      invalidPercentage: totalVotesCast > 0
        ? parseFloat(((totalInvalidVotes / (totalValidVotes + totalInvalidVotes)) * 100).toFixed(2))
        : 0,
      totalRegisteredVoters,
      turnoutPercentage: parseFloat(turnoutPercentage.toFixed(2)),
      reportingAreas: reportingAreasCount.length,
      totalAreas: totalAreasCount,
      reportingPercentage: totalAreasCount > 0
        ? parseFloat(((reportingAreasCount.length / totalAreasCount) * 100).toFixed(2))
        : 0,
      candidateResults,
      marginOfVictory,
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
