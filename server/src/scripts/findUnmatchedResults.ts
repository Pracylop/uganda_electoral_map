/**
 * Find Unmatched Election Results
 * Generates a CSV of records from election CSVs that don't match database admin units
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { normalizeName, createLookupKey, getAlternativeLookupKeys } from '../utils/nameNormalizer';

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

interface UnmatchedRecord {
  election: string;
  level: string;
  district: string;
  constituency: string;
  subcounty: string;
  parish: string;
  registeredVoters: string;
  totalVotes: string;
  reason: string;
}

async function findUnmatched(): Promise<UnmatchedRecord[]> {
  const dataDir = '/Users/polycarp/dev/cursor/projects/uganda_electoral_map/Data/Election Results/Presidential';
  const unmatched: UnmatchedRecord[] = [];

  // Build parish lookup (same as import script)
  console.log('Building parish lookup...');
  const parishes = await prisma.administrativeUnit.findMany({
    where: { level: 5 },
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

  const parishMap: Map<string, number> = new Map();
  for (const parish of parishes) {
    const subcounty = parish.parent?.name || '';
    const constituency = parish.parent?.parent?.name || '';
    const district = parish.parent?.parent?.parent?.name || '';
    const key = createLookupKey(district, constituency, subcounty, parish.name);
    parishMap.set(key, parish.id);
  }
  console.log(`  Built lookup for ${parishMap.size} parishes`);

  // Build constituency lookup
  console.log('Building constituency lookup...');
  const constituencies = await prisma.administrativeUnit.findMany({
    where: { level: 3 },
    select: {
      id: true,
      name: true,
      parent: {
        select: {
          name: true,
        },
      },
    },
  });

  const constituencyMap: Map<string, number> = new Map();
  for (const c of constituencies) {
    constituencyMap.set(normalizeName(c.name), c.id);
    if (c.parent) {
      const key = createLookupKey(c.parent.name, c.name);
      constituencyMap.set(key, c.id);
    }
  }
  console.log(`  Built lookup for ${constituencyMap.size} constituencies`);

  // Process each election file
  const electionFiles = [
    { file: '13_2001_presidential_constituency.csv', election: '2001 Presidential', level: 'constituency' },
    { file: '10_b_2006_parish_results.csv', election: '2006 Presidential', level: 'parish' },
    { file: '5_c_2011_parish_results.csv', election: '2011 Presidential', level: 'parish' },
    { file: '5_a_2016_parish_results.csv', election: '2016 Presidential', level: 'parish' },
    { file: '5_b_2021_parish_results.csv', election: '2021 Presidential', level: 'parish' },
  ];

  for (const { file, election, level } of electionFiles) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  Skipping ${file} (not found)`);
      continue;
    }

    console.log(`\nProcessing ${election}...`);
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCSV(csvContent);

    for (const row of rows) {
      const districtName = row['District.Name'] || '';
      const constituencyName = row['Constituency.Name'] || '';
      const subcountyName = row['SubCounty.Name'] || '';
      const parishName = row['Parish.Name'] || '';
      const registeredVoters = row['Registered.Voters'] || row['Reg..Voters'] || '';
      const totalVotes = row['Total.Votes'] || '';

      if (level === 'constituency') {
        // Check constituency match
        let found = constituencyMap.get(createLookupKey(districtName, constituencyName));
        if (!found) {
          found = constituencyMap.get(normalizeName(constituencyName));
        }
        if (!found) {
          const altKeys = getAlternativeLookupKeys(districtName, constituencyName);
          for (const altKey of altKeys) {
            found = constituencyMap.get(altKey);
            if (found) break;
          }
        }

        if (!found) {
          unmatched.push({
            election,
            level: 'Constituency',
            district: districtName,
            constituency: constituencyName,
            subcounty: '',
            parish: '',
            registeredVoters,
            totalVotes,
            reason: determineReason(districtName, constituencyName, '', ''),
          });
        }
      } else {
        // Check parish match
        const key = createLookupKey(districtName, constituencyName, subcountyName, parishName);
        let found = parishMap.get(key);

        if (!found) {
          const altKeys = getAlternativeLookupKeys(districtName, constituencyName, subcountyName, parishName);
          for (const altKey of altKeys) {
            found = parishMap.get(altKey);
            if (found) break;
          }
        }

        if (!found) {
          unmatched.push({
            election,
            level: 'Parish',
            district: districtName,
            constituency: constituencyName,
            subcounty: subcountyName,
            parish: parishName,
            registeredVoters,
            totalVotes,
            reason: determineReason(districtName, constituencyName, subcountyName, parishName),
          });
        }
      }
    }
  }

  return unmatched;
}

function determineReason(district: string, constituency: string, subcounty: string, parish: string): string {
  const normalizedDistrict = normalizeName(district);

  // Check if it's a newer district
  const newerDistricts = [
    'KWANIA', 'OBONGI', 'KAZO', 'RWAMPARA', 'KITAGWENDA', 'MADI-OKOLLO', 'TEREGO',
    'PAKWACH', 'KIKUUBE', 'KAPELEBYONG', 'KALAKI', 'KASSANDA', 'KYOTERA', 'BUGWERI',
    'BUNYANGABU', 'NABILATUK', 'KARENGA', 'LUSAKA', 'RUBANDA', 'KOLE', 'NWOYA',
    'LAMWO', 'OTUKE', 'ZOMBO', 'BUVUMA', 'BUYENDE', 'LUUKA', 'NAMAYINGO', 'SERERE',
    'NGORA', 'BULAMBULI', 'KWEEN', 'NTOROKO', 'KYANKWANZI', 'GOMBA', 'BUTAMBALA',
    'LWENGO', 'BUKOMANSIMBI', 'KALUNGU', 'MITOOMA', 'RUBIRIZI', 'SHEEMA', 'BUHWEJU'
  ];

  if (newerDistricts.includes(normalizedDistrict)) {
    return 'District created after historical election boundaries';
  }

  // Check for municipality/town council
  if (constituency.toUpperCase().includes('MUNICIPALITY') ||
      subcounty.toUpperCase().includes('MUNICIPALITY') ||
      subcounty.toUpperCase().includes('TOWN COUNCIL') ||
      subcounty.toUpperCase().includes('DIVISION')) {
    return 'Urban area naming variation';
  }

  // Check for ward (urban subdivision)
  if (parish.toUpperCase().includes('WARD')) {
    return 'Urban ward naming variation';
  }

  return 'Name mismatch or boundary change';
}

async function main() {
  console.log('Finding unmatched election results...\n');

  const unmatched = await findUnmatched();

  console.log(`\nTotal unmatched records: ${unmatched.length}`);

  // Generate CSV
  const csvHeader = 'Election,Level,District,Constituency,Subcounty,Parish,RegisteredVoters,TotalVotes,PossibleReason';
  const csvRows = unmatched.map(r =>
    `"${r.election}","${r.level}","${r.district}","${r.constituency}","${r.subcounty}","${r.parish}","${r.registeredVoters}","${r.totalVotes}","${r.reason}"`
  );

  const csvContent = [csvHeader, ...csvRows].join('\n');
  const outputPath = '/Users/polycarp/dev/cursor/projects/uganda_electoral_map/Documentation/Unmatched_Election_Results.csv';

  fs.writeFileSync(outputPath, csvContent, 'utf-8');
  console.log(`\nCSV written to: ${outputPath}`);

  // Summary by election
  console.log('\n=== Summary by Election ===');
  const byElection = new Map<string, number>();
  unmatched.forEach(r => {
    byElection.set(r.election, (byElection.get(r.election) || 0) + 1);
  });
  byElection.forEach((count, election) => {
    console.log(`  ${election}: ${count} unmatched`);
  });

  // Summary by reason
  console.log('\n=== Summary by Reason ===');
  const byReason = new Map<string, number>();
  unmatched.forEach(r => {
    byReason.set(r.reason, (byReason.get(r.reason) || 0) + 1);
  });
  byReason.forEach((count, reason) => {
    console.log(`  ${reason}: ${count}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
