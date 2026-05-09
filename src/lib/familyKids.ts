import type { FamilyChildAgeBand, FamilyKidsByAge } from './types';

export const FAMILY_CHILD_AGE_BANDS: FamilyChildAgeBand[] = [
  '0-3',
  '3-6',
  '6-9',
  '9-12',
  '12-16',
  '16+',
];

export const FAMILY_BAND_LABEL: Record<FamilyChildAgeBand, { en: string; he: string }> = {
  '0-3': { en: '0–3', he: '0–3' },
  '3-6': { en: '3–6', he: '3–6' },
  '6-9': { en: '6–9', he: '6–9' },
  '9-12': { en: '9–12', he: '9–12' },
  '12-16': { en: '12–16', he: '12–16' },
  '16+': { en: '16+', he: '16+' },
};

export function emptyFamilyKidsByAge(): FamilyKidsByAge {
  return {};
}

export function totalFamilyKids(by?: FamilyKidsByAge | null): number {
  if (!by) return 0;
  return FAMILY_CHILD_AGE_BANDS.reduce((sum, k) => sum + Math.max(0, Math.floor(by[k] ?? 0)), 0);
}

/** One-line summary for prompts (English). */
export function formatFamilyKidsForPrompt(by?: FamilyKidsByAge | null): string {
  if (!by || totalFamilyKids(by) === 0) return '';
  const parts = FAMILY_CHILD_AGE_BANDS.filter((k) => (by[k] ?? 0) > 0).map((k) => {
    const label = k === '16+' ? '16+' : k.replace('-', '–');
    return `${by[k]}× ages ${label} yrs`;
  });
  return parts.join('; ');
}

/** Drop zero entries; return null if no kids. */
export function sanitizeFamilyKids(by: FamilyKidsByAge | null | undefined): FamilyKidsByAge | null {
  if (!by) return null;
  const out: FamilyKidsByAge = {};
  for (const k of FAMILY_CHILD_AGE_BANDS) {
    const n = by[k];
    if (n != null && n > 0) out[k] = Math.min(12, Math.floor(n));
  }
  return totalFamilyKids(out) > 0 ? out : null;
}
