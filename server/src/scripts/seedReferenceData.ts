/**
 * Seed Reference Data Script
 * Seeds election types, political parties, issue categories, and admin user
 * Run: npx tsx src/scripts/seedReferenceData.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Election Types (MOD-003)
const electionTypes = [
  { code: 'PRES', name: 'Presidential', electoralLevel: 0, description: 'National presidential election - votes aggregated to national level' },
  { code: 'CONST_MP', name: 'Constituency MP', electoralLevel: 3, description: 'Directly elected Member of Parliament at constituency level' },
  { code: 'WOMAN_MP', name: 'District Woman MP', electoralLevel: 2, description: 'Woman Member of Parliament elected at district level' },
  { code: 'LC5_CHAIR', name: 'LC5 Chairperson', electoralLevel: 2, description: 'Local Council 5 Chairperson elected at district level' },
  { code: 'YOUTH_MP', name: 'Youth MP', electoralLevel: 1, description: 'Youth Member of Parliament elected at sub-region level' },
  { code: 'WORKER_MP', name: 'Workers MP', electoralLevel: 0, description: 'Workers Representative elected at national level' },
  { code: 'ARMY_MP', name: 'Army Representative', electoralLevel: 0, description: 'UPDF Representative elected at national level' },
  { code: 'PWD_MP', name: 'PWD Representative', electoralLevel: 1, description: 'Persons with Disabilities Representative at sub-region level' },
  { code: 'ELDERLY_MP', name: 'Elderly Representative', electoralLevel: 1, description: 'Older Persons Representative at sub-region level' },
];

// Political Parties (MOD-001)
const politicalParties = [
  { abbreviation: 'NRM', name: 'National Resistance Movement', color: '#FFD700', foundedYear: 1981, description: 'Ruling party since 1986, led by Yoweri Museveni' },
  { abbreviation: 'NUP', name: 'National Unity Platform', color: '#E50000', foundedYear: 2020, description: 'Opposition party led by Robert Kyagulanyi (Bobi Wine)' },
  { abbreviation: 'FDC', name: 'Forum for Democratic Change', color: '#003DA5', foundedYear: 2004, description: 'Opposition party, founded by former NRM members' },
  { abbreviation: 'DP', name: 'Democratic Party', color: '#228B22', foundedYear: 1954, description: 'One of the oldest political parties in Uganda' },
  { abbreviation: 'UPC', name: 'Uganda People\'s Congress', color: '#FF8C00', foundedYear: 1960, description: 'Founded by Milton Obote, historically significant party' },
  { abbreviation: 'ANT', name: 'Alliance for National Transformation', color: '#800080', foundedYear: 2019, description: 'Party led by Mugisha Muntu' },
  { abbreviation: 'PPP', name: 'People\'s Progressive Party', color: '#FF69B4', foundedYear: 2005, description: 'Led by Jaberi Bidandi Ssali' },
  { abbreviation: 'JEEMA', name: 'Justice Forum', color: '#006400', foundedYear: 1996, description: 'Islamic-leaning political party' },
  { abbreviation: 'CP', name: 'Conservative Party', color: '#4169E1', foundedYear: 1979, description: 'Monarchist conservative party' },
  { abbreviation: 'SDP', name: 'Social Democratic Party', color: '#DC143C', foundedYear: 2005, description: 'Social democratic political party' },
];

// Issue Categories (MOD-008)
const issueCategories = [
  { code: 'campaign_blockage', name: 'Campaign Blockage/Disruption', severity: 4, color: '#FF6B6B', description: 'Incidents where campaign activities were blocked or disrupted by authorities' },
  { code: 'violence', name: 'Violence/Assault', severity: 5, color: '#DC143C', description: 'Physical violence or assault during campaign activities' },
  { code: 'court_case', name: 'Court Case/Legal Challenge', severity: 3, color: '#4169E1', description: 'Legal challenges, court cases, or electoral petitions' },
  { code: 'voter_intimidation', name: 'Voter Intimidation', severity: 4, color: '#FF8C00', description: 'Intimidation of voters or electoral officials' },
  { code: 'ballot_tampering', name: 'Ballot Tampering', severity: 5, color: '#8B0000', description: 'Tampering with ballots, ballot boxes, or results' },
  { code: 'media_interference', name: 'Media Interference', severity: 3, color: '#9370DB', description: 'Interference with media coverage or journalist harassment' },
  { code: 'registration_issue', name: 'Registration Issues', severity: 3, color: '#20B2AA', description: 'Issues with voter registration or candidate nomination' },
  { code: 'arrest_detention', name: 'Arrest/Detention', severity: 4, color: '#B22222', description: 'Arrest or detention of candidates, supporters, or campaign staff' },
  { code: 'property_damage', name: 'Property Damage', severity: 3, color: '#DAA520', description: 'Damage to campaign property, offices, or materials' },
  { code: 'bribery', name: 'Bribery/Vote Buying', severity: 4, color: '#8B4513', description: 'Allegations of bribery or vote buying' },
  { code: 'hate_speech', name: 'Hate Speech/Incitement', severity: 4, color: '#800000', description: 'Hate speech or incitement to violence' },
  { code: 'other', name: 'Other', severity: 2, color: '#808080', description: 'Other electoral issues not categorized above' },
];

async function seedElectionTypes() {
  console.log('Seeding election types...');

  for (const type of electionTypes) {
    await prisma.electionType.upsert({
      where: { code: type.code },
      update: type,
      create: type,
    });
  }

  console.log(`  ✓ Seeded ${electionTypes.length} election types`);
}

async function seedPoliticalParties() {
  console.log('Seeding political parties...');

  for (const party of politicalParties) {
    await prisma.politicalParty.upsert({
      where: { abbreviation: party.abbreviation },
      update: party,
      create: party,
    });
  }

  console.log(`  ✓ Seeded ${politicalParties.length} political parties`);
}

async function seedIssueCategories() {
  console.log('Seeding issue categories...');

  for (const category of issueCategories) {
    await prisma.issueCategory.upsert({
      where: { code: category.code },
      update: category,
      create: category,
    });
  }

  console.log(`  ✓ Seeded ${issueCategories.length} issue categories`);
}

async function seedAdminUser() {
  console.log('Seeding admin user...');

  const existingAdmin = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (existingAdmin) {
    console.log('  ✓ Admin user already exists');
    return;
  }

  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash,
      fullName: 'System Administrator',
      role: 'admin',
      isActive: true,
    },
  });

  console.log('  ✓ Created admin user (username: admin, password: admin123)');
}

async function main() {
  console.log('='.repeat(60));
  console.log('Uganda Electoral Map - Reference Data Seeder');
  console.log('='.repeat(60));
  console.log('');

  try {
    await seedElectionTypes();
    await seedPoliticalParties();
    await seedIssueCategories();
    await seedAdminUser();

    console.log('');
    console.log('='.repeat(60));
    console.log('Seeding completed successfully!');
    console.log('='.repeat(60));

    // Print summary
    const electionTypeCount = await prisma.electionType.count();
    const partyCount = await prisma.politicalParty.count();
    const categoryCount = await prisma.issueCategory.count();
    const userCount = await prisma.user.count();

    console.log('');
    console.log('Summary:');
    console.log(`  - Election Types: ${electionTypeCount}`);
    console.log(`  - Political Parties: ${partyCount}`);
    console.log(`  - Issue Categories: ${categoryCount}`);
    console.log(`  - Users: ${userCount}`);

  } catch (error) {
    console.error('Error seeding data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
