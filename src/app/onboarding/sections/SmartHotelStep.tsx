'use client';

/**
 * SmartHotelStep — Step 4 of the onboarding wizard.
 *
 * Two paths:
 *   A) "I have a hotel" — geocode search → confirm (unchanged)
 *   B) "Help me choose" — 4 progressive blocks driven by traveler context:
 *        Block 1: Accommodation type (ordered + dimmed by persona)
 *        Block 2: Nightly budget (filtered by type — existing logic)
 *        Block 3: Where in the city? (hotelLocationPref — single select)
 *        Block 4: Must-haves? (hotelAmenities — multi select)
 *
 * Context (groupType, groupDynamics, budget) is read from onboardingStore
 * and passed to getHotelPersonalization() which returns the display config.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BedDouble, Hotel, Star, Home, TreePalm,
  Coins, Banknote, CreditCard, Gem,
  Building2, Leaf, TrainFront, Waves,
  Coffee, Laptop, Dumbbell, SquareParking, Bath, Sunset, PawPrint,
  Search, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useOnboardingStore } from '@/state/onboardingStore';
import { getHotelPersonalization } from '@/lib/hotelPersonalization';
import { THEME, CARD } from '@/lib/onboardingTheme';
import { readTripLanguagePref } from '@/lib/tripLanguagePref';
import type { AccommodationType, HotelAmenity, HotelLocationPref } from '@/lib/types';

// Hebrew translations for this step's chrome. Prices use Unicode isolates
// (LRI…PDI) so "$80–$150" stays LTR inside an RTL line.
const HE: Record<string, string> = {
  // Accommodation
  'Hostel / Guesthouse': 'אכסניה / בית הארחה', 'Social, affordable, central': 'חברתי, זול, מרכזי',
  'Boutique Hotel': 'מלון בוטיק', 'Character-driven, local feel': 'אופי ייחודי, תחושה מקומית',
  'Luxury Hotel': 'מלון יוקרה', '5-star service & amenities': 'שירות 5 כוכבים ומתקנים',
  'Apartment / Airbnb': 'דירה / Airbnb', 'Live like a local, full kitchen': 'לחיות כמו מקומי, מטבח מלא',
  'Resort': 'ריזורט', 'Self-contained, pool, curated': 'הכל-כלול, בריכה, מוקפד',
  // Nightly budget
  'Up to $80': 'עד ⁦$80⁩', '$80 - $150': '⁦$80–$150⁩', '$150 - $300': '⁦$150–$300⁩', '$300+': '⁦$300+⁩',
  // Locations + sublabels
  'City center': 'מרכז העיר', 'Walk to attractions': 'הליכה לאטרקציות', 'Walk to everything': 'הליכה לכל מקום',
  'Quiet area': 'אזור שקט', 'Safe, residential': 'בטוח, מגורים', 'Intimate neighbourhood': 'שכונה אינטימית', 'Residential, calm': 'מגורים, רגוע',
  'Near transit': 'ליד תחבורה', 'Easy to get around': 'קל להתנייד', 'Metro at your door': 'מטרו בפתח',
  'Nature / parks': 'טבע / פארקים', 'Kids love the outdoors': 'ילדים אוהבים טבע', 'Scenic surroundings': 'נוף סובב', 'Green surroundings': 'סביבה ירוקה',
  // Amenities
  'Breakfast': 'ארוחת בוקר', 'Pool': 'בריכה', 'Workspace': 'חלל עבודה', 'Gym': 'חדר כושר', 'Parking': 'חניה',
  'Spa': 'ספא', 'Suite / extra space': 'סוויטה / מקום נוסף', 'Rooftop': 'גג', 'Pet-friendly': 'ידידותי לחיות',
  // Path selector
  'I already have a hotel': 'כבר יש לי מלון', 'Let me enter it': 'אני אזין אותו',
  'Help me choose': 'עזרו לי לבחור', 'Set my preferences': 'הגדירו את ההעדפות שלי',
  // Headers + buttons + errors
  'What kind of place?': 'איזה סוג מקום?', 'Nightly budget per room': 'תקציב ללילה לחדר',
  'Where in the city?': 'איפה בעיר?', 'Must-haves?': 'חובה לכם?', 'pick any': 'בחרו',
  'Find': 'חפש', "Skip — I don't have a hotel": 'דלגו — אין לי מלון',
  'Hotel not found — try a different name or address': 'המלון לא נמצא — נסו שם או כתובת אחרים',
};

const reveal = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

// ── Static lookup tables ───────────────────────────────────────────────────────

const ACCOM_BASE: Record<AccommodationType, { label: string; icon: LucideIcon; defaultDesc: string }> = {
  'hostel':         { label: 'Hostel / Guesthouse', icon: BedDouble, defaultDesc: 'Social, affordable, central' },
  'boutique-hotel': { label: 'Boutique Hotel',      icon: Hotel,     defaultDesc: 'Character-driven, local feel' },
  'luxury-hotel':   { label: 'Luxury Hotel',        icon: Star,      defaultDesc: '5-star service & amenities' },
  'airbnb':         { label: 'Apartment / Airbnb',  icon: Home,      defaultDesc: 'Live like a local, full kitchen' },
  'resort':         { label: 'Resort',              icon: TreePalm,  defaultDesc: 'Self-contained, pool, curated' },
};

// ── Nightly budget (exported — used by test) ──────────────────────────────────

export const NIGHTLY_OPTIONS = [
  { value: 'budget'  as const, label: 'Up to $80',   icon: Coins as LucideIcon },
  { value: 'mid'     as const, label: '$80 - $150',  icon: Banknote as LucideIcon },
  { value: 'comfort' as const, label: '$150 - $300', icon: CreditCard as LucideIcon },
  { value: 'luxury'  as const, label: '$300+',       icon: Gem as LucideIcon },
] as const;

type NightlyOption = (typeof NIGHTLY_OPTIONS)[number];

export function getNightlyOptionsForAccommodation(
  accommodation: AccommodationType | '',
): readonly NightlyOption[] {
  switch (accommodation) {
    case 'hostel':
      return NIGHTLY_OPTIONS.filter((o) => o.value === 'budget' || o.value === 'mid');
    case 'luxury-hotel':
    case 'resort':
      return NIGHTLY_OPTIONS.filter((o) => o.value === 'comfort' || o.value === 'luxury');
    case 'boutique-hotel':
    case 'airbnb':
      return NIGHTLY_OPTIONS.filter((o) => o.value !== 'budget');
    default:
      return NIGHTLY_OPTIONS;
  }
}

// ── Location options ──────────────────────────────────────────────────────────

const LOCATION_OPTIONS: Record<
  HotelLocationPref,
  { label: string; icon: LucideIcon; subLabel: (groupType: string) => string }
> = {
  center:  {
    label: 'City center',
    icon:  Building2,
    subLabel: (gt) => gt === 'family' ? 'Walk to attractions' : 'Walk to everything',
  },
  quiet:   {
    label: 'Quiet area',
    icon:  Leaf,
    subLabel: (gt) => gt === 'family' ? 'Safe, residential' : gt === 'couple' ? 'Intimate neighbourhood' : 'Residential, calm',
  },
  transit: {
    label: 'Near transit',
    icon:  TrainFront,
    subLabel: (gt) => gt === 'family' ? 'Easy to get around' : 'Metro at your door',
  },
  nature:  {
    label: 'Nature / parks',
    icon:  Waves,
    subLabel: (gt) => gt === 'family' ? 'Kids love the outdoors' : gt === 'couple' ? 'Scenic surroundings' : 'Green surroundings',
  },
};

// ── Amenity options ───────────────────────────────────────────────────────────

const AMENITY_OPTIONS: Record<HotelAmenity, { label: string; icon: LucideIcon }> = {
  breakfast: { label: 'Breakfast',          icon: Coffee },
  pool:      { label: 'Pool',               icon: Waves },
  workspace: { label: 'Workspace',          icon: Laptop },
  gym:       { label: 'Gym',                icon: Dumbbell },
  parking:   { label: 'Parking',            icon: SquareParking },
  spa:       { label: 'Spa',                icon: Bath },
  suite:     { label: 'Suite / extra space', icon: BedDouble },
  rooftop:   { label: 'Rooftop',            icon: Sunset },
  pets:      { label: 'Pet-friendly',       icon: PawPrint },
};
const ALL_AMENITIES = Object.keys(AMENITY_OPTIONS) as HotelAmenity[];

// ── Component ─────────────────────────────────────────────────────────────────

type Path = 'booked' | 'choose' | null;
type SearchStatus = 'idle' | 'loading' | 'found' | 'error';

interface Props {
  onComplete?: () => void;  // reserved for future use — parent currently drives continuation
  onSkip:      () => void;
}

export function SmartHotelStep({ onComplete, onSkip }: Props) {
  const {
    hotelAddress, hotelLat, hotelLng,
    setHotelLocation, clearHotelLocation,
    accommodation, hotelNightlyBudget,
    hotelLocationPref, hotelAmenities,
    setAccommodation, setHotelNightlyBudget,
    setHotelLocationPref, toggleHotelAmenity, skipHotel,
    destination, groupType, groupDynamics, budget,
  } = useOnboardingStore();

  const he = (readTripLanguagePref() ?? 'en') === 'he';
  const t = (s: string) => (he ? (HE[s] ?? s) : s);

  function handleSkip() {
    // Clear all hotel state AND flag the step as skipped so the itinerary
    // generator suppresses every hotel section (recommendations + basecamp).
    skipHotel();
    onSkip();
  }

  // Personalization config derived from traveler context
  const config = useMemo(
    () => getHotelPersonalization(groupType, groupDynamics, budget),
    [groupType, groupDynamics, budget],
  );

  const [path, setPath]           = useState<Path>(hotelAddress ? 'booked' : null);
  const [query, setQuery]         = useState(hotelAddress || '');
  const [searchStatus, setStatus] = useState<SearchStatus>(hotelAddress ? 'found' : 'idle');
  const [errMsg, setErrMsg]       = useState('');
  // True once we've exhausted geocoding — lets user proceed with name-only.
  const [canUseNameOnly, setCanUseNameOnly] = useState(false);

  const visibleNightlyOptions = useMemo(
    () => getNightlyOptionsForAccommodation(accommodation),
    [accommodation],
  );

  // Reset budget when accommodation changes and new type doesn't include current budget
  useEffect(() => {
    if (
      accommodation &&
      hotelNightlyBudget &&
      !visibleNightlyOptions.some((o) => o.value === hotelNightlyBudget)
    ) {
      setHotelNightlyBudget('');
    }
  }, [accommodation, hotelNightlyBudget, setHotelNightlyBudget, visibleNightlyOptions]);

  // Amenity display order: preset first, then the rest
  const orderedAmenities = useMemo(() => {
    const preset = config.amenityPreset.filter((a) => ALL_AMENITIES.includes(a));
    const rest   = ALL_AMENITIES.filter((a) => !preset.includes(a));
    return [...preset, ...rest];
  }, [config.amenityPreset]);

  // ── Path A helpers ────────────────────────────────────────────────────────

  async function geocode(q: string): Promise<{ lat: string; lon: string; display_name: string } | null> {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.length ? data[0] : null;
  }

  async function handleSearch() {
    const q = query.trim();
    if (q.length < 3) return;
    setStatus('loading');
    setErrMsg('');
    setCanUseNameOnly(false);
    try {
      // First try the raw query; if that fails, retry with the destination
      // appended (e.g. "Park Hyatt" → "Park Hyatt, Tokyo"). This catches the
      // most common case where users type just the hotel name without the city.
      let result = await geocode(q);
      if (!result && destination) {
        result = await geocode(`${q}, ${destination}`);
      }

      if (result) {
        const { lat, lon, display_name } = result;
        setHotelLocation(display_name ?? q, parseFloat(lat), parseFloat(lon));
        setStatus('found');
      } else {
        // Both attempts failed — offer name-only as a fallback so users
        // aren't blocked by geocoding gaps.
        setStatus('error');
        setErrMsg(`Can't find "${q}" on the map — try a more specific name, or continue with just the name.`);
        setCanUseNameOnly(true);
      }
    } catch {
      setStatus('error');
      setErrMsg('Search failed — check your connection and try again.');
      setCanUseNameOnly(true);
    }
  }

  function handleUseNameOnly() {
    // Store the hotel name without coordinates. The AI generator still gets
    // the name in its prompt; only the map pin will be missing.
    setHotelLocation(query.trim(), 0, 0);
    setStatus('found');
    setCanUseNameOnly(false);
  }

  function handleClear() {
    clearHotelLocation();
    setQuery('');
    setStatus('idle');
    setCanUseNameOnly(false);
  }

  function handlePathSelect(p: Path) {
    if (p === 'choose') {
      clearHotelLocation();
      setQuery('');
      setStatus('idle');
    }
    setPath(p);
  }

  function handleAccommodationSelect(type: AccommodationType) {
    setAccommodation(type);
    const next = getNightlyOptionsForAccommodation(type);
    if (hotelNightlyBudget && !next.some((o) => o.value === hotelNightlyBudget)) {
      setHotelNightlyBudget('');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6" data-tour="hotel">

      {/* Context badge */}
      {config.contextBadge && (
        <div
          className="inline-flex items-center gap-1.5 self-start text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: THEME.surfaceSel, color: THEME.gold, border: `1px solid ${THEME.borderSel}` }}
        >
          {config.contextBadge}
        </div>
      )}

      {/* Path selector */}
      <div className="grid grid-cols-2 gap-3">
        {([
          { p: 'booked' as Path, icon: Hotel as LucideIcon, label: 'I already have a hotel', sub: 'Let me enter it' },
          { p: 'choose' as Path, icon: Search as LucideIcon, label: 'Help me choose',          sub: 'Set my preferences' },
        ] as const).map(({ p, icon: Icon, label, sub }) => {
          const sel = path === p;
          return (
            <motion.button
              key={p!}
              onClick={() => handlePathSelect(p)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="relative flex flex-col items-start gap-2 p-4 rounded-2xl border text-left transition-colors"
              style={sel ? CARD.selected : CARD.base}
            >
              <Icon size={18} strokeWidth={1.75} style={{ color: sel ? THEME.gold : THEME.textMuted }} className="shrink-0" />
              <div>
                <p className="text-sm font-bold leading-tight"
                  style={{ color: sel ? THEME.deepGreen : THEME.textBody }}>{t(label)}</p>
                <p className="text-[11px] mt-0.5" style={{ color: THEME.textMuted }}>{t(sub)}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">

        {/* ── PATH A: Hotel search (unchanged) ──────────────────────── */}
        {path === 'booked' && (
          <motion.div key="booked-path"
            variants={reveal} initial="hidden" animate="visible" exit="exit"
            className="flex flex-col gap-3">
            <AnimatePresence mode="wait">
              {searchStatus !== 'found' ? (
                <motion.div key="search-input"
                  variants={reveal} initial="hidden" animate="visible" exit="exit"
                  className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <div
                      className="flex-1 flex items-center gap-2.5 px-3.5 py-3 rounded-xl"
                      style={{ background: THEME.surface, border: `1px solid ${THEME.border}` }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = THEME.borderSel)}
                      onBlur={(e)  => (e.currentTarget.style.borderColor = THEME.border)}
                    >
                      <Hotel size={16} strokeWidth={1.75} style={{ color: THEME.textMuted }} className="shrink-0" />
                      <input
                        type="text"
                        placeholder={he ? `שם מלון ב-${destination || 'יעד'}…` : `Hotel name in ${destination || 'your destination'}…`}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="flex-1 bg-transparent text-sm outline-none"
                        style={{ color: THEME.textBody }}
                      />
                    </div>
                    <motion.button
                      onClick={handleSearch}
                      disabled={query.trim().length < 3 || searchStatus === 'loading'}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      className="px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
                      style={{ background: THEME.gold, color: THEME.ink }}
                    >
                      {searchStatus === 'loading' ? '…' : t('Find')}
                    </motion.button>
                  </div>
                  {/* Always-visible name-only shortcut — no geocoding needed */}
                  <AnimatePresence>
                    {query.trim().length >= 3 && searchStatus !== 'loading' && (
                      <motion.button
                        key="use-name"
                        variants={reveal} initial="hidden" animate="visible" exit="exit"
                        onClick={handleUseNameOnly}
                        className="self-start text-xs font-semibold px-3 py-1.5 rounded-lg"
                        style={{ color: THEME.textMuted, background: THEME.surface, border: `1px solid ${THEME.border}` }}
                      >
                        {he ? `המשיכו עם "${query.trim()}"` : `Just use "${query.trim()}" →`}
                      </motion.button>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div key="hotel-found"
                  variants={reveal} initial="hidden" animate="visible" exit="exit"
                  className="flex items-start gap-3 px-4 py-3.5 rounded-2xl"
                  style={CARD.selected}>
                  <Building2 size={18} strokeWidth={1.75} style={{ color: THEME.gold }} className="shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: THEME.deepGreen }}>{hotelAddress.split(',')[0]}</p>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: THEME.textMuted }}>{hotelAddress}</p>
                    {hotelLat != null && (
                      <p className="text-[10px] mt-1 font-mono" style={{ color: THEME.textFaint }}>
                        {hotelLat.toFixed(4)}, {hotelLng!.toFixed(4)}
                      </p>
                    )}
                    {(() => {
                      const aid = process.env.NEXT_PUBLIC_BOOKING_AFFILIATE_ID;
                      if (!aid) return null;
                      const q = encodeURIComponent(`${hotelAddress.split(',')[0]} ${destination ?? ''}`);
                      return (
                        <a
                          href={`https://www.booking.com/search.html?aid=${aid}&ss=${q}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold mt-2"
                          style={{ color: THEME.gold }}
                        >
                          Book on Booking.com →
                        </a>
                      );
                    })()}
                  </div>
                  <button onClick={handleClear} aria-label="Clear hotel"
                    className="shrink-0 mt-0.5 transition-colors"
                    style={{ color: THEME.textFaint }}>
                    <X size={14} strokeWidth={1.75} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {searchStatus === 'error' && (
                <motion.div key="error-block"
                  variants={reveal} initial="hidden" animate="visible" exit="exit"
                  className="flex flex-col gap-2">
                  <p
                    className="text-sm px-4 py-2.5 rounded-xl"
                    style={{ background: 'rgba(180,60,60,0.08)', color: '#b43c3c', border: '1px solid rgba(180,60,60,0.20)' }}>
                    {t(errMsg)}
                  </p>
                  {canUseNameOnly && (
                    <motion.button
                      onClick={handleUseNameOnly}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="self-start text-sm font-semibold px-4 py-2.5 rounded-xl"
                      style={{ background: THEME.surfaceSel, color: THEME.deepGreen, border: `1px solid ${THEME.borderSel}` }}
                    >
                      {he ? `המשיכו עם "${query}"` : `Continue with "${query}"`}
                    </motion.button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── PATH B: Preferences (4 progressive blocks) ──────────── */}
        {path === 'choose' && (
          <motion.div key="choose-path"
            variants={reveal} initial="hidden" animate="visible" exit="exit"
            className="flex flex-col gap-5">

            {/* Block 1: Accommodation type */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: THEME.textMuted }}>
                {t('What kind of place?')}
              </p>
              <div className="flex flex-col gap-2">
                {config.accomOrder.map((type, i) => {
                  const base        = ACCOM_BASE[type];
                  const Icon        = base.icon;
                  const desc        = config.accomDescriptions[type] ?? base.defaultDesc;
                  const sel         = accommodation === type;
                  const dimmed      = !sel && config.accomDimmed.includes(type);
                  const highlighted = !dimmed && i < 2;
                  return (
                    <motion.button
                      key={type}
                      onClick={() => handleAccommodationSelect(type)}
                      whileHover={dimmed ? {} : { scale: 1.01, x: 2 }}
                      whileTap={dimmed ? {} : { scale: 0.98 }}
                      className="flex items-center gap-3.5 px-4 py-3 rounded-xl border text-left transition-all"
                      style={{
                        opacity: dimmed ? 0.4 : 1,
                        ...(sel
                          ? CARD.selected
                          : highlighted ? { background: THEME.surface, border: `1px solid ${THEME.goldSoft}` }
                          : CARD.base),
                      }}
                    >
                      <Icon size={18} strokeWidth={1.75} style={{ color: sel ? THEME.gold : THEME.textMuted }} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight"
                          style={{ color: sel ? THEME.deepGreen : THEME.textBody }}>{t(base.label)}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: THEME.textMuted }}>{t(desc)}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Block 2: Nightly budget — reveals after accommodation type chosen */}
            <AnimatePresence>
              {accommodation && (
                <motion.div key="nightly"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } }}
                  exit={{ opacity: 0 }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: THEME.textMuted }}>
                    {t('Nightly budget per room')}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {visibleNightlyOptions.map((opt) => {
                      const sel = hotelNightlyBudget === opt.value;
                      const Icon = opt.icon;
                      return (
                        <motion.button
                          key={opt.value}
                          onClick={() => setHotelNightlyBudget(opt.value)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left transition-colors"
                          style={sel ? CARD.selected : CARD.base}
                        >
                          <Icon size={18} strokeWidth={1.75} style={{ color: sel ? THEME.gold : THEME.textMuted }} className="shrink-0" />
                          <span className="text-xs font-semibold leading-tight"
                            style={{ color: sel ? THEME.deepGreen : THEME.textBody }}>{t(opt.label)}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Block 3: Location preference — reveals after budget chosen */}
            <AnimatePresence>
              {accommodation && hotelNightlyBudget && (
                <motion.div key="location"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } }}
                  exit={{ opacity: 0 }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: THEME.textMuted }}>
                    {t('Where in the city?')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {config.locationOrder.map((loc) => {
                      const opt = LOCATION_OPTIONS[loc];
                      const sel = hotelLocationPref.includes(loc);
                      const Icon = opt.icon;
                      return (
                        <motion.button
                          key={loc}
                          onClick={() => setHotelLocationPref([loc])}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors"
                          style={sel ? CARD.selected : CARD.base}
                        >
                          <Icon size={18} strokeWidth={1.75} style={{ color: sel ? THEME.gold : THEME.textMuted }} className="shrink-0" />
                          <div>
                            <p className="text-xs font-semibold leading-tight"
                              style={{ color: sel ? THEME.deepGreen : THEME.textBody }}>{t(opt.label)}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: THEME.textFaint }}>
                              {t(opt.subLabel(groupType))}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Block 4: Amenities — reveals after location chosen */}
            <AnimatePresence>
              {accommodation && hotelNightlyBudget && hotelLocationPref.length > 0 && (
                <motion.div key="amenities"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } }}
                  exit={{ opacity: 0 }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: THEME.textMuted }}>
                    {t('Must-haves?')}{' '}
                    <span className="normal-case font-normal">{t('pick any')}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {orderedAmenities.map((amenity) => {
                      const opt = AMENITY_OPTIONS[amenity];
                      const sel = hotelAmenities.includes(amenity);
                      const Icon = opt.icon;
                      return (
                        <motion.button
                          key={amenity}
                          onClick={() => toggleHotelAmenity(amenity)}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors"
                          style={sel
                            ? { ...CARD.selected, color: THEME.deepGreen }
                            : { ...CARD.base, color: THEME.textBody }
                          }
                        >
                          <Icon size={14} strokeWidth={1.75} style={{ color: sel ? THEME.gold : THEME.textMuted }} />
                          <span>{t(opt.label)}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip — explicit third option */}
      <motion.button
        type="button"
        onClick={handleSkip}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3 rounded-2xl text-sm font-semibold text-center transition-colors"
        style={{
          border: `1.5px dashed ${THEME.border}`,
          background: 'transparent',
          color: THEME.textMuted,
        }}
      >
        {he ? 'דלגו — אין לי מלון' : "Skip — I don't have a hotel"}
      </motion.button>

    </div>
  );
}
