/**
 * videoBrief — turn a saved trip into a structured AI ad-script brief, and the
 * prompt that generates a shot-by-shot video script (AdCreative.ai style) with
 * an Indiana-Jones-style explorer who points and smiles in every scene.
 *
 * Uses the app's existing AI layer (Gemini JSON mode, Claude fallback) — no new
 * provider. The JSON output is the render config you feed to an image-to-video
 * API (Runway / Kling / Vids).
 */

import type { Itinerary, TravelerProfile, Activity } from '@/lib/types';

// ─── 1. Extract marketing data from a trip ──────────────────────────────────────

export interface MarketingBrief {
  destination: string;
  archetype: string; // "Family Adventure", "Romance", …
  attractions: { name: string; placeId: string | null; lat?: number; lng?: number }[];
  heroImageQuery: string;
}

/** groupType + groupDynamics.subType → a punchy marketing archetype. */
function toArchetype(p?: TravelerProfile | null): string {
  const sub = (p?.groupDynamics?.subType ?? '').toString();
  switch (p?.groupType) {
    case 'couple': return /honeymoon|romantic/i.test(sub) ? 'Romance' : 'Couple’s Escape';
    case 'family': return 'Family Adventure';
    case 'solo':   return /adventure|expedition/i.test(sub) ? 'Solo Expedition' : 'Solo Journey';
    case 'group':  return 'Squad Trip';
    default:       return 'Dream Trip';
  }
}

/** Keep real sightseeing; drop meals/dining slots. */
function isAttraction(a?: Activity): a is Activity {
  if (!a?.name) return false;
  return !(a.tags ?? []).some((t) => /dining|meal|restaurant|breakfast|lunch|dinner|reservation/i.test(t));
}

export function buildMarketingBrief(itin: Itinerary, profile?: TravelerProfile | null): MarketingBrief {
  const acts = (itin.days ?? [])
    .flatMap((d) => [d.morning, d.afternoon, d.evening])
    .filter(isAttraction);

  const seen = new Set<string>();
  const attractions = acts
    .filter((a) => { const k = a.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 5)
    .map((a) => ({ name: a.name, placeId: a.google_place_id ?? null, lat: a.latitude, lng: a.longitude }));

  return {
    destination: itin.destination,
    archetype: toArchetype(profile),
    attractions,
    heroImageQuery: `${itin.destination} skyline cinematic golden hour`,
  };
}

// ─── 2. The AI prompt (shot-by-shot ad brief) ───────────────────────────────────

export const DEFAULT_CHARACTER =
  'Indiana Jones-style explorer: fedora, weathered leather jacket, charismatic and adventurous, a friendly guide';

export const VIDEO_BRIEF_SYSTEM = `You are the creative director of a boutique travel ad studio, producing a 15–20 second VERTICAL (9:16) social ad in the polished, high-energy style of AdCreative.ai.

You receive a trip brief (destination, archetype, key attractions) and a CHARACTER brief. Return a shot-by-shot production script.

HARD RULES:
- 4–6 scenes, each 2.5–4s; total duration ≤ 20s.
- The character appears in EVERY scene as a friendly guide. In every scene he must POINT at the subject and SMILE — set "character.action" to a specific pointing gesture and "character.expression" to "warm smile".
- Scene 1 establishes the destination (character points at a globe/map). Middle scenes each spotlight ONE key attraction by name. The final scene is a CTA.
- Voiceover: punchy, second person, excited but tasteful, ≤ 12 words per scene.
- "imagePrompt" is a vivid text-to-image description (subject, lighting, camera) usable by an image model.
- "motion" describes camera/subject movement for an image-to-video model (e.g., "slow push-in with parallax").

Return ONLY JSON with this exact shape:
{
  "concept": string,
  "aspectRatio": "9:16",
  "durationSec": number,
  "musicMood": string,
  "cta": string,
  "scenes": [{
    "id": number,
    "durationSec": number,
    "attraction": string | null,
    "imagePrompt": string,
    "voiceover": string,
    "onScreenText": string,
    "character": { "action": string, "expression": string, "pose": string },
    "motion": string
  }]
}`;

export function buildVideoBriefUser(brief: MarketingBrief, character: string = DEFAULT_CHARACTER): string {
  return `TRIP BRIEF:
Destination: ${brief.destination}
Archetype/Theme: ${brief.archetype}
Key attractions: ${brief.attractions.map((a) => a.name).join(', ') || '(surprise the viewer with iconic spots)'}

CHARACTER: ${character}

Produce the vertical ad script now.`;
}

// ─── Output type + light validation ──────────────────────────────────────────

export interface VideoScene {
  id: number;
  durationSec: number;
  attraction: string | null;
  imagePrompt: string;
  voiceover: string;
  onScreenText: string;
  character: { action: string; expression: string; pose: string };
  motion: string;
}
export interface VideoScript {
  concept: string;
  aspectRatio: '9:16';
  durationSec: number;
  musicMood: string;
  cta: string;
  scenes: VideoScene[];
}

/** Returns the parsed script only if it has the required shape. */
export function parseVideoScript(raw: string): VideoScript | null {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    const j = JSON.parse(stripped);
    if (!Array.isArray(j?.scenes) || j.scenes.length === 0) return null;
    return j as VideoScript;
  } catch {
    return null;
  }
}
