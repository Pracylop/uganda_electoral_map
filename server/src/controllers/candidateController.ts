import { Request, Response } from 'express';
import prisma from '../config/database';

// Create candidate (Editor/Admin only)
export const createCandidate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { electionId, name, party, partyColor, photoUrl } = req.body;

    if (!electionId || !name || !party) {
      res.status(400).json({ error: 'Election ID, name, and party are required' });
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

    const candidate = await prisma.candidate.create({
      data: {
        electionId: parseInt(electionId),
        name,
        party,
        partyColor,
        photoUrl
      }
    });

    res.status(201).json({
      message: 'Candidate created successfully',
      candidate
    });
  } catch (error) {
    console.error('Create candidate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update candidate (Editor/Admin only)
export const updateCandidate = async (req: Request, res: Response): Promise<void> => {
  try {
    const candidateId = parseInt(req.params.id);
    const { name, party, partyColor, photoUrl } = req.body;

    if (isNaN(candidateId)) {
      res.status(400).json({ error: 'Invalid candidate ID' });
      return;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (party !== undefined) updateData.party = party;
    if (partyColor !== undefined) updateData.partyColor = partyColor;
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl;

    const candidate = await prisma.candidate.update({
      where: { id: candidateId },
      data: updateData
    });

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

    await prisma.candidate.delete({
      where: { id: candidateId }
    });

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
