const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // Check results with geometry
  const results = await prisma.result.findMany({
    where: {
      electionId: 2,
      status: 'approved',
      adminUnit: { level: 5 }
    },
    take: 5,
    include: {
      adminUnit: { select: { id: true, name: true, level: true, geometry: true } },
      candidate: {
        include: {
          person: { select: { fullName: true } },
          party: { select: { abbreviation: true, color: true } }
        }
      }
    }
  });

  console.log('Sample results with geometry:');
  for (const r of results) {
    const hasGeom = r.adminUnit.geometry !== null;
    console.log('  Parish:', r.adminUnit.name);
    console.log('    Has geometry:', hasGeom);
    console.log('    Candidate:', r.candidate.person.fullName);
    console.log('    Party:', r.candidate.party?.abbreviation || 'IND');
    console.log('');
  }

  await prisma.$disconnect();
}
check();
