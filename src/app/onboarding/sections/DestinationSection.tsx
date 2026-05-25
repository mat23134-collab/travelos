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
import { useOnboardingStore } from '@/state/onboardingStore';

// ── Palette ───────────────────────────────────────────────────────────────────
const RED  = '#9e363a';
const RED2 = '#b5404a';
const MUTED = 'rgba(255,255,255,0.38)';

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
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      animate={selected
        ? { boxShadow: `0 0 0 2px ${RED}, 0 8px 24px rgba(158,54,58,0.25)` }
        : { boxShadow: '0 2px 10px rgba(0,0,0,0.22)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 24 }}
      className="relative flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl text-center transition-colors"
      style={{
        background: selected ? 'rgba(158,54,58,0.16)' : 'rgba(15,40,98,0.24)',
        border: selected ? `1.5px solid rgba(158,54,58,0.55)` : '1.5px solid rgba(255,255,255,0.07)',
      }}
    >
      {selected && (
        <span
          className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white"
          style={{ background: RED }}
        >✓</span>
      )}
      <span className="text-2xl leading-none">{country.flag}</span>
      <span className="text-[11px] font-bold leading-tight text-white">{country.name}</span>
    </motion.button>
  );
}

// ── City chip ─────────────────────────────────────────────────────────────────
function CityChip({ city, selected, onToggle }: {
  city: TravelCity;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      onClick={onToggle}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      animate={selected
        ? { boxShadow: `0 0 0 1.5px ${RED}` }
        : { boxShadow: 'none' }}
      className="px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-colors"
      style={{
        background: selected ? `rgba(158,54,58,0.20)` : 'rgba(255,255,255,0.07)',
        border: selected ? `1.5px solid rgba(158,54,58,0.55)` : '1.5px solid rgba(255,255,255,0.10)',
        color: selected ? '#ff9fa3' : 'rgba(255,255,255,0.72)',
      }}
    >
      {city.name}
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

  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [subStep, setSubStep] = useState<'country' | 'type' | 'city'>('country');

  const typePanelRef = useRef<HTMLDivElement>(null);
  const cityPanelRef = useRef<HTMLDivElement>(null);

  // Restore subStep from persisted state
  useEffect(() => {
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
    setCountry(c.name);
    setSubStep('type');
    scrollTo(typePanelRef);
  }

  function handleTripType(t: 'single' | 'multi') {
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
  const canConfirm = Boolean(country && tripType && cities.length > 0);

  const filtered = search
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES;

  // ── Completed summary bar ─────────────────────────────────────────────────
  if (isCompleted) {
    const cityLabel = cities.length === 1
      ? cities[0].name
      : cities.map((c) => c.name).join(' → ');
    const typeLabel = tripType === 'multi' ? 'Multi-city' : 'Single city';

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-5 py-3.5 rounded-2xl"
        style={{
          background: 'rgba(15,40,98,0.28)',
          border: '1px solid rgba(158,54,58,0.22)',
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0"
            style={{ background: RED }}
          >✓</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">
              {selectedCountry?.flag} {country}
            </span>
            <span style={{ color: MUTED }} className="text-xs">·</span>
            <span className="text-xs font-medium" style={{ color: MUTED }}>{typeLabel}</span>
            <span style={{ color: MUTED }} className="text-xs">·</span>
            <span className="text-xs font-semibold text-white/80">{cityLabel}</span>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover-bg-subtle"
          style={{ color: MUTED, border: '1px solid rgba(255,255,255,0.10)' }}
        >
          Edit
        </button>
      </motion.div>
    );
  }

  // ── Active form ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* Section header */}
      <div className="flex items-center gap-3">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
          style={{ background: RED }}
        >1</span>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Where to?</h2>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>Choose a country, then pick your cities</p>
        </div>
      </div>

      {/* Country search */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        <span className="text-base">🔍</span>
        <input
          type="text"
          placeholder="Search countries…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs" style={{ color: MUTED }}>✕</button>
        )}
      </div>

      {/* Country grid */}
      <div
        className="grid gap-2.5 overflow-y-auto pr-1"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
          maxHeight: '240px',
          scrollbarWidth: 'thin',
        }}
      >
        {filtered.map((c, i) => (
          <motion.div
            key={c.code}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.018, type: 'spring', stiffness: 360, damping: 26 }}
          >
            <CountryCard
              country={c}
              selected={country === c.name}
              onClick={() => handleCountrySelect(c)}
            />
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-center py-6" style={{ color: MUTED }}>
            No countries found for &ldquo;{search}&rdquo;
          </p>
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
            <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <p className="text-sm font-semibold text-white">
              How would you like to explore {selectedCountry?.flag} {country}?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'single' as const, icon: '📍', label: 'Single city', sub: 'Dive deep into one destination' },
                { value: 'multi'  as const, icon: '🗺️', label: 'Multi-city tour', sub: 'Visit multiple cities' },
              ].map(({ value, icon, label, sub }) => {
                const active = tripType === value;
                return (
                  <motion.button
                    key={value}
                    onClick={() => handleTripType(value)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    animate={active
                      ? { boxShadow: `0 0 0 2px ${RED}, 0 8px 24px rgba(158,54,58,0.22)` }
                      : { boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}
                    className="flex flex-col items-start gap-2 p-4 rounded-2xl text-left"
                    style={{
                      background: active ? 'rgba(158,54,58,0.16)' : 'rgba(255,255,255,0.05)',
                      border: active ? `1.5px solid rgba(158,54,58,0.50)` : '1.5px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color: active ? '#ff9fa3' : '#fff' }}>{label}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{sub}</p>
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
            <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

            {/* Popular cities */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: MUTED }}>
                Popular in {country}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedCountry.cities.map((city) => (
                  <CityChip
                    key={city.name}
                    city={city}
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
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
              >
                <input
                  type="text"
                  placeholder={`Other city in ${country}…`}
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomCity()}
                  className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
                />
              </div>
              <motion.button
                onClick={handleCustomCity}
                disabled={!customInput.trim() || geocoding}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                style={{ background: RED }}
              >
                {geocoding ? '…' : 'Add'}
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
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: MUTED }}>Your route</p>
                  <div className="flex items-center flex-wrap gap-1.5">
                    {cities.map((city, i) => (
                      <div key={city.name} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-xs" style={{ color: MUTED }}>→</span>}
                        <motion.span
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{
                            background: 'rgba(158,54,58,0.18)',
                            border: '1px solid rgba(158,54,58,0.35)',
                            color: '#ff9fa3',
                          }}
                        >
                          {city.name}
                          <button
                            onClick={() => removeCity(city.name)}
                            className="opacity-60 hover:opacity-100 transition-opacity ml-0.5"
                          >×</button>
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

      {/* ── Confirm CTA ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {canConfirm && (
          <motion.div
            key="confirm"
            variants={reveal}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.button
              onClick={onComplete}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-full text-sm font-black text-white tracking-wide"
              style={{
                background: `linear-gradient(135deg, ${RED}, ${RED2})`,
                boxShadow: `0 0 40px rgba(158,54,58,0.42), 0 8px 24px -4px rgba(158,54,58,0.30)`,
              }}
            >
              {tripType === 'multi' && cities.length > 1
                ? `Plan ${cities.length}-city ${country} tour →`
                : `Plan ${cities[0]?.name ?? country} →`}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
