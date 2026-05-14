/**
 * Wall-clock budgets for itinerary generation — must stay aligned with the
 * client AbortController on `src/app/plan/page.tsx` (same millisecond cap).
 *
 * Strategy: cap parallel prefetch + single LLM call + post-processing headroom;
 * do not change model names / token ceilings here (quality stays in env + prompts).
 */
export const GENERATE_WALL_CLOCK_MS = 90_000;

/** Max wait for each parallel prefetch branch (places DB + web RAG + hotel snippets). */
export const GENERATE_PREFETCH_PER_BRANCH_MS = 14_000;

/** Single-provider LLM HTTP budget (Gemini fetch or Anthropic SDK). */
export const GENERATE_LLM_FETCH_MS = 76_000;

/** LLM retries on 429/529 only — keep low to preserve wall-clock budget. */
export const GENERATE_LLM_MAX_ATTEMPTS = 2;
