// src/lib/assistantCards.ts
import type { PlaceRow, AssistantPlaceCard, AssistantRecommendation, SwapTarget } from './assistantTypes';
import { placeRowToActivity } from './placesQuery';

/** Resolve model recommendations against fetched rows into renderable cards.
 *  Drops unknown ids, preserves recommendation order, normalizes to exactly
 *  one top pick when any cards exist. */
export function buildCardsFromRecommendations(
  rows: PlaceRow[],
  recs: AssistantRecommendation[],
  target: SwapTarget,
): AssistantPlaceCard[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const cards: AssistantPlaceCard[] = [];
  let topAssigned = false;

  for (const rec of recs) {
    const row = byId.get(rec.placeId);
    if (!row) continue;
    const isTop = rec.isTopPick && !topAssigned;
    if (isTop) topAssigned = true;
    const activity = placeRowToActivity(row);
    activity.whyThis = rec.reasoning;
    cards.push({
      placeId: row.id,
      name: row.name,
      categoryEmoji: row.category_emoji,
      description: row.description,
      googleRating: row.google_rating,
      reasoning: rec.reasoning,
      isTopPick: isTop,
      activity,
      target,
    });
  }

  if (cards.length > 0 && !topAssigned) cards[0].isTopPick = true;
  return cards;
}
