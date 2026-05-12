/**
 * TravelOS logotype — uses Cormorant Garamond (see layout + `.font-brand`) for editorial / travel feel.
 */
export function BrandWordmark({
  accent,
  className = '',
}: {
  accent: string;
  className?: string;
}) {
  return (
    <span className={`font-brand ${className}`.trim()}>
      Travel<span style={{ color: accent }}>OS</span>
    </span>
  );
}
