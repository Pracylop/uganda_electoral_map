/**
 * Import Electoral Issues
 * Imports 2026 campaign electoral issues from CSV
 * Run: npx tsx src/scripts/importElectoralIssues.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CsvRow {
  [key: string]: string;
}

// Map CSV categories to database codes
const categoryMapping: { [key: string]: string } = {
  'Campaign Blockage/Disruption': 'campaign_blockage',
  'Campaign Blockage': 'campaign_blockage',
  'Violence/Assault': 'violence',
  'Violence': 'violence',
  'Court Case/Legal Challenge': 'court_case',
  'Court Case': 'court_case',
  'Voter Intimidation': 'voter_intimidation',
  'Ballot Tampering': 'ballot_tampering',
  'Media Interference': 'media_interference',
  'Registration Issues': 'registration_issue',
  'Arrest/Detention': 'arrest_detention',
  'Property Damage': 'property_damage',
  'Bribery/Vote Buying': 'bribery',
  'Hate Speech/Incitement': 'hate_speech',
  'Other': 'other',
};

function parseCSV(content: string): CsvRow[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted fields with commas
    const line = lines[i];
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Format: MM/DD/YYYY
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;

  const month = parseInt(parts[0]) - 1;
  const day = parseInt(parts[1]);
  const year = parseInt(parts[2]);

  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;

  return new Date(year, month, day);
}

function parseTime(timeStr: string): Date | null {
  if (!timeStr) return null;

  // Format: HH:MM AM/PM
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3]?.toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Uganda Electoral Map - Electoral Issues Import');
  console.log('='.repeat(60));

  try {
    // Navigate from app/server/src/scripts to project root Data directory
    const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const csvPath = path.join(projectRoot, 'Data/Election Issues/3_electoral_issues_cleaned.csv');
    console.log(`Data file: ${csvPath}`);

    if (!fs.existsSync(csvPath)) {
      throw new Error(`File not found: ${csvPath}`);
    }

    // Load issue categories
    console.log('\nLoading issue categories...');
    const categories = await prisma.issueCategory.findMany();
    const categoryMap: Map<string, number> = new Map();
    for (const cat of categories) {
      categoryMap.set(cat.code, cat.id);
    }
    console.log(`  Loaded ${categoryMap.size} categories`);

    // Build district lookup
    console.log('\nBuilding administrative unit lookups...');
    const districts = await prisma.administrativeUnit.findMany({
      where: { level: 2 },
      select: { id: true, name: true },
    });
    const districtMap: Map<string, number> = new Map();
    for (const d of districts) {
      districtMap.set(d.name.toUpperCase(), d.id);
    }

    const constituencies = await prisma.administrativeUnit.findMany({
      where: { level: 3 },
      select: { id: true, name: true, parentId: true },
    });
    const constituencyMap: Map<string, number> = new Map();
    for (const c of constituencies) {
      constituencyMap.set(`${c.parentId}-${c.name.toUpperCase()}`, c.id);
    }

    const subcounties = await prisma.administrativeUnit.findMany({
      where: { level: 4 },
      select: { id: true, name: true, parentId: true },
    });
    const subcountyMap: Map<string, number> = new Map();
    for (const s of subcounties) {
      subcountyMap.set(`${s.parentId}-${s.name.toUpperCase()}`, s.id);
    }

    const parishes = await prisma.administrativeUnit.findMany({
      where: { level: 5 },
      select: { id: true, name: true, parentId: true },
    });
    const parishMap: Map<string, number> = new Map();
    for (const p of parishes) {
      parishMap.set(`${p.parentId}-${p.name.toUpperCase()}`, p.id);
    }

    console.log(`  Districts: ${districtMap.size}`);
    console.log(`  Constituencies: ${constituencyMap.size}`);
    console.log(`  Subcounties: ${subcountyMap.size}`);
    console.log(`  Parishes: ${parishMap.size}`);

    // Read CSV
    console.log('\nReading CSV file...');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(csvContent);
    console.log(`  Found ${rows.length} issue records`);

    // Import issues
    console.log('\nImporting electoral issues...');
    let imported = 0;
    let skipped = 0;
    let categoryNotFound = 0;

    for (const row of rows) {
      const dateStr = row['DATE'] || '';
      const timeStr = row['TIME'] || '';
      const districtName = (row['DISTRICT'] || '').toUpperCase();
      const constituencyName = (row['CONSTITUENCY'] || '').toUpperCase();
      const subcountyName = (row['SUBCOUNTY'] || '').toUpperCase();
      const parishName = (row['PARISH'] || '').toUpperCase();
      const village = row['VILLAGE'] || null;
      const location = row['LOCATION'] || null;
      const categoryStr = row['ISSUE_CATEGORY'] || 'Other';
      const summary = row['SUMMARY'] || '';
      const fullText = row['FULL_TEXT'] || null;
      const urls = row['URLS'] || null;

      // Parse date
      const date = parseDate(dateStr);
      if (!date) {
        skipped++;
        continue;
      }

      // Parse time
      const time = parseTime(timeStr);

      // Get category
      const categoryCode = categoryMapping[categoryStr] || 'other';
      const categoryId = categoryMap.get(categoryCode);
      if (!categoryId) {
        categoryNotFound++;
        continue;
      }

      // Find administrative units
      const districtId = districtMap.get(districtName) || null;
      let constituencyId: number | null = null;
      let subcountyId: number | null = null;
      let parishId: number | null = null;

      if (districtId && constituencyName) {
        constituencyId = constituencyMap.get(`${districtId}-${constituencyName}`) || null;

        if (constituencyId && subcountyName) {
          subcountyId = subcountyMap.get(`${constituencyId}-${subcountyName}`) || null;

          if (subcountyId && parishName) {
            parishId = parishMap.get(`${subcountyId}-${parishName}`) || null;
          }
        }
      }

      // Check for duplicate (same date, summary)
      const existing = await prisma.electoralIssue.findFirst({
        where: {
          date,
          summary: summary.substring(0, 100), // Compare first 100 chars
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create issue
      await prisma.electoralIssue.create({
        data: {
          issueCategoryId: categoryId,
          date,
          time,
          districtId,
          constituencyId,
          subcountyId,
          parishId,
          village,
          location,
          summary: summary.substring(0, 500), // Limit to field size
          fullText,
          source: 'Daily Monitor', // Default source based on data
          urls,
          status: 'reported',
        },
      });

      imported++;
      if (imported % 50 === 0) {
        console.log(`  ... ${imported} issues imported`);
      }
    }

    console.log(`\n  Imported: ${imported} issues`);
    console.log(`  Skipped (no date or duplicate): ${skipped}`);
    console.log(`  Category not found: ${categoryNotFound}`);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('Import completed!');
    console.log('='.repeat(60));

    const issueCount = await prisma.electoralIssue.count();
    const issuesByCategory = await prisma.electoralIssue.groupBy({
      by: ['issueCategoryId'],
      _count: true,
    });

    console.log('\nDatabase Summary:');
    console.log(`  - Total Electoral Issues: ${issueCount}`);
    console.log('\n  Issues by Category:');

    for (const item of issuesByCategory) {
      const cat = categories.find(c => c.id === item.issueCategoryId);
      console.log(`    - ${cat?.name || 'Unknown'}: ${item._count}`);
    }

  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
