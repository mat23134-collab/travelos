import { withSentryConfig } from '@sentry/nextjs';
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
  // @react-pdf/renderer v3 ships CJS that Next.js can't tree-shake cleanly —
  // transpiling it avoids "Cannot find module 'canvas'" and similar runtime
  // crashes when the PDF is generated client-side.
  transpilePackages: ['@react-pdf/renderer'],
  webpack(config, { isServer }) {
    if (!isServer) {
      // @react-pdf/renderer pulls in canvas as an optional dep; the browser
      // doesn't have it, so alias it to false to prevent bundler errors.
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'images.pexels.com' },
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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "sarto-te",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
