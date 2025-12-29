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
    const csvPath = path.join(projectRoot, 'Data/Polling Stations/3_h_combined_polling_stations_2011_2016_2021.csv');
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

    // Get elections
    const elections = await prisma.election.findMany({
      where: {
        electionType: { code: 'PRES' },
      },
      orderBy: { year: 'asc' },
    });

    const electionMap: Map<number, number> = new Map();
    for (const election of elections) {
      electionMap.set(election.year, election.id);
    }
    console.log(`\nFound elections for years: ${Array.from(electionMap.keys()).join(', ')}`);

    // Build parish lookup
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

    // Track created polling stations by parish+code
    const stationMap: Map<string, number> = new Map();

    // Import polling stations
    console.log('\nImporting polling stations...');
    let stationsCreated = 0;
    let electionDataCreated = 0;
    let skipped = 0;
    let parishNotFound = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const districtName = row['District.Name']?.toUpperCase() || '';
      const constituencyName = row['Constituency.Name']?.toUpperCase() || '';
      const subcountyName = row['SubCounty.Name']?.toUpperCase() || '';
      const parishName = row['Parish.Name']?.toUpperCase() || '';
      const stationCode = row['Station.Code']?.replace('.0', '') || '';
      const stationName = row['Station.Name'] || '';
      const year = parseInt(row['Year']) || 0;
      const registeredVoters = parseInt(row['Registered.Voters']) || 0;

      // Find parish
      const parishKey = `${districtName}-${constituencyName}-${subcountyName}-${parishName}`;
      const parishId = parishMap.get(parishKey);

      if (!parishId) {
        parishNotFound++;
        if (parishNotFound <= 5) {
          console.log(`  Parish not found: ${districtName} > ${constituencyName} > ${subcountyName} > ${parishName}`);
        }
        continue;
      }

      // Get or create polling station
      const stationKey = `${parishId}-${stationCode}`;
      let stationId = stationMap.get(stationKey);

      if (!stationId) {
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
      }

      // Get election ID
      const electionId = electionMap.get(year);
      if (!electionId) {
        skipped++;
        continue;
      }

      // Create polling station election data
      await prisma.pollingStationElection.create({
        data: {
          pollingStationId: stationId,
          electionId,
          totalVoters: registeredVoters,
          isActive: true,
        },
      });
      electionDataCreated++;

      if ((stationsCreated + electionDataCreated) % 5000 === 0) {
        console.log(`  ... ${stationsCreated} stations, ${electionDataCreated} election records created`);
      }
    }

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
