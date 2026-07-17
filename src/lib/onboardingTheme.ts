/**
 * onboardingTheme — single source of design tokens for the onboarding wizard.
 *
 * Editorial Warmth palette (2026-06): aligned with the results-page glow-up.
 * Warm paper surfaces, sunrise-gold accent, warm near-black ink — mirrors the
 * `--color-paper` / `--color-sunrise` / `--color-ink-warm` tokens in
 * globals.css. Every onboarding section imports from here; no section defines
 * its own color constants, so this file recolors the whole wizard at once.
 */
export const THEME = {
  gold:       '#b8772e',                    // accent: selected borders, progress fill (sunrise-deep)
  goldSoft:   'rgba(184,119,46,0.45)',      // faint accent (chevrons, dividers)
  ink:        '#2b2622',                    // CTA buttons, strongest text (warm near-black)
  deepGreen:  '#2b2622',                    // headlines (ink-warm)
  textBody:   '#2b2622',                    // card option titles
  textMuted:  '#6b6358',                    // sub-labels, secondary copy (ink-warm-mut)
  textFaint:  '#9a8f7e',                    // hints, tertiary copy (warm faint)
  ivory:      '#efe3cd',                    // page background (warm paper)
  surface:    '#fffdf7',                    // unselected card background (warm white)
  surfaceSel: '#f6ead2',                    // selected card background (sunrise-tinted)
  border:     'rgba(43,38,34,0.12)',        // unselected card border (warm ink, faint)
  borderSel:  '#b8772e',                    // selected card border (sunrise-deep)
} as const;

/**
 * Full-bleed backdrop veil — laid over the fixed destination photo so the
 * page keeps depth (a warm paper wash + real photo show through up top) while
 * settling to paper where the form sits, keeping content readable.
 */
export const BACKDROP_VEIL =
  'linear-gradient(to bottom,' +
  ' rgba(247,241,231,0.55) 0%,' +   // warm paper wash over the photo
  ' rgba(243,236,221,0.60) 26%,' +  // thins out — photo reads through for depth
  ' rgba(243,236,221,0.94) 60%,' +  // settles toward paper for the form
  ' rgba(239,227,205,1) 100%)';     // warm paper ground at the bottom

export const CARD = {
  // Soft lift so opaque cards float above the photo backdrop (restores depth).
  base: {
    background: THEME.surface,
    border: `1px solid ${THEME.border}`,
    boxShadow: '0 1px 2px rgba(43,38,34,0.05), 0 10px 26px -18px rgba(43,38,34,0.20)',
  },
  selected: {
    background: THEME.surfaceSel,
    border: `1px solid ${THEME.borderSel}`,
    boxShadow: '0 2px 6px rgba(184,119,46,0.14), 0 12px 30px -18px rgba(43,38,34,0.24)',
  },
} as const;
