import { GroupType } from '@/lib/types';

const TITLE_BY_GROUP: Record<GroupType, string> = {
  solo: 'Solo',
  couple: 'Couple',
  family: 'Family',
  group: 'Squad',
};

const TARGET_BY_GROUP: Record<GroupType, string> = {
  solo: 'you',
  couple: 'your couple',
  family: 'your family',
  group: 'your squad',
};

const NOUN_BY_GROUP: Record<GroupType, string> = {
  solo: 'solo travelers',
  couple: 'couples',
  family: 'families',
  group: 'squads',
};

export function audienceTitle(groupType?: GroupType | null): string {
  if (!groupType) return 'Squad';
  return TITLE_BY_GROUP[groupType] ?? 'Squad';
}

export function audienceTarget(groupType?: GroupType | null): string {
  if (!groupType) return 'your squad';
  return TARGET_BY_GROUP[groupType] ?? 'your squad';
}

export function audienceNounPlural(groupType?: GroupType | null): string {
  if (!groupType) return 'squads';
  return NOUN_BY_GROUP[groupType] ?? 'squads';
}
