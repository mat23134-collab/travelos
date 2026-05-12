/** Unique-ish id per build (git on CI, timestamp token locally). */
const gitSha =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_REF ||
  '';

const NEXT_PUBLIC_BUILD_ID = gitSha ? gitSha.slice(0, 7) : `local-${Date.now().toString(36)}`;
const NEXT_PUBLIC_BUILT_AT = new Date().toISOString();

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
};

export default nextConfig;
