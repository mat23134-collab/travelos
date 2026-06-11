import assert from 'node:assert/strict';
import { getDaySummarySentences } from './DaySummaryCard';
import type { DayPlan } from '../lib/types';

// AI-written daySummary present → used verbatim, as a single sentence
const withAiSummary: DayPlan = {
  day: 1,
  theme: 'Old Town Discovery',
  morning: { name: 'Castle Hill' },
  daySummary: 'You start the day climbing Castle Hill for sweeping views, then wander down into the Old Town for a relaxed afternoon of cafes and hidden courtyards.',
};
assert.deepEqual(
  getDaySummarySentences(withAiSummary, 0, 'en'),
  ['You start the day climbing Castle Hill for sweeping views, then wander down into the Old Town for a relaxed afternoon of cafes and hidden courtyards.'],
  'AI daySummary is used verbatim when present',
);

// Empty/whitespace-only daySummary → falls back to summarizeDay
const withBlankSummary: DayPlan = {
  day: 1,
  theme: 'Old Town Discovery',
  morning: { name: 'Castle Hill' },
  daySummary: '   ',
};
const fallbackSentences = getDaySummarySentences(withBlankSummary, 0, 'en');
assert.ok(fallbackSentences.length > 0, 'Falls back to summarizeDay output for blank daySummary');
assert.ok(fallbackSentences[0].includes('Old Town Discovery'), 'Fallback includes the theme');

// No daySummary field at all (old itineraries) → falls back to summarizeDay
const noSummary: DayPlan = {
  day: 1,
  theme: 'Old Town Discovery',
  morning: { name: 'Castle Hill' },
};
const noSummarySentences = getDaySummarySentences(noSummary, 0, 'en');
assert.deepEqual(noSummarySentences, fallbackSentences, 'Missing daySummary falls back identically to a blank one');

console.log('✓ getDaySummarySentences — all tests passed');
