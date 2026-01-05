/**
 * Name Normalizer for Uganda Administrative Units
 *
 * Handles spelling variations and historical name changes
 * to improve matching between CSV data and database records.
 */

// Spelling variations mapping (CSV spelling -> Database spelling)
const SPELLING_VARIATIONS: Record<string, string> = {
  // Double vowel variations
  'LUWERO': 'LUWEERO',
  'LWERO': 'LUWEERO',
  'BUWEERO': 'BUWEERO',
  'BUWERO': 'BUWEERO',

  // Common spelling differences
  'KABALORE': 'KABAROLE',
  'KABALOLE': 'KABAROLE',
  'RUKINGIRI': 'RUKUNGIRI',
  'BUNDIBUGYO': 'BUNDIBUGYO',
  'BUNDIBUJO': 'BUNDIBUGYO',
  'KAYUNGA': 'KAYUNGA',
  'KIOGA': 'KYOGA',

  // Historical name changes
  'MASINDI': 'MASINDI',
  'FORT PORTAL': 'FORT PORTAL',

  // Municipality/Town Council variations
  'ARUA MUNICIPALITY': 'ARUA',
  'JINJA MUNICIPALITY': 'JINJA',
  'MBALE MUNICIPALITY': 'MBALE',
  'GULU MUNICIPALITY': 'GULU',
  'LIRA MUNICIPALITY': 'LIRA',
  'SOROTI MUNICIPALITY': 'SOROTI',
  'TORORO MUNICIPALITY': 'TORORO',
  'MASAKA MUNICIPALITY': 'MASAKA',
  'MBARARA MUNICIPALITY': 'MBARARA',
  'KABALE MUNICIPALITY': 'KABALE',
  'KASESE MUNICIPALITY': 'KASESE',
  'HOIMA MUNICIPALITY': 'HOIMA',
  'FORT PORTAL MUNICIPALITY': 'FORT PORTAL',
  'ENTEBBE MUNICIPALITY': 'ENTEBBE',

  // Town Council variations (T.C. suffix)
  'KAMULI T.C.': 'KAMULI',
  'IGANGA T.C.': 'IGANGA',
  'BUGIRI T.C.': 'BUGIRI',
  'BUSIA T.C.': 'BUSIA',
};

// Districts created after certain elections (child -> parent mapping)
// Used to inherit results from parent district for newer districts
export const DISTRICT_LINEAGE: Record<string, { parent: string; splitYear: number }> = {
  // Districts created in 2019
  'KWANIA': { parent: 'APAC', splitYear: 2019 },
  'OBONGI': { parent: 'MOYO', splitYear: 2019 },
  'KAZO': { parent: 'KIRUHURA', splitYear: 2019 },
  'RWAMPARA': { parent: 'MBARARA', splitYear: 2019 },
  'KITAGWENDA': { parent: 'KAMWENGE', splitYear: 2019 },
  'MADI-OKOLLO': { parent: 'ARUA', splitYear: 2019 },
  'TEREGO': { parent: 'ARUA', splitYear: 2019 },
  'PAKWACH': { parent: 'NEBBI', splitYear: 2019 },
  'KIKUUBE': { parent: 'HOIMA', splitYear: 2019 },
  'KAPELEBYONG': { parent: 'AMURIA', splitYear: 2019 },
  'KALAKI': { parent: 'KABERAMAIDO', splitYear: 2019 },
  'KASSANDA': { parent: 'MUBENDE', splitYear: 2019 },
  'KYOTERA': { parent: 'RAKAI', splitYear: 2019 },
  'BUGWERI': { parent: 'IGANGA', splitYear: 2019 },
  'BUNYANGABU': { parent: 'KABAROLE', splitYear: 2019 },
  'NABILATUK': { parent: 'NAKAPIRIPIRIT', splitYear: 2019 },
  'KARENGA': { parent: 'KAABONG', splitYear: 2020 },
  'LUSAKA': { parent: 'BUGIRI', splitYear: 2020 },

  // Districts created between 2016 and 2021
  'RUBANDA': { parent: 'KABALE', splitYear: 2017 },
  'NWOYA': { parent: 'AMURU', splitYear: 2010 },
  'LAMWO': { parent: 'KITGUM', splitYear: 2010 },
  'OTUKE': { parent: 'LIRA', splitYear: 2010 },
  'ZOMBO': { parent: 'NEBBI', splitYear: 2010 },
  'BUVUMA': { parent: 'MUKONO', splitYear: 2010 },
  'BUYENDE': { parent: 'KAMULI', splitYear: 2010 },
  'LUUKA': { parent: 'IGANGA', splitYear: 2010 },
  'NAMAYINGO': { parent: 'BUGIRI', splitYear: 2010 },
  'SERERE': { parent: 'SOROTI', splitYear: 2010 },
  'NGORA': { parent: 'KUMI', splitYear: 2010 },
  'BULAMBULI': { parent: 'SIRONKO', splitYear: 2010 },
  'KWEEN': { parent: 'KAPCHORWA', splitYear: 2010 },
  'NTOROKO': { parent: 'BUNDIBUGYO', splitYear: 2010 },
  'KYANKWANZI': { parent: 'KIBOGA', splitYear: 2010 },
  'GOMBA': { parent: 'MPIGI', splitYear: 2010 },
  'BUTAMBALA': { parent: 'MPIGI', splitYear: 2010 },
  'LWENGO': { parent: 'MASAKA', splitYear: 2010 },
  'BUKOMANSIMBI': { parent: 'MASAKA', splitYear: 2010 },
  'KALUNGU': { parent: 'MASAKA', splitYear: 2010 },
  'MITOOMA': { parent: 'BUSHENYI', splitYear: 2010 },
  'RUBIRIZI': { parent: 'BUSHENYI', splitYear: 2010 },
  'SHEEMA': { parent: 'BUSHENYI', splitYear: 2010 },
  'BUHWEJU': { parent: 'BUSHENYI', splitYear: 2010 },
  'NTUNGAMO': { parent: 'RUKUNGIRI', splitYear: 2001 },
};

/**
 * Normalize an administrative unit name for consistent matching
 * @param name - The name to normalize
 * @returns Normalized name (uppercase, trimmed, spelling corrected)
 */
export function normalizeName(name: string): string {
  if (!name) return '';

  // Uppercase and trim
  let normalized = name.toUpperCase().trim();

  // Normalize underscores to hyphens (CSV often uses underscores)
  normalized = normalized.replace(/_/g, '-');

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ');

  // Remove common suffixes that may differ between datasets
  normalized = normalized
    .replace(/\s+MUNICIPALITY$/i, '')
    .replace(/\s+T\.?C\.?$/i, '')
    .replace(/\s+TOWN\s+COUNCIL$/i, '')
    .replace(/\s+DIVISION$/i, '')
    .replace(/\s+WARD$/i, '');

  // Apply spelling corrections
  if (SPELLING_VARIATIONS[normalized]) {
    normalized = SPELLING_VARIATIONS[normalized];
  }

  return normalized;
}

/**
 * Create a lookup key for matching administrative units
 * Normalizes all components of the hierarchical path
 */
export function createLookupKey(...parts: string[]): string {
  return parts
    .map(p => normalizeName(p))
    .filter(p => p.length > 0)
    .join('-');
}

/**
 * Get the parent district for a district that didn't exist at a given election year
 * @param districtName - Current district name
 * @param electionYear - The year of the election
 * @returns Parent district name if current district didn't exist, otherwise null
 */
export function getParentDistrictForYear(districtName: string, electionYear: number): string | null {
  const normalized = normalizeName(districtName);
  const lineage = DISTRICT_LINEAGE[normalized];

  if (lineage && lineage.splitYear > electionYear) {
    return lineage.parent;
  }

  return null;
}

/**
 * Build alternative lookup keys for fuzzy matching
 * Returns array of possible keys to try when exact match fails
 */
export function getAlternativeLookupKeys(
  district: string,
  constituency?: string,
  subcounty?: string,
  parish?: string
): string[] {
  const keys: string[] = [];
  const normalizedDistrict = normalizeName(district);

  // Try with parent district if this is a newer district
  for (const [newDistrict, lineage] of Object.entries(DISTRICT_LINEAGE)) {
    if (normalizedDistrict === newDistrict) {
      if (constituency && subcounty && parish) {
        keys.push(createLookupKey(lineage.parent, constituency, subcounty, parish));
      } else if (constituency) {
        keys.push(createLookupKey(lineage.parent, constituency));
      }
    }
  }

  return keys;
}

export default {
  normalizeName,
  createLookupKey,
  getParentDistrictForYear,
  getAlternativeLookupKeys,
  SPELLING_VARIATIONS,
  DISTRICT_LINEAGE,
};
