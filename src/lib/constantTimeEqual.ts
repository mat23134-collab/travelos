/**
 * constantTimeEqual — length-independent, content-constant-time string compare.
 *
 * Node's `crypto.timingSafeEqual` isn't available on the Edge runtime (and
 * throws on length mismatch), and these helpers run in both Node route handlers
 * and Edge-capable server code. This folds every byte into a single accumulator
 * so the loop's duration doesn't depend on WHERE the first differing byte is —
 * closing the timing side-channel that `===`/`!==` opens on secrets and tokens.
 *
 * The length difference is folded in too, so callers don't leak length via an
 * early return. (Timing still varies with the LONGER input's length, which is
 * not secret-dependent here.)
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}
