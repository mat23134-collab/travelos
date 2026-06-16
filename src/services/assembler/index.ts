/**
 * assembler — deterministic, zero-LLM trip builder (ADR-001).
 *
 * Usage (inside /api/generate, before the LLM call):
 *   import { assembleItinerary } from '@/services/assembler';
 *   const { itinerary } = assembleItinerary(profile, cityPlaces);
 *   if (itinerary) return itinerary;        // covered city → no tokens spent
 *   // else fall through to the existing LLM generation path.
 */
export { assembleItinerary } from './assembleItinerary';
export type { AssemblerPlace, AssemblerProfile, AssemblerResult } from './assembleItinerary';
export * from './taxonomy';
export * from './geo';
