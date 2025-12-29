/**
 * Reimport LUWEERO 2021 Presidential Election Results
 * Fixes the naming mismatch: CSV has "LUWERO", database has "LUWEERO"
 * Run: npx tsx src/scripts/reimportLuweero2021.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

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

// Mapping for district name variations
const districtNameMap: Record<string, string> = {
  'LUWERO': 'LUWEERO',
};

async function main() {
  console.log('='.repeat(60));
  console.log('Reimporting LUWEERO 2021 Presidential Results');
  console.log('='.repeat(60));

  try {
    // Get admin user
    const adminUser = await prisma.user.findUnique({
      where: { username: 'admin' },
    });

    if (!adminUser) {
      throw new Error('Admin user not found');
    }

    // Get 2021 election
    const election = await prisma.election.findFirst({
      where: { year: 2021 },
    });

    if (!election) {
      throw new Error('2021 election not found');
    }

    console.log(`Using election: ${election.name} (id: ${election.id})`);

    // Get candidates
    const candidates = await prisma.candidate.findMany({
      where: { electionId: election.id },
      include: { person: true },
    });

    const candidateMap: Map<string, number> = new Map();
    for (const cand of candidates) {
      candidateMap.set(cand.person.fullName, cand.id);
    }

    console.log(`Found ${candidates.length} candidates`);

    // Build parish lookup for LUWEERO district only
    console.log('\nBuilding LUWEERO parish lookup...');
    const parishes = await prisma.administrativeUnit.findMany({
      where: {
        level: 5,
        parent: {
          parent: {
            parent: {
              name: 'LUWEERO'
            }
          }
        }
      },
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

    console.log(`Found ${parishes.length} parishes in LUWEERO`);

    // Create lookup key: Constituency-Subcounty-Parish (without district)
    const parishMap: Map<string, number> = new Map();
    for (const parish of parishes) {
      const subcounty = parish.parent?.name || '';
      const constituency = parish.parent?.parent?.name || '';
      // Key without district since we're only looking at LUWEERO
      const key = `${constituency.toUpperCase()}-${subcounty.toUpperCase()}-${parish.name.toUpperCase()}`;
      parishMap.set(key, parish.id);
    }

    // Read CSV file
    const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const csvPath = path.join(projectRoot, 'Data/Election Results/Presidential/5_b_2021_parish_results.csv');

    console.log(`\nReading CSV: ${csvPath}`);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const allRows = parseCSV(csvContent);

    // Filter only LUWERO rows (CSV spelling)
    const luweeroRows = allRows.filter(row => {
      const distName = row['District.Name']?.toUpperCase() || '';
      return distName === 'LUWERO';
    });

    console.log(`Found ${luweeroRows.length} LUWERO rows in CSV`);

    // Import results
    let imported = 0;
    let skipped = 0;
    let notFound = 0;
    let alreadyExists = 0;

    for (const row of luweeroRows) {
      const constituencyName = row['Constituency.Name']?.toUpperCase() || '';
      const subcountyName = row['SubCounty.Name']?.toUpperCase() || '';
      const parishName = row['Parish.Name']?.toUpperCase() || '';

      const key = `${constituencyName}-${subcountyName}-${parishName}`;
      const parishId = parishMap.get(key);

      if (!parishId) {
        notFound++;
        if (notFound <= 5) {
          console.log(`  Parish not found: ${constituencyName} > ${subcountyName} > ${parishName}`);
        }
        continue;
      }

      // Check if already imported
      const existingResult = await prisma.result.findFirst({
        where: {
          electionId: election.id,
          adminUnitId: parishId,
        },
      });

      if (existingResult) {
        alreadyExists++;
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
      try {
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
            enteredBy: adminUser.id,
            verifiedBy: adminUser.id,
            verifiedAt: new Date(),
          },
        });
      } catch (e) {
        // Summary might already exist
      }

      // Create results for each candidate
      for (const candData of candidates2021) {
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
            enteredBy: adminUser.id,
            verifiedBy: adminUser.id,
            verifiedAt: new Date(),
          },
        });
      }

      imported++;
      if (imported % 20 === 0) {
        console.log(`  ... ${imported} parishes imported`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('Import Summary:');
    console.log(`  Imported: ${imported} parishes`);
    console.log(`  Already exists: ${alreadyExists}`);
    console.log(`  Not found: ${notFound}`);
    console.log(`${'='.repeat(60)}`);

    // Verify results
    const resultCount = await prisma.result.count({
      where: {
        electionId: election.id,
        adminUnit: {
          parent: {
            parent: {
              parent: {
                name: 'LUWEERO'
              }
            }
          }
        }
      }
    });

    console.log(`\nTotal LUWEERO results for 2021: ${resultCount}`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
