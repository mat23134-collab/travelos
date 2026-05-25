/**
 * onboardingStore — Zustand store for the 4-step onboarding flow.
 *
 * Step 0 — Destination  : destination
 * Step 1 — Dates        : startDate, endDate
 * Step 2 — Logistics    : arrivalTime, departureTime, dailyStartTime, skipDay1
 * Step 3 — Hotel Anchor : hotelAddress, hotelLat, hotelLng
 *
 * All fields persist to localStorage. Plan page reads destination + dates
 * from the query-string params we push on completion.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TripCity {
  name: string;
  lat:  number;
  lng:  number;
}

export interface OnboardingState {
  // Step index (0-based)
  step: number;

  // Country + trip type (new progressive flow)
  country:  string;                      // e.g. 'Italy'
  tripType: 'single' | 'multi' | '';     // single-city or multi-city tour
  cities:   TripCity[];                  // chosen cities (1 for single, n for multi)

  // Step 0: Destination (first/only city — kept for plan page compat)
  destination: string;
  destinationLat: number | null;
  destinationLng: number | null;

  // Step 1: Dates (YYYY-MM-DD strings)
  startDate: string;
  endDate:   string;

  // Step 2: Logistics
  arrivalTime:    string;  // HH:MM, e.g. "21:30"
  departureTime:  string;  // HH:MM, e.g. "14:00"
  dailyStartTime: string;  // HH:MM, e.g. "08:30"
  skipDay1:       boolean; // derived: true when arrivalTime is after 18:00

  // Step 3: Hotel Center of Gravity
  hotelAddress: string;
  hotelLat:     number | null;
  hotelLng:     number | null;

  // Step 3b: Hotel preferences (when no hotel booked)
  accommodation:      'hostel' | 'boutique-hotel' | 'luxury-hotel' | 'airbnb' | 'resort' | '';
  hotelNightlyBudget: 'budget' | 'mid' | 'comfort' | 'luxury' | '';

  // Step 4: Vibe — who's traveling + pace
  groupType: 'solo' | 'couple' | 'family' | 'group' | '';
  pace:      'relaxed' | 'moderate' | 'intense' | '';

  // Step 5: Preferences — interests + budget
  interests: string[];
  budget:    'budget' | 'mid-range' | 'luxury' | '';

  // ── Actions ──────────────────────────────────────────────────────────────
  setCountry:        (c: string) => void;
  setTripType:       (t: 'single' | 'multi') => void;
  setCities:         (cities: TripCity[]) => void;
  addCity:           (city: TripCity) => void;
  removeCity:        (name: string) => void;

  setDestination:    (d: string) => void;
  setDestinationGeo: (d: string, lat: number | null, lng: number | null) => void;
  setDateRange:      (start: string, end: string) => void;
  setArrivalTime:    (time: string) => void;
  setDepartureTime:  (time: string) => void;
  setDailyStartTime: (time: string) => void;
  setHotelLocation:  (address: string, lat: number, lng: number) => void;
  clearHotelLocation: () => void;
  setAccommodation:      (a: 'hostel' | 'boutique-hotel' | 'luxury-hotel' | 'airbnb' | 'resort') => void;
  setHotelNightlyBudget: (b: 'budget' | 'mid' | 'comfort' | 'luxury') => void;
  setGroupType:          (gt: 'solo' | 'couple' | 'family' | 'group') => void;
  setPace:               (p: 'relaxed' | 'moderate' | 'intense') => void;
  setBudget:             (b: 'budget' | 'mid-range' | 'luxury') => void;
  setInterests:          (interests: string[]) => void;
  toggleInterest:        (interest: string) => void;
  nextStep:  () => void;
  prevStep:  () => void;
  goToStep:  (n: number) => void;
  reset:     () => void;
}

function isLateArrival(time: string): boolean {
  if (!time) return false;
  const [h = 0, m = 0] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
  return h > 18 || (h === 18 && m > 0);
}

const INITIAL: Omit<
  OnboardingState,
  | 'setCountry' | 'setTripType' | 'setCities' | 'addCity' | 'removeCity'
  | 'setDestination' | 'setDateRange'
  | 'setDestinationGeo'
  | 'setArrivalTime' | 'setDepartureTime' | 'setDailyStartTime'
  | 'setHotelLocation' | 'clearHotelLocation'
  | 'setAccommodation' | 'setHotelNightlyBudget'
  | 'setGroupType' | 'setPace' | 'setBudget' | 'setInterests' | 'toggleInterest'
  | 'nextStep' | 'prevStep' | 'goToStep' | 'reset'
> = {
  step:           0,
  country:        '',
  tripType:       '',
  cities:         [],
  destination:    '',
  startDate:      '',
  endDate:        '',
  arrivalTime:    '',
  departureTime:  '',
  dailyStartTime: '08:30',
  skipDay1:       false,
  hotelAddress:   '',
  hotelLat:       null,
  hotelLng:       null,
  destinationLat: null,
  destinationLng: null,
  accommodation:      '',
  hotelNightlyBudget: '',
  groupType:          '',
  pace:               '',
  interests:          [],
  budget:             '',
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...INITIAL,

      setCountry: (c) => set({ country: c, tripType: '', cities: [], destination: '', destinationLat: null, destinationLng: null }),
      setTripType: (t) => set({ tripType: t, cities: [], destination: '', destinationLat: null, destinationLng: null }),
      setCities: (cities) => set({
        cities,
        destination:    cities[0]?.name ?? '',
        destinationLat: cities[0]?.lat  ?? null,
        destinationLng: cities[0]?.lng  ?? null,
      }),
      addCity: (city) => set((s) => {
        if (s.cities.find((c) => c.name === city.name)) return s;
        const next = [...s.cities, city];
        return {
          cities:         next,
          destination:    next[0].name,
          destinationLat: next[0].lat,
          destinationLng: next[0].lng,
        };
      }),
      removeCity: (name) => set((s) => {
        const next = s.cities.filter((c) => c.name !== name);
        return {
          cities:         next,
          destination:    next[0]?.name ?? '',
          destinationLat: next[0]?.lat  ?? null,
          destinationLng: next[0]?.lng  ?? null,
        };
      }),

      setDestination: (d) => set({ destination: d, destinationLat: null, destinationLng: null }),
      setDestinationGeo: (d, lat, lng) => set({ destination: d, destinationLat: lat, destinationLng: lng }),

      setDateRange: (start, end) => set({ startDate: start, endDate: end }),

      setArrivalTime: (time) =>
        set({ arrivalTime: time, skipDay1: isLateArrival(time) }),

      setDepartureTime: (time) => set({ departureTime: time }),

      setDailyStartTime: (time) => set({ dailyStartTime: time }),

      setHotelLocation: (address, lat, lng) =>
        set({ hotelAddress: address, hotelLat: lat, hotelLng: lng }),

      clearHotelLocation: () =>
        set({ hotelAddress: '', hotelLat: null, hotelLng: null }),

      setAccommodation:      (a) => set({ accommodation: a }),
      setHotelNightlyBudget: (b) => set({ hotelNightlyBudget: b }),
      setGroupType: (gt) => set({ groupType: gt }),
      setPace:      (p)  => set({ pace: p }),
      setBudget:    (b)  => set({ budget: b }),
      setInterests: (interests) => set({ interests }),
      toggleInterest: (interest) => set((s) => ({
        interests: s.interests.includes(interest)
          ? s.interests.filter((i) => i !== interest)
          : [...s.interests, interest],
      })),

      nextStep: () => set((s) => ({ step: s.step + 1 })),
      prevStep: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
      goToStep: (n) => set({ step: n }),

      reset: () => set(INITIAL),
    }),
    {
      name: 'travelos-onboarding',
      partialize: (s) => ({
        step:           s.step,
        country:        s.country,
        tripType:       s.tripType,
        cities:         s.cities,
        destination:    s.destination,
        destinationLat: s.destinationLat,
        destinationLng: s.destinationLng,
        startDate:      s.startDate,
        endDate:        s.endDate,
        arrivalTime:    s.arrivalTime,
        departureTime:  s.departureTime,
        dailyStartTime: s.dailyStartTime,
        skipDay1:       s.skipDay1,
        hotelAddress:   s.hotelAddress,
        hotelLat:       s.hotelLat,
        hotelLng:       s.hotelLng,
        accommodation:      s.accommodation,
        hotelNightlyBudget: s.hotelNightlyBudget,
        groupType:          s.groupType,
        pace:               s.pace,
        interests:          s.interests,
        budget:             s.budget,
      }),
    },
  ),
);
