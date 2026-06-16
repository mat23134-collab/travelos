/**
 * placeClassify.ts — free (zero-API) derivation of the assembler columns from a
 * venue's name / category / description. Mirrors the SQL backfill rules so that
 * AI-generated venues written back to `places` are immediately assembler-ready
 * (subcategory, meal_slots, price_tier, opening_hours).
 *
 * opening_hours produced here are category-default placeholders tagged
 * "source":"default" — a later Google Places pass should overwrite them.
 */

const lc = (s: string | null | undefined) => (s ?? '').toLowerCase();

/** Meal slots a venue serves, by coarse category. Non-food → []. */
export function deriveMealSlots(category: string): string[] {
  switch (lc(category)) {
    case 'restaurant': return ['lunch', 'dinner'];
    case 'cafe':       return ['breakfast', 'brunch', 'lunch'];
    default:           return [];
  }
}

/** Fine-grained type for intra-day variety. Name first, then a light fallback. */
export function deriveSubcategory(name: string, category: string): string {
  const cat = lc(category);
  if (['restaurant', 'cafe', 'bar', 'nightlife', 'hotel'].includes(cat)) return cat;
  const t = lc(name);
  const test = (re: RegExp) => re.test(t);
  if (test(/museum|museo|mus[eé]e/)) return 'museum';
  if (test(/gallery|galleria|galerie/)) return 'gallery';
  if (test(/cathedral|basilica|duomo|\bchurch\b|chiesa|chapel|abbey|monaster|mosque|\btemple\b|synagog|shrine|sanctuar/)) return 'religious';
  if (test(/\bgarden\b|gardens|giardini|botanical|\bpark\b|parco/)) return 'park';
  if (test(/palace|palazzo|castle|castello|fortress|citadel|chateau|\bvilla\b|\bcastel\b/)) return 'palace';
  if (test(/\bforum\b|\bforo\b|ruins|archaeolog|catacomb|amphitheat|colosseo|colosseum|necropolis|palatine|\bterme\b|baths of|circus maximus/)) return 'historic_site';
  if (test(/piazza|\bsquare\b|plaza|\blargo\b|\bcampo\b/)) return 'square';
  if (test(/bridge|ponte/)) return 'bridge';
  if (test(/\btower\b|viewpoint|observation|panoram|belvedere|lookout|terrazza/)) return 'viewpoint';
  if (test(/fountain|fontana|\bsteps\b|scalinata|\bgate\b|\barch\b|\barco\b|obelisk|statue|monument|memorial/)) return 'landmark';
  if (test(/market|bazaar|mercato/)) return 'market';
  if (test(/beach|spiaggia|seaside|\blido\b/)) return 'beach';
  if (test(/mountain|\blake\b|forest|waterfall|\bfalls\b|\bcave\b|cliff|volcano/)) return 'nature';
  if (test(/neighbo|quarter|quartiere|district|street art/)) return 'district';
  if (test(/theat|stadium|arena|\bzoo\b|aquarium|amusement|ferris|opera house/)) return 'entertainment';
  return 'sight_other';
}

/** Relative price 1–4. Food venues read keyword signals; others use a baseline. */
export function derivePriceTier(category: string, text: string): number {
  const cat = lc(category);
  const t = lc(text);
  if (['restaurant', 'cafe', 'bar', 'nightlife'].includes(cat)) {
    if (/michelin|haute|tasting menu|michelin[ -]?star/.test(t)) return 4;
    if (/luxury|fine[ -]?dining|upscale|gourmet|elegant|refined|high[ -]?end|sophisticated|chic/.test(t)) return 3;
    if (/budget|cheap|street[ -]?food|affordable|no[ -]?frills|hole[ -]?in[ -]?the[ -]?wall|inexpensive/.test(t)) return 1;
  }
  if (cat === 'cafe' || cat === 'market' || cat === 'nature') return 1;
  if (cat === 'nightlife') return 3;
  return 2;
}

const HOURS: Record<string, [string, string][]> = {
  restaurant:   [['12:00', '15:00'], ['19:00', '23:00']],
  cafe:         [['07:30', '19:00']],
  bar:          [['17:00', '01:00']],
  nightlife:    [['22:00', '03:00']],
  attraction:   [['09:00', '18:00']],
  tourism_site: [['09:00', '18:00']],
  market:       [['08:00', '14:00']],
  nature:       [['00:00', '23:59']],
  shopping:     [['10:00', '20:00']],
};

/** Category-default weekly hours, tagged source:"default". Hotels → null. */
export function defaultOpeningHours(category: string): Record<string, unknown> | null {
  const h = HOURS[lc(category)];
  if (!h) return null;
  return { mon: h, tue: h, wed: h, thu: h, fri: h, sat: h, sun: h, source: 'default' };
}

/**
 * Category-default group_suitability (scout's vocabulary), mirroring the SQL
 * backfill. Used when ingesting venues that have no per-venue suitability tags
 * (e.g. fresh scout rows). Hotels → [].
 */
export function deriveGroupSuitability(category: string): string[] {
  switch (lc(category)) {
    case 'restaurant':   return ['solo', 'romantic-couple', 'groups', 'families', 'friends'];
    case 'cafe':         return ['solo', 'romantic-couple', 'groups', 'families', 'friends', 'remote-work'];
    case 'bar':          return ['solo', 'romantic-couple', 'groups', 'friends'];
    case 'nightlife':    return ['romantic-couple', 'groups', 'friends'];
    case 'attraction':
    case 'tourism_site': return ['solo', 'romantic-couple', 'groups', 'families', 'kids', 'friends'];
    case 'market':
    case 'nature':       return ['solo', 'romantic-couple', 'groups', 'families', 'friends'];
    case 'shopping':     return ['solo', 'romantic-couple', 'groups', 'friends'];
    case 'hotel':        return [];
    default:             return ['solo', 'romantic-couple', 'groups', 'families', 'friends'];
  }
}
