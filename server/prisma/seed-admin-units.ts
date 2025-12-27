import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAdministrativeUnits() {
  console.log('🌍 Seeding administrative units for Uganda...');

  // Create National level
  const uganda = await prisma.administrativeUnit.create({
    data: {
      name: 'Uganda',
      code: 'UG',
      level: 0, // National
      parentId: null,
      geometry: null // Will be added later with PostGIS
    }
  });

  console.log(`✅ Created national level: ${uganda.name}`);

  // Create sample regions
  const regions = [
    { name: 'Central Region', code: 'C' },
    { name: 'Eastern Region', code: 'E' },
    { name: 'Northern Region', code: 'N' },
    { name: 'Western Region', code: 'W' }
  ];

  const createdRegions = [];
  for (const region of regions) {
    const r = await prisma.administrativeUnit.create({
      data: {
        name: region.name,
        code: region.code,
        level: 1, // Region/Sub-Region
        parentId: uganda.id,
        geometry: null
      }
    });
    createdRegions.push(r);
    console.log(`✅ Created region: ${r.name}`);
  }

  // Create sample districts (focusing on major ones)
  const districts = [
    { name: 'Kampala', code: 'KLA', region: 'Central Region', population: 1680000 },
    { name: 'Wakiso', code: 'WAK', region: 'Central Region', population: 2007700 },
    { name: 'Mukono', code: 'MUK', region: 'Central Region', population: 596800 },
    { name: 'Jinja', code: 'JIN', region: 'Eastern Region', population: 471200 },
    { name: 'Mbale', code: 'MBA', region: 'Eastern Region', population: 488500 },
    { name: 'Gulu', code: 'GUL', region: 'Northern Region', population: 407300 },
    { name: 'Lira', code: 'LIR', region: 'Northern Region', population: 408200 },
    { name: 'Mbarara', code: 'MBR', region: 'Western Region', population: 472600 },
    { name: 'Kasese', code: 'KAS', region: 'Western Region', population: 702200 }
  ];

  const createdDistricts = [];
  for (const district of districts) {
    const parentRegion = createdRegions.find(r => r.name === district.region);
    if (!parentRegion) continue;

    const d = await prisma.administrativeUnit.create({
      data: {
        name: district.name,
        code: district.code,
        level: 2, // District
        parentId: parentRegion.id,
        registeredVoters: Math.floor(district.population * 0.6), // Estimate 60% are voters
        geometry: null
      }
    });
    createdDistricts.push(d);
    console.log(`✅ Created district: ${d.name} (~${Math.floor(district.population * 0.6).toLocaleString()} voters)`);
  }

  // Create sample constituencies for Kampala
  const kampalaDist = createdDistricts.find(d => d.name === 'Kampala');
  if (kampalaDist) {
    const constituencies = [
      { name: 'Kampala Central Division', code: 'KLA-C' },
      { name: 'Kawempe Division North', code: 'KLA-KN' },
      { name: 'Kawempe Division South', code: 'KLA-KS' },
      { name: 'Makindye Division East', code: 'KLA-ME' },
      { name: 'Makindye Division West', code: 'KLA-MW' },
      { name: 'Nakawa Division East', code: 'KLA-NE' },
      { name: 'Nakawa Division West', code: 'KLA-NW' },
      { name: 'Rubaga Division North', code: 'KLA-RN' },
      { name: 'Rubaga Division South', code: 'KLA-RS' }
    ];

    for (const constituency of constituencies) {
      const c = await prisma.administrativeUnit.create({
        data: {
          name: constituency.name,
          code: constituency.code,
          level: 3, // Constituency
          parentId: kampalaDist.id,
          geometry: null
        }
      });
      console.log(`✅ Created constituency: ${c.name}`);
    }
  }

  console.log('\n✨ Administrative units seeding completed!');
  console.log(`📊 Summary:`);
  console.log(`   - 1 National level`);
  console.log(`   - ${regions.length} Regions`);
  console.log(`   - ${districts.length} Districts`);
  console.log(`   - 9 Constituencies (Kampala)`);
}

async function main() {
  try {
    await seedAdministrativeUnits();
  } catch (error) {
    console.error('❌ Error seeding administrative units:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
