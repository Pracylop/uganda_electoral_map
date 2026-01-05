/**
 * Aggregate Demographics Data
 *
 * Pre-computes demographic aggregates at all administrative levels (1-5)
 * for fast map rendering. Run this after importing demographics data.
 *
 * Usage: npm run aggregate:demographics
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CENSUS_YEAR = 2024;

interface AggregateData {
  totalPopulation: number;
  malePopulation: number;
  femalePopulation: number;
  votingAgePopulation: number;
  youthPopulation: number;
  elderlyPopulation: number;
  numberOfHouseholds: number;
  parishCount: number;
}

async function aggregateDemographics() {
  console.log('=== Demographics Aggregation Script ===');
  console.log(`Census Year: ${CENSUS_YEAR}`);
  console.log('');

  // Clear existing aggregates
  console.log('Clearing existing aggregates...');
  await prisma.demographicsAggregate.deleteMany({
    where: { censusYear: CENSUS_YEAR }
  });

  // Level 5: Parish (direct copy from Demographics)
  console.log('\n--- Level 5: Parishes (direct copy) ---');
  const parishes = await prisma.demographics.findMany({
    where: { censusYear: CENSUS_YEAR },
    include: { adminUnit: { select: { id: true, level: true } } }
  });

  const parishAggregates = parishes.map(d => ({
    adminUnitId: d.adminUnitId,
    censusYear: CENSUS_YEAR,
    level: 5,
    totalPopulation: d.totalPopulation,
    malePopulation: d.malePopulation,
    femalePopulation: d.femalePopulation,
    votingAgePopulation: d.votingAgePopulation,
    youthPopulation: d.youthPopulation,
    elderlyPopulation: d.elderlyPopulation,
    numberOfHouseholds: d.numberOfHouseholds || 0,
    parishCount: 1
  }));

  // Batch insert parishes
  if (parishAggregates.length > 0) {
    await prisma.demographicsAggregate.createMany({
      data: parishAggregates
    });
    console.log(`Created ${parishAggregates.length} parish aggregates`);
  }

  // Build lookup map for parishes
  const parishDataMap = new Map<number, AggregateData>();
  parishes.forEach(d => {
    parishDataMap.set(d.adminUnitId, {
      totalPopulation: d.totalPopulation,
      malePopulation: d.malePopulation,
      femalePopulation: d.femalePopulation,
      votingAgePopulation: d.votingAgePopulation,
      youthPopulation: d.youthPopulation,
      elderlyPopulation: d.elderlyPopulation,
      numberOfHouseholds: d.numberOfHouseholds || 0,
      parishCount: 1
    });
  });

  // Get all admin units with their children (for aggregation)
  const allUnits = await prisma.administrativeUnit.findMany({
    select: { id: true, name: true, level: true, parentId: true }
  });

  // Build parent-children map
  const childrenMap = new Map<number, number[]>();
  allUnits.forEach(unit => {
    if (unit.parentId) {
      if (!childrenMap.has(unit.parentId)) {
        childrenMap.set(unit.parentId, []);
      }
      childrenMap.get(unit.parentId)!.push(unit.id);
    }
  });

  // Get all descendant parishes for a unit (recursive)
  function getDescendantParishes(unitId: number, visitedLevel: number): number[] {
    if (visitedLevel === 5) {
      return [unitId]; // This is a parish
    }

    const children = childrenMap.get(unitId) || [];
    const parishes: number[] = [];

    for (const childId of children) {
      const child = allUnits.find(u => u.id === childId);
      if (child) {
        parishes.push(...getDescendantParishes(childId, child.level));
      }
    }

    return parishes;
  }

  // Aggregate for levels 4, 3, 2, 1 (bottom up)
  for (const level of [4, 3, 2, 1]) {
    const levelName = ['', 'Sub-Region', 'District', 'Constituency', 'Subcounty'][level];
    console.log(`\n--- Level ${level}: ${levelName}s ---`);

    const units = allUnits.filter(u => u.level === level);
    const aggregates: any[] = [];

    for (const unit of units) {
      // Get all descendant parishes
      const descendantParishes = getDescendantParishes(unit.id, level);

      // Sum up parish data
      let aggregate: AggregateData = {
        totalPopulation: 0,
        malePopulation: 0,
        femalePopulation: 0,
        votingAgePopulation: 0,
        youthPopulation: 0,
        elderlyPopulation: 0,
        numberOfHouseholds: 0,
        parishCount: 0
      };

      for (const parishId of descendantParishes) {
        const parishData = parishDataMap.get(parishId);
        if (parishData) {
          aggregate.totalPopulation += parishData.totalPopulation;
          aggregate.malePopulation += parishData.malePopulation;
          aggregate.femalePopulation += parishData.femalePopulation;
          aggregate.votingAgePopulation += parishData.votingAgePopulation;
          aggregate.youthPopulation += parishData.youthPopulation;
          aggregate.elderlyPopulation += parishData.elderlyPopulation;
          aggregate.numberOfHouseholds += parishData.numberOfHouseholds;
          aggregate.parishCount += 1;
        }
      }

      if (aggregate.parishCount > 0) {
        aggregates.push({
          adminUnitId: unit.id,
          censusYear: CENSUS_YEAR,
          level,
          ...aggregate
        });
      }
    }

    // Batch insert
    if (aggregates.length > 0) {
      await prisma.demographicsAggregate.createMany({
        data: aggregates
      });
      console.log(`Created ${aggregates.length} ${levelName} aggregates`);

      // Show some sample data
      const totalPop = aggregates.reduce((sum, a) => sum + a.totalPopulation, 0);
      console.log(`Total population at level ${level}: ${totalPop.toLocaleString()}`);
    }
  }

  // Summary
  const counts = await prisma.demographicsAggregate.groupBy({
    by: ['level'],
    _count: true,
    where: { censusYear: CENSUS_YEAR }
  });

  console.log('\n=== Aggregation Complete ===');
  console.log('Records by level:');
  counts.forEach(c => {
    const levelName = ['National', 'Sub-Region', 'District', 'Constituency', 'Subcounty', 'Parish'][c.level];
    console.log(`  Level ${c.level} (${levelName}): ${c._count}`);
  });

  await prisma.$disconnect();
}

aggregateDemographics()
  .catch(err => {
    console.error('Error:', err);
    prisma.$disconnect();
    process.exit(1);
  });
