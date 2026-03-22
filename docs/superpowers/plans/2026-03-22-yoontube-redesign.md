# Yoontube V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite Yoontube as a single Next.js 15 app backed by Supabase, replacing the Fastify backend and JSON index with Postgres queries, Vidstack video player, and shadcn/ui.

**Architecture:** Next.js 15 App Router with server components querying Supabase directly. Video streaming via API route that proxies Google Drive byte-range requests. Sync via GitHub Actions that crawls Drive and upserts into Supabase. Auth via shared password with signed session cookie.

**Tech Stack:** Next.js 15, Tailwind CSS v4, shadcn/ui, Vidstack, Supabase (Postgres + Storage), Google Drive API (googleapis), TypeScript, Vitest, GitHub Actions

---

## File Structure

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    — Root layout with nav, search bar
│   │   ├── page.tsx                      — Home feed (recent media, filter tabs)
│   │   ├── loading.tsx                   — Skeleton for home
│   │   ├── globals.css                   — Tailwind v4 imports + custom vars
│   │   ├── login/
│   │   │   ├── page.tsx                  — Login form
│   │   │   └── actions.ts               — Server action: verify password, set cookie
│   │   ├── folders/
│   │   │   ├── page.tsx                  — Root folder listing
│   │   │   └── [...path]/
│   │   │       ├── page.tsx              — Nested folder view
│   │   │       └── loading.tsx           — Skeleton
│   │   ├── watch/
│   │   │   └── [id]/
│   │   │       └── page.tsx              — Video player page
│   │   ├── photo/
│   │   │   └── [id]/
│   │   │       └── page.tsx              — Photo viewer page
│   │   ├── search/
│   │   │   └── page.tsx                  — Search results
│   │   └── api/
│   │       └── stream/
│   │           └── [id]/
│   │               └── route.ts          — Drive byte-range proxy
│   ├── components/
│   │   ├── ui/                           — shadcn/ui components (auto-generated)
│   │   ├── nav-bar.tsx                   — Top nav with search + sync status
│   │   ├── search-bar.tsx                — Search input
│   │   ├── media-grid.tsx                — Paginated media grid with infinite scroll
│   │   ├── media-card.tsx                — Thumbnail card for video/photo
│   │   ├── filter-tabs.tsx               — All/Videos/Photos tabs
│   │   ├── sort-select.tsx               — Sort dropdown (name/date/size)
│   │   ├── folder-card.tsx               — Folder thumbnail in grid
│   │   ├── breadcrumbs.tsx               — Folder breadcrumb nav
│   │   ├── video-player.tsx              — Vidstack player wrapper
│   │   ├── photo-viewer.tsx              — Full photo viewer
│   │   └── load-more-button.tsx          — Pagination load-more button
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts                 — createClient() for server components
│   │   │   ├── client.ts                 — createBrowserClient() for client components
│   │   │   └── types.ts                  — Generated DB types
│   │   ├── drive.ts                      — Google Drive API client (service account)
│   │   ├── auth.ts                       — Password verification, cookie helpers
│   │   ├── format.ts                     — Shared formatting utilities (duration, size)
│   │   └── constants.ts                  — Shared constants
│   └── middleware.ts                     — Session cookie check, redirect to /login
├── .env.local
├── next.config.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts

.github/
└── workflows/
    ├── sync.yml                          — Manual sync: crawl Drive → upsert Supabase
    └── keepalive.yml                     — Scheduled ping to prevent Supabase pause

supabase/
└── migrations/
    └── 001_initial_schema.sql            — folders + media tables, indexes
```

---

## Task 1: Project Scaffolding & Dependencies

**Files:**
- Modify: `web/package.json`
- Create: `web/vitest.config.ts`
- Modify: `web/next.config.ts`
- Modify: `web/tsconfig.json`
- Modify: `web/src/app/globals.css`

This task removes the V1 backend dependency, installs V2 dependencies, and configures the project.

- [ ] **Step 1: Install V2 dependencies**

```bash
cd web
npm install @supabase/ssr @supabase/supabase-js googleapis @vidstack/react
npm install -D supabase
```

- [ ] **Step 2: Initialize shadcn/ui**

```bash
cd web
npx shadcn@latest init
```

Select: New York style, default color, CSS variables. This creates `components/ui/` and updates `globals.css` and `tsconfig.json` with the `@/` alias.

- [ ] **Step 3: Add shadcn/ui components needed across the app**

```bash
cd web
npx shadcn@latest add button card input tabs select breadcrumb skeleton badge
```

- [ ] **Step 4: Update `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 5: Create vitest config**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 6: Create `.env.local` template**

Create `web/.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
SHARED_PASSWORD=
SESSION_SECRET=
```

- [ ] **Step 7: Verify build**

```bash
cd web && npm run build
```

Expected: Build succeeds (pages may be empty but no config errors).

- [ ] **Step 8: Commit**

```bash
git add web/package.json web/package-lock.json web/vitest.config.ts web/next.config.ts web/src/app/globals.css web/tsconfig.json web/src/components/ui/ web/.env.local.example web/components.json
git commit -m "chore: scaffold V2 dependencies — supabase, vidstack, shadcn/ui"
```

---

## Task 2: Supabase Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/001_initial_schema.sql

-- Folders table
create table folders (
  id text primary key,              -- Google Drive folder ID
  name text not null,
  parent_id text references folders(id) on delete cascade,
  path text not null,               -- e.g. "Trips/Japan 2024"
  synced_at timestamptz not null default now()
);

create index idx_folders_parent_id on folders(parent_id);

-- Media table
create table media (
  id text primary key,              -- Google Drive file ID
  name text not null,
  folder_id text references folders(id) on delete set null,
  mime_type text not null,
  type text not null check (type in ('video', 'photo')),
  size bigint,
  thumbnail_url text,
  duration integer,                 -- milliseconds, null if unavailable
  created_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index idx_media_folder_id on media(folder_id);
create index idx_media_type on media(type);
create index idx_media_name on media(name);
create index idx_media_created_at on media(created_at desc);

-- Full-text search on media name
create index idx_media_name_trgm on media using gin (name gin_trgm_ops);
```

Note: The trigram index requires `CREATE EXTENSION IF NOT EXISTS pg_trgm;` — run this in the Supabase SQL editor first (it's enabled by default on Supabase).

- [ ] **Step 2: Apply migration via Supabase dashboard**

Run the SQL above in Supabase SQL Editor. Verify tables exist:

```sql
select count(*) from folders;
select count(*) from media;
```

Expected: Both return 0 rows, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase schema — folders and media tables with indexes"
```

---

## Task 3: Supabase Client Setup & Types

**Files:**
- Create: `web/src/lib/supabase/server.ts`
- Create: `web/src/lib/supabase/client.ts`
- Create: `web/src/lib/supabase/types.ts`
- Create: `web/src/lib/constants.ts`

- [ ] **Step 1: Generate Supabase types**

```bash
cd web
npx supabase gen types typescript --project-id <your-project-id> > src/lib/supabase/types.ts
```

If you don't have the CLI linked yet, create a minimal types file:

```typescript
// src/lib/supabase/types.ts
export type Database = {
  public: {
    Tables: {
      folders: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          path: string
          synced_at: string
        }
        Insert: {
          id: string
          name: string
          parent_id?: string | null
          path: string
          synced_at?: string
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          path?: string
          synced_at?: string
        }
      }
      media: {
        Row: {
          id: string
          name: string
          folder_id: string | null
          mime_type: string
          type: 'video' | 'photo'
          size: number | null
          thumbnail_url: string | null
          duration: number | null
          created_at: string
          synced_at: string
        }
        Insert: {
          id: string
          name: string
          folder_id?: string | null
          mime_type: string
          type: 'video' | 'photo'
          size?: number | null
          thumbnail_url?: string | null
          duration?: number | null
          created_at?: string
          synced_at?: string
        }
        Update: {
          id?: string
          name?: string
          folder_id?: string | null
          mime_type?: string
          type?: 'video' | 'photo'
          size?: number | null
          thumbnail_url?: string | null
          duration?: number | null
          created_at?: string
          synced_at?: string
        }
      }
    }
  }
}

export type Folder = Database['public']['Tables']['folders']['Row']
export type Media = Database['public']['Tables']['media']['Row']
```

- [ ] **Step 2: Create server client**

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — safe to ignore with middleware refresh
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create browser client**

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

- [ ] **Step 4: Create constants**

```typescript
// src/lib/constants.ts
export const SESSION_COOKIE_NAME = 'yoontube-session'
export const ITEMS_PER_PAGE = 30
```

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/supabase/ web/src/lib/constants.ts
git commit -m "feat: add Supabase client setup and database types"
```

---

## Task 4: Auth — Shared Password & Middleware

**Files:**
- Create: `web/src/lib/auth.ts`
- Create: `web/src/lib/auth.test.ts`
- Modify: `web/src/middleware.ts`
- Modify: `web/src/app/login/page.tsx`
- Modify: `web/src/app/login/actions.ts`

- [ ] **Step 1: Write auth utility tests**

```typescript
// src/lib/auth.test.ts
import { describe, it, expect } from 'vitest'
import { createSessionToken, verifySessionToken } from './auth'

describe('auth', () => {
  const secret = 'test-secret-at-least-32-chars-long!'

  it('creates a verifiable session token', () => {
    const token = createSessionToken(secret)
    expect(verifySessionToken(token, secret)).toBe(true)
  })

  it('rejects a tampered token', () => {
    expect(verifySessionToken('garbage', secret)).toBe(false)
  })

  it('rejects empty token', () => {
    expect(verifySessionToken('', secret)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npx vitest run src/lib/auth.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement auth utilities**

```typescript
// src/lib/auth.ts
import { createHmac, timingSafeEqual } from 'crypto'
import { SESSION_COOKIE_NAME } from './constants'

const PAYLOAD = 'yoontube-authenticated'

export function createSessionToken(secret: string): string {
  const hmac = createHmac('sha256', secret)
  hmac.update(PAYLOAD)
  return hmac.digest('hex')
}

export function verifySessionToken(token: string, secret: string): boolean {
  if (!token) return false
  try {
    const expected = createSessionToken(secret)
    const a = Buffer.from(token)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET env var is required')
  return secret
}

export function getSharedPassword(): string {
  const password = process.env.SHARED_PASSWORD
  if (!password) throw new Error('SHARED_PASSWORD env var is required')
  return password
}

export { SESSION_COOKIE_NAME }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && npx vitest run src/lib/auth.test.ts
```

Expected: PASS.

- [ ] **Step 5: Implement middleware**

Uses Web Crypto API for HMAC verification so it runs on Edge runtime (Node.js `crypto` module is not available in Edge middleware).

```typescript
// src/middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from './lib/constants'

const PUBLIC_PATHS = ['/login']
const PAYLOAD = 'yoontube-authenticated'

async function verifyTokenEdge(token: string): Promise<boolean> {
  const secret = process.env.SESSION_SECRET
  if (!secret || !token) return false

  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(PAYLOAD))
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return token === expected
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Allow static files
  if (pathname.includes('.')) {
    return NextResponse.next()
  }

  const session = request.cookies.get(SESSION_COOKIE_NAME)
  if (session?.value && (await verifyTokenEdge(session.value))) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 6: Implement login server action**

```typescript
// src/app/login/actions.ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSessionToken, getSessionSecret, getSharedPassword, SESSION_COOKIE_NAME } from '@/lib/auth'

export type LoginState = { error: string | null }

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get('password')

  if (typeof password !== 'string' || !password) {
    return { error: 'Password is required' }
  }

  if (password !== getSharedPassword()) {
    return { error: 'Incorrect password' }
  }

  const token = createSessionToken(getSessionSecret())
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  redirect('/')
}
```

- [ ] **Step 7: Implement login page**

```tsx
// src/app/login/page.tsx
'use client'

import { useActionState } from 'react'
import { login, type LoginState } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const initialState: LoginState = { error: null }

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form action={formAction} className="w-full max-w-sm space-y-4 p-4">
        <h1 className="text-2xl font-bold text-center">Yoontube</h1>
        <Input
          name="password"
          type="password"
          placeholder="Enter password"
          autoFocus
          required
        />
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/auth.ts web/src/lib/auth.test.ts web/src/middleware.ts web/src/app/login/
git commit -m "feat: add shared password auth with signed session cookie"
```

---

## Task 5: Drive Client (Reuse from V1)

**Files:**
- Create: `web/src/lib/drive.ts`
- Create: `web/src/lib/drive.test.ts`

The V1 `backend/src/drive/client.ts` contains the Drive API logic. We extract the streaming and thumbnail parts into a single file.

- [ ] **Step 1: Write test for Drive stream header extraction**

```typescript
// src/lib/drive.test.ts
import { describe, it, expect } from 'vitest'
import { extractProxyHeaders } from './drive'

describe('extractProxyHeaders', () => {
  it('extracts only allowed headers', () => {
    const raw = new Headers({
      'content-type': 'video/mp4',
      'content-range': 'bytes 0-999/5000',
      'content-length': '1000',
      'accept-ranges': 'bytes',
      'cache-control': 'private',
      'x-secret': 'should-not-appear',
    })

    const result = extractProxyHeaders(raw)
    expect(result.get('content-type')).toBe('video/mp4')
    expect(result.get('content-range')).toBe('bytes 0-999/5000')
    expect(result.has('x-secret')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run src/lib/drive.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement Drive client**

```typescript
// src/lib/drive.ts
import { google } from 'googleapis'

const PROXIED_HEADERS = [
  'accept-ranges',
  'cache-control',
  'content-length',
  'content-range',
  'content-type',
]

export function extractProxyHeaders(source: Headers): Headers {
  const headers = new Headers()
  for (const name of PROXIED_HEADERS) {
    const value = source.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}

function createDriveAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
}

function getDriveClient() {
  return google.drive({ version: 'v3', auth: createDriveAuth() })
}

export async function getDriveFileStream(fileId: string, range?: string) {
  const drive = getDriveClient()

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    {
      responseType: 'stream',
      headers: range ? { Range: range } : undefined,
    }
  )

  return {
    status: response.status,
    headers: response.headers,
    data: response.data as NodeJS.ReadableStream,
  }
}

export async function getDriveFileMeta(fileId: string) {
  const drive = getDriveClient()

  const response = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, thumbnailLink, videoMediaMetadata, imageMediaMetadata, createdTime',
  })

  return response.data
}

export async function getDriveThumbnail(fileId: string) {
  const drive = getDriveClient()
  const auth = createDriveAuth()

  const meta = await drive.files.get({
    fileId,
    fields: 'thumbnailLink, mimeType',
  })

  const thumbnailLink = meta.data.thumbnailLink

  if (thumbnailLink) {
    const thumbnailUrl = thumbnailLink.replace(/=s\d+$/, '=s480')
    const accessToken = await auth.getAccessToken()

    const response = await fetch(thumbnailUrl, {
      headers: accessToken.token ? { Authorization: `Bearer ${accessToken.token}` } : {},
    })

    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? 'image/jpeg',
      body: Buffer.from(await response.arrayBuffer()),
    }
  }

  return null
}

export async function listDriveFolder(folderId: string) {
  const drive = getDriveClient()
  const entries: Array<{
    id: string
    name: string
    mimeType: string
    size?: string
    createdTime?: string
    thumbnailLink?: string
    videoMediaMetadata?: { durationMillis?: string }
  }> = []

  let pageToken: string | undefined

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, thumbnailLink, videoMediaMetadata)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageSize: 1000,
      pageToken,
    })

    for (const file of response.data.files ?? []) {
      if (file.id && file.name && file.mimeType) {
        entries.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size ?? undefined,
          createdTime: file.createdTime ?? undefined,
          thumbnailLink: file.thumbnailLink ?? undefined,
          videoMediaMetadata: file.videoMediaMetadata
            ? { durationMillis: String(file.videoMediaMetadata.durationMillis ?? '') }
            : undefined,
        })
      }
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return entries
}
```

- [ ] **Step 4: Run tests**

```bash
cd web && npx vitest run src/lib/drive.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/drive.ts web/src/lib/drive.test.ts
git commit -m "feat: add Google Drive API client for streaming and folder listing"
```

---

## Task 6: Streaming API Route

**Files:**
- Create: `web/src/app/api/stream/[id]/route.ts`
- Create: `web/src/app/api/stream/[id]/route.test.ts`

This replaces the V1 proxy-to-backend pattern with direct Drive streaming.

- [ ] **Step 1: Implement streaming route**

```typescript
// src/app/api/stream/[id]/route.ts
import { NextRequest } from 'next/server'
import { getDriveFileStream, extractProxyHeaders } from '@/lib/drive'
import { verifySessionToken, getSessionSecret, SESSION_COOKIE_NAME } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const session = request.cookies.get(SESSION_COOKIE_NAME)
  if (!session?.value || !verifySessionToken(session.value, getSessionSecret())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const range = request.headers.get('range') ?? undefined

  try {
    const { status, headers: rawHeaders, data } = await getDriveFileStream(id, range)

    const responseHeaders = new Headers()
    const headerEntries = rawHeaders instanceof Headers
      ? rawHeaders
      : new Headers(rawHeaders as Record<string, string>)

    for (const [key, value] of headerEntries.entries()) {
      responseHeaders.set(key, value)
    }

    const proxied = extractProxyHeaders(responseHeaders)

    // Convert Node readable stream to web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        data.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
        data.on('end', () => controller.close())
        data.on('error', (err: Error) => controller.error(err))
      },
    })

    return new Response(webStream, { status, headers: proxied })
  } catch {
    return Response.json({ error: 'Stream unavailable' }, { status: 502 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/app/api/stream/
git commit -m "feat: add Drive byte-range streaming proxy route"
```

---

## Task 7: Root Layout & Navigation

**Files:**
- Modify: `web/src/app/layout.tsx`
- Create: `web/src/components/nav-bar.tsx`
- Create: `web/src/components/search-bar.tsx`

- [ ] **Step 1: Implement search bar**

```tsx
// src/components/search-bar.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Input } from '@/components/ui/input'

export function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <Input
        type="search"
        placeholder="Search files..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-9"
      />
    </form>
  )
}
```

- [ ] **Step 2: Implement nav bar**

```tsx
// src/components/nav-bar.tsx
import Link from 'next/link'
import { Suspense } from 'react'
import { SearchBar } from './search-bar'
import { getSyncStatus } from '@/lib/queries'

async function SyncStatus() {
  const lastSynced = await getSyncStatus()
  if (!lastSynced) return null

  const date = new Date(lastSynced)
  const formatted = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <span className="text-xs text-muted-foreground" title={`Last synced: ${date.toLocaleString()}`}>
      Synced {formatted}
    </span>
  )
}

export function NavBar() {
  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="text-lg font-bold shrink-0">
          Yoontube
        </Link>
        <Suspense>
          <SearchBar />
        </Suspense>
        <div className="ml-auto flex items-center gap-2">
          <Suspense>
            <SyncStatus />
          </Suspense>
          <Link href="/folders" className="text-sm text-muted-foreground hover:text-foreground">
            Folders
          </Link>
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 3: Update root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { NavBar } from '@/components/nav-bar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Yoontube',
  description: 'Private media gallery',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <NavBar />
        <main className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add web/src/app/layout.tsx web/src/components/nav-bar.tsx web/src/components/search-bar.tsx
git commit -m "feat: add root layout with nav bar and search"
```

---

## Task 8: Media Card & Media Grid Components

**Files:**
- Create: `web/src/lib/format.ts`
- Create: `web/src/lib/format.test.ts`
- Create: `web/src/components/media-card.tsx`
- Create: `web/src/components/media-grid.tsx`
- Create: `web/src/components/filter-tabs.tsx`
- Create: `web/src/components/sort-select.tsx`

- [ ] **Step 1: Create shared formatting utilities with tests**

```typescript
// src/lib/format.ts
export function formatDuration(ms: number | null): string | null {
  if (!ms) return null
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatSize(bytes: number | null): string | null {
  if (!bytes) return null
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${(bytes / 1_000).toFixed(0)} KB`
}
```

```typescript
// src/lib/format.test.ts
import { describe, it, expect } from 'vitest'
import { formatDuration, formatSize } from './format'

describe('formatDuration', () => {
  it('formats milliseconds to m:ss', () => {
    expect(formatDuration(65000)).toBe('1:05')
    expect(formatDuration(3600000)).toBe('60:00')
  })
  it('returns null for null/zero', () => {
    expect(formatDuration(null)).toBeNull()
    expect(formatDuration(0)).toBeNull()
  })
})

describe('formatSize', () => {
  it('formats bytes to human-readable', () => {
    expect(formatSize(1_500_000_000)).toBe('1.5 GB')
    expect(formatSize(50_000_000)).toBe('50.0 MB')
    expect(formatSize(500_000)).toBe('500 KB')
  })
  it('returns null for null/zero', () => {
    expect(formatSize(null)).toBeNull()
    expect(formatSize(0)).toBeNull()
  })
})
```

- [ ] **Step 2: Implement media card**

```tsx
// src/components/media-card.tsx
import Image from 'next/image'
import Link from 'next/link'
import type { Media } from '@/lib/supabase/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDuration, formatSize } from '@/lib/format'

export function MediaCard({ item }: { item: Media }) {
  const href = item.type === 'video' ? `/watch/${item.id}` : `/photo/${item.id}`
  const duration = formatDuration(item.duration)
  const size = formatSize(item.size)

  return (
    <Link href={href}>
      <Card className="group overflow-hidden hover:ring-2 hover:ring-primary transition-all">
        <div className="relative aspect-video bg-muted">
          {item.thumbnail_url ? (
            <Image
              src={item.thumbnail_url}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              No preview
            </div>
          )}
          {duration && (
            <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
              {duration}
            </span>
          )}
          <Badge variant="secondary" className="absolute top-1 left-1 text-xs">
            {item.type}
          </Badge>
        </div>
        <div className="p-2">
          <p className="text-sm font-medium truncate">{item.name}</p>
          {size && <p className="text-xs text-muted-foreground">{size}</p>}
        </div>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Implement filter tabs**

```tsx
// src/components/filter-tabs.tsx
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'videos', label: 'Videos' },
  { value: 'photos', label: 'Photos' },
] as const

export type MediaFilter = (typeof FILTERS)[number]['value']

export function FilterTabs() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = (searchParams.get('filter') as MediaFilter) ?? 'all'

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete('filter')
    } else {
      params.set('filter', value)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Tabs value={current} onValueChange={handleChange}>
      <TabsList>
        {FILTERS.map((f) => (
          <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
```

- [ ] **Step 3: Implement sort select**

```tsx
// src/components/sort-select.tsx
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const SORT_OPTIONS = [
  { value: 'date', label: 'Date' },
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]['value']

export function SortSelect() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = (searchParams.get('sort') as SortOption) ?? 'date'

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'date') {
      params.delete('sort')
    } else {
      params.set('sort', value)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-28 h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 4: Implement media grid with pagination**

```tsx
// src/components/media-grid.tsx
import type { Media } from '@/lib/supabase/types'
import { MediaCard } from './media-card'
import { LoadMoreButton } from './load-more-button'

type MediaGridProps = {
  items: Media[]
  hasMore: boolean
  nextPage: number
}

export function MediaGrid({ items, hasMore, nextPage }: MediaGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No media found
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center py-8">
          <LoadMoreButton nextPage={nextPage} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create load-more button (client component)**

```tsx
// src/components/load-more-button.tsx
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function LoadMoreButton({ nextPage }: { nextPage: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleClick() {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(nextPage))
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Button variant="outline" onClick={handleClick}>
      Load more
    </Button>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/format.ts web/src/lib/format.test.ts web/src/components/media-card.tsx web/src/components/media-grid.tsx web/src/components/filter-tabs.tsx web/src/components/sort-select.tsx web/src/components/load-more-button.tsx
git commit -m "feat: add media card, grid, filter tabs, sort, and formatting utilities"
```

---

## Task 9: Home Page

**Files:**
- Modify: `web/src/app/page.tsx`
- Create: `web/src/app/loading.tsx`
- Create: `web/src/lib/queries.ts`

- [ ] **Step 1: Create shared query helpers**

```typescript
// src/lib/queries.ts
import { createClient } from '@/lib/supabase/server'
import { ITEMS_PER_PAGE } from '@/lib/constants'
import type { SortOption } from '@/components/sort-select'
import type { MediaFilter } from '@/components/filter-tabs'

type ListMediaParams = {
  filter?: MediaFilter
  sort?: SortOption
  page?: number
  folderId?: string | null
  search?: string
}

export async function listMedia({ filter, sort = 'date', page = 1, folderId, search }: ListMediaParams) {
  const supabase = await createClient()
  const from = (page - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE

  let query = supabase.from('media').select('*', { count: 'exact' })

  if (filter === 'videos') query = query.eq('type', 'video')
  if (filter === 'photos') query = query.eq('type', 'photo')

  if (folderId !== undefined) {
    query = folderId ? query.eq('folder_id', folderId) : query.is('folder_id', null)
  }

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  if (sort === 'name') query = query.order('name', { ascending: true })
  else if (sort === 'size') query = query.order('size', { ascending: false, nullsFirst: false })
  else query = query.order('created_at', { ascending: false })

  query = query.range(from, to - 1)

  const { data, count, error } = await query

  if (error) throw error

  return {
    items: data ?? [],
    total: count ?? 0,
    hasMore: (count ?? 0) > to,
    nextPage: page + 1,
  }
}

export type MediaWithFolder = Media & {
  folders: { name: string; path: string } | null
}

export async function getMediaById(id: string): Promise<MediaWithFolder> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('media')
    .select('*, folders(name, path)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as MediaWithFolder
}

export async function listFolders(parentId: string | null) {
  const supabase = await createClient()

  let query = supabase.from('folders').select('*').order('name')

  if (parentId) {
    query = query.eq('parent_id', parentId)
  } else {
    query = query.is('parent_id', null)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getFolderByPath(pathSegments: string[]) {
  const supabase = await createClient()
  const path = pathSegments.join('/')

  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('path', path)
    .single()

  if (error) return null
  return data
}

export async function getSyncStatus() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('media')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single()

  return data?.synced_at ?? null
}
```

- [ ] **Step 2: Implement home page**

```tsx
// src/app/page.tsx
import { Suspense } from 'react'
import { listMedia } from '@/lib/queries'
import { MediaGrid } from '@/components/media-grid'
import { FilterTabs, type MediaFilter } from '@/components/filter-tabs'
import { SortSelect, type SortOption } from '@/components/sort-select'

type HomeProps = {
  searchParams: Promise<{ filter?: string; sort?: string; page?: string }>
}

export default async function HomePage({ searchParams }: HomeProps) {
  const params = await searchParams
  const filter = (params.filter as MediaFilter) ?? 'all'
  const sort = (params.sort as SortOption) ?? 'date'
  const page = Number(params.page) || 1

  const { items, hasMore, nextPage } = await listMedia({ filter, sort, page })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Suspense>
          <FilterTabs />
        </Suspense>
        <Suspense>
          <SortSelect />
        </Suspense>
      </div>
      <MediaGrid items={items} hasMore={hasMore} nextPage={nextPage} />
    </div>
  )
}
```

- [ ] **Step 3: Add loading skeleton**

```tsx
// src/app/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function HomeLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/queries.ts web/src/app/page.tsx web/src/app/loading.tsx
git commit -m "feat: add home page with media grid, filtering, sorting, and pagination"
```

---

## Task 10: Folder Browser

**Files:**
- Modify: `web/src/app/folders/page.tsx`
- Modify: `web/src/app/folders/[...path]/page.tsx`
- Create: `web/src/app/folders/[...path]/loading.tsx`
- Create: `web/src/components/folder-card.tsx`
- Create: `web/src/components/breadcrumbs.tsx`

- [ ] **Step 1: Implement folder card**

```tsx
// src/components/folder-card.tsx
import Link from 'next/link'
import type { Folder } from '@/lib/supabase/types'
import { Card } from '@/components/ui/card'

export function FolderCard({ folder }: { folder: Folder }) {
  const href = `/folders/${folder.path}`

  return (
    <Link href={href}>
      <Card className="group flex items-center gap-3 p-4 hover:ring-2 hover:ring-primary transition-all">
        <span className="text-2xl">📁</span>
        <span className="text-sm font-medium truncate">{folder.name}</span>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Implement breadcrumbs**

```tsx
// src/components/breadcrumbs.tsx
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Fragment } from 'react'

type BreadcrumbsProps = {
  segments: string[]
}

export function FolderBreadcrumbs({ segments }: BreadcrumbsProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/folders">Folders</BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((segment, i) => {
          const isLast = i === segments.length - 1
          const href = `/folders/${segments.slice(0, i + 1).join('/')}`

          return (
            <Fragment key={i}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{segment}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href}>{segment}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
```

- [ ] **Step 3: Implement root folders page**

```tsx
// src/app/folders/page.tsx
import { listFolders } from '@/lib/queries'
import { FolderCard } from '@/components/folder-card'

export default async function FoldersPage() {
  const folders = await listFolders(null)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Folders</h1>
      {folders.length === 0 ? (
        <p className="text-muted-foreground">No folders found. Run a sync to populate.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {folders.map((folder) => (
            <FolderCard key={folder.id} folder={folder} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Implement nested folder page**

```tsx
// src/app/folders/[...path]/page.tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getFolderByPath, listFolders, listMedia } from '@/lib/queries'
import { FolderCard } from '@/components/folder-card'
import { FolderBreadcrumbs } from '@/components/breadcrumbs'
import { MediaGrid } from '@/components/media-grid'
import { FilterTabs, type MediaFilter } from '@/components/filter-tabs'
import { SortSelect, type SortOption } from '@/components/sort-select'

type FolderPageProps = {
  params: Promise<{ path: string[] }>
  searchParams: Promise<{ filter?: string; sort?: string; page?: string }>
}

export default async function FolderPage({ params, searchParams }: FolderPageProps) {
  const { path } = await params
  const sp = await searchParams

  const decodedPath = path.map(decodeURIComponent)
  const folder = await getFolderByPath(decodedPath)
  if (!folder) notFound()

  const filter = (sp.filter as MediaFilter) ?? 'all'
  const sort = (sp.sort as SortOption) ?? 'date'
  const page = Number(sp.page) || 1

  const [subfolders, { items, hasMore, nextPage }] = await Promise.all([
    listFolders(folder.id),
    listMedia({ filter, sort, page, folderId: folder.id }),
  ])

  return (
    <div className="space-y-6">
      <FolderBreadcrumbs segments={decodedPath} />

      {subfolders.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {subfolders.map((f) => (
            <FolderCard key={f.id} folder={f} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <Suspense>
          <FilterTabs />
        </Suspense>
        <Suspense>
          <SortSelect />
        </Suspense>
      </div>

      <MediaGrid items={items} hasMore={hasMore} nextPage={nextPage} />
    </div>
  )
}
```

- [ ] **Step 5: Add folder loading skeleton**

```tsx
// src/app/folders/[...path]/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function FolderLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/app/folders/ web/src/components/folder-card.tsx web/src/components/breadcrumbs.tsx
git commit -m "feat: add folder browser with breadcrumbs, subfolders, and media grid"
```

---

## Task 11: Video Player Page (Vidstack)

**Files:**
- Create: `web/src/components/video-player.tsx`
- Modify: `web/src/app/watch/[id]/page.tsx`

- [ ] **Step 1: Implement Vidstack video player component**

```tsx
// src/components/video-player.tsx
'use client'

import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'
import { MediaPlayer, MediaProvider } from '@vidstack/react'
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default'
import { useEffect, useRef } from 'react'
import type { MediaPlayerInstance } from '@vidstack/react'

type VideoPlayerProps = {
  src: string
  title: string
  mediaId: string
}

const STORAGE_KEY_PREFIX = 'yoontube-resume-'

export function VideoPlayer({ src, title, mediaId }: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null)

  // Resume playback from localStorage
  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    const savedTime = localStorage.getItem(`${STORAGE_KEY_PREFIX}${mediaId}`)
    if (savedTime) {
      const time = parseFloat(savedTime)
      if (time > 0) {
        player.currentTime = time
      }
    }

    // Save position periodically
    const interval = setInterval(() => {
      if (player.currentTime > 0) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${mediaId}`, String(player.currentTime))
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [mediaId])

  return (
    <MediaPlayer
      ref={playerRef}
      title={title}
      src={src}
      crossOrigin
      playsInline
      keyShortcuts={{
        togglePaused: 'k Space',
        toggleMuted: 'm',
        toggleFullscreen: 'f',
        togglePictureInPicture: 'i',
        seekBackward: ['j', 'ArrowLeft'],
        seekForward: ['l', 'ArrowRight'],
        volumeUp: 'ArrowUp',
        volumeDown: 'ArrowDown',
        speedUp: '>',
        slowDown: '<',
      }}
      className="w-full aspect-video bg-black rounded-lg overflow-hidden"
    >
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  )
}
```

- [ ] **Step 2: Implement watch page**

```tsx
// src/app/watch/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getMediaById } from '@/lib/queries'
import { VideoPlayer } from '@/components/video-player'
import { formatSize } from '@/lib/format'
import Link from 'next/link'

type WatchPageProps = {
  params: Promise<{ id: string }>
}

function isH265(name: string): boolean {
  const lowerName = name.toLowerCase()
  return lowerName.endsWith('.hevc') || lowerName.includes('h265') || lowerName.includes('h.265')
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { id } = await params
  const media = await getMediaById(id)

  if (!media || media.type !== 'video') notFound()

  const h265Warning = isH265(media.name)

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {media.folders?.path && (
        <Link
          href={`/folders/${media.folders.path}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to {media.folders.name}
        </Link>
      )}

      {h265Warning && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-sm">
          <p className="font-medium">This video may use H.265/HEVC encoding</p>
          <p className="text-muted-foreground mt-1">
            H.265 has limited browser support (Safari only). If playback fails, use the download button below.
          </p>
        </div>
      )}

      <VideoPlayer
        src={`/api/stream/${media.id}`}
        title={media.name}
        mediaId={media.id}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{media.name}</h1>
          {media.size && (
            <p className="text-sm text-muted-foreground">{formatSize(media.size)}</p>
          )}
        </div>
        <a
          href={`/api/stream/${media.id}`}
          download={media.name}
          className="text-sm text-primary hover:underline shrink-0"
        >
          Download
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/video-player.tsx web/src/app/watch/
git commit -m "feat: add Vidstack video player page with resume, keyboard shortcuts, and H.265 warning"
```

---

## Task 12: Photo Viewer Page

**Files:**
- Create: `web/src/components/photo-viewer.tsx`
- Modify: `web/src/app/photo/[id]/page.tsx`

- [ ] **Step 1: Implement photo viewer**

Uses a plain `<img>` tag instead of `next/image` because the source is a streaming proxy route (`/api/stream/[id]`). The `next/image` optimization layer would re-fetch through the proxy, potentially hitting Vercel timeouts on large photos and failing auth (no cookie forwarded). A plain `<img>` loads the full-resolution image directly.

```tsx
// src/components/photo-viewer.tsx
'use client'

import { useState } from 'react'

type PhotoViewerProps = {
  src: string
  alt: string
}

export function PhotoViewer({ src, alt }: PhotoViewerProps) {
  const [zoomed, setZoomed] = useState(false)

  return (
    <div
      className="relative flex items-center justify-center bg-black rounded-lg overflow-hidden cursor-zoom-in min-h-[60vh]"
      onClick={() => setZoomed(!zoomed)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`max-h-[80vh] w-auto object-contain transition-transform ${zoomed ? 'scale-150 cursor-zoom-out' : ''}`}
      />
    </div>
  )
}
```

- [ ] **Step 2: Implement photo page**

```tsx
// src/app/photo/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getMediaById } from '@/lib/queries'
import { PhotoViewer } from '@/components/photo-viewer'
import Link from 'next/link'

type PhotoPageProps = {
  params: Promise<{ id: string }>
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { id } = await params
  const media = await getMediaById(id)

  if (!media || media.type !== 'photo') notFound()

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {media.folders?.path && (
        <Link
          href={`/folders/${media.folders.path}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to {media.folders.name}
        </Link>
      )}

      <PhotoViewer
        src={`/api/stream/${media.id}`}
        alt={media.name}
      />

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-bold">{media.name}</h1>
        <a
          href={`/api/stream/${media.id}`}
          download={media.name}
          className="text-sm text-primary hover:underline shrink-0"
        >
          Download
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/photo-viewer.tsx web/src/app/photo/
git commit -m "feat: add photo viewer page with zoom"
```

---

## Task 13: Search Page

**Files:**
- Create: `web/src/app/search/page.tsx`

- [ ] **Step 1: Implement search page**

```tsx
// src/app/search/page.tsx
import { Suspense } from 'react'
import { listMedia } from '@/lib/queries'
import { MediaGrid } from '@/components/media-grid'
import { FilterTabs, type MediaFilter } from '@/components/filter-tabs'
import { SortSelect, type SortOption } from '@/components/sort-select'

type SearchPageProps = {
  searchParams: Promise<{ q?: string; filter?: string; sort?: string; page?: string }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = params.q ?? ''
  const filter = (params.filter as MediaFilter) ?? 'all'
  const sort = (params.sort as SortOption) ?? 'date'
  const page = Number(params.page) || 1

  if (!query.trim()) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Enter a search term to find media
      </div>
    )
  }

  // When filter is 'all', fetch videos and photos separately to group by type (spec: videos first, then photos)
  if (filter === 'all') {
    const [videos, photos] = await Promise.all([
      listMedia({ filter: 'videos', sort, page, search: query }),
      listMedia({ filter: 'photos', sort, page, search: query }),
    ])
    const totalCount = videos.total + photos.total

    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">
          Results for &ldquo;{query}&rdquo;
          <span className="font-normal text-muted-foreground text-base ml-2">
            ({totalCount} found)
          </span>
        </h1>

        <div className="flex items-center justify-between gap-4">
          <Suspense><FilterTabs /></Suspense>
          <Suspense><SortSelect /></Suspense>
        </div>

        {videos.items.length > 0 && (
          <>
            <h2 className="text-lg font-semibold">Videos</h2>
            <MediaGrid items={videos.items} hasMore={videos.hasMore} nextPage={videos.nextPage} />
          </>
        )}
        {photos.items.length > 0 && (
          <>
            <h2 className="text-lg font-semibold">Photos</h2>
            <MediaGrid items={photos.items} hasMore={photos.hasMore} nextPage={photos.nextPage} />
          </>
        )}
        {videos.items.length === 0 && photos.items.length === 0 && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            No results found
          </div>
        )}
      </div>
    )
  }

  const { items, total, hasMore, nextPage } = await listMedia({ filter, sort, page, search: query })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">
        Results for &ldquo;{query}&rdquo;
        <span className="font-normal text-muted-foreground text-base ml-2">
          ({total} found)
        </span>
      </h1>

      <div className="flex items-center justify-between gap-4">
        <Suspense><FilterTabs /></Suspense>
        <Suspense><SortSelect /></Suspense>
      </div>

      <MediaGrid items={items} hasMore={hasMore} nextPage={nextPage} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/app/search/
git commit -m "feat: add search page with filtering and sorting"
```

---

## Task 14: GitHub Actions — Sync Workflow

**Files:**
- Create: `.github/workflows/sync.yml`
- Create: `.github/workflows/keepalive.yml`
- Create: `scripts/sync.ts`

- [ ] **Step 1: Create sync script**

```typescript
// scripts/sync.ts
//
// Run with: npx tsx scripts/sync.ts
// Requires env vars: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
//   GOOGLE_DRIVE_ROOT_FOLDER_ID, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
})
const drive = google.drive({ version: 'v3', auth })

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MEDIA_MIMES = [...VIDEO_MIMES, ...PHOTO_MIMES]

type FolderRecord = { id: string; name: string; parent_id: string | null; path: string }
type MediaRecord = {
  id: string; name: string; folder_id: string | null; mime_type: string;
  type: 'video' | 'photo'; size: number | null; thumbnail_url: string | null;
  duration: number | null; created_at: string; synced_at: string;
}

const now = new Date().toISOString()
const allFolders: FolderRecord[] = []
const allMedia: MediaRecord[] = []

async function listAllFiles(folderId: string) {
  const files: any[] = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, thumbnailLink, videoMediaMetadata)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageSize: 1000,
      pageToken,
    })
    files.push(...(res.data.files ?? []))
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return files
}

async function downloadAndUploadThumbnail(fileId: string, thumbnailLink: string): Promise<string | null> {
  try {
    const url = thumbnailLink.replace(/=s\d+$/, '=s480')
    const token = await auth.getAccessToken()
    const res = await fetch(url, {
      headers: token.token ? { Authorization: `Bearer ${token.token}` } : {},
    })
    if (!res.ok) return null

    const buffer = Buffer.from(await res.arrayBuffer())
    const path = `thumbnails/${fileId}.jpg`

    const { error } = await supabase.storage
      .from('thumbnails')
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })

    if (error) { console.error(`Thumbnail upload failed for ${fileId}:`, error.message); return null }

    const { data } = supabase.storage.from('thumbnails').getPublicUrl(path)
    return data.publicUrl
  } catch (e) {
    console.error(`Thumbnail failed for ${fileId}:`, e)
    return null
  }
}

async function crawl(folderId: string, parentId: string | null, pathSegments: string[]) {
  const files = await listAllFiles(folderId)

  for (const file of files) {
    if (file.mimeType === FOLDER_MIME) {
      const folderPath = [...pathSegments, file.name].join('/')
      allFolders.push({ id: file.id, name: file.name, parent_id: parentId, path: folderPath, synced_at: now })
      await crawl(file.id, file.id, [...pathSegments, file.name])
    } else if (MEDIA_MIMES.includes(file.mimeType)) {
      const type = VIDEO_MIMES.includes(file.mimeType) ? 'video' : 'photo'
      const duration = file.videoMediaMetadata?.durationMillis
        ? parseInt(file.videoMediaMetadata.durationMillis)
        : null

      let thumbnailUrl: string | null = null
      if (file.thumbnailLink) {
        thumbnailUrl = await downloadAndUploadThumbnail(file.id, file.thumbnailLink)
      }

      allMedia.push({
        id: file.id,
        name: file.name,
        folder_id: parentId,
        mime_type: file.mimeType,
        type,
        size: file.size ? parseInt(file.size) : null,
        thumbnail_url: thumbnailUrl,
        duration,
        created_at: file.createdTime ?? now,
        synced_at: now,
      })
    }
  }
}

async function main() {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!
  console.log('Starting sync from root folder:', rootId)

  await crawl(rootId, null, [])

  console.log(`Found ${allFolders.length} folders, ${allMedia.length} media files`)

  // Upsert folders (parents first — sorted by path depth)
  const sortedFolders = allFolders.sort((a, b) => a.path.split('/').length - b.path.split('/').length)
  for (const batch of chunk(sortedFolders, 500)) {
    const { error } = await supabase.from('folders').upsert(batch, { onConflict: 'id' })
    if (error) console.error('Folder upsert error:', error.message)
  }

  // Upsert media
  for (const batch of chunk(allMedia, 500)) {
    const { error } = await supabase.from('media').upsert(batch, { onConflict: 'id' })
    if (error) console.error('Media upsert error:', error.message)
  }

  // Delete orphaned records — any row whose synced_at is older than this sync run
  // was not seen in Drive and should be removed. This avoids the Supabase default
  // 1000-row select limit that would silently truncate large result sets.
  const { count: deletedMedia } = await supabase
    .from('media')
    .delete({ count: 'exact' })
    .lt('synced_at', now)

  if (deletedMedia && deletedMedia > 0) {
    console.log(`Deleted ${deletedMedia} orphaned media records`)
  }

  const { count: deletedFolders } = await supabase
    .from('folders')
    .delete({ count: 'exact' })
    .lt('synced_at', now)

  if (deletedFolders && deletedFolders > 0) {
    console.log(`Deleted ${deletedFolders} orphaned folder records`)
  }

  console.log('Sync complete!')
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Create sync workflow**

```yaml
# .github/workflows/sync.yml
name: Sync Drive to Supabase

on:
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install googleapis @supabase/supabase-js tsx
      - run: npx tsx scripts/sync.ts
        env:
          GOOGLE_SERVICE_ACCOUNT_EMAIL: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_EMAIL }}
          GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY }}
          GOOGLE_DRIVE_ROOT_FOLDER_ID: ${{ secrets.GOOGLE_DRIVE_ROOT_FOLDER_ID }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

- [ ] **Step 3: Create keepalive workflow**

```yaml
# .github/workflows/keepalive.yml
name: Supabase Keepalive

on:
  schedule:
    - cron: '0 0 */3 * *' # every 3 days

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/now" \
            -H "apikey: $SUPABASE_KEY" \
            -H "Authorization: Bearer $SUPABASE_KEY"
        env:
          SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/sync.ts .github/workflows/sync.yml .github/workflows/keepalive.yml
git commit -m "feat: add GitHub Actions for Drive-to-Supabase sync and keepalive"
```

---

## Task 15: Cleanup & Final Integration

**Files:**
- Remove: `backend/` directory (archive V1)
- Modify: `package.json` (remove workspaces)
- Verify all pages work end-to-end

- [ ] **Step 1: Update root package.json**

```json
{
  "name": "yoontube",
  "private": true,
  "scripts": {
    "dev": "npm --prefix web run dev",
    "build": "npm --prefix web run build",
    "test": "npm --prefix web run test",
    "sync": "npx tsx scripts/sync.ts"
  }
}
```

- [ ] **Step 2: Archive V1 backend**

Move the `backend/` directory out of the project or delete it. The spec says this is a greenfield rewrite and the V1 backend is decommissioned.

```bash
rm -rf backend/
```

- [ ] **Step 3: Remove unused V1 files from web**

Delete V1-specific files that are replaced:
- `web/src/lib/backend.ts` (was proxy to Fastify)
- `web/src/lib/backend.test.ts`
- `web/src/lib/media-detail.ts`
- `web/src/app/videos/` (replaced by `/watch/`)
- `web/src/app/photos/` (replaced by `/photo/`)
- `web/src/app/api/thumbnail/` (thumbnails served from Supabase Storage now)
- `web/src/app/login/state.ts` (merged into actions.ts)

- [ ] **Step 4: Run full build**

```bash
cd web && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Run all tests**

```bash
cd web && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove V1 backend and unused files, finalize V2 project structure"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Project scaffolding & dependencies |
| 2 | Supabase database schema |
| 3 | Supabase client setup & types |
| 4 | Auth — shared password & middleware |
| 5 | Drive client (reuse from V1) |
| 6 | Streaming API route |
| 7 | Root layout & navigation |
| 8 | Media card & grid components |
| 9 | Home page |
| 10 | Folder browser |
| 11 | Video player page (Vidstack) |
| 12 | Photo viewer page |
| 13 | Search page |
| 14 | GitHub Actions — sync & keepalive |
| 15 | Cleanup & final integration |
