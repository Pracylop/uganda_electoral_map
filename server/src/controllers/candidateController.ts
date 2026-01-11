import { Request, Response } from 'express';
import prisma from '../config/database';
import { createAuditLog } from '../middleware/auditLog';
import * as fs from 'fs';
import * as path from 'path';

// Directory for candidate images (relative to client public folder)
// __dirname is app/server/src/controllers, so go up 3 levels to app/, then into client/public/images/candidates
const CANDIDATE_IMAGES_DIR = path.resolve(__dirname, '../../../client/public/images/candidates');

// Helper to save base64 image to file
const saveBase64Image = (base64Data: string, candidateId: number): string | null => {
  try {
    // Check if it's a base64 data URL
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return null; // Not a base64 image, return as-is (might be a URL)
    }

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const imageData = matches[2];
    const filename = `candidate_${candidateId}_${Date.now()}.${extension}`;
    const filepath = path.join(CANDIDATE_IMAGES_DIR, filename);

    // Ensure directory exists
    if (!fs.existsSync(CANDIDATE_IMAGES_DIR)) {
      fs.mkdirSync(CANDIDATE_IMAGES_DIR, { recursive: true });
    }

    // Write the file
    fs.writeFileSync(filepath, Buffer.from(imageData, 'base64'));

    // Return the relative URL path
    return `/images/candidates/${filename}`;
  } catch (error) {
    console.error('Error saving image:', error);
    return null;
  }
};

// Helper to get client IP address
const getClientIp = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

// Create candidate (Editor/Admin only)
export const createCandidate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { electionId, personId, partyId, electoralAreaId, ballotOrder, photoUrl, isIndependent } = req.body;

    if (!electionId || !personId) {
      res.status(400).json({ error: 'Election ID and person ID are required' });
      return;
    }

    // Verify election exists
    const election = await prisma.election.findUnique({
      where: { id: parseInt(electionId) }
    });

    if (!election) {
      res.status(404).json({ error: 'Election not found' });
      return;
    }

    // Verify person exists
    const person = await prisma.person.findUnique({
      where: { id: parseInt(personId) }
    });

    if (!person) {
      res.status(404).json({ error: 'Person not found' });
      return;
    }

    // Verify party exists if provided
    if (partyId) {
      const party = await prisma.politicalParty.findUnique({
        where: { id: parseInt(partyId) }
      });
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }
    }

    const candidate = await prisma.candidate.create({
      data: {
        electionId: parseInt(electionId),
        personId: parseInt(personId),
        partyId: partyId ? parseInt(partyId) : null,
        electoralAreaId: electoralAreaId ? parseInt(electoralAreaId) : null,
        ballotOrder: ballotOrder ? parseInt(ballotOrder) : null,
        photoUrl,
        isIndependent: isIndependent || false
      },
      include: {
        person: { select: { fullName: true } },
        party: { select: { name: true, abbreviation: true, color: true } },
        election: { select: { name: true, year: true } }
      }
    });

    // Audit log
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'CREATE_CANDIDATE',
      'candidate',
      candidate.id,
      null,
      {
        personName: candidate.person.fullName,
        partyName: candidate.party?.name || 'Independent',
        electionName: candidate.election.name
      },
      getClientIp(req),
      `Created candidate: ${candidate.person.fullName} for ${candidate.election.name}`
    );

    res.status(201).json({
      message: 'Candidate created successfully',
      candidate
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Candidate already exists for this election' });
      return;
    }
    console.error('Create candidate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update candidate (Editor/Admin only)
export const updateCandidate = async (req: Request, res: Response): Promise<void> => {
  try {
    const candidateId = parseInt(req.params.id);
    const { partyId, electoralAreaId, ballotOrder, photoUrl, isIndependent } = req.body;

    if (isNaN(candidateId)) {
      res.status(400).json({ error: 'Invalid candidate ID' });
      return;
    }

    // Fetch old candidate data for audit log
    const oldCandidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        person: { select: { fullName: true } },
        party: { select: { name: true } },
        election: { select: { name: true } }
      }
    });

    if (!oldCandidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    const updateData: any = {};
    if (partyId !== undefined) updateData.partyId = partyId ? parseInt(partyId) : null;
    if (electoralAreaId !== undefined) updateData.electoralAreaId = electoralAreaId ? parseInt(electoralAreaId) : null;
    if (ballotOrder !== undefined) updateData.ballotOrder = ballotOrder ? parseInt(ballotOrder) : null;
    if (photoUrl !== undefined) {
      // Check if it's a base64 image and save to file
      if (photoUrl && photoUrl.startsWith('data:image/')) {
        const savedPath = saveBase64Image(photoUrl, candidateId);
        updateData.photoUrl = savedPath || photoUrl.substring(0, 255); // Fallback to truncated if save fails
      } else {
        updateData.photoUrl = photoUrl;
      }
    }
    if (isIndependent !== undefined) updateData.isIndependent = isIndependent;

    const candidate = await prisma.candidate.update({
      where: { id: candidateId },
      data: updateData,
      include: {
        person: { select: { fullName: true } },
        party: { select: { name: true, abbreviation: true, color: true } },
        election: { select: { name: true, year: true } }
      }
    });

    // Audit log
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'UPDATE_CANDIDATE',
      'candidate',
      candidate.id,
      {
        partyName: oldCandidate.party?.name || 'Independent',
        ballotOrder: oldCandidate.ballotOrder,
        isIndependent: oldCandidate.isIndependent
      },
      {
        partyName: candidate.party?.name || 'Independent',
        ballotOrder: candidate.ballotOrder,
        isIndependent: candidate.isIndependent
      },
      getClientIp(req),
      `Updated candidate: ${candidate.person.fullName}`
    );

    res.json({
      message: 'Candidate updated successfully',
      candidate
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }
    console.error('Update candidate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete candidate (Admin only)
export const deleteCandidate = async (req: Request, res: Response): Promise<void> => {
  try {
    const candidateId = parseInt(req.params.id);

    if (isNaN(candidateId)) {
      res.status(400).json({ error: 'Invalid candidate ID' });
      return;
    }

    // Fetch candidate data for audit log before deletion
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        person: { select: { fullName: true } },
        party: { select: { name: true } },
        election: { select: { name: true } }
      }
    });

    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    await prisma.candidate.delete({
      where: { id: candidateId }
    });

    // Audit log
    await createAuditLog(
      req.user!.userId,
      req.user!.role,
      'DELETE_CANDIDATE',
      'candidate',
      candidateId,
      {
        personName: candidate.person.fullName,
        partyName: candidate.party?.name || 'Independent',
        electionName: candidate.election.name
      },
      null,
      getClientIp(req),
      `Deleted candidate: ${candidate.person.fullName} from ${candidate.election.name}`
    );

    res.json({ message: 'Candidate deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }
    if (error.code === 'P2003') {
      res.status(400).json({ error: 'Cannot delete candidate with existing results' });
      return;
    }
    console.error('Delete candidate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get candidates by election
export const getCandidatesByElection = async (req: Request, res: Response): Promise<void> => {
  try {
    const electionId = parseInt(req.params.electionId);

    if (isNaN(electionId)) {
      res.status(400).json({ error: 'Invalid election ID' });
      return;
    }

    const candidates = await prisma.candidate.findMany({
      where: { electionId },
      include: {
        person: {
          select: {
            id: true,
            fullName: true,
            dateOfBirth: true,
            gender: true,
            biography: true,
            imageUrl: true
          }
        },
        party: { select: { name: true, abbreviation: true, color: true } },
        electoralArea: { select: { name: true, code: true } },
        election: { select: { id: true, name: true, year: true } },
        _count: { select: { results: true } }
      },
      orderBy: { ballotOrder: 'asc' }
    });

    res.json(candidates);
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
