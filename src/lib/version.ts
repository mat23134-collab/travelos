/**
 * Semantic app version — bump this when you ship a meaningful release.
 * Every `next build` / dev server start also gets NEXT_PUBLIC_BUILD_ID + BUILT_AT
 * from next.config.mjs (git short SHA on Vercel/Railway/GitHub Actions, else a local token).
 */
export const APP_VERSION = 'v1.10.26';

const buildId = process.env.NEXT_PUBLIC_BUILD_ID ?? '';
const builtAt = process.env.NEXT_PUBLIC_BUILT_AT ?? '';

/** Corner stamp: version · commit (or local token) · build date */
export const VERSION_LABEL = [
  APP_VERSION,
  buildId || undefined,
  builtAt ? builtAt.slice(0, 10) : undefined,
].filter(Boolean).join(' · ');
