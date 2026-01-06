import { Router } from 'express';
import prisma from '../config/database';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Get all election types
router.get('/election-types', authenticate, async (req, res) => {
  try {
    const electionTypes = await prisma.electionType.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(electionTypes);
  } catch (error) {
    console.error('Get election types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all political parties
router.get('/parties', authenticate, async (req, res) => {
  try {
    const parties = await prisma.politicalParty.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    res.json(parties);
  } catch (error) {
    console.error('Get parties error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all persons (for candidate selection)
router.get('/persons', authenticate, async (req, res) => {
  try {
    const search = req.query.search as string;
    const where = search ? {
      fullName: { contains: search, mode: 'insensitive' as const }
    } : {};

    const persons = await prisma.person.findMany({
      where,
      orderBy: { fullName: 'asc' },
      take: 100 // Limit results
    });
    res.json(persons);
  } catch (error) {
    console.error('Get persons error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new person (for adding new candidates)
router.post('/persons', authenticate, authorize('editor', 'admin'), async (req, res) => {
  try {
    const { fullName, dateOfBirth, gender, biography } = req.body;

    if (!fullName) {
      res.status(400).json({ error: 'Full name is required' });
      return;
    }

    const person = await prisma.person.create({
      data: {
        fullName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
        biography
      }
    });

    res.status(201).json({ message: 'Person created successfully', person });
  } catch (error) {
    console.error('Create person error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search regions/admin units by name (for autocomplete)
router.get('/regions/search', authenticate, async (req, res) => {
  try {
    const query = req.query.q as string;

    if (!query || query.trim().length < 2) {
      res.json([]);
      return;
    }

    // Search for admin units matching the query
    const units = await prisma.administrativeUnit.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' }
      },
      select: {
        id: true,
        name: true,
        level: true,
        parent: {
          select: { name: true }
        }
      },
      orderBy: [
        { level: 'asc' },  // Districts first, then constituencies, etc.
        { name: 'asc' }
      ],
      take: 20  // Limit results for performance
    });

    // Format response to match frontend expectations
    const results = units.map(unit => ({
      id: unit.id,
      name: unit.name,
      level: unit.level,
      parentName: unit.parent?.name || null
    }));

    res.json(results);
  } catch (error) {
    console.error('Search regions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get administrative units (for electoral area selection)
router.get('/admin-units', authenticate, async (req, res) => {
  try {
    const level = req.query.level ? parseInt(req.query.level as string) : undefined;
    const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : undefined;

    const where: any = {};
    if (level !== undefined) where.level = level;
    if (parentId !== undefined) where.parentId = parentId;

    const units = await prisma.administrativeUnit.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        parentId: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(units);
  } catch (error) {
    console.error('Get admin units error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
