'use client';

import { VerificationStatus, verificationBadgeLabel } from '@/lib/verification';

interface VerificationBadgeProps {
  status?: VerificationStatus;
  verifiedAt?: string;
  className?: string;
}

const BADGE_STYLES: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  'verified-open':      { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.30)',  text: '#4ade80', glow: 'rgba(34,197,94,0.15)' },
  'flagged-closed':     { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.35)',  text: '#f87171', glow: 'rgba(239,68,68,0.18)' },
  'flagged-renovating': { bg: 'rgba(234,179,8,0.10)',  border: 'rgba(234,179,8,0.30)',  text: '#facc15', glow: 'rgba(234,179,8,0.15)' },
};

export function VerificationBadge({ status, verifiedAt, className = '' }: VerificationBadgeProps) {
  const label = verificationBadgeLabel(status, verifiedAt);
  if (!label || !status) return null;

  const styles = BADGE_STYLES[status];
  if (!styles) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded-md leading-none ${className}`}
      style={{
        background:   styles.bg,
        border:       `1px solid ${styles.border}`,
        color:        styles.text,
        boxShadow:    `0 0 6px ${styles.glow}`,
        whiteSpace:   'nowrap',
      }}
      title={status === 'verified-open' ? `Status verified via Exa live search on ${verifiedAt ? new Date(verifiedAt).toLocaleDateString() : 'today'}` : undefined}
    >
      {label}
    </span>
  );
}
