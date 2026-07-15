'use client';

/**
 * DestinationSection — Section 1 of the new progressive onboarding flow.
 *
 * Three inline sub-steps (no page navigation):
 *   A → Country grid (searchable)
 *   B → Trip type: single city vs. multi-city tour (reveals below)
 *   C → City selector: quick-pick chips + custom search (reveals below)
 *
 * On completion calls onComplete(). When isCompleted renders a compact
 * summary bar with an Edit button.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { COUNTRIES, type Country, type TravelCity } from '@/lib/countries';
import { getCountryImage, DEFAULT_HERO } from '@/lib/travelImagery';
import { DayPhoto } from '@/components/DayPhoto';
import { useOnboardingStore } from '@/state/onboardingStore';
import { THEME, CARD } from '@/lib/onboardingTheme';
import { MapPin, Map, Search, X } from 'lucide-react';
import { readTripLanguagePref } from '@/lib/tripLanguagePref';
import type { LucideIcon } from 'lucide-react';

// ── Variants ──────────────────────────────────────────────────────────────────
const reveal = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.22 } },
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  isCompleted: boolean;
  onComplete:  () => void;
  onEdit:      () => void;
}

// ── Geocode helper (for custom city search) ───────────────────────────────────
async function geocodeCity(query: string): Promise<TravelCity | null> {
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.length) return null;
    return {
      name: query.trim(),
      lat:  parseFloat(data[0].lat),
      lng:  parseFloat(data[0].lon),
    };
  } catch {
    return null;
  }
}

// ── Country card ──────────────────────────────────────────────────────────────
function CountryCard({ country, selected, onClick }: {
  country: Country;
  selected: boolean;
  onClick: () => void;
}) {
  const photo = getCountryImage(country.name);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 24 }}
      className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden text-center transition-colors block"
      style={{
        border: selected ? `2px solid ${THEME.gold}` : `2px solid ${THEME.border}`,
      }}
    >
      <img
        src={photo}
        alt={country.name}
        loading="lazy"
        onError={(event) => {
          if (event.currentTarget.src !== DEFAULT_HERO) {
            event.currentTarget.src = DEFAULT_HERO;
          }
        }}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out"
        style={{ transform: selected ? 'scale(1.05)' : 'scale(1)' }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: selected
            ? 'linear-gradient(to top, rgba(9,31,54,0.92) 0%, rgba(9,31,54,0.35) 55%, rgba(9,31,54,0.15) 100%)'
            : 'linear-gradient(to top, rgba(9,31,54,0.88) 0%, rgba(9,31,54,0.40) 50%, rgba(9,31,54,0.20) 100%)',
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 z-10 px-2">
        <span className="text-2xl leading-none drop-shadow-lg">{country.flag}</span>
        <span className="text-[12px] font-black leading-tight text-white tracking-tight drop-shadow-md">
          {country.name}
        </span>
      </div>
    </motion.button>
  );
}

// ── City chip ─────────────────────────────────────────────────────────────────
function CityChip({ city, country, selected, onToggle }: {
  city: TravelCity;
  country: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.94 }}
      className="relative min-h-[76px] overflow-hidden rounded-2xl text-left transition-colors"
      style={{
        border: selected ? `1.5px solid ${THEME.gold}` : `1.5px solid ${THEME.border}`,
      }}
    >
      {/* Dynamically fetched per-CITY photo (not a static per-country lookup) —
          otherwise every city in a country with only one curated hero image
          (e.g. Melbourne/Brisbane/Perth alongside Sydney) shows the same photo. */}
      <div
        className="absolute inset-0 transition-transform duration-500 ease-out"
        style={{ transform: selected ? 'scale(1.06)' : 'scale(1)' }}
      >
        <DayPhoto query={`${city.name} ${country} cityscape`} alt={city.name} fill dark hideCredit />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background: selected
            ? 'linear-gradient(to top, rgba(9,31,54,0.92) 0%, rgba(9,31,54,0.35) 58%, rgba(9,31,54,0.14) 100%)'
            : 'linear-gradient(to top, rgba(9,31,54,0.88) 0%, rgba(9,31,54,0.40) 56%, rgba(9,31,54,0.16) 100%)',
        }}
      />
      <span className="relative z-10 flex h-full min-h-[76px] items-end px-3 pb-2.5 text-[12px] font-black leading-tight text-white drop-shadow-md">
        {city.name}
      </span>
    </motion.button>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────
export function DestinationSection({ isCompleted, onComplete, onEdit }: Props) {
  const {
    country, tripType, cities,
    setCountry, setTripType, setCities, addCity, removeCity,
    destination,
  } = useOnboardingStore();

  const he = (readTripLanguagePref() ?? 'en') === 'he';

  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [subStep, setSubStep] = useState<'country' | 'type' | 'city'>('country');

  const typePanelRef = useRef<HTMLDivElement>(null);
  const cityPanelRef = useRef<HTMLDivElement>(null);

  // Restore subStep from persisted state. Multi-city is temporarily disabled,
  // so clear any stale 'multi' selection a returning user may have persisted
  // and send them back to the trip-type picker.
  useEffect(() => {
    if (tripType === 'multi') {
      setTripType('single');
      setCities([]);
      setSubStep(country ? 'type' : 'country');
      return;
    }
    if (country && tripType && cities.length > 0) setSubStep('city');
    else if (country && tripType) setSubStep('city');
    else if (country) setSubStep('type');
    else setSubStep('country');
  }, []); // only on mount

  // Scroll helpers
  function scrollTo(ref: React.RefObject<HTMLDivElement | null>) {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }

  function handleCountrySelect(c: Country) {
    if (country === c.name) {
      setCountry('');
      setSubStep('country');
      return;
    }

    setCountry(c.name);
    setSubStep('type');
    scrollTo(typePanelRef);
  }

  function handleTripType(t: 'single' | 'multi') {
    // Multi-city is not built yet — keep it locked behind a "coming soon" badge
    // so users can't advance into an unfinished flow.
    if (t === 'multi') return;
    setTripType(t);
    setSubStep('city');
    scrollTo(cityPanelRef);
  }

  function handleCityToggle(city: TravelCity) {
    const exists = cities.find((c) => c.name === city.name);
    if (tripType === 'single') {
      setCities(exists ? [] : [city]);
    } else {
      if (exists) removeCity(city.name);
      else addCity(city);
    }
  }

  async function handleCustomCity() {
    const q = customInput.trim();
    if (!q) return;
    setGeocoding(true);
    const result = await geocodeCity(q);
    setGeocoding(false);
    if (result) {
      if (tripType === 'single') setCities([result]);
      else addCity(result);
      setCustomInput('');
    }
  }

  const selectedCountry = COUNTRIES.find((c) => c.name === country);
  const filtered = search
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES;

  // ── Completed summary bar ─────────────────────────────────────────────────
  if (isCompleted) {
    const cityLabel = cities.length === 1
      ? cities[0].name
      : cities.map((c) => c.name).join(' → ');
    const typeLabel = tripType === 'multi' ? (he ? 'מרובת ערים' : 'Multi-city') : (he ? 'עיר אחת' : 'Single city');

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-5 py-3.5 rounded-2xl"
        style={CARD.base}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color: THEME.textBody }}>
              {selectedCountry?.flag} {country}
            </span>
            <span style={{ color: THEME.textMuted }} className="text-xs">·</span>
            <span className="text-xs font-medium" style={{ color: THEME.textMuted }}>{typeLabel}</span>
            <span style={{ color: THEME.textMuted }} className="text-xs">·</span>
            <span className="text-xs font-semibold" style={{ color: THEME.textBody }}>{cityLabel}</span>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover-bg-subtle"
          style={{ color: THEME.textMuted, border: `1px solid ${THEME.border}` }}
        >
          {he ? 'עריכה' : 'Edit'}
        </button>
      </motion.div>
    );
  }

  // ── Active form ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* Country search — capped so it doesn't span the full-bleed grid width */}
      <div
        data-tour="destination"
        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl w-full max-w-2xl"
        style={{ background: THEME.surface, border: `1px solid ${THEME.border}` }}
      >
        <Search size={16} strokeWidth={1.75} style={{ color: THEME.textMuted }} className="shrink-0" />
        <input
          type="text"
          placeholder={he ? 'חיפוש מדינות…' : 'Search countries…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: THEME.textBody }}
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs" style={{ color: THEME.textMuted }}>
            <X size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Country grid — scrollable, with a bottom fade so "more below" reads clearly */}
      <div className="relative">
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 overflow-y-auto pr-1 max-h-[340px] lg:max-h-[58vh]"
        style={{ scrollbarWidth: 'thin' }}
      >
        {filtered.map((c, i) => (
          <motion.div
            key={c.code}
            className="w-full min-w-0"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(i * 0.018, 0.35), type: 'spring', stiffness: 360, damping: 26 }}
          >
            <CountryCard
              country={c}
              selected={country === c.name}
              onClick={() => handleCountrySelect(c)}
            />
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-center py-6" style={{ color: THEME.textMuted }}>
            {he ? `לא נמצאו מדינות עבור "${search}"` : `No countries found for “${search}”`}
          </p>
        )}
      </div>
        {/* Scroll affordance — fade hints there's more to scroll */}
        {filtered.length > 6 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-2xl"
            style={{ background: 'linear-gradient(to top, rgba(239,227,205,0.95), rgba(239,227,205,0))' }}
          />
        )}
      </div>

      {/* ── B: Trip type (slides in after country) ───────────────────────── */}
      <AnimatePresence>
        {(subStep === 'type' || subStep === 'city') && country && (
          <motion.div
            ref={typePanelRef}
            key="trip-type"
            variants={reveal}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col gap-3"
          >
            <div className="h-px" style={{ background: THEME.border }} />
            <p className="text-sm font-semibold" style={{ color: THEME.textBody }}>
              {he ? 'איך תרצו לחקור את' : 'How would you like to explore'} {selectedCountry?.flag} {country}?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'single' as const, icon: MapPin as LucideIcon, label: he ? 'עיר אחת' : 'Single city', sub: he ? 'להעמיק ביעד אחד' : 'Dive deep into one destination', comingSoon: false },
                { value: 'multi'  as const, icon: Map as LucideIcon, label: he ? 'סיור רב-ערים' : 'Multi-city tour', sub: he ? 'לבקר בכמה ערים' : 'Visit multiple cities', comingSoon: true },
              ].map((opt) => {
                const { value, icon: Icon, label, sub, comingSoon } = opt;
                const active = tripType === value;
                return (
                  <motion.button
                    key={value}
                    onClick={() => handleTripType(value)}
                    disabled={comingSoon}
                    aria-disabled={comingSoon}
                    whileHover={comingSoon ? undefined : { scale: 1.03 }}
                    whileTap={comingSoon ? undefined : { scale: 0.96 }}
                    className="relative flex flex-col items-start gap-2 p-4 rounded-2xl text-left transition-colors"
                    style={{
                      ...(active ? CARD.selected : CARD.base),
                      opacity: comingSoon ? 0.55 : 1,
                      cursor: comingSoon ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {comingSoon && (
                      <span
                        className="absolute top-2.5 right-2.5 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                        style={{ background: THEME.surfaceSel, color: THEME.gold, border: `1px solid ${THEME.borderSel}` }}
                      >
                        {he ? 'בקרוב' : 'Coming soon'}
                      </span>
                    )}
                    <Icon
                      size={18}
                      strokeWidth={1.75}
                      style={{ color: active ? THEME.gold : THEME.textMuted, filter: comingSoon ? 'grayscale(0.5)' : undefined }}
                      className="shrink-0"
                    />
                    <div>
                      <p className="text-sm font-bold" style={{ color: active ? THEME.deepGreen : THEME.textBody }}>{label}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: THEME.textMuted }}>
                        {comingSoon ? (he ? 'בפיתוח — עיר אחת בינתיים' : 'In the works — single city for now') : sub}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── C: City selector (slides in after trip type) ──────────────────── */}
      <AnimatePresence>
        {subStep === 'city' && tripType && selectedCountry && (
          <motion.div
            ref={cityPanelRef}
            key="city-select"
            variants={reveal}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col gap-4"
          >
            <div className="h-px" style={{ background: THEME.border }} />

            {/* Popular cities */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: THEME.textMuted }}>
                {he ? 'פופולרי ב-' : 'Popular in '}{country}
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
                {selectedCountry.cities.map((city) => (
                  <CityChip
                    key={city.name}
                    city={city}
                    country={country}
                    selected={!!cities.find((c) => c.name === city.name)}
                    onToggle={() => handleCityToggle(city)}
                  />
                ))}
              </div>
            </div>

            {/* Custom city search */}
            <div className="flex gap-2">
              <div
                className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
                style={{ background: THEME.surface, border: `1px solid ${THEME.border}` }}
              >
                <input
                  type="text"
                  placeholder={`Other city in ${country}…`}
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomCity()}
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: THEME.textBody }}
                />
              </div>
              <motion.button
                onClick={handleCustomCity}
                disabled={!customInput.trim() || geocoding}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                style={{ background: THEME.gold }}
              >
                {geocoding ? '…' : (he ? 'הוסף' : 'Add')}
              </motion.button>
            </div>

            {/* Multi-city route preview */}
            <AnimatePresence>
              {tripType === 'multi' && cities.length > 0 && (
                <motion.div
                  key="route-preview"
                  variants={reveal}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex flex-col gap-2"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: THEME.textMuted }}>{he ? 'המסלול שלך' : 'Your route'}</p>
                  <div className="flex items-center flex-wrap gap-1.5">
                    {cities.map((city, i) => (
                      <div key={city.name} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-xs" style={{ color: THEME.textMuted }}>→</span>}
                        <motion.span
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{
                            background: THEME.surfaceSel,
                            border: `1px solid ${THEME.borderSel}`,
                            color: THEME.deepGreen,
                          }}
                        >
                          {city.name}
                          <button
                            onClick={() => removeCity(city.name)}
                            className="opacity-60 hover:opacity-100 transition-opacity ml-0.5"
                          >
                            <X size={12} strokeWidth={1.75} />
                          </button>
                        </motion.span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
