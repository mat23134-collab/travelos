/**
 * stepCopy — dynamic headline + sub line for each onboarding wizard step.
 * Pure function over a snapshot of the store; total fallbacks mean it can
 * never throw or return empty strings, regardless of how little the user
 * has answered.
 */
export interface StepCopyState {
  cityName:  string | null;
  nights:    number | null;
  groupType: string | null;
}

export interface StepCopy {
  headline: string;
  sub:      string;
}

const NIGHT_WORDS = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
];

/** "Five nights" up to twelve, "13 nights" beyond. */
export function spellNights(n: number): string {
  const word = n >= 1 && n <= 12 ? NIGHT_WORDS[n] : String(n);
  return `${word} ${n === 1 ? 'night' : 'nights'}`;
}

export function getStepCopy(step: number, s: StepCopyState): StepCopy {
  const city = s.cityName?.trim() || null;

  switch (step) {
    case 0:
      return {
        headline: 'Where to?',
        sub: 'Choose a country, then pick your cities.',
      };
    case 1:
      return city
        ? { headline: `When does ${city} happen?`, sub: 'Pick your travel dates.' }
        : { headline: 'When are you traveling?',   sub: 'Pick your travel dates.' };
    case 2: {
      const sub = 'Budget calibrates every recommendation; interests bias the picks.';
      if (city && s.nights) return { headline: `${spellNights(s.nights)} in ${city} — what's the budget?`, sub };
      if (city)             return { headline: `${city} — what's the budget?`, sub };
      return { headline: "What's the budget?", sub };
    }
    case 3: {
      const sub = 'A few quiet questions to shape the restaurants, pace, and venues we choose.';
      return city
        ? { headline: `How fast do you want ${city} to move?`, sub }
        : { headline: 'How do you travel?', sub };
    }
    case 4: {
      const sub = 'Booked already, or shall we find the right neighborhood?';
      return city
        ? { headline: `Where will you sleep in ${city}?`, sub }
        : { headline: 'Where will you stay?', sub };
    }
    case 5: {
      const sub = 'Dietary needs we should respect. Optional — skip freely.';
      return city
        ? { headline: `Eating your way through ${city} — any rules?`, sub }
        : { headline: 'Any dining rules?', sub };
    }
    case 6: {
      const sub = 'Hand-picked recommendations and your must-sees.';
      return city
        ? { headline: `Last touch — what can't you miss in ${city}?`, sub }
        : { headline: 'Last touch', sub };
    }
    default:
      return { headline: 'Almost there', sub: 'Just a little more.' };
  }
}
