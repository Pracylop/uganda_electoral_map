/**
 * Import Demographics Data from 2024 Uganda National Census
 *
 * Reads CSV files from Data/Demographics and imports into demographics table.
 * Uses multi-strategy parish matching to handle naming variations.
 *
 * Usage: npx tsx src/scripts/importDemographics.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Census year for this import
const CENSUS_YEAR = 2024;

// CSV file paths
const DATA_DIR = path.join(__dirname, '../../../..', 'Data/Demographics');
const GENDER_FILE = path.join(DATA_DIR, 'UBOS_Census_Gender.csv');
const AGE_FILE = path.join(DATA_DIR, 'UBOS_Census_Age_Groups.csv');
const HOUSEHOLDS_FILE = path.join(DATA_DIR, 'UBOS_Census_Households.csv');

interface GenderRow {
  district: string;
  constituency: string;
  subcounty: string;
  location: string;
  male: number;
  female: number;
  total: number;
}

interface AgeRow {
  district: string;
  constituency: string;
  subcounty: string;
  location: string;
  age0_17: number;
  age18Plus: number;
  age60Plus: number;
}

interface HouseholdRow {
  district: string;
  constituency: string;
  subcounty: string;
  location: string;
  households: number;
  avgSize: number;
}

interface MergedDemographics {
  district: string;
  constituency: string;
  subcounty: string;
  parish: string;
  totalPopulation: number;
  malePopulation: number;
  femalePopulation: number;
  votingAgePopulation: number;
  youthPopulation: number;
  elderlyPopulation: number;
  numberOfHouseholds: number | null;
  avgHouseholdSize: number | null;
}

function parseCSV(filePath: string): string[][] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

function parseGenderFile(): Map<string, GenderRow> {
  const rows = parseCSV(GENDER_FILE);
  const map = new Map<string, GenderRow>();

  // Skip header
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 7) continue;

    const key = `${row[0]}|${row[1]}|${row[2]}|${row[3]}`.toUpperCase();
    map.set(key, {
      district: row[0],
      constituency: row[1],
      subcounty: row[2],
      location: row[3],
      male: parseInt(row[4]) || 0,
      female: parseInt(row[5]) || 0,
      total: parseInt(row[6]) || 0,
    });
  }

  return map;
}

function parseAgeFile(): Map<string, AgeRow> {
  const rows = parseCSV(AGE_FILE);
  const map = new Map<string, AgeRow>();

  // Header: DISTRICT,CONSTITUENCY,SUBCOUNTY,Location,Age 0-4,Age 0-17,Age 6-12,Age 13-18,Age 14-64,Age 15+,Age 18-30,Age 15-24,Age 18+,Age 60+,Age 65+,Age 80+
  // Indices: 0       1            2         3        4       5        6        7         8        9       10       11       12      13      14      15
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 14) continue;

    const key = `${row[0]}|${row[1]}|${row[2]}|${row[3]}`.toUpperCase();
    map.set(key, {
      district: row[0],
      constituency: row[1],
      subcounty: row[2],
      location: row[3],
      age0_17: parseInt(row[5]) || 0,   // Age 0-17
      age18Plus: parseInt(row[12]) || 0, // Age 18+
      age60Plus: parseInt(row[13]) || 0, // Age 60+
    });
  }

  return map;
}

function parseHouseholdsFile(): Map<string, HouseholdRow> {
  const rows = parseCSV(HOUSEHOLDS_FILE);
  const map = new Map<string, HouseholdRow>();

  // Header: DISTRICT,CONSTITUENCY,SUBCOUNTY,Location,Household Population,Number of Households,Average Household Size
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 7) continue;

    const key = `${row[0]}|${row[1]}|${row[2]}|${row[3]}`.toUpperCase();
    map.set(key, {
      district: row[0],
      constituency: row[1],
      subcounty: row[2],
      location: row[3],
      households: parseInt(row[5]) || 0,
      avgSize: parseFloat(row[6]) || 0,
    });
  }

  return map;
}

function mergeData(
  genderMap: Map<string, GenderRow>,
  ageMap: Map<string, AgeRow>,
  householdMap: Map<string, HouseholdRow>
): MergedDemographics[] {
  const merged: MergedDemographics[] = [];

  // Use gender map as the base (all files should have same keys)
  for (const [key, gender] of genderMap) {
    const age = ageMap.get(key);
    const household = householdMap.get(key);

    merged.push({
      district: gender.district,
      constituency: gender.constituency,
      subcounty: gender.subcounty,
      parish: gender.location,
      totalPopulation: gender.total,
      malePopulation: gender.male,
      femalePopulation: gender.female,
      votingAgePopulation: age?.age18Plus || 0,
      youthPopulation: age?.age0_17 || 0,
      elderlyPopulation: age?.age60Plus || 0,
      numberOfHouseholds: household?.households || null,
      avgHouseholdSize: household?.avgSize || null,
    });
  }

  return merged;
}

async function buildParishMaps() {
  console.log('Building parish lookup maps...');

  // Get all parishes (level 5) with their hierarchy - only select needed fields
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
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });

  console.log(`Found ${parishes.length} parishes in database`);

  // Strategy 1: Full hierarchy key (DISTRICT|CONSTITUENCY|SUBCOUNTY|PARISH)
  const fullKeyMap = new Map<string, number>();

  // Strategy 2: Subcounty + Parish key
  const subcountyParishMap = new Map<string, number>();

  // Strategy 3: Parish name only (with district tiebreaker)
  const parishNameMap = new Map<string, { id: number; district: string }[]>();

  for (const parish of parishes) {
    const subcounty = parish.parent;
    const constituency = subcounty?.parent;
    const district = constituency?.parent;

    if (!subcounty || !constituency || !district) continue;

    // Strategy 1: Full key
    const fullKey = `${district.name}|${constituency.name}|${subcounty.name}|${parish.name}`.toUpperCase();
    fullKeyMap.set(fullKey, parish.id);

    // Strategy 2: Subcounty + Parish
    const scKey = `${subcounty.name}|${parish.name}`.toUpperCase();
    if (!subcountyParishMap.has(scKey)) {
      subcountyParishMap.set(scKey, parish.id);
    }

    // Strategy 3: Parish name only
    const parishName = parish.name.toUpperCase();
    if (!parishNameMap.has(parishName)) {
      parishNameMap.set(parishName, []);
    }
    parishNameMap.get(parishName)!.push({ id: parish.id, district: district.name.toUpperCase() });
  }

  return { fullKeyMap, subcountyParishMap, parishNameMap };
}

function findParishId(
  data: MergedDemographics,
  maps: {
    fullKeyMap: Map<string, number>;
    subcountyParishMap: Map<string, number>;
    parishNameMap: Map<string, { id: number; district: string }[]>;
  }
): number | null {
  // Strategy 1: Full hierarchy match
  const fullKey = `${data.district}|${data.constituency}|${data.subcounty}|${data.parish}`.toUpperCase();
  if (maps.fullKeyMap.has(fullKey)) {
    return maps.fullKeyMap.get(fullKey)!;
  }

  // Strategy 2: Subcounty + Parish match
  const scKey = `${data.subcounty}|${data.parish}`.toUpperCase();
  if (maps.subcountyParishMap.has(scKey)) {
    return maps.subcountyParishMap.get(scKey)!;
  }

  // Strategy 3: Parish name with district tiebreaker
  const parishName = data.parish.toUpperCase();
  const candidates = maps.parishNameMap.get(parishName);
  if (candidates && candidates.length > 0) {
    // Try to find one in the same district
    const districtUpper = data.district.toUpperCase();
    const match = candidates.find(c => c.district === districtUpper);
    if (match) {
      return match.id;
    }
    // Otherwise, return first candidate
    return candidates[0].id;
  }

  return null;
}

async function importDemographics() {
  console.log('='.repeat(60));
  console.log('DEMOGRAPHICS IMPORT - 2024 Uganda National Census');
  console.log('='.repeat(60));

  // Check if files exist
  if (!fs.existsSync(GENDER_FILE)) {
    throw new Error(`Gender file not found: ${GENDER_FILE}`);
  }
  if (!fs.existsSync(AGE_FILE)) {
    throw new Error(`Age file not found: ${AGE_FILE}`);
  }
  if (!fs.existsSync(HOUSEHOLDS_FILE)) {
    throw new Error(`Households file not found: ${HOUSEHOLDS_FILE}`);
  }

  // Parse CSV files
  console.log('\nParsing CSV files...');
  const genderMap = parseGenderFile();
  console.log(`  Gender data: ${genderMap.size} rows`);

  const ageMap = parseAgeFile();
  console.log(`  Age data: ${ageMap.size} rows`);

  const householdMap = parseHouseholdsFile();
  console.log(`  Household data: ${householdMap.size} rows`);

  // Merge data
  console.log('\nMerging data...');
  const mergedData = mergeData(genderMap, ageMap, householdMap);
  console.log(`  Merged records: ${mergedData.length}`);

  // Build parish lookup maps
  const maps = await buildParishMaps();

  // Delete existing demographics for this census year
  console.log(`\nDeleting existing demographics for census year ${CENSUS_YEAR}...`);
  const deleted = await prisma.demographics.deleteMany({
    where: { censusYear: CENSUS_YEAR }
  });
  console.log(`  Deleted ${deleted.count} existing records`);

  // Import data
  console.log('\nImporting demographics...');
  let imported = 0;
  let notFound = 0;
  const notFoundSamples: string[] = [];

  // Process in batches
  const BATCH_SIZE = 500;
  const batches: any[][] = [];
  let currentBatch: any[] = [];

  for (const data of mergedData) {
    const parishId = findParishId(data, maps);

    if (!parishId) {
      notFound++;
      if (notFoundSamples.length < 10) {
        notFoundSamples.push(`${data.district} > ${data.constituency} > ${data.subcounty} > ${data.parish}`);
      }
      continue;
    }

    currentBatch.push({
      adminUnitId: parishId,
      censusYear: CENSUS_YEAR,
      totalPopulation: data.totalPopulation,
      malePopulation: data.malePopulation,
      femalePopulation: data.femalePopulation,
      votingAgePopulation: data.votingAgePopulation,
      youthPopulation: data.youthPopulation,
      elderlyPopulation: data.elderlyPopulation,
      numberOfHouseholds: data.numberOfHouseholds,
      avgHouseholdSize: data.avgHouseholdSize,
    });

    if (currentBatch.length >= BATCH_SIZE) {
      batches.push(currentBatch);
      currentBatch = [];
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  // Insert batches
  for (let i = 0; i < batches.length; i++) {
    try {
      const result = await prisma.demographics.createMany({
        data: batches[i],
        skipDuplicates: true,
      });
      imported += result.count;

      if ((i + 1) % 5 === 0 || i === batches.length - 1) {
        console.log(`  Progress: ${imported} records imported (batch ${i + 1}/${batches.length})`);
      }
    } catch (error) {
      console.error(`  Error in batch ${i + 1}:`, error);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total CSV records: ${mergedData.length}`);
  console.log(`Successfully imported: ${imported}`);
  console.log(`Not matched: ${notFound} (${((notFound / mergedData.length) * 100).toFixed(1)}%)`);
  console.log(`Match rate: ${((imported / mergedData.length) * 100).toFixed(1)}%`);

  if (notFoundSamples.length > 0) {
    console.log('\nSample unmatched locations:');
    notFoundSamples.forEach(s => console.log(`  - ${s}`));
  }

  // Verify totals
  const stats = await prisma.demographics.aggregate({
    where: { censusYear: CENSUS_YEAR },
    _sum: {
      totalPopulation: true,
      votingAgePopulation: true,
    },
    _count: true,
  });

  console.log('\nDatabase verification:');
  console.log(`  Records in database: ${stats._count}`);
  console.log(`  Total population: ${stats._sum.totalPopulation?.toLocaleString()}`);
  console.log(`  Voting age population: ${stats._sum.votingAgePopulation?.toLocaleString()}`);
}

// Run import
importDemographics()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
