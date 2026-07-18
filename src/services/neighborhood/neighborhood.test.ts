// src/services/neighborhood/neighborhood.test.ts
// Run: npx tsx src/services/neighborhood/neighborhood.test.ts
import assert from 'node:assert/strict';
import { safeParseJsonObject } from './geminiOrchestrator';
import { computeMatchPercent } from './spatialProfiler';
import type { AnchorNeighborhood } from './types';

// ── safe JSON parsing strips Markdown fences / surrounding prose ──────────────
{
  const fenced = '```json\n{ "a": 1, "b": "x" }\n```';
  assert.deepEqual(safeParseJsonObject(fenced), { a: 1, b: 'x' }, 'strips ```json fences');

  const bare = '{ "hook": "שלום" }';
  assert.deepEqual(safeParseJsonObject(bare), { hook: 'שלום' }, 'parses bare object');

  const prose = 'Sure! Here is the JSON:\n```\n{ "k": [1,2] }\n```\nHope it helps.';
  assert.deepEqual(safeParseJsonObject(prose), { k: [1, 2] }, 'grabs object out of prose');

  assert.equal(safeParseJsonObject('not json at all'), null, 'unparseable → null');
  assert.equal(safeParseJsonObject('```json\n{ bad json }\n```'), null, 'invalid json → null');
}

// ── match percent: coverage + interest overlap, clamped 70..99 ────────────────
{
  const n = (matched: number, total: number): AnchorNeighborhood => ({
    id: 'x', nameEnglish: 'Trastevere', nameHebrew: 'טרסטוורה', matched, total,
    centroid: { lat: 41.88, lng: 12.47 }, boundaryGeoJson: null,
  });

  const tight = computeMatchPercent(n(4, 4), [{ name: 'a', lat: 0, lng: 0, category: 'food' }], ['food']);
  const loose = computeMatchPercent(n(1, 4), [{ name: 'a', lat: 0, lng: 0, category: 'museum' }], ['food']);
  assert.ok(tight > loose, `tighter+on-interest(${tight}) beats loose+off(${loose})`);
  assert.ok(tight <= 99 && loose >= 70, 'clamped to [70,99]');
}

console.log('✓ neighborhood profiler tests passed');
