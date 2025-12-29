import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// District creation history for Uganda (2016-2019)
// This maps current districts to their parent districts before splits
const districtHistory = [
  // 2010 - July 1
  { currentDistrict: 'KALUNGU', parentDistrict: 'MASAKA', splitYear: 2010, notes: 'Carved from Masaka District' },

  // 2016 - July 1
  { currentDistrict: 'KAGADI', parentDistrict: 'KIBAALE', splitYear: 2016, notes: 'Carved from Kibaale District' },
  { currentDistrict: 'KAKUMIRO', parentDistrict: 'KIBAALE', splitYear: 2016, notes: 'Carved from Kibaale District' },
  { currentDistrict: 'OMORO', parentDistrict: 'GULU', splitYear: 2016, notes: 'Carved from Gulu District (Omoro County)' },
  { currentDistrict: 'RUBANDA', parentDistrict: 'KABALE', splitYear: 2016, notes: 'Carved from Kabale District' },

  // 2017 - July 1
  { currentDistrict: 'BUNYANGABU', parentDistrict: 'KABAROLE', splitYear: 2017, notes: 'Carved from Kabarole District' },
  { currentDistrict: 'NAMISINDWA', parentDistrict: 'MANAFWA', splitYear: 2017, notes: 'Carved from Manafwa District' },
  { currentDistrict: 'PAKWACH', parentDistrict: 'NEBBI', splitYear: 2017, notes: 'Carved from Nebbi District' },
  { currentDistrict: 'BUTEBO', parentDistrict: 'PALLISA', splitYear: 2017, notes: 'Carved from Pallisa District' },
  { currentDistrict: 'RUKIGA', parentDistrict: 'KABALE', splitYear: 2017, notes: 'Carved from Kabale District' },
  { currentDistrict: 'KYOTERA', parentDistrict: 'RAKAI', splitYear: 2017, notes: 'Carved from Rakai District' },

  // 2018 - July 1
  { currentDistrict: 'NABILATUK', parentDistrict: 'NAKAPIRIPIRIT', splitYear: 2018, notes: 'Carved from Nakapiripirit District' },
  { currentDistrict: 'BUGWERI', parentDistrict: 'IGANGA', splitYear: 2018, notes: 'Carved from Iganga District' },
  { currentDistrict: 'KASSANDA', parentDistrict: 'MUBENDE', splitYear: 2018, notes: 'Carved from Mubende District' },
  { currentDistrict: 'KWANIA', parentDistrict: 'APAC', splitYear: 2018, notes: 'Carved from Apac District' },
  { currentDistrict: 'KAPELEBYONG', parentDistrict: 'AMURIA', splitYear: 2018, notes: 'Carved from Amuria District' },
  { currentDistrict: 'KIKUUBE', parentDistrict: 'HOIMA', splitYear: 2018, notes: 'Carved from Hoima District' },

  // 2019 - July 1
  { currentDistrict: 'OBONGI', parentDistrict: 'MOYO', splitYear: 2019, notes: 'Carved from Moyo District' },
  { currentDistrict: 'KAZO', parentDistrict: 'KIRUHURA', splitYear: 2019, notes: 'Carved from Kiruhura District' },
  { currentDistrict: 'RWAMPARA', parentDistrict: 'MBARARA', splitYear: 2019, notes: 'Carved from Mbarara District' },
  { currentDistrict: 'KITAGWENDA', parentDistrict: 'KAMWENGE', splitYear: 2019, notes: 'Carved from Kamwenge District' },
  { currentDistrict: 'MADI-OKOLLO', parentDistrict: 'ARUA', splitYear: 2019, notes: 'Carved from Arua District' },
  { currentDistrict: 'KARENGA', parentDistrict: 'KAABONG', splitYear: 2019, notes: 'Carved from Kaabong District' },
  { currentDistrict: 'KALAKI', parentDistrict: 'KABERAMAIDO', splitYear: 2019, notes: 'Carved from Kaberamaido District' },

  // 2020 - July 1 (Districts and Cities)
  { currentDistrict: 'TEREGO', parentDistrict: 'ARUA', splitYear: 2020, notes: 'Carved from Arua District' },
  { currentDistrict: 'ARUA CITY', parentDistrict: 'ARUA', splitYear: 2020, notes: 'City created from Arua District' },
  { currentDistrict: 'FORT PORTAL CITY', parentDistrict: 'KABAROLE', splitYear: 2020, notes: 'City created from Kabarole District' },
  { currentDistrict: 'GULU CITY', parentDistrict: 'GULU', splitYear: 2020, notes: 'City created from Gulu District' },
  { currentDistrict: 'HOIMA CITY', parentDistrict: 'HOIMA', splitYear: 2020, notes: 'City created from Hoima District' },
  { currentDistrict: 'JINJA CITY', parentDistrict: 'JINJA', splitYear: 2020, notes: 'City created from Jinja District' },
  { currentDistrict: 'LIRA CITY', parentDistrict: 'LIRA', splitYear: 2020, notes: 'City created from Lira District' },
  { currentDistrict: 'MASAKA CITY', parentDistrict: 'MASAKA', splitYear: 2020, notes: 'City created from Masaka District' },
  { currentDistrict: 'MBALE CITY', parentDistrict: 'MBALE', splitYear: 2020, notes: 'City created from Mbale District' },
  { currentDistrict: 'MBARARA CITY', parentDistrict: 'MBARARA', splitYear: 2020, notes: 'City created from Mbarara District' },
  { currentDistrict: 'SOROTI CITY', parentDistrict: 'SOROTI', splitYear: 2020, notes: 'City created from Soroti District' },
];

async function main() {
  console.log('Seeding district history...');

  // Get all districts (level 2)
  const districts = await prisma.administrativeUnit.findMany({
    where: { level: 2 },
    select: { id: true, name: true }
  });

  const districtMap = new Map<string, number>();
  districts.forEach(d => {
    districtMap.set(d.name.toUpperCase(), d.id);
  });

  console.log(`Found ${districts.length} districts in database`);

  let successCount = 0;
  let errorCount = 0;

  for (const entry of districtHistory) {
    const currentId = districtMap.get(entry.currentDistrict);
    const parentId = districtMap.get(entry.parentDistrict);

    if (!currentId) {
      console.warn(`  WARNING: Current district not found: ${entry.currentDistrict}`);
      errorCount++;
      continue;
    }

    if (!parentId) {
      console.warn(`  WARNING: Parent district not found: ${entry.parentDistrict}`);
      errorCount++;
      continue;
    }

    try {
      await prisma.districtHistory.upsert({
        where: { currentDistrictId: currentId },
        update: {
          parentDistrictId: parentId,
          splitYear: entry.splitYear,
          notes: entry.notes
        },
        create: {
          currentDistrictId: currentId,
          parentDistrictId: parentId,
          splitYear: entry.splitYear,
          notes: entry.notes
        }
      });

      console.log(`  ✓ ${entry.currentDistrict} (${entry.splitYear}) -> ${entry.parentDistrict}`);
      successCount++;
    } catch (err) {
      console.error(`  ✗ Error processing ${entry.currentDistrict}:`, err);
      errorCount++;
    }
  }

  console.log(`\nSeeding complete: ${successCount} successful, ${errorCount} errors`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
