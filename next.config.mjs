/** Unique-ish id per build (git on CI, timestamp token locally). */
const gitSha =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_REF ||
  '';

const NEXT_PUBLIC_BUILD_ID = gitSha ? gitSha.slice(0, 7) : `local-${Date.now().toString(36)}`;
const NEXT_PUBLIC_BUILT_AT = new Date().toISOString();

// ── Security headers applied to every response ────────────────────────────────
const securityHeaders = [
  // Prevent the page from being embedded in an iframe (clickjacking protection)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop browsers from MIME-sniffing the content-type (e.g. treating a .txt as JS)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Only send the origin in the Referer header — never the full URL path
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Force HTTPS for 1 year; include subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Restrict access to sensitive browser features
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=()',
  },
  // Basic XSS protection for older browsers (modern ones use CSP instead)
  { key: 'X-XSS-Protection', value: '1; mode=block' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID,
    NEXT_PUBLIC_BUILT_AT,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
  async headers() {
    return [
      {
        // Apply to every route
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
