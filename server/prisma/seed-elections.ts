import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedElections() {
  console.log('🗳️  Seeding elections and candidates...');

  // Create 2026 Presidential Election
  const presidentialElection = await prisma.election.create({
    data: {
      name: '2026 Presidential Election',
      electionDate: new Date('2026-01-14'),
      electionType: 'Presidential',
      isActive: true
    }
  });

  console.log(`✅ Created election: ${presidentialElection.name}`);

  // Create Presidential Candidates
  const presidentialCandidates = [
    {
      name: 'Yoweri Kaguta Museveni',
      party: 'National Resistance Movement',
      partyColor: '#FFFF00', // Yellow
    },
    {
      name: 'Robert Kyagulanyi Ssentamu (Bobi Wine)',
      party: 'National Unity Platform',
      partyColor: '#FF0000', // Red
    },
    {
      name: 'Patrick Oboi Amuriat',
      party: 'Forum for Democratic Change',
      partyColor: '#0000FF', // Blue
    },
    {
      name: 'Norbert Mao',
      party: 'Democratic Party',
      partyColor: '#008000', // Green
    },
    {
      name: 'Mugisha Muntu',
      party: 'Alliance for National Transformation',
      partyColor: '#800080', // Purple
    },
    {
      name: 'John Katumba',
      party: 'Independent',
      partyColor: '#808080', // Gray
    }
  ];

  for (const candidate of presidentialCandidates) {
    const c = await prisma.candidate.create({
      data: {
        electionId: presidentialElection.id,
        name: candidate.name,
        party: candidate.party,
        partyColor: candidate.partyColor
      }
    });
    console.log(`✅ Created candidate: ${c.name} (${c.party})`);
  }

  // Create 2026 Parliamentary Election
  const parliamentaryElection = await prisma.election.create({
    data: {
      name: '2026 Parliamentary Election',
      electionDate: new Date('2026-01-14'),
      electionType: 'Parliamentary',
      isActive: true
    }
  });

  console.log(`✅ Created election: ${parliamentaryElection.name}`);

  // Create sample Parliamentary Candidates for Kampala Central
  const parliamentaryCandidates = [
    {
      name: 'Muhammad Nsereko',
      party: 'National Resistance Movement',
      partyColor: '#FFFF00',
    },
    {
      name: 'Mubarak Munyagwa',
      party: 'National Unity Platform',
      partyColor: '#FF0000',
    },
    {
      name: 'Sarah Nakato',
      party: 'Forum for Democratic Change',
      partyColor: '#0000FF',
    },
    {
      name: 'Andrew Ssekajja',
      party: 'Independent',
      partyColor: '#808080',
    }
  ];

  for (const candidate of parliamentaryCandidates) {
    const c = await prisma.candidate.create({
      data: {
        electionId: parliamentaryElection.id,
        name: candidate.name,
        party: candidate.party,
        partyColor: candidate.partyColor
      }
    });
    console.log(`✅ Created parliamentary candidate: ${c.name} (${c.party})`);
  }

  // Create 2026 Local Council Election
  const localElection = await prisma.election.create({
    data: {
      name: '2026 Local Council (LC5) Election',
      electionDate: new Date('2026-01-14'),
      electionType: 'Local',
      isActive: false
    }
  });

  console.log(`✅ Created election: ${localElection.name}`);

  console.log('\n✨ Elections and candidates seeding completed!');
  console.log(`📊 Summary:`);
  console.log(`   - 3 Elections`);
  console.log(`   - ${presidentialCandidates.length} Presidential candidates`);
  console.log(`   - ${parliamentaryCandidates.length} Parliamentary candidates`);
}

async function main() {
  try {
    await seedElections();
  } catch (error) {
    console.error('❌ Error seeding elections:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
