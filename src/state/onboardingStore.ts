/**
 * onboardingStore — Zustand store for the 3D onboarding flow.
 *
 * Persists to localStorage so partial state survives refreshes.
 *
 * Fields:
 *  arrivalTime    — HH:MM, e.g. "21:30"
 *  departureTime  — HH:MM, e.g. "14:00"
 *  dailyStartTime — HH:MM, e.g. "08:30"
 *  skipDay1       — derived: true when arrivalTime hour >= 20
 *  hotelAddress   — free-text hotel address (from step 3)
 *  hotelLat       — geocoded latitude (null until geocoded)
 *  hotelLng       — geocoded longitude (null until geocoded)
 *
 * hotelLat/hotelLng are read by page.tsx to pass to CompassInjector
 * so the gold "hotel anchor" marker appears on the 3D compass.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OnboardingState {
  // Step index (0-based)
  step: number;

  // Logistics
  arrivalTime:    string;
  departureTime:  string;
  dailyStartTime: string;

  // Derived
  skipDay1: boolean;

  // Hotel Center of Gravity (step 3)
  hotelAddress: string;
  hotelLat:     number | null;
  hotelLng:     number | null;

  // Actions
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
  | 'setArrivalTime' | 'setDepartureTime' | 'setDailyStartTime'
  | 'setHotelLocation' | 'clearHotelLocation'
  | 'nextStep' | 'prevStep' | 'goToStep' | 'reset'
> = {
  step:           0,
  arrivalTime:    '',
  departureTime:  '',
  dailyStartTime: '08:30',
  skipDay1:       false,
  hotelAddress:   '',
  hotelLat:       null,
  hotelLng:       null,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...INITIAL,

      setArrivalTime: (time) =>
        set({ arrivalTime: time, skipDay1: isLateArrival(time) }),

      setDepartureTime: (time) =>
        set({ departureTime: time }),

      setDailyStartTime: (time) =>
        set({ dailyStartTime: time }),

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
