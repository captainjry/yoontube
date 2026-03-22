# Yoontube

Private media gallery for streaming Google Drive-hosted videos and photos through a proper web UI. Built for a small group of friends who need 4K MP4 playback, fast browsing, and a YouTube-like experience that Google Drive can't provide.

## Architecture

Single Next.js 15 app on Vercel with two external services:

- **Supabase** — Postgres database for media metadata, folder structure, and thumbnail storage
- **Google Drive API** — source of truth for files, called during sync and streaming

No long-running backend server. The V1 Fastify backend and Oracle VM deployment have been replaced.

## Tech Stack

- Next.js 15 (App Router, server components, route handlers)
- Tailwind CSS v4 + shadcn/ui
- Vidstack (video player)
- Supabase (Postgres + Storage)
- Google Drive API (googleapis)
- TypeScript
- GitHub Actions (sync + keepalive)

## Setup

1. Create a Supabase project and run the migration in `supabase/migrations/001_initial_schema.sql`
2. Create a public storage bucket called `thumbnails` in Supabase
3. Copy `web/.env.local.example` to `web/.env.local` and fill in the values
4. Install dependencies: `cd web && npm install`
5. Run dev server: `npm run dev`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (sync only) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Drive service account email |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Google Drive service account private key |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Root folder ID in Google Drive |
| `SHARED_PASSWORD` | Password for login |
| `SESSION_SECRET` | Secret for signing session cookies (32+ chars) |

## Sync

Media metadata is synced from Google Drive to Supabase via a GitHub Actions workflow:

1. Go to Actions tab → "Sync Drive to Supabase" → "Run workflow"
2. The workflow crawls Drive, upserts folders/media into Supabase, and uploads thumbnails to Supabase Storage
3. A separate keepalive workflow pings Supabase every 3 days to prevent free-tier pausing

## Deployment

- **Frontend**: Vercel (hobby tier) — deploy from GitHub
- **Database**: Supabase (free tier) — 500 MB Postgres, 1 GB storage
- **Sync**: GitHub Actions — manual trigger via `workflow_dispatch`
