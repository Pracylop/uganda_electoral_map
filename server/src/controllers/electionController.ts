import { Request, Response } from 'express';
import prisma from '../config/database';

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
