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

export const CARD = {
  base:     { background: THEME.surface,    border: `1px solid ${THEME.border}` },
  selected: { background: THEME.surfaceSel, border: `1px solid ${THEME.borderSel}` },
} as const;
