<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: Sarto Tours (TravelOS)

This repo is the production web app for Sarto Tours (sarto.tours) — live and in active use. See [ROADMAP.md](ROADMAP.md) for the mobile app build plan (PWA → Capacitor → React Native). Phase 1 (PWA) is shipped; Phase 2 (Capacitor) is next.

**What never changes** (across all mobile phases, and as a general rule): Supabase database/RLS/data, the AI itinerary generation API and prompts, all server-side API routes, existing user auth, and affiliate integrations (Booking.com). Don't touch these casually.

## Deploy is push-triggered — be careful with git

`deploy.bat` runs `git add .` then `git commit` and `git push`, and **Railway auto-deploys from GitHub on push**. This means:
- Any `git push` to the tracked branch ships straight to production. There is no separate staging/approval step.
- `git add .` stages *everything* untracked at the time, not just what you're working on — so uncommitted work-in-progress sitting in the tree can get swept into a deploy unintentionally.
- Don't commit or push changes to live app code/behavior unless the user explicitly asks you to ship them. Default to leaving functional changes uncommitted and asking first.

## Non-code files in this repo

Business/marketing documents (reports, decks, competitive analysis, content calendars) and `daily-check-*.md` health-check logs live in the working directory but are gitignored — they're reference material, not part of the app, and shouldn't ship to GitHub/production.
