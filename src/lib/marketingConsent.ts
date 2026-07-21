/**
 * marketingConsent — shared constants for the marketing (promotional-email)
 * opt-in, kept entirely separate from legalConsent.ts (Terms/Privacy/Cookies).
 *
 * Israel's Communications Law (Bezeq and Broadcasts) Amendment §30א ("the
 * anti-spam law") requires PRIOR, EXPLICIT, FREELY-GIVEN consent — specific to
 * marketing, never bundled with a site's Terms/Cookie acceptance — before
 * sending advertising by email/SMS/fax/auto-dialer, and the sender must be
 * able to PROVE consent was given and honor withdrawal immediately. That's why
 * this is its own flow with its own version/audit trail (see
 * /api/marketing-consent + public.marketing_consents), not a checkbox folded
 * into the required legal banner.
 *
 * LEGAL NOTE: the copy below is a compliance-minded DRAFT reflecting the
 * anti-spam law's known requirements (specific, opt-in, revocable, unbundled).
 * It is not a substitute for review by qualified counsel before this ships to
 * production — in particular, any actual marketing SEND must also carry the
 * sender's identifying details and a one-click unsubscribe in the message
 * itself, which is a separate build (no send pipeline exists yet; this only
 * captures and records the opt-in/opt-out decision).
 */

// Bump this if the consent copy's meaning changes materially — same pattern as
// LEGAL_CONSENT_VERSION. A version bump does NOT retroactively invalidate past
// answers (marketing consent has no forced re-prompt-on-every-change like the
// required Terms banner does); it only labels which wording a given consent
// row was collected under, for audit purposes.
export const MARKETING_CONSENT_VERSION = '2026-07-marketing-email-v1';

export type MarketingConsentSource = 'signup' | 'dashboard_prompt' | 'settings';

export const MARKETING_CONSENT_COPY = {
  he: {
    title: 'לקבל טיפים והצעות?',
    body: 'נשמח לשלוח לכם מדי פעם רעיונות לטיולים, טיפים ומבצעים באימייל. זה לגמרי אופציונלי ולא משפיע על השימוש באתר — ותמיד אפשר לבטל בלחיצה אחת.',
    yes: 'כן, שלחו לי',
    no: 'לא תודה',
  },
  en: {
    title: 'Want trip ideas and offers?',
    body: 'We’d love to occasionally email you trip ideas, tips, and offers. Totally optional, doesn’t affect using the site — and you can unsubscribe anytime with one click.',
    yes: 'Yes, send them',
    no: 'No thanks',
  },
} as const;
