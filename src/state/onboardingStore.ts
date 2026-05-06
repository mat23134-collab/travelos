/**
 * onboardingStore — Zustand store for the 3D onboarding flow.
 *
 * Persists to localStorage so partial state survives refreshes.
 * The `skipDay1` flag is derived automatically whenever `arrivalTime` changes:
 *   If arrival hour >= 20 (8 PM), Day 1 has no usable time → skip all activities.
 *
 * This flag is injected into the Claude prompt via TravelerProfile in plan/page.tsx.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OnboardingState {
  // Step index (0-based)
  step: number;

  // Logistics inputs (collected in the first 2 steps)
  arrivalTime: string;   // "HH:MM" 24-hour, e.g. "21:30"
  departureTime: string; // "HH:MM" 24-hour, e.g. "14:00"
  dailyStartTime: string; // "HH:MM" 24-hour, e.g. "08:30"

  // Derived flag — true when arrivalTime hour >= 20
  skipDay1: boolean;

  // Actions
  setArrivalTime: (time: string) => void;
  setDepartureTime: (time: string) => void;
  setDailyStartTime: (time: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (n: number) => void;
  reset: () => void;
}

/** Returns true if a "HH:MM" string represents 20:00 or later */
function isLateArrival(time: string): boolean {
  if (!time) return false;
  const [h] = time.split(':').map(Number);
  return h >= 20;
}

const INITIAL: Omit<OnboardingState, 'setArrivalTime' | 'setDepartureTime' | 'setDailyStartTime' | 'nextStep' | 'prevStep' | 'goToStep' | 'reset'> = {
  step: 0,
  arrivalTime: '',
  departureTime: '',
  dailyStartTime: '08:30',
  skipDay1: false,
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

      nextStep: () => set((s) => ({ step: s.step + 1 })),
      prevStep: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
      goToStep: (n) => set({ step: n }),

      reset: () => set(INITIAL),
    }),
    {
      name: 'travelos-onboarding',
      // Only persist the data fields, not step index or actions
      partialize: (s) => ({
        arrivalTime: s.arrivalTime,
        departureTime: s.departureTime,
        dailyStartTime: s.dailyStartTime,
        skipDay1: s.skipDay1,
      }),
    },
  ),
);
