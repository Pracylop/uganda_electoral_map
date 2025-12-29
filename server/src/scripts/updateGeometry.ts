/**
 * Update Administrative Unit Geometry
 * Updates existing admin units with geometry from GeoJSON file
 * Run: npx tsx src/scripts/updateGeometry.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

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

async function updateGeometry() {
  console.log('='.repeat(60));
  console.log('Updating Administrative Unit Geometry');
  console.log('='.repeat(60));

  try {
    // Read GeoJSON file
    console.log('\n1. Reading GeoJSON file...');
    const geoJSONPath = path.join(__dirname, '../../../../Data/GIS/UG_Admin_Boundaries.geojson');

    if (!fs.existsSync(geoJSONPath)) {
      throw new Error(`GeoJSON file not found: ${geoJSONPath}`);
    }

    const geoJSONContent = fs.readFileSync(geoJSONPath, 'utf-8');
    const geoJSON: GeoJSONFile = JSON.parse(geoJSONContent);
    console.log(`   Read ${geoJSON.features.length} features from GeoJSON`);

    // Group features by parish (aggregate village polygons)
    console.log('\n2. Aggregating geometries by parish...');
    const parishGeometries = new Map<string, any[]>();

    for (const feature of geoJSON.features) {
      const key = `${feature.properties.SUBCOUNTY}|${feature.properties.PARISH}`.toUpperCase();
      if (!parishGeometries.has(key)) {
        parishGeometries.set(key, []);
      }
      parishGeometries.get(key)!.push(feature.geometry);
    }
    console.log(`   Found ${parishGeometries.size} unique parishes`);

    // Group by subcounty
    const subcountyGeometries = new Map<string, any[]>();
    for (const feature of geoJSON.features) {
      const key = `${feature.properties.CONSTITUENCY}|${feature.properties.SUBCOUNTY}`.toUpperCase();
      if (!subcountyGeometries.has(key)) {
        subcountyGeometries.set(key, []);
      }
      subcountyGeometries.get(key)!.push(feature.geometry);
    }
    console.log(`   Found ${subcountyGeometries.size} unique subcounties`);

    // Group by constituency
    const constituencyGeometries = new Map<string, any[]>();
    for (const feature of geoJSON.features) {
      const key = `${feature.properties.DISTRICT}|${feature.properties.CONSTITUENCY}`.toUpperCase();
      if (!constituencyGeometries.has(key)) {
        constituencyGeometries.set(key, []);
      }
      constituencyGeometries.get(key)!.push(feature.geometry);
    }
    console.log(`   Found ${constituencyGeometries.size} unique constituencies`);

    // Group by district
    const districtGeometries = new Map<string, any[]>();
    for (const feature of geoJSON.features) {
      const key = feature.properties.DISTRICT.toUpperCase();
      if (!districtGeometries.has(key)) {
        districtGeometries.set(key, []);
      }
      districtGeometries.get(key)!.push(feature.geometry);
    }
    console.log(`   Found ${districtGeometries.size} unique districts`);

    // Helper function to merge polygons into MultiPolygon
    function mergeGeometries(geometries: any[]): any {
      const allPolygons: any[] = [];

      for (const geom of geometries) {
        if (geom.type === 'Polygon') {
          allPolygons.push(geom.coordinates);
        } else if (geom.type === 'MultiPolygon') {
          allPolygons.push(...geom.coordinates);
        }
      }

      if (allPolygons.length === 0) return null;
      if (allPolygons.length === 1) {
        return { type: 'Polygon', coordinates: allPolygons[0] };
      }
      return { type: 'MultiPolygon', coordinates: allPolygons };
    }

    // Get all admin units
    console.log('\n3. Loading existing admin units...');
    const adminUnits = await prisma.administrativeUnit.findMany({
      select: { id: true, name: true, level: true, parentId: true }
    });
    console.log(`   Loaded ${adminUnits.length} admin units`);

    // Build parent lookup
    const parentLookup = new Map<number, { name: string; level: number }>();
    for (const unit of adminUnits) {
      parentLookup.set(unit.id, { name: unit.name, level: unit.level });
    }

    // Update geometry for each level
    console.log('\n4. Updating geometry...');
    let updatedCount = 0;
    let skippedCount = 0;

    // Update parishes (level 5)
    const parishes = adminUnits.filter(u => u.level === 5);
    console.log(`   Updating ${parishes.length} parishes...`);

    for (const parish of parishes) {
      // Get parent subcounty name
      const subcounty = parish.parentId ? parentLookup.get(parish.parentId) : null;
      if (!subcounty) continue;

      const key = `${subcounty.name}|${parish.name}`.toUpperCase();
      const geometries = parishGeometries.get(key);

      if (geometries && geometries.length > 0) {
        const mergedGeometry = mergeGeometries(geometries);
        if (mergedGeometry) {
          await prisma.administrativeUnit.update({
            where: { id: parish.id },
            data: { geometry: JSON.stringify(mergedGeometry) }
          });
          updatedCount++;
        }
      } else {
        skippedCount++;
      }
    }
    console.log(`     Updated: ${updatedCount}, Skipped: ${skippedCount}`);

    // Update subcounties (level 4)
    updatedCount = 0;
    skippedCount = 0;
    const subcounties = adminUnits.filter(u => u.level === 4);
    console.log(`   Updating ${subcounties.length} subcounties...`);

    for (const subcounty of subcounties) {
      const constituency = subcounty.parentId ? parentLookup.get(subcounty.parentId) : null;
      if (!constituency) continue;

      const key = `${constituency.name}|${subcounty.name}`.toUpperCase();
      const geometries = subcountyGeometries.get(key);

      if (geometries && geometries.length > 0) {
        const mergedGeometry = mergeGeometries(geometries);
        if (mergedGeometry) {
          await prisma.administrativeUnit.update({
            where: { id: subcounty.id },
            data: { geometry: JSON.stringify(mergedGeometry) }
          });
          updatedCount++;
        }
      } else {
        skippedCount++;
      }
    }
    console.log(`     Updated: ${updatedCount}, Skipped: ${skippedCount}`);

    // Update constituencies (level 3)
    updatedCount = 0;
    skippedCount = 0;
    const constituencies = adminUnits.filter(u => u.level === 3);
    console.log(`   Updating ${constituencies.length} constituencies...`);

    for (const constituency of constituencies) {
      const district = constituency.parentId ? parentLookup.get(constituency.parentId) : null;
      if (!district) continue;

      const key = `${district.name}|${constituency.name}`.toUpperCase();
      const geometries = constituencyGeometries.get(key);

      if (geometries && geometries.length > 0) {
        const mergedGeometry = mergeGeometries(geometries);
        if (mergedGeometry) {
          await prisma.administrativeUnit.update({
            where: { id: constituency.id },
            data: { geometry: JSON.stringify(mergedGeometry) }
          });
          updatedCount++;
        }
      } else {
        skippedCount++;
      }
    }
    console.log(`     Updated: ${updatedCount}, Skipped: ${skippedCount}`);

    // Update districts (level 2)
    updatedCount = 0;
    skippedCount = 0;
    const districts = adminUnits.filter(u => u.level === 2);
    console.log(`   Updating ${districts.length} districts...`);

    for (const district of districts) {
      const key = district.name.toUpperCase();
      const geometries = districtGeometries.get(key);

      if (geometries && geometries.length > 0) {
        const mergedGeometry = mergeGeometries(geometries);
        if (mergedGeometry) {
          await prisma.administrativeUnit.update({
            where: { id: district.id },
            data: { geometry: JSON.stringify(mergedGeometry) }
          });
          updatedCount++;
        }
      } else {
        skippedCount++;
      }
    }
    console.log(`     Updated: ${updatedCount}, Skipped: ${skippedCount}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Geometry update complete!');
    console.log('='.repeat(60));

    // Verify
    for (let level = 2; level <= 5; level++) {
      const withGeom = await prisma.administrativeUnit.count({
        where: { level, NOT: { geometry: null } }
      });
      const total = await prisma.administrativeUnit.count({ where: { level } });
      console.log(`Level ${level}: ${withGeom}/${total} with geometry`);
    }

  } catch (error) {
    console.error('Error updating geometry:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateGeometry();
