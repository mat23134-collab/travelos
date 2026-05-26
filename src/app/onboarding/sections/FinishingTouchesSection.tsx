'use client';

import { useOnboardingStore } from '@/state/onboardingStore';
import { FinishingTouchesForm } from '@/components/FinishingTouchesForm';

export function FinishingTouchesSection() {
  const {
    destination,
    dietaryRestrictions,
    mustHaveItems,
    mustHaveOther,
    toggleDietary,
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
      stepBadge={6}
    />
  );
}
