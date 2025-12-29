/**
 * Import Presidential Election Results
 * Imports 2011, 2016 and 2021 presidential election results from CSV files
 * Run: npx tsx src/scripts/importPresidentialResults.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Candidate data for each election year
const candidates2011 = [
  { name: 'ABED BWANIKA', party: 'PPP' },
  { name: 'BESIGYE KIFEFE KIZZA', party: 'FDC' },
  { name: 'BETI OLIVE KAMYA NAMISANGO', party: null }, // UFA not in system, treat as Independent
  { name: 'BIDANDI-SSALI JABERI', party: null }, // PPP already used by Bwanika, likely Independent for this
  { name: 'MAO NORBERT', party: 'DP' },
  { name: 'OLARA OTUNNU', party: 'UPC' },
  { name: 'SAMUEL LUBEGA MUKAAKU WALTER', party: null }, // Independent
  { name: 'YOWERI MUSEVENI KAGUTA', party: 'NRM' },
];

const candidates2016 = [
  { name: 'ABED BWANIKA', party: 'PPP' },
  { name: 'AMAMA MBABAZI', party: null }, // Independent
  { name: 'BARYAMUREEBA VENANSIUS', party: null },
  { name: 'BENON BUTA BIRAARO', party: null },
  { name: 'KIZZA BESIGYE KIFEFE', party: 'FDC' },
  { name: 'MABIRIZI JOSEPH', party: null },
  { name: 'MAUREEN FAITH KYALYA WALUUBE', party: null },
  { name: 'YOWERI KAGUTA MUSEVENI', party: 'NRM' },
];

const candidates2021 = [
  { name: 'AMURIAT OBOI PATRICK', party: 'FDC' },
  { name: 'KABULETA KIIZA JOSEPH', party: null },
  { name: 'KALEMBE NANCY LINDA', party: null },
  { name: 'KATUMBA JOHN', party: null },
  { name: 'KYAGULANYI SSENTAMU ROBERT', party: 'NUP' },
  { name: 'MAO NORBERT', party: 'DP' },
  { name: 'MAYAMBALA WILLY', party: null },
  { name: 'MUGISHA MUNTU GREG', party: 'ANT' },
  { name: 'MWESIGYE FRED', party: null },
  { name: 'TUMUKUNDE HENRY KAKURUNGU', party: null },
  { name: 'YOWERI MUSEVENI TIBUHABURWA KAGUTA', party: 'NRM' },
];

interface CsvRow {
  [key: string]: string;
}

function parseCSV(content: string): CsvRow[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    rows.push(row);
  }

  return rows;
}

async function getOrCreatePerson(fullName: string): Promise<number> {
  let person = await prisma.person.findFirst({
    where: { fullName },
  });

  if (!person) {
    person = await prisma.person.create({
      data: { fullName },
    });
    console.log(`    Created person: ${fullName}`);
  }

  return person.id;
}

async function getPartyId(abbreviation: string | null): Promise<number | null> {
  if (!abbreviation) return null;

  const party = await prisma.politicalParty.findUnique({
    where: { abbreviation },
  });

  return party?.id || null;
}

async function importElection(
  year: number,
  candidateData: { name: string; party: string | null }[],
  csvPath: string,
  adminUserId: number
) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Importing ${year} Presidential Election Results`);
  console.log(`${'='.repeat(60)}`);

  // Get presidential election type
  const electionType = await prisma.electionType.findUnique({
    where: { code: 'PRES' },
  });

  if (!electionType) {
    throw new Error('Presidential election type not found. Run seed:reference first.');
  }

  // Create or get election
  let election = await prisma.election.findFirst({
    where: {
      year,
      electionTypeId: electionType.id,
    },
  });

  if (!election) {
    election = await prisma.election.create({
      data: {
        electionTypeId: electionType.id,
        name: `${year} Presidential Election`,
        year,
        electionDate: new Date(`${year}-02-18`), // Approximate date
        isActive: year === 2021,
      },
    });
    console.log(`Created election: ${election.name}`);
  } else {
    console.log(`Using existing election: ${election.name}`);
  }

  // Create persons and candidates
  console.log('\nCreating candidates...');
  const candidateMap: Map<string, number> = new Map();

  for (const candData of candidateData) {
    const personId = await getOrCreatePerson(candData.name);
    const partyId = await getPartyId(candData.party);

    let candidate = await prisma.candidate.findFirst({
      where: {
        electionId: election.id,
        personId,
      },
    });

    if (!candidate) {
      candidate = await prisma.candidate.create({
        data: {
          personId,
          electionId: election.id,
          partyId,
          isIndependent: !partyId,
        },
      });
      console.log(`  Created candidate: ${candData.name} (${candData.party || 'Independent'})`);
    }

    candidateMap.set(candData.name, candidate.id);
  }

  // Read CSV file
  console.log('\nReading CSV file...');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(csvContent);
  console.log(`  Found ${rows.length} parish records`);

  // Build parish lookup map
  console.log('\nBuilding parish lookup...');
  const parishes = await prisma.administrativeUnit.findMany({
    where: { level: 5 }, // Parish level
    select: {
      id: true,
      name: true,
      parent: {
        select: {
          name: true,
          parent: {
            select: {
              name: true,
              parent: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Create lookup key: District-Constituency-Subcounty-Parish
  const parishMap: Map<string, number> = new Map();
  for (const parish of parishes) {
    const subcounty = parish.parent?.name || '';
    const constituency = parish.parent?.parent?.name || '';
    const district = parish.parent?.parent?.parent?.name || '';
    const key = `${district.toUpperCase()}-${constituency.toUpperCase()}-${subcounty.toUpperCase()}-${parish.name.toUpperCase()}`;
    parishMap.set(key, parish.id);
  }
  console.log(`  Built lookup for ${parishMap.size} parishes`);

  // Import results
  console.log('\nImporting results...');
  let imported = 0;
  let skipped = 0;
  let notFound = 0;

  for (const row of rows) {
    const districtName = row['District.Name']?.toUpperCase() || '';
    const constituencyName = row['Constituency.Name']?.toUpperCase() || '';
    const subcountyName = row['SubCounty.Name']?.toUpperCase() || '';
    const parishName = row['Parish.Name']?.toUpperCase() || '';

    const key = `${districtName}-${constituencyName}-${subcountyName}-${parishName}`;
    const parishId = parishMap.get(key);

    if (!parishId) {
      notFound++;
      if (notFound <= 5) {
        console.log(`  Parish not found: ${districtName} > ${constituencyName} > ${subcountyName} > ${parishName}`);
      }
      continue;
    }

    // Check if already imported
    const existingSummary = await prisma.electionSummary.findUnique({
      where: {
        electionId_adminUnitId: {
          electionId: election.id,
          adminUnitId: parishId,
        },
      },
    });

    if (existingSummary) {
      skipped++;
      continue;
    }

    // Parse aggregate stats
    const registeredVoters = parseInt(row['Reg..Voters']) || 0;
    const totalVotes = parseInt(row['Total.Votes']) || 0;
    const validVotes = parseInt(row['Valid.Votes']) || 0;
    const invalidVotes = parseInt(row['Invalid.Votes']) || 0;
    const turnoutPct = parseFloat(row['Turnout_Pct']) || 0;
    const invalidPct = parseFloat(row['Invalid_Pct']) || 0;

    // Create election summary
    await prisma.electionSummary.create({
      data: {
        electionId: election.id,
        adminUnitId: parishId,
        registeredVoters,
        totalVotes,
        validVotes,
        invalidVotes,
        turnoutPercent: turnoutPct,
        invalidPercent: invalidPct,
        status: 'approved',
        enteredBy: adminUserId,
        verifiedBy: adminUserId,
        verifiedAt: new Date(),
      },
    });

    // Create results for each candidate
    for (const candData of candidateData) {
      const candidateId = candidateMap.get(candData.name);
      if (!candidateId) continue;

      const votes = parseInt(row[candData.name]) || 0;
      const votePct = parseFloat(row[`${candData.name}_Pct`]) || 0;

      await prisma.result.create({
        data: {
          electionId: election.id,
          candidateId,
          adminUnitId: parishId,
          votes,
          votePercent: votePct,
          status: 'approved',
          enteredBy: adminUserId,
          verifiedBy: adminUserId,
          verifiedAt: new Date(),
        },
      });
    }

    imported++;
    if (imported % 500 === 0) {
      console.log(`  ... ${imported} parishes imported`);
    }
  }

  console.log(`\n  Imported: ${imported} parishes`);
  console.log(`  Skipped (already exists): ${skipped}`);
  console.log(`  Not found: ${notFound}`);

  return { imported, skipped, notFound };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Uganda Electoral Map - Presidential Results Import');
  console.log('='.repeat(60));

  try {
    // Get admin user
    const adminUser = await prisma.user.findUnique({
      where: { username: 'admin' },
    });

    if (!adminUser) {
      throw new Error('Admin user not found. Run seed:reference first.');
    }

    // Navigate from app/server/src/scripts to project root Data directory
    const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const dataDir = path.join(projectRoot, 'Data/Election Results/Presidential');
    console.log(`Data directory: ${dataDir}`);

    // Import 2011 results
    const csv2011 = path.join(dataDir, '5_c_2011_parish_results.csv');
    if (fs.existsSync(csv2011)) {
      await importElection(2011, candidates2011, csv2011, adminUser.id);
    } else {
      console.log(`File not found: ${csv2011}`);
    }

    // Import 2016 results
    const csv2016 = path.join(dataDir, '5_a_2016_parish_results.csv');
    if (fs.existsSync(csv2016)) {
      await importElection(2016, candidates2016, csv2016, adminUser.id);
    } else {
      console.log(`File not found: ${csv2016}`);
    }

    // Import 2021 results
    const csv2021 = path.join(dataDir, '5_b_2021_parish_results.csv');
    if (fs.existsSync(csv2021)) {
      await importElection(2021, candidates2021, csv2021, adminUser.id);
    } else {
      console.log(`File not found: ${csv2021}`);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('Import completed!');
    console.log('='.repeat(60));

    const electionCount = await prisma.election.count();
    const candidateCount = await prisma.candidate.count();
    const summaryCount = await prisma.electionSummary.count();
    const resultCount = await prisma.result.count();

    console.log('\nDatabase Summary:');
    console.log(`  - Elections: ${electionCount}`);
    console.log(`  - Candidates: ${candidateCount}`);
    console.log(`  - Election Summaries: ${summaryCount}`);
    console.log(`  - Results: ${resultCount}`);

  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
