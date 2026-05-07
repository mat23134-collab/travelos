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

export interface OnboardingState {
  // Step index (0-based)
  step: number;

  // Step 0: Destination
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
  skipDay1:       boolean; // derived: true when arrivalTime hour >= 20

  // Step 3: Hotel Center of Gravity
  hotelAddress: string;
  hotelLat:     number | null;
  hotelLng:     number | null;

  // ── Actions ──────────────────────────────────────────────────────────────
  setDestination:    (d: string) => void;
  setDestinationGeo: (d: string, lat: number | null, lng: number | null) => void;
  setDateRange:      (start: string, end: string) => void;
  setArrivalTime:    (time: string) => void;
  setDepartureTime:  (time: string) => void;
  setDailyStartTime: (time: string) => void;
  setHotelLocation:  (address: string, lat: number, lng: number) => void;
  clearHotelLocation: () => void;
  nextStep:  () => void;
  prevStep:  () => void;
  goToStep:  (n: number) => void;
  reset:     () => void;
}

function isLateArrival(time: string): boolean {
  if (!time) return false;
  const [h] = time.split(':').map(Number);
  return h >= 20;
}

const INITIAL: Omit<
  OnboardingState,
  | 'setDestination' | 'setDateRange'
  | 'setDestinationGeo'
  | 'setArrivalTime' | 'setDepartureTime' | 'setDailyStartTime'
  | 'setHotelLocation' | 'clearHotelLocation'
  | 'nextStep' | 'prevStep' | 'goToStep' | 'reset'
> = {
  step:           0,
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
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...INITIAL,

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

      nextStep: () => set((s) => ({ step: s.step + 1 })),
      prevStep: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
      goToStep: (n) => set({ step: n }),

      reset: () => set(INITIAL),
    }),
    {
      name: 'travelos-onboarding',
      partialize: (s) => ({
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
      }),
    },
  ),
);
