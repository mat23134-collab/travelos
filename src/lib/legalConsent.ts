export const LEGAL_CONSENT_VERSION = '2026-05-terms-privacy-cookies-v1';
export const LEGAL_CONSENT_STORAGE_KEY = 'travelos_legal_consent_v1';

export interface LegalConsentRecord {
  version: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  essentialCookies: boolean;
  preferencesCookies: boolean;
  analyticsCookies: boolean;
  acceptedAt: string;
}

export function getStoredLegalConsent(): LegalConsentRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LEGAL_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LegalConsentRecord>;
    if (
      parsed.version !== LEGAL_CONSENT_VERSION ||
      parsed.acceptedTerms !== true ||
      parsed.acceptedPrivacy !== true ||
      parsed.essentialCookies !== true
    ) {
      return null;
    }
    return parsed as LegalConsentRecord;
  } catch {
    return null;
  }
}

export function hasRequiredLegalConsent(): boolean {
  return getStoredLegalConsent() != null;
}

export function buildLegalConsentRecord(options?: {
  preferencesCookies?: boolean;
  analyticsCookies?: boolean;
}): LegalConsentRecord {
  return {
    version: LEGAL_CONSENT_VERSION,
    acceptedTerms: true,
    acceptedPrivacy: true,
    essentialCookies: true,
    preferencesCookies: options?.preferencesCookies ?? true,
    analyticsCookies: options?.analyticsCookies ?? false,
    acceptedAt: new Date().toISOString(),
  };
}

export function storeLegalConsent(record: LegalConsentRecord) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LEGAL_CONSENT_STORAGE_KEY, JSON.stringify(record));
  window.dispatchEvent(new CustomEvent('travelos:legal-consent-updated', { detail: record }));
}

export function requestLegalConsent() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('travelos:legal-consent-required'));
}
