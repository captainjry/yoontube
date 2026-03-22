# Yoontube Redesign Spec

## Problem

Google Drive is a bad media player. It can't process 4K MP4 footage, browsing photos and videos is clunky, and there's no YouTube-like viewing experience. Yoontube is a private media gallery for a small group of friends that solves this by streaming Drive-hosted media through a proper web UI.

## Goals

- Play 4K MP4 (H.264) videos that Google Drive can't process. H.265/HEVC has limited browser support (Safari only) — show a warning for H.265 files with a download fallback
- YouTube-like video player with full controls, keyboard shortcuts, PiP, speed control
- Photo gallery alongside video library
- Search, sort, and filter across 2000+ files organized in folders
- Fast browsing — no sluggish page loads, slow thumbnails, or buffering
- Zero server management, free hosting

## Architecture

Single Next.js 15 app on Vercel with two external services:

- **Supabase** (free tier) — Postgres database for media metadata, folder structure, thumbnail URLs
- **Google Drive API** — source of truth for files, called during sync and streaming

No long-running backend server. No VM. No JSON file index.

### Request Flow

- **Page load**: Next.js server components query Supabase directly, render pages with media grid
- **Video playback**: Next.js API route authenticates with Drive API, proxies byte-range stream to browser
- **Search/filter/sort**: Supabase SQL queries with indexes
- **Sync**: Manually triggered GitHub Action crawls Drive, upserts metadata into Supabase

## Tech Stack

- **Next.js 15** (App Router, server components, route handlers)
- **Tailwind CSS v4** + **shadcn/ui**
- **Vidstack** (video player)
- **Supabase** (Postgres + JS client)
- **Google Drive API** (googleapis)
- **TypeScript**
- **GitHub Actions** (manual sync trigger)

## Database Schema (Supabase)

### `folders`

| Column      | Type      | Notes                                  |
|-------------|-----------|----------------------------------------|
| `id`        | text (PK) | Google Drive folder ID                 |
| `name`      | text      |                                        |
| `parent_id` | text (FK) | Self-referencing, null for root        |
| `path`      | text      | Full path e.g. `"Trips/Japan 2024"`   |
| `synced_at` | timestamp |                                        |

### `media`

| Column          | Type      | Notes                            |
|-----------------|-----------|----------------------------------|
| `id`            | text (PK) | Google Drive file ID             |
| `name`          | text      |                                  |
| `folder_id`     | text (FK) | References `folders.id`          |
| `mime_type`     | text      |                                  |
| `type`          | text      | `video` or `photo`               |
| `size`          | bigint    | Bytes                            |
| `thumbnail_url` | text      | Drive thumbnail link             |
| `duration`      | integer   | Video duration in ms (from Drive, null if unavailable) |
| `created_at`    | timestamp | File creation time from Drive    |
| `synced_at`     | timestamp |                                  |

### Indexes

- `media.folder_id`
- `media.type`
- `media.name`
- `media.created_at`

## Pages

| Route               | Purpose                                              |
|----------------------|------------------------------------------------------|
| `/login`             | Shared password gate                                 |
| `/`                  | Home feed — recent media, filter tabs (All/Videos/Photos) |
| `/folders/[...path]` | Folder browser with breadcrumbs, subfolders, media grid |
| `/watch/[id]`        | YouTube-like video player page                       |
| `/photo/[id]`        | Photo viewer page                                    |
| `/search`            | Search results page                                  |

## Video Player (Vidstack)

- YouTube-style UI: progress bar, volume, fullscreen, time display
- Speed control (0.5x–2x)
- Skip forward/back 10s
- Keyboard shortcuts (space, arrows, f for fullscreen, m for mute)
- Picture-in-picture
- Buffering indicator
- Resume playback (position stored in localStorage)

## Search

- Search bar in top nav, always accessible
- Searches file names across all folders via Supabase full-text or `ILIKE`
- Results grouped by type (videos first, then photos)

## Sorting & Filtering

- Sort by: name, date, size
- Filter by: type (video/photo)
- Applied per-folder and on search results

## Streaming

All videos are streamed through a single proxy — no Drive player fallback, no detection logic. One code path for simplicity.

Next.js API route at `/api/stream/[id]`:

1. Validate session (shared password)
2. Authenticate with Google Drive API using service account
3. Request file with byte-range headers from Drive
4. Proxy response to browser with correct `Content-Range` / `Content-Length` headers
5. Browser's native video decoder handles MP4 H.264

Byte-range support enables seeking without downloading the entire file.

### Vercel Timeout Mitigation

Vercel Hobby tier has a 10-second function timeout. The largest videos are 1-2 GB (~65 files), and each byte-range chunk is ~1-2 MB — well within the 10-second limit per request. The browser's video player makes sequential range requests, each as a separate function invocation. If a request times out, the player retries automatically. Monitor in production — if timeouts are frequent, evaluate Vercel Pro (60s timeout).

## Thumbnails

Drive thumbnail URLs are short-lived (expire within hours). Two-layer approach:

- **During sync**: Download Drive thumbnails and upload to Supabase Storage (free: 1 GB). Store the permanent Supabase Storage URL in the `thumbnail_url` column.
- **Frontend**: Load via `next/image` with lazy loading and blur placeholder
- **Fallback**: Placeholder image if thumbnail is missing or failed to download

## Sync (GitHub Actions)

Manually triggered workflow (`workflow_dispatch`):

1. Recursively list all folders under root Drive folder, upsert into `folders` table with computed `path`
2. For each folder, list files filtered to video/photo mime types
3. Upsert into `media` table. For each file, download Drive thumbnail and upload to Supabase Storage, storing the permanent URL. (~50-100 KB per thumbnail, ~100-200 MB for 2000 files, well within 1 GB free tier)
4. Delete records from Supabase whose Drive files no longer exist
5. Update `synced_at` timestamps

Triggered via GitHub repo Actions tab → "Run workflow" when new media is uploaded to Drive.

Service account credentials stored as GitHub repository secrets.

## Performance Strategy

| Problem              | Solution                                                    |
|----------------------|-------------------------------------------------------------|
| Slow page loads      | Server components query Supabase directly, no API hop       |
| Rendering 2000+ items | Paginate — 20–30 items per page, infinite scroll           |
| Slow video start     | Byte-range proxy, Vercel edge network closer to users       |
| Sluggish navigation  | Client-side navigation, `loading.tsx` skeletons             |
| Slow thumbnails      | Supabase Storage URLs, `next/image` lazy loading            |
| JSON blob in memory  | Replaced by indexed Supabase queries                        |

## Error Handling

- **Unsupported codec (H.265)**: H.264 and H.265 share the same `video/mp4` MIME type, so detection relies on Drive's `videoMediaMetadata` codec field when available, or client-side detection (if the `<video>` element fires an error, show the fallback). UI shows warning with download button as fallback.
- **Stream proxy failure**: Video player shows error state with retry button. If persistent, offer direct Drive link.
- **Drive API rate limit**: Sync job implements exponential backoff. Streaming route returns 503 with retry-after header.
- **Stale data**: If a file was deleted from Drive but exists in Supabase, the stream route returns 404 and the UI removes the item.

## Auth

Shared password. Session cookie contains a signed token (not the raw password), validated by Next.js middleware. Simple and sufficient for a small private group.

## Migration

This is a greenfield rewrite. The existing `backend/` and `web/` directories from V1 will be archived or removed. No data migration needed — the sync job will populate Supabase fresh from Google Drive. The Oracle VM deployment is decommissioned.

## Deployment

- **Frontend**: Vercel (hobby tier, free) — deploy from GitHub
- **Database**: Supabase (free tier) — 500 MB Postgres, 1 GB storage. Free tier pauses after 7 days of inactivity — add a scheduled GitHub Action that runs a lightweight Supabase query every 3 days to prevent this
- **Sync**: GitHub Actions (free for public repos, 2000 min/month private)
- **Domain**: Optional custom domain on Vercel

## Sync Status

Last synced timestamp displayed in the UI (queried from Supabase `synced_at`) so users know if the index is current.
