import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GENERATE_WALL_CLOCK_MS,
  GENERATE_PREFETCH_PER_BRANCH_MS,
  GENERATE_LLM_FETCH_MS,
} from './generateBudget';

// The plan page aborts the fetch at GENERATE_WALL_CLOCK_MS + 45s. The server-side
// LLM budget must stay comfortably under that so a slow-but-valid Gemini response
// is NOT killed prematurely (which dumps the run into the generic fallback).
const CLIENT_ABORT_MS = GENERATE_WALL_CLOCK_MS + 45_000;

test('LLM budget gives Gemini enough room for its p95 latency', () => {
  // Regression guard: the old 76s cap timed out ~40% of 35-source prompts.
  assert.ok(
    GENERATE_LLM_FETCH_MS >= 100_000,
    `LLM budget ${GENERATE_LLM_FETCH_MS}ms is too tight — slow Gemini responses fall back`,
  );
});

test('prefetch + LLM fit inside the wall-clock budget', () => {
  assert.ok(
    GENERATE_PREFETCH_PER_BRANCH_MS + GENERATE_LLM_FETCH_MS <= GENERATE_WALL_CLOCK_MS,
    'prefetch + LLM must fit within GENERATE_WALL_CLOCK_MS',
  );
});

test('LLM budget leaves post-LLM headroom before the client aborts', () => {
  // Need slack after the LLM for parse + Google Places verify + first DB write
  // before the `complete` SSE event. Require >= 30s of margin.
  assert.ok(
    CLIENT_ABORT_MS - (GENERATE_PREFETCH_PER_BRANCH_MS + GENERATE_LLM_FETCH_MS) >= 30_000,
    'not enough headroom between LLM budget and client abort for post-LLM work',
  );
});
