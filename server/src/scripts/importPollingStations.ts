/**
 * Import Polling Stations
 * Clears existing data and imports polling stations from combined CSV
 * Run: npx tsx src/scripts/importPollingStations.ts
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

async function clearExistingData() {
  console.log('\nClearing existing polling station data...');

  // Delete polling station elections first (foreign key constraint)
  const deletedElections = await prisma.pollingStationElection.deleteMany({});
  console.log(`  Deleted ${deletedElections.count} polling station election records`);

  // Delete polling stations
  const deletedStations = await prisma.pollingStation.deleteMany({});
  console.log(`  Deleted ${deletedStations.count} polling stations`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('Uganda Electoral Map - Polling Stations Import');
  console.log('='.repeat(60));

  try {
    // Navigate from app/server/src/scripts to project root Data directory
    const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const csvPath = path.join(projectRoot, 'Data/Polling Stations/3_i_combined_polling_stations_2006_2011_2016_2021.csv');
    console.log(`Data file: ${csvPath}`);

    if (!fs.existsSync(csvPath)) {
      throw new Error(`File not found: ${csvPath}`);
    }

    // Read CSV
    console.log('\nReading CSV file...');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(csvContent);
    console.log(`  Found ${rows.length} polling station records`);

    // Clear existing data first
    await clearExistingData();

    // Map years to presidential election IDs
    const electionMap: Map<number, number> = new Map([
      [2006, 11], // 2006 Presidential Election
      [2011, 3],  // 2011 Presidential Election
      [2016, 1],  // 2016 Presidential Election
      [2021, 2],  // 2021 Presidential Election
    ]);
    console.log(`\nElection mappings: 2006->11, 2011->3, 2016->1, 2021->2`);

    // Build multiple parish lookup strategies
    console.log('\nBuilding parish lookups...');
    const parishes = await prisma.administrativeUnit.findMany({
      where: { level: 5 }, // Parish level
      select: {
        id: true,
        name: true,
        parent: {
          select: {
            id: true,
            name: true,
            parent: {
              select: {
                id: true,
                name: true,
                parent: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Strategy 1: Full hierarchy match (District-Constituency-Subcounty-Parish)
    const parishMapFull: Map<string, number> = new Map();
    // Strategy 2: Subcounty-Parish only (ignores district/constituency changes)
    const parishMapSubcountyParish: Map<string, number> = new Map();
    // Strategy 3: Parish name only (last resort, may have duplicates)
    const parishMapNameOnly: Map<string, number[]> = new Map();

    for (const parish of parishes) {
      const subcounty = parish.parent?.name || '';
      const constituency = parish.parent?.parent?.name || '';
      const district = parish.parent?.parent?.parent?.name || '';
      const parishName = parish.name.toUpperCase();
      const subcountyName = subcounty.toUpperCase();

      // Full key
      const fullKey = `${district.toUpperCase()}-${constituency.toUpperCase()}-${subcountyName}-${parishName}`;
      parishMapFull.set(fullKey, parish.id);

      // Subcounty-Parish key
      const subParishKey = `${subcountyName}-${parishName}`;
      if (!parishMapSubcountyParish.has(subParishKey)) {
        parishMapSubcountyParish.set(subParishKey, parish.id);
      }

      // Name only
      if (!parishMapNameOnly.has(parishName)) {
        parishMapNameOnly.set(parishName, []);
      }
      parishMapNameOnly.get(parishName)!.push(parish.id);
    }
    console.log(`  Full hierarchy lookups: ${parishMapFull.size}`);
    console.log(`  Subcounty-Parish lookups: ${parishMapSubcountyParish.size}`);
    console.log(`  Parish name lookups: ${parishMapNameOnly.size}`);

    // Track created polling stations by parish+code
    const stationMap: Map<string, number> = new Map();

    // Import polling stations
    console.log('\nImporting polling stations...');
    let stationsCreated = 0;
    let electionDataCreated = 0;
    let skipped = 0;
    let parishNotFound = 0;
    let matchedByFull = 0;
    let matchedBySubcounty = 0;
    let matchedByName = 0;

    // Track already processed station+election combos to avoid duplicates
    const processedElectionData = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const districtName = row['District.Name']?.toUpperCase() || '';
      const constituencyName = row['Constituency.Name']?.toUpperCase() || '';
      const subcountyName = row['SubCounty.Name']?.toUpperCase() || '';
      const parishName = row['Parish.Name']?.toUpperCase() || '';
      const stationCode = row['Station.Code']?.replace('.0', '') || '1';
      const stationName = row['Station.Name'] || '';
      const year = parseInt(row['Year']) || 0;
      const registeredVoters = parseInt(row['Registered.Voters']) || 0;

      // Try multiple lookup strategies
      let parishId: number | undefined;

      // Strategy 1: Full hierarchy
      const fullKey = `${districtName}-${constituencyName}-${subcountyName}-${parishName}`;
      parishId = parishMapFull.get(fullKey);
      if (parishId) matchedByFull++;

      // Strategy 2: Subcounty-Parish (handles district splits)
      if (!parishId) {
        const subParishKey = `${subcountyName}-${parishName}`;
        parishId = parishMapSubcountyParish.get(subParishKey);
        if (parishId) matchedBySubcounty++;
      }

      // Strategy 3: Parish name only (last resort for unique names)
      if (!parishId) {
        const nameMatches = parishMapNameOnly.get(parishName);
        if (nameMatches && nameMatches.length === 1) {
          parishId = nameMatches[0];
          matchedByName++;
        }
      }

      if (!parishId) {
        parishNotFound++;
        continue;
      }

      // Get or create polling station
      const stationKey = `${parishId}-${stationCode}`;
      let stationId = stationMap.get(stationKey);

      if (!stationId) {
        try {
          const station = await prisma.pollingStation.create({
            data: {
              code: stationCode,
              name: stationName,
              parishId,
            },
          });
          stationsCreated++;
          stationId = station.id;
          stationMap.set(stationKey, stationId);
        } catch (err) {
          // Handle unique constraint - find existing
          const existing = await prisma.pollingStation.findFirst({
            where: { parishId, code: stationCode },
          });
          if (existing) {
            stationId = existing.id;
            stationMap.set(stationKey, stationId);
          } else {
            continue;
          }
        }
      }

      // Get election ID
      const electionId = electionMap.get(year);
      if (!electionId) {
        skipped++;
        continue;
      }

      // Check if already processed
      const electionDataKey = `${stationId}-${electionId}`;
      if (processedElectionData.has(electionDataKey)) {
        continue;
      }
      processedElectionData.add(electionDataKey);

      // Create polling station election data using upsert
      await prisma.pollingStationElection.upsert({
        where: {
          pollingStationId_electionId: {
            pollingStationId: stationId,
            electionId,
          },
        },
        update: {
          totalVoters: registeredVoters,
        },
        create: {
          pollingStationId: stationId,
          electionId,
          totalVoters: registeredVoters,
          isActive: true,
        },
      });
      electionDataCreated++;

      if ((stationsCreated + electionDataCreated) % 10000 === 0) {
        console.log(`  ... ${stationsCreated} stations, ${electionDataCreated} election records`);
      }
    }

    console.log(`\n  Match stats:`);
    console.log(`    - Full hierarchy: ${matchedByFull}`);
    console.log(`    - Subcounty-Parish: ${matchedBySubcounty}`);
    console.log(`    - Parish name only: ${matchedByName}`);

    console.log(`\n  Polling stations created: ${stationsCreated}`);
    console.log(`  Election data records created: ${electionDataCreated}`);
    console.log(`  Skipped (no election found for year): ${skipped}`);
    console.log(`  Parish not found: ${parishNotFound}`);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('Import completed!');
    console.log('='.repeat(60));

    const stationCount = await prisma.pollingStation.count();
    const electionDataCount = await prisma.pollingStationElection.count();

    console.log('\nDatabase Summary:');
    console.log(`  - Polling Stations: ${stationCount}`);
    console.log(`  - Polling Station Election Data: ${electionDataCount}`);

  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
