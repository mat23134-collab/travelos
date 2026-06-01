// src/lib/hotelPersonalization.ts
import type {
  AccommodationType,
  BudgetLevel,
  GroupType,
  HotelAmenity,
  HotelLocationPref,
} from './types';
import type { GroupDynamicsPayload } from './types';

export interface HotelPersonalizationConfig {
  headline: string;
  subline: string;
  /** Shown as a small badge above the headline. null = no badge (default config). */
  contextBadge: string | null;
  /** Accommodation types in preferred display order. First 2 get a subtle gold highlight. */
  accomOrder: AccommodationType[];
  /** Types shown at reduced opacity (not clickable — still selectable). */
  accomDimmed: AccommodationType[];
  /** Override descriptions per type. Falls back to ACCOM_BASE defaults. */
  accomDescriptions: Partial<Record<AccommodationType, string>>;
  /** Location options in preferred display order. */
  locationOrder: HotelLocationPref[];
  /** 3–4 pre-selected amenity suggestions for this traveler profile. */
  amenityPreset: HotelAmenity[];
}

const DEFAULT: HotelPersonalizationConfig = {
  headline:          'Where will you sleep?',
  subline:           'Your accommodation anchors routes, dining picks, and neighbourhood advice',
  contextBadge:      null,
  accomOrder:        ['boutique-hotel', 'airbnb', 'luxury-hotel', 'hostel', 'resort'],
  accomDimmed:       [],
  accomDescriptions: {},
  locationOrder:     ['center', 'transit', 'quiet', 'nature'],
  amenityPreset:     ['breakfast', 'pool'],
};

export function getHotelPersonalization(
  groupType:    GroupType | '',
  groupDynamics: GroupDynamicsPayload | null,
  budget:       BudgetLevel | '',
): HotelPersonalizationConfig {
  const sub = groupDynamics?.subType ?? null;

  let cfg: HotelPersonalizationConfig = { ...DEFAULT, accomDescriptions: {} };

  // ── Solo ────────────────────────────────────────────────────────────────────
  if (groupType === 'solo' && sub === 'digital-nomad') {
    cfg = {
      ...cfg,
      headline:     'Your office away from home',
      subline:      'Fast Wi-Fi, a real desk, and a neighbourhood worth exploring',
      contextBadge: '💻 Personalized for a digital nomad',
      accomOrder:   ['boutique-hotel', 'airbnb', 'luxury-hotel', 'hostel', 'resort'],
      accomDimmed:  ['resort'],
      accomDescriptions: {
        'boutique-hotel': 'Character, reliable Wi-Fi, local feel',
        'airbnb':         'Full kitchen, long-stay rates, your own space',
        'hostel':         'Social, affordable, central',
        'luxury-hotel':   '5-star service & amenities',
        'resort':         'Self-contained, pool, curated',
      },
      locationOrder: ['transit', 'center', 'quiet', 'nature'],
      amenityPreset: ['workspace', 'gym'],
    };
  } else if (groupType === 'solo' && sub === 'adventure') {
    cfg = {
      ...cfg,
      headline:     'Fuelled and ready to explore',
      subline:      'A solid base to crash after big days out',
      contextBadge: '🏔️ Personalized for a solo adventurer',
      accomOrder:   ['hostel', 'boutique-hotel', 'airbnb', 'luxury-hotel', 'resort'],
      accomDimmed:  ['resort', 'luxury-hotel'],
      accomDescriptions: {
        'hostel':         'Meet fellow travellers, affordable, central',
        'boutique-hotel': 'Character-driven, local feel',
        'airbnb':         'Your own space, full kitchen',
        'luxury-hotel':   '5-star service & amenities',
        'resort':         'Self-contained, pool, curated',
      },
      locationOrder: ['center', 'transit', 'quiet', 'nature'],
      amenityPreset: ['breakfast', 'gym'],
    };
  } else if (groupType === 'solo' && sub === 'deep-recharge') {
    cfg = {
      ...cfg,
      headline:     'Your recharge sanctuary',
      subline:      'Calm, comfort, and zero pressure',
      contextBadge: '🧘 Personalized for a solo recharge trip',
      accomOrder:   ['boutique-hotel', 'airbnb', 'luxury-hotel', 'resort', 'hostel'],
      accomDimmed:  ['hostel'],
      accomDescriptions: {
        'boutique-hotel': 'Intimate, character-driven, quiet',
        'airbnb':         'Your own peaceful space',
        'luxury-hotel':   'Full service, spa, concierge',
        'resort':         'Self-contained, pool, curated',
        'hostel':         'Social, dorm-style',
      },
      locationOrder: ['quiet', 'nature', 'center', 'transit'],
      amenityPreset: ['spa', 'breakfast'],
    };

  // ── Couple ──────────────────────────────────────────────────────────────────
  } else if (groupType === 'couple' && sub === 'romantic') {
    cfg = {
      ...cfg,
      headline:     'The perfect backdrop for you two',
      subline:      'Intimate, stylish, and in the heart of the city',
      contextBadge: "💑 Personalized for a couple's escape",
      accomOrder:   ['boutique-hotel', 'luxury-hotel', 'airbnb', 'resort', 'hostel'],
      accomDimmed:  ['hostel'],
      accomDescriptions: {
        'boutique-hotel': 'Character, intimacy, local feel',
        'luxury-hotel':   'Spoil yourselves — full amenities',
        'airbnb':         'Your own apartment, total privacy',
        'resort':         'Curated romance package',
        'hostel':         'Social, dorm-style',
      },
      locationOrder: ['center', 'quiet', 'transit', 'nature'],
      amenityPreset: ['rooftop', 'breakfast', 'spa'],
    };
  } else if (groupType === 'couple') {
    cfg = {
      ...cfg,
      headline:     'A base for quality time',
      subline:      'Comfortable, well-located, no stress',
      contextBadge: '💑 Personalized for you two',
      accomOrder:   ['boutique-hotel', 'airbnb', 'luxury-hotel', 'resort', 'hostel'],
      accomDimmed:  ['hostel'],
      accomDescriptions: {
        'boutique-hotel': 'Character-driven, local feel',
        'airbnb':         'Home away from home',
        'luxury-hotel':   'Full service, concierge',
        'resort':         'Self-contained, pool, curated',
        'hostel':         'Social, dorm-style',
      },
      locationOrder: ['quiet', 'transit', 'center', 'nature'],
      amenityPreset: ['breakfast', 'parking'],
    };

  // ── Family ──────────────────────────────────────────────────────────────────
  } else if (groupType === 'family') {
    cfg = {
      ...cfg,
      headline:     'Home base for the whole family',
      subline:      'Space, comfort, and a pool',
      contextBadge: '👨‍👩‍👧 Personalized for a family',
      accomOrder:   ['airbnb', 'resort', 'luxury-hotel', 'boutique-hotel', 'hostel'],
      accomDimmed:  ['hostel'],
      accomDescriptions: {
        'airbnb':         'Multiple rooms, kitchen, your own space',
        'resort':         "Pool, kids' activities, everything on site",
        'luxury-hotel':   'Suites, concierge, full service',
        'boutique-hotel': 'Intimate, character-driven',
        'hostel':         'Not suited for families',
      },
      locationOrder: ['quiet', 'center', 'transit', 'nature'],
      amenityPreset: ['pool', 'breakfast', 'parking', 'pets'],
    };

  // ── Group ───────────────────────────────────────────────────────────────────
  } else if (groupType === 'group' && sub === 'best-friends') {
    cfg = {
      ...cfg,
      headline:     'A base camp for the whole crew',
      subline:      'Enough space, great location, share-worthy',
      contextBadge: '🎉 Personalized for your group',
      accomOrder:   ['airbnb', 'hostel', 'boutique-hotel', 'luxury-hotel', 'resort'],
      accomDimmed:  ['resort'],
      accomDescriptions: {
        'airbnb':         'Your own place — best value for groups',
        'hostel':         'Social, affordable, meet everyone',
        'boutique-hotel': 'Character-driven, cool neighbourhood',
        'luxury-hotel':   'Full service, split the cost',
        'resort':         'Self-contained, pool',
      },
      locationOrder: ['center', 'transit', 'quiet', 'nature'],
      amenityPreset: ['rooftop', 'breakfast'],
    };
  } else if (groupType === 'group' && sub === 'work-crew') {
    cfg = {
      ...cfg,
      headline:     'Work hard, explore harder',
      subline:      'Reliable connectivity and a great location',
      contextBadge: '💼 Personalized for a work trip',
      accomOrder:   ['luxury-hotel', 'boutique-hotel', 'airbnb', 'hostel', 'resort'],
      accomDimmed:  ['hostel'],
      accomDescriptions: {
        'luxury-hotel':   'Business facilities, concierge, meeting rooms',
        'boutique-hotel': 'Character, reliable Wi-Fi, local feel',
        'airbnb':         'Group space, kitchen, work-from-anywhere',
        'hostel':         'Social, budget',
        'resort':         'Self-contained, pool',
      },
      locationOrder: ['transit', 'center', 'quiet', 'nature'],
      amenityPreset: ['workspace', 'breakfast', 'gym'],
    };
  } else if (groupType === 'group') {
    cfg = {
      ...cfg,
      headline:     'The whole group, one great base',
      subline:      'Space for everyone, great access to the city',
      contextBadge: '👥 Personalized for a group',
      accomOrder:   ['airbnb', 'luxury-hotel', 'boutique-hotel', 'hostel', 'resort'],
      accomDimmed:  [],
      accomDescriptions: {},
      locationOrder: ['center', 'quiet', 'transit', 'nature'],
      amenityPreset: ['pool', 'breakfast', 'parking'],
    };
  }

  // ── Budget overlay ─────────────────────────────────────────────────────────
  if (budget === 'budget') {
    cfg = {
      ...cfg,
      accomDimmed: [...new Set([...cfg.accomDimmed, 'luxury-hotel' as AccommodationType, 'resort' as AccommodationType])],
    };
  } else if (budget === 'luxury') {
    cfg = {
      ...cfg,
      accomDimmed: [...new Set([...cfg.accomDimmed, 'hostel' as AccommodationType])],
    };
  }

  return cfg;
}
