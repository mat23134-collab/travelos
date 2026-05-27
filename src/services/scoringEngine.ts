import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { GroupDynamicsPayload, GroupType } from '@/lib/types';

type TagColumn = 'vibe' | 'group_suitability' | 'culinary_focus';

export interface UserTripChoicesForScoring {
  destination?: string | null;
  city_name?: string | null;
  group_type?: GroupType | string | null;
  budget?: string | null;
  pace?: string | null;
  interests?: string[] | null;
  dietary_restrictions?: string | string[] | null;
  must_have?: string | string[] | null;
}

export interface GetFilteredInventoryInput {
  userTripChoices: UserTripChoicesForScoring;
  groupDynamics?: GroupDynamicsPayload | null;
}

export interface InventoryItem {
  id?: string;
  source_table: 'places' | 'restaurants';
  name: string;
  city?: string | null;
  category?: string | null;
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
  category_emoji?: string | null;
  social_proof_url?: string | null;
  vibe_label?: string | null;
  status?: string | null;
  created_at?: string | null;
  vibe: string[];
  group_suitability: string[];
  culinary_focus: string[];
  score: number;
  matchedTags: Record<TagColumn, string[]>;
  scoreReasons: string[];
}

type RawInventoryRow = {
  id?: string | number | null;
  name?: string | null;
  city?: string | null;
  city_name?: string | null;
  category?: string | null;
  description?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  category_emoji?: string | null;
  social_proof_url?: string | null;
  vibe_label?: string | null;
  status?: string | null;
  created_at?: string | null;
  vibe?: unknown;
  group_suitability?: unknown;
  culinary_focus?: unknown;
};

interface DesiredTags {
  vibe: string[];
  group_suitability: string[];
  culinary_focus: string[];
}

const MAX_RESULTS = 30;

const POPULAR_VIBE_WEIGHT: Record<string, number> = {
  'local-favorite': 2.5,
  classic: 2,
  'viral-trend': 1.75,
  'hidden-gem': 1.5,
  'luxury-pick': 1.25,
  'budget-pick': 1,
};

const GROUP_TAGS: Record<string, string[]> = {
  solo: ['solo'],
  couple: ['romantic-couple'],
  family: ['families', 'kids', 'family-friendly'],
  group: ['groups'],
};

const DYNAMICS_TAGS: Record<string, Partial<DesiredTags>> = {
  'digital-nomad': {
    vibe: ['quiet', 'work-friendly', 'calm'],
    group_suitability: ['solo', 'remote-work'],
    culinary_focus: ['coffee', 'casual-dining'],
  },
  'deep-recharge': {
    vibe: ['quiet-luxury', 'calm', 'low-key'],
    group_suitability: ['solo'],
  },
  adventure: {
    vibe: ['energetic', 'outdoorsy', 'active'],
    group_suitability: ['solo'],
  },
  romantic: {
    vibe: ['quiet-luxury', 'dim-lit', 'intimate'],
    group_suitability: ['romantic-couple'],
    culinary_focus: ['fine-dining', 'tasting-menu'],
  },
  'parent-child': {
    vibe: ['easygoing', 'playful'],
    group_suitability: ['families', 'kids', 'parent-child'],
  },
  reconnecting: {
    vibe: ['quiet-luxury', 'intimate', 'scenic'],
    group_suitability: ['romantic-couple'],
    culinary_focus: ['fine-dining'],
  },
  'young-kids': {
    vibe: ['easygoing', 'playful'],
    group_suitability: ['families', 'kids', 'stroller-friendly'],
  },
  'mixed-ages': {
    vibe: ['balanced', 'easygoing'],
    group_suitability: ['groups', 'families', 'mixed-ages'],
  },
  teens: {
    vibe: ['energetic', 'trendy', 'interactive'],
    group_suitability: ['families', 'teens'],
  },
  'best-friends': {
    vibe: ['energetic', 'trendy', 'social'],
    group_suitability: ['groups', 'friends'],
  },
  'work-crew': {
    vibe: ['polished', 'conversation-worthy', 'trendy'],
    group_suitability: ['co-founders', 'groups', 'work-crew'],
    culinary_focus: ['fine-dining', 'cocktails'],
  },
};

export async function getFilteredInventory(
  input: GetFilteredInventoryInput,
  client: SupabaseClient = supabase,
): Promise<InventoryItem[]> {
  const desiredTags = buildDesiredTags(input);
  const city = normalizeText(input.userTripChoices.city_name ?? input.userTripChoices.destination ?? '');

  const [places, restaurants] = await Promise.all([
    fetchInventoryTable(client, 'places', city),
    fetchInventoryTable(client, 'restaurants', city),
  ]);

  const inventory = [...places, ...restaurants];
  if (!inventory.length) return [];

  const scored = inventory.map((item) => scoreInventoryItem(item, desiredTags));
  const hasTagMatches = scored.some((item) =>
    item.matchedTags.vibe.length > 0 ||
    item.matchedTags.group_suitability.length > 0 ||
    item.matchedTags.culinary_focus.length > 0,
  );

  return scored
    .sort((a, b) => {
      const scoreDelta = hasTagMatches ? b.score - a.score : popularityScore(b) - popularityScore(a);
      if (scoreDelta !== 0) return scoreDelta;
      return Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? '');
    })
    .slice(0, MAX_RESULTS);
}

async function fetchInventoryTable(
  client: SupabaseClient,
  table: 'places' | 'restaurants',
  city: string,
): Promise<InventoryItem[]> {
  try {
    let query = client.from(table).select('*').limit(120);
    if (city && table === 'places') query = query.ilike('city', city);

    const { data, error } = await query;
    if (error) {
      console.warn(`[scoringEngine] ${table} query skipped:`, error.message);
      return [];
    }

    return ((data ?? []) as RawInventoryRow[])
      .map((row) => normalizeInventoryRow(row, table))
      .filter((row): row is InventoryItem => row !== null)
      .filter((row) => table === 'places' || !city || !row.city || normalizeText(row.city) === city)
      .filter((row) => row.status !== 'closed' && row.status !== 'renovating');
  } catch (err) {
    console.warn(`[scoringEngine] ${table} unexpected error:`, err);
    return [];
  }
}

function scoreInventoryItem(item: InventoryItem, desired: DesiredTags): InventoryItem {
  const matchedTags: Record<TagColumn, string[]> = {
    vibe: intersect(item.vibe, desired.vibe),
    group_suitability: intersect(item.group_suitability, desired.group_suitability),
    culinary_focus: intersect(item.culinary_focus, desired.culinary_focus),
  };

  const score =
    matchedTags.group_suitability.length * 5 +
    matchedTags.culinary_focus.length * 4 +
    matchedTags.vibe.length * 3 +
    popularityScore(item);

  const scoreReasons = [
    ...matchedTags.group_suitability.map((tag) => `group:${tag}`),
    ...matchedTags.culinary_focus.map((tag) => `culinary:${tag}`),
    ...matchedTags.vibe.map((tag) => `vibe:${tag}`),
  ];

  return { ...item, score, matchedTags, scoreReasons };
}

function buildDesiredTags({ userTripChoices, groupDynamics }: GetFilteredInventoryInput): DesiredTags {
  const tags: DesiredTags = {
    vibe: [],
    group_suitability: [],
    culinary_focus: [],
  };

  addTags(tags.group_suitability, GROUP_TAGS[normalizeText(userTripChoices.group_type ?? '')] ?? []);
  addTagsFromDynamics(tags, groupDynamics?.subType);
  addTagsFromPace(tags, userTripChoices.pace);
  addTagsFromBudget(tags, userTripChoices.budget);
  addTagsFromInterests(tags, userTripChoices.interests ?? []);
  addTagsFromFreeText(tags, userTripChoices.must_have);
  addTagsFromFreeText(tags, userTripChoices.dietary_restrictions);

  return {
    vibe: unique(tags.vibe),
    group_suitability: unique(tags.group_suitability),
    culinary_focus: unique(tags.culinary_focus),
  };
}

function addTagsFromDynamics(tags: DesiredTags, subType?: string): void {
  if (!subType) return;
  const mapped = DYNAMICS_TAGS[subType];
  if (!mapped) return;
  addTags(tags.vibe, mapped.vibe ?? []);
  addTags(tags.group_suitability, mapped.group_suitability ?? []);
  addTags(tags.culinary_focus, mapped.culinary_focus ?? []);
}

function addTagsFromPace(tags: DesiredTags, pace?: string | null): void {
  const normalized = normalizeText(pace ?? '');
  if (normalized === 'relaxed') addTags(tags.vibe, ['quiet', 'calm', 'low-key']);
  if (normalized === 'moderate') addTags(tags.vibe, ['balanced', 'easygoing']);
  if (normalized === 'intense') addTags(tags.vibe, ['energetic', 'trendy']);
}

function addTagsFromBudget(tags: DesiredTags, budget?: string | null): void {
  const normalized = normalizeText(budget ?? '');
  if (normalized === 'luxury') {
    addTags(tags.vibe, ['quiet-luxury', 'polished']);
    addTags(tags.culinary_focus, ['fine-dining', 'tasting-menu']);
  }
  if (normalized === 'budget') addTags(tags.culinary_focus, ['street-food', 'casual-dining']);
}

function addTagsFromInterests(tags: DesiredTags, interests: string[]): void {
  for (const interest of interests.map(normalizeText)) {
    if (interest === 'food') addTags(tags.culinary_focus, ['street-food', 'fine-dining', 'local-specialty']);
    if (interest === 'nightlife') addTags(tags.vibe, ['energetic', 'dim-lit', 'trendy']);
    if (interest === 'luxury') addTags(tags.vibe, ['quiet-luxury', 'polished']);
    if (interest === 'family') addTags(tags.group_suitability, ['families', 'kids']);
    if (interest === 'culture') addTags(tags.vibe, ['classic', 'thoughtful']);
  }
}

function addTagsFromFreeText(tags: DesiredTags, value?: string | string[] | null): void {
  const text = Array.isArray(value) ? value.join(' ') : value ?? '';
  const normalized = normalizeText(text);
  if (!normalized) return;
  if (normalized.includes('tasting')) addTags(tags.culinary_focus, ['tasting-menu']);
  if (normalized.includes('street')) addTags(tags.culinary_focus, ['street-food']);
  if (normalized.includes('fine')) addTags(tags.culinary_focus, ['fine-dining']);
  if (normalized.includes('quiet')) addTags(tags.vibe, ['quiet', 'quiet-luxury']);
  if (normalized.includes('trendy')) addTags(tags.vibe, ['trendy']);
}

function normalizeInventoryRow(row: RawInventoryRow, sourceTable: 'places' | 'restaurants'): InventoryItem | null {
  const name = row.name?.trim();
  if (!name) return null;

  return {
    id: row.id == null ? undefined : String(row.id),
    source_table: sourceTable,
    name,
    city: row.city ?? row.city_name ?? null,
    category: row.category ?? null,
    description: row.description ?? null,
    lat: toNumber(row.lat ?? row.latitude),
    lng: toNumber(row.lng ?? row.longitude),
    category_emoji: row.category_emoji ?? null,
    social_proof_url: row.social_proof_url ?? null,
    vibe_label: row.vibe_label ?? null,
    status: row.status ?? null,
    created_at: row.created_at ?? null,
    vibe: normalizeTagArray(row.vibe),
    group_suitability: normalizeTagArray(row.group_suitability),
    culinary_focus: normalizeTagArray(row.culinary_focus),
    score: 0,
    matchedTags: { vibe: [], group_suitability: [], culinary_focus: [] },
    scoreReasons: [],
  };
}

function popularityScore(item: Pick<InventoryItem, 'vibe_label' | 'category'>): number {
  const vibeScore = POPULAR_VIBE_WEIGHT[normalizeText(item.vibe_label ?? '')] ?? 0;
  const category = normalizeText(item.category ?? '');
  const categoryScore = category === 'restaurant' || category === 'attraction' ? 0.75 : 0;
  return vibeScore + categoryScore;
}

function normalizeTagArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return unique(value.filter((tag): tag is string => typeof tag === 'string').map(normalizeText));
}

function intersect(source: string[], target: string[]): string[] {
  const wanted = new Set(target.map(normalizeText));
  return source.filter((tag) => wanted.has(normalizeText(tag)));
}

function addTags(target: string[], tags: string[]): void {
  target.push(...tags.map(normalizeText).filter(Boolean));
}

function unique(tags: string[]): string[] {
  return Array.from(new Set(tags.map(normalizeText).filter(Boolean)));
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

