/**
 * onboardingTheme — single source of design tokens for the onboarding wizard.
 * Quiet-luxury palette: warm gold accent on ivory, deep-green text.
 * Every onboarding section imports from here; no section defines its own
 * color constants.
 */
export const THEME = {
  gold:       '#c4a26a',                    // accent: selected borders, progress fill
  goldSoft:   'rgba(196,162,106,0.35)',     // faint accent (chevrons, dividers)
  ink:        '#1f2421',                    // CTA buttons, strongest text
  deepGreen:  '#0d2b27',                    // headlines
  textBody:   '#1a4a44',                    // card option titles
  textMuted:  '#3a7068',                    // sub-labels, secondary copy
  textFaint:  '#5a908a',                    // hints, tertiary copy
  ivory:      '#FDFCF9',                    // page background
  surface:    '#FFFFFF',                    // unselected card background
  surfaceSel: '#FAF6EE',                    // selected card background
  border:     '#E8E5DC',                    // unselected card border (1px)
  borderSel:  '#c4a26a',                    // selected card border (1px)
} as const;

/**
 * Full-bleed backdrop veil — laid over the fixed destination photo so the
 * page keeps depth (the airy teal wash + real photo show through up top)
 * while settling to ivory where the form sits, keeping content readable.
 */
export const BACKDROP_VEIL =
  'linear-gradient(to bottom,' +
  ' rgba(199,222,219,0.58) 0%,' +   // airy eucalyptus/teal wash over the photo
  ' rgba(205,225,221,0.46) 26%,' +  // thins out — photo reads through for depth
  ' rgba(247,246,241,0.93) 60%,' +  // settles toward ivory for the form
  ' rgba(253,252,249,1) 100%)';     // pure ivory ground at the bottom

export const CARD = {
  // Soft lift so opaque cards float above the photo backdrop (restores depth).
  base: {
    background: THEME.surface,
    border: `1px solid ${THEME.border}`,
    boxShadow: '0 1px 2px rgba(13,43,39,0.04), 0 10px 26px -18px rgba(13,43,39,0.22)',
  },
  selected: {
    background: THEME.surfaceSel,
    border: `1px solid ${THEME.borderSel}`,
    boxShadow: '0 2px 6px rgba(196,162,106,0.12), 0 12px 30px -18px rgba(13,43,39,0.26)',
  },
} as const;
