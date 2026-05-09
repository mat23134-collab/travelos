/** Normalize to DB format: lowercase [a-z0-9_] */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function validateUsernameShape(u: string): string | null {
  const n = normalizeUsername(u);
  if (n.length < 3) return 'Username must be at least 3 characters.';
  if (n.length > 24) return 'Username must be at most 24 characters.';
  if (!/^[a-z0-9_]+$/.test(n)) return 'Use only letters, numbers, and underscores.';
  return null;
}
