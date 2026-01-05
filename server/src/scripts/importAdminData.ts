import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CSVRow {
  OBJECTID: string;
  SUBREGION: string;
  DISTRICT: string;
  CONSTITUENCY: string;
  SUBCOUNTY: string;
  PARISH: string;
  VILLAGE: string;
}

interface GeoJSONFeature {
  type: string;
  properties: {
    OBJECTID: number;
    SUBREGION: string;
    DISTRICT: string;
    CONSTITUENCY: string;
    SUBCOUNTY: string;
    PARISH: string;
    VILLAGE: string;
  };
  geometry: any;
}

interface GeoJSONFile {
  type: string;
  features: GeoJSONFeature[];
}

async function importAdministrativeData() {
  console.log('Starting administrative data import...');

  try {
    // Step 1: Delete all related data first (due to foreign key constraints)
    console.log('\n1. Deleting related data and existing administrative units...');

    // Delete results (references administrative units)
    await prisma.result.deleteMany({});
    console.log('   ✓ All results deleted');

    // Delete election summaries (references administrative units)
    await prisma.electionSummary.deleteMany({});
    console.log('   ✓ All election summaries deleted');

    // Delete demographics aggregates (references administrative units)
    await prisma.demographicsAggregate.deleteMany({});
    console.log('   ✓ All demographics aggregates deleted');

    // Delete demographics (parish level - references administrative units)
    await prisma.demographics.deleteMany({});
    console.log('   ✓ All demographics deleted');

    // Delete district history (references administrative units)
    await prisma.districtHistory.deleteMany({});
    console.log('   ✓ All district history deleted');

    // Clear candidate electoral area references
    await prisma.candidate.updateMany({
      data: { electoralAreaId: null }
    });
    console.log('   ✓ Candidate electoral area references cleared');

    // Clear electoral issue location references
    await prisma.electoralIssue.updateMany({
      data: {
        districtId: null,
        constituencyId: null,
        subcountyId: null,
        parishId: null
      }
    });
    console.log('   ✓ Electoral issue location references cleared');

    // Delete polling station elections first (references polling stations)
    await prisma.pollingStationElection.deleteMany({});
    console.log('   ✓ All polling station elections deleted');

    // Delete polling stations (references administrative units via parish)
    await prisma.pollingStation.deleteMany({});
    console.log('   ✓ All polling stations deleted');

    // Delete administrative units
    await prisma.administrativeUnit.deleteMany({});
    console.log('   ✓ All existing administrative units deleted');

    // Step 2: Read CSV file
    console.log('\n2. Reading CSV file...');
    const csvPath = path.join(__dirname, '../../../../Data/Admin_Boundaries/UG_Admin_Regions_UPDATED.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const csvLines = csvContent.split('\n').filter(line => line.trim());
    const headers = csvLines[0].split(',').map(h => h.replace(/"/g, ''));

    const csvData: CSVRow[] = [];
    for (let i = 1; i < csvLines.length; i++) {
      const values = csvLines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (values && values.length >= 7) {
        csvData.push({
          OBJECTID: values[0].replace(/"/g, ''),
          SUBREGION: values[1].replace(/"/g, ''),
          DISTRICT: values[2].replace(/"/g, ''),
          CONSTITUENCY: values[3].replace(/"/g, ''),
          SUBCOUNTY: values[4].replace(/"/g, ''),
          PARISH: values[5].replace(/"/g, ''),
          VILLAGE: values[6].replace(/"/g, '')
        });
      }
    }
    console.log(`   ✓ Read ${csvData.length} records from CSV`);

    // Step 3: Read GeoJSON file
    console.log('\n3. Reading GeoJSON file...');
    const geoJSONPath = path.join(__dirname, '../../../../Data/GIS/UG_Admin_Boundaries.geojson');
    const geoJSONContent = fs.readFileSync(geoJSONPath, 'utf-8');
    const geoJSON: GeoJSONFile = JSON.parse(geoJSONContent);
    console.log(`   ✓ Read ${geoJSON.features.length} features from GeoJSON`);

    // Create geometry lookup by OBJECTID
    const geometryLookup = new Map<number, any>();
    for (const feature of geoJSON.features) {
      geometryLookup.set(feature.properties.OBJECTID, feature.geometry);
    }

    // Step 4: Build unique administrative units at each level
    console.log('\n4. Building administrative hierarchy...');

    const subregions = new Set<string>();
    const districts = new Map<string, string>(); // key: district name, value: subregion
    const constituencies = new Map<string, string>(); // key: constituency name, value: district
    const subcounties = new Map<string, string>(); // key: subcounty name, value: constituency
    const parishes = new Map<string, string>(); // key: parish name, value: subcounty
    const villages: Array<{
      objectId: string;
      name: string;
      parish: string;
      geometry: any;
    }> = [];

    for (const row of csvData) {
      subregions.add(row.SUBREGION);

      const districtKey = `${row.DISTRICT}|${row.SUBREGION}`;
      districts.set(districtKey, row.SUBREGION);

      const constituencyKey = `${row.CONSTITUENCY}|${row.DISTRICT}|${row.SUBREGION}`;
      constituencies.set(constituencyKey, districtKey);

      const subcountyKey = `${row.SUBCOUNTY}|${row.CONSTITUENCY}|${row.DISTRICT}|${row.SUBREGION}`;
      subcounties.set(subcountyKey, constituencyKey);

      const parishKey = `${row.PARISH}|${row.SUBCOUNTY}|${row.CONSTITUENCY}|${row.DISTRICT}|${row.SUBREGION}`;
      parishes.set(parishKey, subcountyKey);

      const geometry = geometryLookup.get(parseInt(row.OBJECTID));
      villages.push({
        objectId: row.OBJECTID,
        name: row.VILLAGE,
        parish: parishKey,
        geometry: geometry ? JSON.stringify(geometry) : null
      });
    }

    console.log(`   ✓ Found ${subregions.size} subregions`);
    console.log(`   ✓ Found ${districts.size} districts`);
    console.log(`   ✓ Found ${constituencies.size} constituencies`);
    console.log(`   ✓ Found ${subcounties.size} subcounties`);
    console.log(`   ✓ Found ${parishes.size} parishes`);
    console.log(`   ✓ Found ${villages.length} villages`);

    // Step 5: Insert data level by level
    console.log('\n5. Inserting administrative units into database...');

    // Level 1: Subregions
    console.log('   Inserting subregions...');
    const subregionIds = new Map<string, number>();
    let counter = 1;
    for (const subregion of Array.from(subregions)) {
      const unit = await prisma.administrativeUnit.create({
        data: {
          name: subregion,
          level: 1,
          code: `SR-${counter.toString().padStart(5, '0')}`,
        }
      });
      subregionIds.set(subregion, unit.id);
      counter++;
    }
    console.log(`   ✓ Inserted ${subregionIds.size} subregions`);

    // Level 2: Districts
    console.log('   Inserting districts...');
    const districtIds = new Map<string, number>();
    counter = 1;
    for (const [districtKey, subregion] of districts.entries()) {
      const districtName = districtKey.split('|')[0];
      const parentId = subregionIds.get(subregion);

      const unit = await prisma.administrativeUnit.create({
        data: {
          name: districtName,
          level: 2,
          code: `DT-${counter.toString().padStart(5, '0')}`,
          parentId: parentId
        }
      });
      districtIds.set(districtKey, unit.id);
      counter++;
    }
    console.log(`   ✓ Inserted ${districtIds.size} districts`);

    // Level 3: Constituencies
    console.log('   Inserting constituencies...');
    const constituencyIds = new Map<string, number>();
    counter = 1;
    for (const [constituencyKey, districtKey] of constituencies.entries()) {
      const constituencyName = constituencyKey.split('|')[0];
      const parentId = districtIds.get(districtKey);

      const unit = await prisma.administrativeUnit.create({
        data: {
          name: constituencyName,
          level: 3,
          code: `CN-${counter.toString().padStart(5, '0')}`,
          parentId: parentId
        }
      });
      constituencyIds.set(constituencyKey, unit.id);
      counter++;
    }
    console.log(`   ✓ Inserted ${constituencyIds.size} constituencies`);

    // Level 4: Subcounties
    console.log('   Inserting subcounties...');
    const subcountyIds = new Map<string, number>();
    counter = 1;
    for (const [subcountyKey, constituencyKey] of subcounties.entries()) {
      const subcountyName = subcountyKey.split('|')[0];
      const parentId = constituencyIds.get(constituencyKey);

      const unit = await prisma.administrativeUnit.create({
        data: {
          name: subcountyName,
          level: 4,
          code: `SC-${counter.toString().padStart(5, '0')}`,
          parentId: parentId
        }
      });
      subcountyIds.set(subcountyKey, unit.id);
      counter++;
    }
    console.log(`   ✓ Inserted ${subcountyIds.size} subcounties`);

    // Level 5: Parishes
    console.log('   Inserting parishes...');
    const parishIds = new Map<string, number>();
    counter = 1;
    for (const [parishKey, subcountyKey] of parishes.entries()) {
      const parishName = parishKey.split('|')[0];
      const parentId = subcountyIds.get(subcountyKey);

      const unit = await prisma.administrativeUnit.create({
        data: {
          name: parishName,
          level: 5,
          code: `PR-${counter.toString().padStart(5, '0')}`,
          parentId: parentId
        }
      });
      parishIds.set(parishKey, unit.id);
      counter++;
    }
    console.log(`   ✓ Inserted ${parishIds.size} parishes`);

    // Level 6: Villages (with geometry) - using batch inserts
    console.log('   Inserting villages...');
    const villageData = villages.map(village => ({
      name: village.name,
      level: 6,
      code: `VL-${village.objectId}`,
      parentId: parishIds.get(village.parish)!,
      geometry: village.geometry
    }));

    // Insert in batches of 1000 to optimize performance
    const batchSize = 1000;
    let insertedCount = 0;

    for (let i = 0; i < villageData.length; i += batchSize) {
      const batch = villageData.slice(i, i + batchSize);
      await prisma.administrativeUnit.createMany({
        data: batch
      });
      insertedCount += batch.length;
      console.log(`   ... ${insertedCount} villages inserted`);
    }
    console.log(`   ✓ Inserted ${insertedCount} villages`);

    console.log('\n✅ Import completed successfully!');
    console.log('\nSummary:');
    console.log(`  - Subregions: ${subregionIds.size}`);
    console.log(`  - Districts: ${districtIds.size}`);
    console.log(`  - Constituencies: ${constituencyIds.size}`);
    console.log(`  - Subcounties: ${subcountyIds.size}`);
    console.log(`  - Parishes: ${parishIds.size}`);
    console.log(`  - Villages: ${insertedCount}`);
    console.log(`  - Total: ${subregionIds.size + districtIds.size + constituencyIds.size + subcountyIds.size + parishIds.size + insertedCount}`);

  } catch (error) {
    console.error('\n❌ Error during import:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importAdministrativeData()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
