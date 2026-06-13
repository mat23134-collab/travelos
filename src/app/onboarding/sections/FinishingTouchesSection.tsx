'use client';

import { useOnboardingStore } from '@/state/onboardingStore';
import { FinishingTouchesForm } from '@/components/FinishingTouchesForm';

interface Props {
  mode?: 'all' | 'dietary' | 'recommendations';
  stepBadge?: number;
}

export function FinishingTouchesSection({ mode = 'all', stepBadge = 6 }: Props) {
  const {
    destination,
    dietaryRestrictions,
    dietaryStrictness,
    mustHaveItems,
    mustHaveOther,
    toggleDietary,
    setDietaryStrictness,
    toggleMustHave,
    setMustHaveOther,
  } = useOnboardingStore();

  return (
    <FinishingTouchesForm
      destination={destination}
      dietary={dietaryRestrictions}
      mustHaveItems={mustHaveItems}
      mustHaveOther={mustHaveOther}
      onToggleDietary={toggleDietary}
      onToggleMustHave={toggleMustHave}
      onMustHaveOtherChange={setMustHaveOther}
      dietaryStrictness={dietaryStrictness}
      onDietaryStrictnessChange={setDietaryStrictness}
      mode={mode}
      stepBadge={stepBadge}
    />
  );
}
