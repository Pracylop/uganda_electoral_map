/**
 * Import Published Statistics from Research Data CSVs
 *
 * This script reads published statistics from the research_data directory
 * and imports them into the database published_* tables.
 *
 * Run with: npx tsx src/scripts/importPublishedStats.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Path to research data directory
const RESEARCH_DATA_DIR = path.join(__dirname, '../../../../Documentation/research_data');

interface CSVRow {
  [key: string]: string;
}

/**
 * Parse CSV file into array of objects
 */
function parseCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: CSVRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parse number, handling "Unknown" and empty values
 */
function parseNumber(value: string): number | null {
  if (!value || value.toLowerCase() === 'unknown' || value === '') {
    return null;
  }
  // Remove + signs and commas
  const cleaned = value.replace(/[+,]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Import Presidential Election Summaries
 */
async function importPresidentialSummaries() {
  console.log('\n📊 Importing Presidential Election Summaries...');

  const filePath = path.join(RESEARCH_DATA_DIR, 'presidential_summary.csv');
  if (!fs.existsSync(filePath)) {
    console.log('  ⚠️ File not found:', filePath);
    return;
  }

  const rows = parseCSV(filePath);
  let imported = 0;

  for (const row of rows) {
    const year = parseInt(row.year);
    const registeredVoters = parseNumber(row.registered_voters);
    const totalVotesCast = parseNumber(row.total_votes_cast);
    const validVotes = parseNumber(row.valid_votes);
    const invalidVotes = parseNumber(row.invalid_votes);
    const turnout = parseFloat(row.turnout_percentage) || 0;
    const pollingStations = parseNumber(row.polling_stations);

    if (!year || !registeredVoters || !totalVotesCast) continue;

    await prisma.publishedElectionSummary.upsert({
      where: { year_electionType: { year, electionType: 'Presidential' } },
      update: {
        registeredVoters,
        totalVotesCast,
        validVotes: validVotes || totalVotesCast,
        invalidVotes: invalidVotes || 0,
        turnoutPercentage: turnout,
        pollingStations,
        source: row.source || 'Uganda Electoral Commission',
      },
      create: {
        year,
        electionType: 'Presidential',
        registeredVoters,
        totalVotesCast,
        validVotes: validVotes || totalVotesCast,
        invalidVotes: invalidVotes || 0,
        turnoutPercentage: turnout,
        pollingStations,
        source: row.source || 'Uganda Electoral Commission',
      },
    });
    imported++;
  }

  console.log(`  ✅ Imported ${imported} election summaries`);
}

/**
 * Import Presidential Candidate Results
 */
async function importCandidateResults() {
  console.log('\n🏆 Importing Presidential Candidate Results...');

  const filePath = path.join(RESEARCH_DATA_DIR, 'presidential_results.csv');
  if (!fs.existsSync(filePath)) {
    console.log('  ⚠️ File not found:', filePath);
    return;
  }

  const rows = parseCSV(filePath);
  let imported = 0;

  // Group by year first
  const byYear: Map<number, CSVRow[]> = new Map();
  for (const row of rows) {
    const year = parseInt(row.year);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(row);
  }

  for (const [year, candidates] of byYear) {
    // Find the summary for this year
    const summary = await prisma.publishedElectionSummary.findUnique({
      where: { year_electionType: { year, electionType: 'Presidential' } },
    });

    if (!summary) {
      console.log(`  ⚠️ No summary found for year ${year}`);
      continue;
    }

    // Sort by votes descending to determine position
    const sortedCandidates = candidates
      .map(c => ({ row: c, votesNum: parseNumber(c.votes) || 0 }))
      .sort((a, b) => b.votesNum - a.votesNum);

    for (let i = 0; i < sortedCandidates.length; i++) {
      const { row, votesNum } = sortedCandidates[i];
      const candidateName = row.candidate_name || row.name;
      const votes = votesNum;
      const percentage = parseFloat(row.percentage) || 0;

      if (!candidateName) continue;

      await prisma.publishedCandidateResult.upsert({
        where: {
          summaryId_candidateName: {
            summaryId: summary.id,
            candidateName
          }
        },
        update: {
          partyAbbreviation: row.party || null,
          votes,
          percentage,
          position: i + 1,
        },
        create: {
          summaryId: summary.id,
          candidateName,
          partyAbbreviation: row.party || null,
          votes,
          percentage,
          position: i + 1,
        },
      });
      imported++;
    }
  }

  console.log(`  ✅ Imported ${imported} candidate results`);
}

/**
 * Import Parliament Summaries and Party Seats
 */
async function importParliamentData() {
  console.log('\n🏛️ Importing Parliament Data...');

  // Import structure first
  const structurePath = path.join(RESEARCH_DATA_DIR, 'parliamentary_structure.csv');
  const compositionPath = path.join(RESEARCH_DATA_DIR, 'parliamentary_composition.csv');

  if (fs.existsSync(structurePath)) {
    const rows = parseCSV(structurePath);
    let imported = 0;

    for (const row of rows) {
      const year = parseInt(row.year);
      const parliamentNumber = parseInt(row.parliament_number?.replace(/\D/g, '') || '0');

      await prisma.publishedParliamentSummary.upsert({
        where: { year },
        update: {
          parliamentNumber,
          totalSeats: parseNumber(row.total_seats) || 0,
          constituencySeats: parseNumber(row.constituency_seats) || 0,
          womenReps: parseNumber(row.women_reps) || 0,
          updfReps: parseNumber(row.updf_reps) || 0,
          youthReps: parseNumber(row.youth_reps) || 0,
          disabilityReps: parseNumber(row.disability_reps) || 0,
          workersReps: parseNumber(row.workers_reps) || 0,
          elderReps: parseNumber(row.elder_reps) || 0,
          exOfficioMembers: parseNumber(row.ex_officio) || 0,
          source: row.source || 'Uganda Electoral Commission',
        },
        create: {
          year,
          parliamentNumber,
          totalSeats: parseNumber(row.total_seats) || 0,
          constituencySeats: parseNumber(row.constituency_seats) || 0,
          womenReps: parseNumber(row.women_reps) || 0,
          updfReps: parseNumber(row.updf_reps) || 0,
          youthReps: parseNumber(row.youth_reps) || 0,
          disabilityReps: parseNumber(row.disability_reps) || 0,
          workersReps: parseNumber(row.workers_reps) || 0,
          elderReps: parseNumber(row.elder_reps) || 0,
          exOfficioMembers: parseNumber(row.ex_officio) || 0,
          source: row.source || 'Uganda Electoral Commission',
        },
      });
      imported++;
    }
    console.log(`  ✅ Imported ${imported} parliament summaries`);
  }

  // Import party seats
  if (fs.existsSync(compositionPath)) {
    const rows = parseCSV(compositionPath);
    let imported = 0;

    for (const row of rows) {
      const year = parseInt(row.year);
      const parliament = await prisma.publishedParliamentSummary.findUnique({
        where: { year },
      });

      if (!parliament) continue;

      // Party columns in the CSV
      const parties = ['NRM', 'FDC', 'NUP', 'DP', 'UPC', 'Independents', 'UPDF', 'JEEMA', 'PPP', 'ANT', 'Other'];

      for (const party of parties) {
        const seats = parseNumber(row[party]);
        if (seats && seats > 0) {
          await prisma.publishedPartySeats.upsert({
            where: {
              parliamentId_partyAbbreviation: {
                parliamentId: parliament.id,
                partyAbbreviation: party,
              },
            },
            update: { seats },
            create: {
              parliamentId: parliament.id,
              partyAbbreviation: party,
              seats,
            },
          });
          imported++;
        }
      }
    }
    console.log(`  ✅ Imported ${imported} party seat records`);
  }
}

/**
 * Import Women's Representation Data
 */
async function importWomenRepresentation() {
  console.log('\n👩 Importing Women\'s Representation Data...');

  const filePath = path.join(RESEARCH_DATA_DIR, 'women_representation.csv');
  if (!fs.existsSync(filePath)) {
    console.log('  ⚠️ File not found:', filePath);
    return;
  }

  const rows = parseCSV(filePath);
  let imported = 0;

  for (const row of rows) {
    const year = parseInt(row.year);
    const parliamentNumber = parseInt(row.parliament_number?.replace(/\D/g, '') || '0');

    await prisma.publishedWomenRepresentation.upsert({
      where: { year },
      update: {
        parliamentNumber,
        totalSeats: parseNumber(row.total_seats) || 0,
        totalWomenMps: parseNumber(row.total_women_mps) || 0,
        womenPercentage: parseFloat(row.women_percentage) || 0,
        womenDistrictReps: parseNumber(row.women_district_reps) || 0,
        womenConstituency: parseNumber(row.women_constituency) || 0,
        womenSpecialInterest: parseNumber(row.women_special_interest) || 0,
        source: row.source || 'Uganda Electoral Commission',
      },
      create: {
        year,
        parliamentNumber,
        totalSeats: parseNumber(row.total_seats) || 0,
        totalWomenMps: parseNumber(row.total_women_mps) || 0,
        womenPercentage: parseFloat(row.women_percentage) || 0,
        womenDistrictReps: parseNumber(row.women_district_reps) || 0,
        womenConstituency: parseNumber(row.women_constituency) || 0,
        womenSpecialInterest: parseNumber(row.women_special_interest) || 0,
        source: row.source || 'Uganda Electoral Commission',
      },
    });
    imported++;
  }

  console.log(`  ✅ Imported ${imported} women's representation records`);
}

/**
 * Import Incident Summaries
 */
async function importIncidentSummaries() {
  console.log('\n⚠️ Importing Incident Summaries...');

  const filePath = path.join(RESEARCH_DATA_DIR, 'election_incidents.csv');
  if (!fs.existsSync(filePath)) {
    console.log('  ⚠️ File not found:', filePath);
    return;
  }

  const rows = parseCSV(filePath);
  let imported = 0;

  for (const row of rows) {
    const year = parseInt(row.year);

    await prisma.publishedIncidentSummary.upsert({
      where: { year },
      update: {
        deathsReported: parseNumber(row.deaths_reported),
        injuriesReported: parseNumber(row.injuries_reported),
        arrestsReported: parseNumber(row.arrests_reported),
        petitionsFiled: parseNumber(row.petitions_filed) || 0,
        petitionsSuccessful: parseNumber(row.petitions_successful) || 0,
        observerRating: row.observer_rating || null,
        keyIncidents: row.key_incidents || null,
        source: row.source || 'Human Rights Watch',
      },
      create: {
        year,
        deathsReported: parseNumber(row.deaths_reported),
        injuriesReported: parseNumber(row.injuries_reported),
        arrestsReported: parseNumber(row.arrests_reported),
        petitionsFiled: parseNumber(row.petitions_filed) || 0,
        petitionsSuccessful: parseNumber(row.petitions_successful) || 0,
        observerRating: row.observer_rating || null,
        keyIncidents: row.key_incidents || null,
        source: row.source || 'Human Rights Watch',
      },
    });
    imported++;
  }

  console.log(`  ✅ Imported ${imported} incident summaries`);
}

/**
 * Import LC Chairpersons Data
 */
async function importLCChairpersons() {
  console.log('\n🏘️ Importing LC Chairpersons Data...');

  // Import LC5 (District) chairpersons
  const lcvPath = path.join(RESEARCH_DATA_DIR, 'lcv_chairpersons.csv');
  if (fs.existsSync(lcvPath)) {
    const rows = parseCSV(lcvPath);
    let imported = 0;

    for (const row of rows) {
      const year = parseInt(row.year);
      const partyBreakdown: Record<string, number> = {};

      ['NRM', 'FDC', 'NUP', 'DP', 'UPC', 'Independents', 'Other'].forEach(party => {
        const count = parseNumber(row[party]);
        if (count && count > 0) partyBreakdown[party] = count;
      });

      await prisma.publishedLCChairpersons.upsert({
        where: { year_level: { year, level: 5 } },
        update: {
          totalUnits: parseNumber(row.total_districts) || 0,
          partyBreakdown,
          source: row.source || 'Uganda Electoral Commission',
        },
        create: {
          year,
          level: 5,
          totalUnits: parseNumber(row.total_districts) || 0,
          partyBreakdown,
          source: row.source || 'Uganda Electoral Commission',
        },
      });
      imported++;
    }
    console.log(`  ✅ Imported ${imported} LC5 chairperson records`);
  }

  // Import LC3 (Sub-county) chairpersons
  const lc3Path = path.join(RESEARCH_DATA_DIR, 'lc3_chairpersons.csv');
  if (fs.existsSync(lc3Path)) {
    const rows = parseCSV(lc3Path);
    let imported = 0;

    for (const row of rows) {
      const year = parseInt(row.year);
      const partyBreakdown: Record<string, number> = {};

      ['NRM_estimated', 'FDC_estimated', 'Other_Parties', 'Independents'].forEach(party => {
        const count = parseNumber(row[party]);
        if (count && count > 0) {
          const cleanParty = party.replace('_estimated', '').replace('_Parties', '');
          partyBreakdown[cleanParty] = count;
        }
      });

      await prisma.publishedLCChairpersons.upsert({
        where: { year_level: { year, level: 3 } },
        update: {
          totalUnits: parseNumber(row.total_subcounties) || 0,
          partyBreakdown,
          dataCompleteness: row.data_completeness || 'Estimated',
          notes: row.notes || null,
          source: row.source || 'Uganda Electoral Commission',
        },
        create: {
          year,
          level: 3,
          totalUnits: parseNumber(row.total_subcounties) || 0,
          partyBreakdown,
          dataCompleteness: row.data_completeness || 'Estimated',
          notes: row.notes || null,
          source: row.source || 'Uganda Electoral Commission',
        },
      });
      imported++;
    }
    console.log(`  ✅ Imported ${imported} LC3 chairperson records`);
  }
}

/**
 * Main import function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📦 Importing Published Statistics from Research Data');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n  Source directory: ${RESEARCH_DATA_DIR}`);

  try {
    await importPresidentialSummaries();
    await importCandidateResults();
    await importParliamentData();
    await importWomenRepresentation();
    await importIncidentSummaries();
    await importLCChairpersons();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ Import completed successfully!');
    console.log('═══════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
