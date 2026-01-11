/**
 * PostgreSQL to SQLite Export Script
 *
 * Exports all electoral data from PostgreSQL to a standalone SQLite database
 * for desktop app distribution. Can be re-run anytime to create fresh exports.
 *
 * Usage: npx tsx scripts/export-to-sqlite.ts [output-path]
 * Default output: ./dist/uganda_electoral.sqlite
 */

import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Output path (can be overridden via command line)
const outputPath = process.argv[2] || './dist/uganda_electoral.sqlite';

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Remove existing database if it exists
if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath);
  console.log(`Removed existing database: ${outputPath}`);
}

// Create SQLite database
const sqlite = new Database(outputPath);

// Enable foreign keys and WAL mode for better performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

console.log(`Creating SQLite database: ${outputPath}`);
console.log('='.repeat(60));

// ============================================================================
// SCHEMA CREATION
// ============================================================================

const createSchema = () => {
  console.log('\nCreating schema...');

  // Users
  sqlite.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('viewer', 'operator', 'editor', 'admin')),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Political Parties
  sqlite.exec(`
    CREATE TABLE political_parties (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      abbreviation TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL,
      logo_url TEXT,
      founded_year INTEGER,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Persons
  sqlite.exec(`
    CREATE TABLE persons (
      id INTEGER PRIMARY KEY,
      full_name TEXT NOT NULL,
      date_of_birth TEXT,
      gender TEXT,
      biography TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Party Memberships
  sqlite.exec(`
    CREATE TABLE party_memberships (
      id INTEGER PRIMARY KEY,
      person_id INTEGER NOT NULL REFERENCES persons(id),
      party_id INTEGER NOT NULL REFERENCES political_parties(id),
      start_date TEXT NOT NULL,
      end_date TEXT,
      position TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Election Types
  sqlite.exec(`
    CREATE TABLE election_types (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      electoral_level INTEGER NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Administrative Units
  sqlite.exec(`
    CREATE TABLE administrative_units (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      level INTEGER NOT NULL,
      parent_id INTEGER REFERENCES administrative_units(id),
      geometry TEXT,
      registered_voters INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_admin_units_level ON administrative_units(level);
    CREATE INDEX idx_admin_units_parent ON administrative_units(parent_id);
  `);

  // Elections
  sqlite.exec(`
    CREATE TABLE elections (
      id INTEGER PRIMARY KEY,
      election_type_id INTEGER NOT NULL REFERENCES election_types(id),
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      election_date TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_elections_year ON elections(year);
  `);

  // Candidates
  sqlite.exec(`
    CREATE TABLE candidates (
      id INTEGER PRIMARY KEY,
      person_id INTEGER NOT NULL REFERENCES persons(id),
      election_id INTEGER NOT NULL REFERENCES elections(id),
      party_id INTEGER REFERENCES political_parties(id),
      electoral_area_id INTEGER REFERENCES administrative_units(id),
      ballot_order INTEGER,
      photo_url TEXT,
      is_independent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(election_id, person_id)
    );
    CREATE INDEX idx_candidates_election ON candidates(election_id);
    CREATE INDEX idx_candidates_party ON candidates(party_id);
  `);

  // Election Summaries
  sqlite.exec(`
    CREATE TABLE election_summaries (
      id INTEGER PRIMARY KEY,
      election_id INTEGER NOT NULL REFERENCES elections(id),
      admin_unit_id INTEGER NOT NULL REFERENCES administrative_units(id),
      registered_voters INTEGER NOT NULL,
      total_votes INTEGER NOT NULL,
      valid_votes INTEGER NOT NULL,
      invalid_votes INTEGER NOT NULL,
      turnout_percent REAL,
      invalid_percent REAL,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'pending', 'rejected', 'approved', 'disputed', 'retracted')),
      entered_by INTEGER NOT NULL,
      verified_by INTEGER,
      verified_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(election_id, admin_unit_id)
    );
    CREATE INDEX idx_summaries_status ON election_summaries(status);
  `);

  // Results
  sqlite.exec(`
    CREATE TABLE results (
      id INTEGER PRIMARY KEY,
      election_id INTEGER NOT NULL REFERENCES elections(id),
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      admin_unit_id INTEGER NOT NULL REFERENCES administrative_units(id),
      votes INTEGER NOT NULL,
      vote_percent REAL,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'pending', 'rejected', 'approved', 'disputed', 'retracted')),
      entered_by INTEGER NOT NULL,
      verified_by INTEGER,
      verified_at TEXT,
      rejection_comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(election_id, candidate_id, admin_unit_id)
    );
    CREATE INDEX idx_results_status ON results(status);
    CREATE INDEX idx_results_admin_unit ON results(admin_unit_id);
  `);

  // Polling Stations
  sqlite.exec(`
    CREATE TABLE polling_stations (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      parish_id INTEGER NOT NULL REFERENCES administrative_units(id),
      latitude REAL,
      longitude REAL,
      address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(parish_id, code)
    );
    CREATE INDEX idx_polling_stations_parish ON polling_stations(parish_id);
  `);

  // Polling Station Elections
  sqlite.exec(`
    CREATE TABLE polling_station_elections (
      id INTEGER PRIMARY KEY,
      polling_station_id INTEGER NOT NULL REFERENCES polling_stations(id),
      election_id INTEGER NOT NULL REFERENCES elections(id),
      total_voters INTEGER NOT NULL,
      female_voters INTEGER,
      male_voters INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(polling_station_id, election_id)
    );
    CREATE INDEX idx_ps_elections_election ON polling_station_elections(election_id);
  `);

  // Demographics
  sqlite.exec(`
    CREATE TABLE demographics (
      id INTEGER PRIMARY KEY,
      admin_unit_id INTEGER NOT NULL REFERENCES administrative_units(id),
      census_year INTEGER NOT NULL,
      total_population INTEGER NOT NULL,
      male_population INTEGER NOT NULL,
      female_population INTEGER NOT NULL,
      voting_age_population INTEGER NOT NULL,
      youth_population INTEGER NOT NULL,
      elderly_population INTEGER NOT NULL,
      number_of_households INTEGER,
      avg_household_size REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(admin_unit_id, census_year)
    );
    CREATE INDEX idx_demographics_year ON demographics(census_year);
  `);

  // Demographics Aggregates
  sqlite.exec(`
    CREATE TABLE demographics_aggregates (
      id INTEGER PRIMARY KEY,
      admin_unit_id INTEGER NOT NULL REFERENCES administrative_units(id),
      census_year INTEGER NOT NULL,
      level INTEGER NOT NULL,
      total_population INTEGER NOT NULL,
      male_population INTEGER NOT NULL,
      female_population INTEGER NOT NULL,
      voting_age_population INTEGER NOT NULL,
      youth_population INTEGER NOT NULL,
      elderly_population INTEGER NOT NULL,
      number_of_households INTEGER NOT NULL,
      parish_count INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(admin_unit_id, census_year)
    );
    CREATE INDEX idx_demo_agg_level ON demographics_aggregates(level, census_year);
  `);

  // Issue Categories
  sqlite.exec(`
    CREATE TABLE issue_categories (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      severity INTEGER DEFAULT 3,
      color TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Electoral Issues
  sqlite.exec(`
    CREATE TABLE electoral_issues (
      id INTEGER PRIMARY KEY,
      case_id TEXT UNIQUE,
      election_id INTEGER REFERENCES elections(id),
      issue_category_id INTEGER NOT NULL REFERENCES issue_categories(id),
      date TEXT NOT NULL,
      time TEXT,
      district_id INTEGER REFERENCES administrative_units(id),
      constituency_id INTEGER REFERENCES administrative_units(id),
      subcounty_id INTEGER REFERENCES administrative_units(id),
      parish_id INTEGER REFERENCES administrative_units(id),
      village TEXT,
      location TEXT,
      latitude REAL,
      longitude REAL,
      severity INTEGER,
      summary TEXT NOT NULL,
      full_text TEXT,
      protagonist TEXT,
      target_category TEXT,
      target_name TEXT,
      injury_count INTEGER DEFAULT 0,
      death_count INTEGER DEFAULT 0,
      arrest_count INTEGER DEFAULT 0,
      source TEXT,
      photo_url TEXT,
      image TEXT,
      urls TEXT,
      status TEXT DEFAULT 'reported' CHECK(status IN ('reported', 'investigating', 'verified', 'resolved', 'dismissed')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_issues_date ON electoral_issues(date);
    CREATE INDEX idx_issues_category ON electoral_issues(issue_category_id);
    CREATE INDEX idx_issues_election ON electoral_issues(election_id);
  `);

  // Electoral Issue Candidates
  sqlite.exec(`
    CREATE TABLE electoral_issue_candidates (
      id INTEGER PRIMARY KEY,
      issue_id INTEGER NOT NULL REFERENCES electoral_issues(id),
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      role TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(issue_id, candidate_id)
    )
  `);

  // District History
  sqlite.exec(`
    CREATE TABLE district_history (
      id INTEGER PRIMARY KEY,
      current_district_id INTEGER UNIQUE NOT NULL REFERENCES administrative_units(id),
      parent_district_id INTEGER NOT NULL REFERENCES administrative_units(id),
      split_year INTEGER NOT NULL,
      split_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_district_history_parent ON district_history(parent_district_id);
    CREATE INDEX idx_district_history_year ON district_history(split_year);
  `);

  // Audit Log
  sqlite.exec(`
    CREATE TABLE audit_log (
      id INTEGER PRIMARY KEY,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER NOT NULL REFERENCES users(id),
      user_role TEXT NOT NULL,
      action_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      comment TEXT
    );
    CREATE INDEX idx_audit_user ON audit_log(user_id);
    CREATE INDEX idx_audit_action ON audit_log(action_type);
    CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
  `);

  console.log('Schema created successfully');
};

// ============================================================================
// DATA EXPORT FUNCTIONS
// ============================================================================

const exportTable = async (
  tableName: string,
  fetchFn: () => Promise<any[]>,
  insertFn: (stmt: Database.Statement, row: any) => void,
  insertSql: string
) => {
  console.log(`Exporting ${tableName}...`);
  const startTime = Date.now();

  const data = await fetchFn();
  const stmt = sqlite.prepare(insertSql);

  const insertMany = sqlite.transaction((rows: any[]) => {
    for (const row of rows) {
      insertFn(stmt, row);
    }
  });

  insertMany(data);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`  -> ${data.length} rows exported (${elapsed}s)`);

  return data.length;
};

// Helper to convert Date to ISO string
const toISOString = (date: Date | null | undefined): string | null => {
  return date ? date.toISOString() : null;
};

// Helper to convert Decimal to number
const toNumber = (decimal: any): number | null => {
  return decimal ? Number(decimal) : null;
};

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

const exportData = async () => {
  console.log('\nExporting data from PostgreSQL...\n');

  let totalRows = 0;
  const startTime = Date.now();

  // Users
  totalRows += await exportTable(
    'users',
    () => prisma.user.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.username, row.passwordHash, row.fullName, row.role,
      row.isActive ? 1 : 0, toISOString(row.createdAt)
    ),
    'INSERT INTO users (id, username, password_hash, full_name, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  // Political Parties
  totalRows += await exportTable(
    'political_parties',
    () => prisma.politicalParty.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.name, row.abbreviation, row.color, row.logoUrl,
      row.foundedYear, row.description, row.isActive ? 1 : 0, toISOString(row.createdAt)
    ),
    'INSERT INTO political_parties (id, name, abbreviation, color, logo_url, founded_year, description, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // Persons
  totalRows += await exportTable(
    'persons',
    () => prisma.person.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.fullName, toISOString(row.dateOfBirth), row.gender,
      row.biography, toISOString(row.createdAt)
    ),
    'INSERT INTO persons (id, full_name, date_of_birth, gender, biography, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  // Party Memberships
  totalRows += await exportTable(
    'party_memberships',
    () => prisma.partyMembership.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.personId, row.partyId, toISOString(row.startDate),
      toISOString(row.endDate), row.position, row.notes, toISOString(row.createdAt)
    ),
    'INSERT INTO party_memberships (id, person_id, party_id, start_date, end_date, position, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // Election Types
  totalRows += await exportTable(
    'election_types',
    () => prisma.electionType.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.name, row.code, row.electoralLevel, row.description, toISOString(row.createdAt)
    ),
    'INSERT INTO election_types (id, name, code, electoral_level, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  // Administrative Units (large table - export in batches to handle large geometry)
  console.log('Exporting administrative_units...');
  const adminStmt = sqlite.prepare(
    'INSERT INTO administrative_units (id, name, code, level, parent_id, geometry, registered_voters, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // First, get all admin units without geometry
  const adminUnitsBase = await prisma.administrativeUnit.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      level: true,
      parentId: true,
      registeredVoters: true,
      createdAt: true,
    },
    orderBy: { id: 'asc' },
  });

  console.log(`  Found ${adminUnitsBase.length} admin units, fetching geometries in batches...`);

  // Process in batches to avoid memory issues with large geometries
  const batchSize = 500;
  let adminCount = 0;

  for (let i = 0; i < adminUnitsBase.length; i += batchSize) {
    const batchIds = adminUnitsBase.slice(i, i + batchSize).map(u => u.id);

    // Fetch geometries for this batch
    const geometries = await prisma.administrativeUnit.findMany({
      where: { id: { in: batchIds } },
      select: { id: true, geometry: true },
    });

    const geometryMap = new Map(geometries.map(g => [g.id, g.geometry]));

    // Insert batch
    const insertBatch = sqlite.transaction((rows: any[]) => {
      for (const row of rows) {
        adminStmt.run(
          row.id, row.name, row.code, row.level, row.parentId,
          geometryMap.get(row.id) || null, row.registeredVoters, toISOString(row.createdAt)
        );
      }
    });

    const batchRows = adminUnitsBase.slice(i, i + batchSize);
    insertBatch(batchRows);
    adminCount += batchRows.length;

    // Progress indicator
    const progress = Math.round((adminCount / adminUnitsBase.length) * 100);
    process.stdout.write(`\r  Processing: ${adminCount}/${adminUnitsBase.length} (${progress}%)`);
  }

  console.log(`\n  -> ${adminCount} rows exported`);
  totalRows += adminCount;

  // Elections
  totalRows += await exportTable(
    'elections',
    () => prisma.election.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.electionTypeId, row.name, row.year,
      toISOString(row.electionDate), row.isActive ? 1 : 0, toISOString(row.createdAt)
    ),
    'INSERT INTO elections (id, election_type_id, name, year, election_date, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  // Candidates
  totalRows += await exportTable(
    'candidates',
    () => prisma.candidate.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.personId, row.electionId, row.partyId, row.electoralAreaId,
      row.ballotOrder, row.photoUrl, row.isIndependent ? 1 : 0, toISOString(row.createdAt)
    ),
    'INSERT INTO candidates (id, person_id, election_id, party_id, electoral_area_id, ballot_order, photo_url, is_independent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // Election Summaries
  totalRows += await exportTable(
    'election_summaries',
    () => prisma.electionSummary.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.electionId, row.adminUnitId, row.registeredVoters,
      row.totalVotes, row.validVotes, row.invalidVotes,
      toNumber(row.turnoutPercent), toNumber(row.invalidPercent),
      row.status, row.enteredBy, row.verifiedBy, toISOString(row.verifiedAt),
      toISOString(row.createdAt), toISOString(row.updatedAt)
    ),
    'INSERT INTO election_summaries (id, election_id, admin_unit_id, registered_voters, total_votes, valid_votes, invalid_votes, turnout_percent, invalid_percent, status, entered_by, verified_by, verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // Results (large table)
  console.log('Exporting results...');
  const results = await prisma.result.findMany();
  const resultsStmt = sqlite.prepare(
    'INSERT INTO results (id, election_id, candidate_id, admin_unit_id, votes, vote_percent, status, entered_by, verified_by, verified_at, rejection_comment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertResults = sqlite.transaction((rows: any[]) => {
    for (const row of rows) {
      resultsStmt.run(
        row.id, row.electionId, row.candidateId, row.adminUnitId,
        row.votes, toNumber(row.votePercent), row.status,
        row.enteredBy, row.verifiedBy, toISOString(row.verifiedAt),
        row.rejectionComment, toISOString(row.createdAt), toISOString(row.updatedAt)
      );
    }
  });
  insertResults(results);
  console.log(`  -> ${results.length} rows exported`);
  totalRows += results.length;

  // Polling Stations
  totalRows += await exportTable(
    'polling_stations',
    () => prisma.pollingStation.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.code, row.name, row.parishId,
      toNumber(row.latitude), toNumber(row.longitude),
      row.address, toISOString(row.createdAt)
    ),
    'INSERT INTO polling_stations (id, code, name, parish_id, latitude, longitude, address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // Polling Station Elections
  totalRows += await exportTable(
    'polling_station_elections',
    () => prisma.pollingStationElection.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.pollingStationId, row.electionId, row.totalVoters,
      row.femaleVoters, row.maleVoters, row.isActive ? 1 : 0, toISOString(row.createdAt)
    ),
    'INSERT INTO polling_station_elections (id, polling_station_id, election_id, total_voters, female_voters, male_voters, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // Demographics
  totalRows += await exportTable(
    'demographics',
    () => prisma.demographics.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.adminUnitId, row.censusYear, row.totalPopulation,
      row.malePopulation, row.femalePopulation, row.votingAgePopulation,
      row.youthPopulation, row.elderlyPopulation, row.numberOfHouseholds,
      toNumber(row.avgHouseholdSize), toISOString(row.createdAt)
    ),
    'INSERT INTO demographics (id, admin_unit_id, census_year, total_population, male_population, female_population, voting_age_population, youth_population, elderly_population, number_of_households, avg_household_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // Demographics Aggregates
  totalRows += await exportTable(
    'demographics_aggregates',
    () => prisma.demographicsAggregate.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.adminUnitId, row.censusYear, row.level,
      row.totalPopulation, row.malePopulation, row.femalePopulation,
      row.votingAgePopulation, row.youthPopulation, row.elderlyPopulation,
      row.numberOfHouseholds, row.parishCount, toISOString(row.createdAt)
    ),
    'INSERT INTO demographics_aggregates (id, admin_unit_id, census_year, level, total_population, male_population, female_population, voting_age_population, youth_population, elderly_population, number_of_households, parish_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // Issue Categories
  totalRows += await exportTable(
    'issue_categories',
    () => prisma.issueCategory.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.name, row.code, row.description, row.severity,
      row.color, row.isActive ? 1 : 0, toISOString(row.createdAt)
    ),
    'INSERT INTO issue_categories (id, name, code, description, severity, color, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // Electoral Issues
  totalRows += await exportTable(
    'electoral_issues',
    () => prisma.electoralIssue.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.caseId, row.electionId, row.issueCategoryId,
      toISOString(row.date), row.time ? toISOString(row.time) : null,
      row.districtId, row.constituencyId, row.subcountyId, row.parishId,
      row.village, row.location, toNumber(row.latitude), toNumber(row.longitude),
      row.severity, row.summary, row.fullText, row.protagonist,
      row.targetCategory, row.targetName, row.injuryCount, row.deathCount,
      row.arrestCount, row.source, row.photoUrl, row.image, row.urls,
      row.status, toISOString(row.createdAt), toISOString(row.updatedAt)
    ),
    'INSERT INTO electoral_issues (id, case_id, election_id, issue_category_id, date, time, district_id, constituency_id, subcounty_id, parish_id, village, location, latitude, longitude, severity, summary, full_text, protagonist, target_category, target_name, injury_count, death_count, arrest_count, source, photo_url, image, urls, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // Electoral Issue Candidates
  totalRows += await exportTable(
    'electoral_issue_candidates',
    () => prisma.electoralIssueCandidate.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.issueId, row.candidateId, row.role, row.notes, toISOString(row.createdAt)
    ),
    'INSERT INTO electoral_issue_candidates (id, issue_id, candidate_id, role, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  // District History
  totalRows += await exportTable(
    'district_history',
    () => prisma.districtHistory.findMany(),
    (stmt, row) => stmt.run(
      row.id, row.currentDistrictId, row.parentDistrictId, row.splitYear,
      toISOString(row.splitDate), row.notes, toISOString(row.createdAt)
    ),
    'INSERT INTO district_history (id, current_district_id, parent_district_id, split_year, split_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  // Audit Log (may be large, but important to include)
  totalRows += await exportTable(
    'audit_log',
    () => prisma.auditLog.findMany(),
    (stmt, row) => stmt.run(
      row.id, toISOString(row.timestamp), row.userId, row.userRole,
      row.actionType, row.entityType, row.entityId,
      row.oldValue ? JSON.stringify(row.oldValue) : null,
      row.newValue ? JSON.stringify(row.newValue) : null,
      row.ipAddress, row.comment
    ),
    'INSERT INTO audit_log (id, timestamp, user_id, user_role, action_type, entity_type, entity_id, old_value, new_value, ip_address, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n' + '='.repeat(60));
  console.log(`Export complete: ${totalRows.toLocaleString()} total rows in ${totalTime}s`);

  return totalRows;
};

// ============================================================================
// MAIN
// ============================================================================

const main = async () => {
  try {
    console.log('Uganda Electoral Map - PostgreSQL to SQLite Export');
    console.log('='.repeat(60));
    console.log(`Source: PostgreSQL (via Prisma)`);
    console.log(`Target: ${outputPath}`);

    createSchema();
    await exportData();

    // Optimize SQLite database
    console.log('\nOptimizing database...');
    sqlite.exec('VACUUM');
    sqlite.exec('ANALYZE');

    // Get file size
    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Database size: ${sizeMB} MB`);

    console.log('\nExport successful!');
    console.log(`Output: ${outputPath}`);

  } catch (error) {
    console.error('\nExport failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    sqlite.close();
  }
};

main();
