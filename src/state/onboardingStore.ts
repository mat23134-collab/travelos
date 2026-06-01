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
import type { GroupDynamicsPayload, HotelLocationPref, HotelAmenity } from '@/lib/types';

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
  hotelLocationPref:  HotelLocationPref[];
  hotelAmenities:     HotelAmenity[];

  // Step 4: Vibe — who's traveling + pace
  groupType:    'solo' | 'couple' | 'family' | 'group' | '';
  groupDynamics: GroupDynamicsPayload | null;
  pace:         'relaxed' | 'moderate' | 'intense' | '';
  /** Family composition — only set when groupType==='family'. */
  familyAdults:    number;          // 1 or 2
  familyChildAges: number[];        // one entry per child, value 0-17
  /** Total head count for "Group" trips (3+ friends). Only set when groupType==='group'. */
  groupSize:       number;          // 3-12

  // Step 5: Preferences — interests + budget
  interests: string[];
  budget:    'budget' | 'mid-range' | 'luxury' | '';

  // Step 6: Finishing touches — dietary + must-haves
  dietaryRestrictions: string[];
  mustHaveItems:       string[];
  mustHaveOther:       string;

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
  setHotelNightlyBudget: (b: OnboardingState['hotelNightlyBudget']) => void;
  setHotelLocationPref:  (prefs: HotelLocationPref[]) => void;
  toggleHotelAmenity:    (amenity: HotelAmenity) => void;
  setGroupType:          (gt: 'solo' | 'couple' | 'family' | 'group') => void;
  setGroupDynamics:      (d: GroupDynamicsPayload | null) => void;
  setPace:               (p: 'relaxed' | 'moderate' | 'intense') => void;
  setFamilyAdults:       (n: number) => void;
  setFamilyChildCount:   (n: number) => void;
  setFamilyChildAge:     (index: number, age: number) => void;
  setGroupSize:          (n: number) => void;
  setBudget:             (b: 'budget' | 'mid-range' | 'luxury') => void;
  setInterests:          (interests: string[]) => void;
  toggleInterest:        (interest: string) => void;
  toggleDietary:         (value: string) => void;
  toggleMustHave:        (label: string) => void;
  setMustHaveOther:      (text: string) => void;
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
  | 'setAccommodation' | 'setHotelNightlyBudget' | 'setHotelLocationPref' | 'toggleHotelAmenity'
  | 'setGroupType' | 'setGroupDynamics' | 'setPace'
  | 'setFamilyAdults' | 'setFamilyChildCount' | 'setFamilyChildAge' | 'setGroupSize'
  | 'setBudget' | 'setInterests' | 'toggleInterest'
  | 'toggleDietary' | 'toggleMustHave' | 'setMustHaveOther'
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
  hotelLocationPref:  [],
  hotelAmenities:     [],
  groupType:       '',
  groupDynamics:   null,
  pace:            '',
  familyAdults:    2,
  familyChildAges: [],
  groupSize:       4,
  interests:          [],
  budget:             '',
  dietaryRestrictions: [],
  mustHaveItems:       [],
  mustHaveOther:       '',
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
      setHotelLocationPref:  (prefs) => set({ hotelLocationPref: prefs }),
      toggleHotelAmenity: (amenity) => set((s) => {
        const current = s.hotelAmenities ?? [];
        const next = current.includes(amenity)
          ? current.filter((a) => a !== amenity)
          : [...current, amenity];
        return { hotelAmenities: next };
      }),
      setGroupType: (gt) => set({
        groupType: gt,
        groupDynamics: null,
        // Reset composition fields whenever the group type changes.
        familyAdults:    gt === 'family' ? 2 : 2,
        familyChildAges: gt === 'family' ? [] : [],
        groupSize:       gt === 'group'  ? 4 : 4,
      }),
      setGroupDynamics: (d) => set({ groupDynamics: d }),
      setPace:          (p) => set({ pace: p }),
      setFamilyAdults:  (n) => set({ familyAdults: Math.max(1, Math.min(2, Math.round(n))) }),
      setFamilyChildCount: (n) => set((s) => {
        const next = Math.max(0, Math.min(8, Math.round(n)));
        const cur  = s.familyChildAges;
        if (next === cur.length) return s;
        if (next < cur.length)   return { familyChildAges: cur.slice(0, next) };
        // Add new children with a sensible default age (6) so the dropdown has a starting value.
        const padded = [...cur, ...Array.from({ length: next - cur.length }, () => 6)];
        return { familyChildAges: padded };
      }),
      setFamilyChildAge: (index, age) => set((s) => {
        if (index < 0 || index >= s.familyChildAges.length) return s;
        const a = Math.max(0, Math.min(17, Math.round(age)));
        const next = [...s.familyChildAges];
        next[index] = a;
        return { familyChildAges: next };
      }),
      setGroupSize: (n) => set({ groupSize: Math.max(3, Math.min(12, Math.round(n))) }),
      setBudget:    (b)  => set({ budget: b }),
      setInterests: (interests) => set({ interests }),
      toggleInterest: (interest) => set((s) => ({
        interests: s.interests.includes(interest)
          ? s.interests.filter((i) => i !== interest)
          : [...s.interests, interest],
      })),

      toggleDietary: (value) => set((s) => ({
        dietaryRestrictions: s.dietaryRestrictions.includes(value)
          ? s.dietaryRestrictions.filter((i) => i !== value)
          : [...s.dietaryRestrictions, value],
      })),

      toggleMustHave: (label) => set((s) => ({
        mustHaveItems: s.mustHaveItems.includes(label)
          ? s.mustHaveItems.filter((i) => i !== label)
          : [...s.mustHaveItems, label],
      })),

      setMustHaveOther: (text) => set({ mustHaveOther: text }),

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
        accommodation:       s.accommodation,
        hotelNightlyBudget:  s.hotelNightlyBudget,
        hotelLocationPref:   s.hotelLocationPref,
        hotelAmenities:      s.hotelAmenities,
        groupType:          s.groupType,
        groupDynamics:      s.groupDynamics,
        familyAdults:       s.familyAdults,
        familyChildAges:    s.familyChildAges,
        groupSize:          s.groupSize,
        pace:               s.pace,
        interests:          s.interests,
        budget:             s.budget,
        dietaryRestrictions: s.dietaryRestrictions,
        mustHaveItems:       s.mustHaveItems,
        mustHaveOther:       s.mustHaveOther,
      }),
    },
  ),
);
