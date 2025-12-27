import { Request, Response } from 'express';
import prisma from '../config/database';

// Get all elections
export const getAllElections = async (req: Request, res: Response): Promise<void> => {
  try {
    const elections = await prisma.election.findMany({
      include: {
        _count: {
          select: {
            candidates: true,
            results: true
          }
        }
      },
      orderBy: { electionDate: 'desc' }
    });

    res.json(elections);
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
        candidates: {
          orderBy: { name: 'asc' }
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
        candidates: {
          orderBy: { name: 'asc' }
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
    const { name, electionDate, electionType, isActive } = req.body;

    if (!name || !electionDate || !electionType) {
      res.status(400).json({ error: 'Name, date, and type are required' });
      return;
    }

    const validTypes = ['Presidential', 'Parliamentary', 'Local'];
    if (!validTypes.includes(electionType)) {
      res.status(400).json({ error: 'Invalid election type', validTypes });
      return;
    }

    const election = await prisma.election.create({
      data: {
        name,
        electionDate: new Date(electionDate),
        electionType,
        isActive: isActive || false
      }
    });

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
    const { name, electionDate, electionType, isActive } = req.body;

    if (isNaN(electionId)) {
      res.status(400).json({ error: 'Invalid election ID' });
      return;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (electionDate !== undefined) updateData.electionDate = new Date(electionDate);
    if (electionType !== undefined) {
      const validTypes = ['Presidential', 'Parliamentary', 'Local'];
      if (!validTypes.includes(electionType)) {
        res.status(400).json({ error: 'Invalid election type', validTypes });
        return;
      }
      updateData.electionType = electionType;
    }
    if (isActive !== undefined) updateData.isActive = isActive;

    const election = await prisma.election.update({
      where: { id: electionId },
      data: updateData
    });

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

    await prisma.election.delete({
      where: { id: electionId }
    });

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
        _count: {
          select: { results: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(candidates);
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
