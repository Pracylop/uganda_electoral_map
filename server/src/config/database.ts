import { PrismaClient } from '@prisma/client';

// Initialize Prisma Client
const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

// Handle cleanup on app termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
