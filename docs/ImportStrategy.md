# Uganda Electoral Map - Data Import Strategy

This document outlines the strategy for importing election data into the system.

---

## Overview

### Election Types (Already Seeded)

| Code | Name | Level | Description |
|------|------|-------|-------------|
| PRES | Presidential | 0 (National) | Results stored at parish level |
| CONST_MP | Constituency MP | 3 (Constituency) | Directly elected MPs |
| WOMAN_MP | District Woman MP | 2 (District) | Woman Representatives |
| YOUTH_MP | Youth MP | 1 (Sub-region) | Youth Representatives |
| WORKER_MP | Workers MP | 0 (National) | Workers Representatives |
| ARMY_MP | Army Representative | 0 (National) | UPDF Representatives |
| PWD_MP | PWD Representative | 1 (Sub-region) | Persons with Disabilities |
| ELDERLY_MP | Elderly Representative | 1 (Sub-region) | Older Persons |

### Admin Levels

| Level | Name | Used For |
|-------|------|----------|
| 0 | National | Special MPs (UPDF, Workers) |
| 1 | Sub-region | Youth, PWD, Elderly MPs |
| 2 | District | District Woman MPs |
| 3 | Constituency | Directly Elected MPs |
| 4 | Subcounty | Not used for elections |
| 5 | Parish | Presidential results storage |

---

## Presidential Elections

### Data Files

| Year | File | Candidates |
|------|------|------------|
| 2011 | `5_c_2011_parish_results.csv` | 8 candidates |
| 2016 | `5_a_2016_parish_results.csv` | 8 candidates (already imported) |
| 2021 | `5_b_2021_parish_results.csv` | 11 candidates (already imported) |

### 2011 Presidential Candidates

1. ABED BWANIKA (PPP)
2. BESIGYE KIFEFE KIZZA (FDC)
3. BETI OLIVE KAMYA NAMISANGO (UFA)
4. BIDANDI-SSALI JABERI (PPP)
5. MAO NORBERT (DP)
6. OLARA OTUNNU (UPC)
7. SAMUEL LUBEGA MUKAAKU WALTER (Independent)
8. YOWERI MUSEVENI KAGUTA (NRM)

### Import Strategy

1. Modify `importPresidentialResults.ts` to add 2011 data
2. Add `candidates2011` array with candidate info
3. Add file path for 2011 CSV
4. Match parishes using District-Constituency-Subcounty-Parish key

---

## Parliamentary Elections

### Data Files

**Directly Elected MPs (CONST_MP)**
| Year | File | Columns |
|------|------|---------|
| 2011 | `8_a_2011_mps_directly_elected.csv` | Year, Category, District.Code/Name, Constituency.Code/Name, Candidate.Name, Political.Party, Votes, Winner |
| 2016 | `7_a_2016_mps_directly_elected.csv` | Same structure |
| 2021 | `6_a_2021_mps_directly_elected.csv` | Same structure |

**District Woman Representatives (WOMAN_MP)**
| Year | File | Columns |
|------|------|---------|
| 2011 | `8_b_2011_mps_district_woman.csv` | Year, Category, District, Constituency, Candidate.Name, Political.Party, Votes |
| 2016 | `7_b_2016_mps_district_woman.csv` | Same structure |
| 2021 | `6_b_2021_mps_district_woman.csv` | Same structure |

**Special Interest Groups (2021 only)**
| Type | File | Admin Level |
|------|------|-------------|
| UPDF | `6_c_2021_mps_updf.csv` | National (level 0) |
| Workers | `6_d_2021_mps_workers.csv` | National (level 0) |
| PWD | `6_e_2021_mps_pwd.csv` | Sub-region (level 1) |
| Youth | `6_f_2021_mps_youth.csv` | Sub-region (level 1) |
| Older Persons | `6_g_2021_mps_older_persons.csv` | Sub-region (level 1) |

### Import Strategy

1. Create `importParliamentaryResults.ts` script
2. Process each category separately with appropriate:
   - Election type code
   - Admin level for matching
3. Match admin units by name (not code, since codes may vary)
4. Handle INDEPENDENT party (create as independent candidate)
5. Use Winner flag where available, or calculate from votes

---

## Import Order

1. **Run reference data seeder first** (if not already done):
   ```bash
   npx tsx src/scripts/seedReferenceData.ts
   ```

2. **Import Presidential Results**:
   ```bash
   npx tsx src/scripts/importPresidentialResults.ts
   ```

3. **Import Parliamentary Results**:
   ```bash
   npx tsx src/scripts/importParliamentaryResults.ts
   ```

4. **Import Polling Stations** (clears existing and reimports):
   ```bash
   npx tsx src/scripts/importPollingStations.ts
   ```

---

## Key Matching Logic

### Presidential (Parish Level)
```
Key = DISTRICT.UPPER() + CONSTITUENCY.UPPER() + SUBCOUNTY.UPPER() + PARISH.UPPER()
```

### Directly Elected MPs (Constituency Level)
```
Match by constituency name (normalized)
```

### District Woman MPs (District Level)
```
Match by district name (normalized)
```

### Special Interest Groups (National Level)
```
No geographic matching needed - results stored at national level
```

---

## Error Handling

1. **Parish/Constituency/District not found**: Log and skip (common due to boundary changes)
2. **Party not found**: Create candidate as Independent
3. **Duplicate results**: Skip if already imported

---

## Polling Stations

### Data File

| File | Location | Records |
|------|----------|---------|
| `3_h_combined_polling_stations_2011_2016_2021.csv` | `Data/Polling Stations/` | ~85,826 |

### CSV Structure

```
Year, District.Code, District.Name, Constituency.Code, Constituency.Name,
SubCounty.Code, SubCounty.Name, Parish.Code, Parish.Name,
Station.Code, Station.Name, Registered.Voters
```

### Import Strategy

1. **Clear existing data first** (clean import approach)
   - Delete all `polling_station_elections` records
   - Delete all `polling_stations` records

2. **Build parish lookup map**
   - Key: `DISTRICT-CONSTITUENCY-SUBCOUNTY-PARISH` (uppercase)

3. **Group by unique station**
   - Unique key: `parishId-stationCode`
   - Each station may have data for multiple years (2011, 2016, 2021)

4. **Create records**
   - One `PollingStation` per unique station
   - One `PollingStationElection` per year with registered voter count

### Database Tables

| Table | Purpose |
|-------|---------|
| `polling_stations` | Master list of polling stations (linked to parish) |
| `polling_station_elections` | Per-election voter counts for each station |

---

## Scripts

| Script | Purpose | Run Command |
|--------|---------|-------------|
| `importPresidentialResults.ts` | Import 2011/2016/2021 presidential | `npx tsx src/scripts/importPresidentialResults.ts` |
| `importParliamentaryResults.ts` | Import all parliamentary elections | `npx tsx src/scripts/importParliamentaryResults.ts` |
| `importPollingStations.ts` | Import polling stations (clears existing) | `npx tsx src/scripts/importPollingStations.ts` |
