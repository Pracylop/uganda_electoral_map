/**
 * Import Parliamentary Election Results
 * Imports Directly Elected MPs and District Woman Representatives from CSV files
 * Run: npx tsx src/scripts/importParliamentaryResults.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

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

function normalizeText(text: string): string {
  return text?.toUpperCase().trim() || '';
}

// Name mappings for districts with spelling variations between CSV and database
const DISTRICT_NAME_MAPPINGS: Record<string, string> = {
  'LUWERO': 'LUWEERO',         // CSV uses LUWERO, DB uses LUWEERO
  'SEMBABULE': 'SSEMBABULE',   // Alternative spelling
  'KABONG': 'KAABONG',         // Alternative spelling
  'FORT PORTAL': 'FORT PORTAL CITY', // City suffix
};

// Apply name mappings to normalize district names
function normalizeDistrictName(name: string): string {
  const normalized = normalizeText(name);
  return DISTRICT_NAME_MAPPINGS[normalized] || normalized;
}

async function getOrCreatePerson(fullName: string): Promise<number> {
  let person = await prisma.person.findFirst({
    where: { fullName },
  });

  if (!person) {
    person = await prisma.person.create({
      data: { fullName },
    });
  }

  return person.id;
}

async function getPartyId(partyName: string | null): Promise<number | null> {
  if (!partyName || partyName === 'INDEPENDENT') return null;

  const party = await prisma.politicalParty.findUnique({
    where: { abbreviation: partyName },
  });

  return party?.id || null;
}

async function getOrCreateElection(
  electionTypeCode: string,
  year: number
): Promise<number> {
  const electionType = await prisma.electionType.findUnique({
    where: { code: electionTypeCode },
  });

  if (!electionType) {
    throw new Error(`Election type ${electionTypeCode} not found`);
  }

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
        name: `${year} ${electionType.name}`,
        year,
        electionDate: new Date(`${year}-02-18`),
        isActive: year === 2021,
      },
    });
    console.log(`  Created election: ${election.name}`);
  }

  return election.id;
}

// Import Directly Elected MPs (Constituency level)
async function importDirectlyElectedMPs(
  csvPath: string,
  adminUserId: number
) {
  console.log('\n--- Importing Directly Elected MPs ---');
  console.log(`File: ${csvPath}`);

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);
  console.log(`Found ${rows.length} candidate records`);

  // Build constituency lookup map
  const constituencies = await prisma.administrativeUnit.findMany({
    where: { level: 3 }, // Constituency level
    select: {
      id: true,
      name: true,
      parent: {
        select: {
          name: true, // District name
        },
      },
    },
  });

  const constituencyMap = new Map<string, number>();
  for (const c of constituencies) {
    const key = normalizeText(c.name);
    constituencyMap.set(key, c.id);
    // Also map with district prefix for disambiguation
    if (c.parent) {
      const fullKey = `${normalizeText(c.parent.name)}-${key}`;
      constituencyMap.set(fullKey, c.id);
    }
  }
  console.log(`Built lookup for ${constituencyMap.size} constituencies`);

  // Helper to get column value with fallback names
  const getCol = (row: CsvRow, ...names: string[]) => {
    for (const name of names) {
      if (row[name]) return row[name];
    }
    return '';
  };

  // Group rows by year and constituency
  const rowsByYearConstituency = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const year = row['Year'];
    const constituencyName = normalizeText(getCol(row, 'Constituency.Name', 'Constituency'));
    const key = `${year}-${constituencyName}`;
    if (!rowsByYearConstituency.has(key)) {
      rowsByYearConstituency.set(key, []);
    }
    rowsByYearConstituency.get(key)!.push(row);
  }

  let imported = 0;
  let skipped = 0;
  let notFound = 0;

  for (const [key, constituencyRows] of rowsByYearConstituency) {
    const year = parseInt(constituencyRows[0]['Year']);
    const constituencyName = normalizeText(getCol(constituencyRows[0], 'Constituency.Name', 'Constituency'));
    const districtName = normalizeText(getCol(constituencyRows[0], 'District.Name', 'District'));

    // Try to find constituency
    let constituencyId = constituencyMap.get(constituencyName);
    if (!constituencyId) {
      constituencyId = constituencyMap.get(`${districtName}-${constituencyName}`);
    }

    if (!constituencyId) {
      notFound++;
      if (notFound <= 5) {
        console.log(`  Constituency not found: ${districtName} > ${constituencyName}`);
      }
      continue;
    }

    const electionId = await getOrCreateElection('CONST_MP', year);

    // Check if already imported
    const existingSummary = await prisma.electionSummary.findUnique({
      where: {
        electionId_adminUnitId: {
          electionId,
          adminUnitId: constituencyId,
        },
      },
    });

    if (existingSummary) {
      skipped++;
      continue;
    }

    // Calculate total votes
    const totalVotes = constituencyRows.reduce((sum, row) => sum + (parseInt(row['Votes']) || 0), 0);

    // Create election summary
    await prisma.electionSummary.create({
      data: {
        electionId,
        adminUnitId: constituencyId,
        registeredVoters: 0, // Not available in data
        totalVotes,
        validVotes: totalVotes,
        invalidVotes: 0,
        status: 'approved',
        enteredBy: adminUserId,
        verifiedBy: adminUserId,
        verifiedAt: new Date(),
      },
    });

    // Create results for each candidate
    for (const row of constituencyRows) {
      const candidateName = row['Candidate.Name'];
      const partyName = normalizeText(row['Political.Party']);
      const votes = parseInt(row['Votes']) || 0;
      const isWinner = row['Winner'] === 'Yes';

      const personId = await getOrCreatePerson(candidateName);
      const partyId = await getPartyId(partyName);

      let candidate = await prisma.candidate.findFirst({
        where: {
          electionId,
          personId,
        },
      });

      if (!candidate) {
        candidate = await prisma.candidate.create({
          data: {
            personId,
            electionId,
            partyId,
            electoralAreaId: constituencyId,
            isIndependent: !partyId,
          },
        });
      }

      await prisma.result.create({
        data: {
          electionId,
          candidateId: candidate.id,
          adminUnitId: constituencyId,
          votes,
          votePercent: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
          status: 'approved',
          enteredBy: adminUserId,
          verifiedBy: adminUserId,
          verifiedAt: new Date(),
        },
      });
    }

    imported++;
    if (imported % 50 === 0) {
      console.log(`  ... ${imported} constituencies imported`);
    }
  }

  console.log(`  Imported: ${imported} constituencies`);
  console.log(`  Skipped (already exists): ${skipped}`);
  console.log(`  Not found: ${notFound}`);

  return { imported, skipped, notFound };
}

// Import District Woman Representatives (District level)
async function importDistrictWomanMPs(
  csvPath: string,
  adminUserId: number
) {
  console.log('\n--- Importing District Woman Representatives ---');
  console.log(`File: ${csvPath}`);

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);
  console.log(`Found ${rows.length} candidate records`);

  // Build district lookup map
  const districts = await prisma.administrativeUnit.findMany({
    where: { level: 2 }, // District level
    select: {
      id: true,
      name: true,
    },
  });

  const districtMap = new Map<string, number>();
  for (const d of districts) {
    districtMap.set(normalizeText(d.name), d.id);
  }
  console.log(`Built lookup for ${districtMap.size} districts`);

  // Helper to get column value with fallback names
  const getCol = (row: CsvRow, ...names: string[]) => {
    for (const name of names) {
      if (row[name]) return row[name];
    }
    return '';
  };

  // Group rows by year and district (using normalized names)
  const rowsByYearDistrict = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const year = row['Year'];
    const rawDistrictName = getCol(row, 'District', 'District.Name');
    const districtName = normalizeDistrictName(rawDistrictName);
    const key = `${year}-${districtName}`;
    if (!rowsByYearDistrict.has(key)) {
      rowsByYearDistrict.set(key, []);
    }
    rowsByYearDistrict.get(key)!.push(row);
  }

  let imported = 0;
  let skipped = 0;
  let notFound = 0;

  for (const [key, districtRows] of rowsByYearDistrict) {
    const year = parseInt(districtRows[0]['Year']);
    const rawDistrictName = getCol(districtRows[0], 'District', 'District.Name');
    const districtName = normalizeDistrictName(rawDistrictName);

    const districtId = districtMap.get(districtName);
    if (!districtId) {
      notFound++;
      if (notFound <= 5) {
        console.log(`  District not found: ${districtName}`);
      }
      continue;
    }

    const electionId = await getOrCreateElection('WOMAN_MP', year);

    // Check if already imported
    const existingSummary = await prisma.electionSummary.findUnique({
      where: {
        electionId_adminUnitId: {
          electionId,
          adminUnitId: districtId,
        },
      },
    });

    if (existingSummary) {
      skipped++;
      continue;
    }

    // Calculate total votes
    const totalVotes = districtRows.reduce((sum, row) => sum + (parseInt(row['Votes']) || 0), 0);

    // Create election summary
    await prisma.electionSummary.create({
      data: {
        electionId,
        adminUnitId: districtId,
        registeredVoters: 0,
        totalVotes,
        validVotes: totalVotes,
        invalidVotes: 0,
        status: 'approved',
        enteredBy: adminUserId,
        verifiedBy: adminUserId,
        verifiedAt: new Date(),
      },
    });

    // Create results for each candidate
    for (const row of districtRows) {
      const candidateName = row['Candidate.Name'];
      const partyName = normalizeText(row['Political.Party']);
      const votes = parseInt(row['Votes']) || 0;

      const personId = await getOrCreatePerson(candidateName);
      const partyId = await getPartyId(partyName);

      let candidate = await prisma.candidate.findFirst({
        where: {
          electionId,
          personId,
        },
      });

      if (!candidate) {
        candidate = await prisma.candidate.create({
          data: {
            personId,
            electionId,
            partyId,
            electoralAreaId: districtId,
            isIndependent: !partyId,
          },
        });
      }

      await prisma.result.create({
        data: {
          electionId,
          candidateId: candidate.id,
          adminUnitId: districtId,
          votes,
          votePercent: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
          status: 'approved',
          enteredBy: adminUserId,
          verifiedBy: adminUserId,
          verifiedAt: new Date(),
        },
      });
    }

    imported++;
    if (imported % 50 === 0) {
      console.log(`  ... ${imported} districts imported`);
    }
  }

  console.log(`  Imported: ${imported} districts`);
  console.log(`  Skipped (already exists): ${skipped}`);
  console.log(`  Not found: ${notFound}`);

  return { imported, skipped, notFound };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Uganda Electoral Map - Parliamentary Results Import');
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
    const dataDir = path.join(projectRoot, 'Data/Election Results/Parliamentary');
    console.log(`Data directory: ${dataDir}`);

    // Import Directly Elected MPs
    const directlyElectedFiles = [
      '11_a_2006_mps_directly_elected.csv',
      '8_a_2011_mps_directly_elected.csv',
      '7_a_2016_mps_directly_elected.csv',
      '6_a_2021_mps_directly_elected.csv',
    ];

    for (const file of directlyElectedFiles) {
      const csvPath = path.join(dataDir, file);
      if (fs.existsSync(csvPath)) {
        await importDirectlyElectedMPs(csvPath, adminUser.id);
      } else {
        console.log(`File not found: ${csvPath}`);
      }
    }

    // Import District Woman Representatives
    const womanMPFiles = [
      '11_b_2006_mps_district_woman.csv',
      '8_b_2011_mps_district_woman.csv',
      '7_b_2016_mps_district_woman.csv',
      '6_b_2021_mps_district_woman.csv',
    ];

    for (const file of womanMPFiles) {
      const csvPath = path.join(dataDir, file);
      if (fs.existsSync(csvPath)) {
        await importDistrictWomanMPs(csvPath, adminUser.id);
      } else {
        console.log(`File not found: ${csvPath}`);
      }
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
