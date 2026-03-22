# Drive Media Library Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a private Google Drive media library with a Vercel-hosted Next.js frontend and an Oracle-hosted Fastify backend that indexes one shared root folder, streams playable `mp4` files, and falls back cleanly for `heic` and `cr2`.

**Architecture:** Use a small npm workspace in `ideas/drive-media-library/` with two apps: `web` for the Next.js UI and `backend` for the Fastify API. The backend owns Google Drive access, recursive indexing, the cached `media-index.json`, and the byte-range video stream endpoint. The frontend stays thin: password gate, feed/gallery pages, and detail pages that consume backend APIs.

**Tech Stack:** TypeScript, npm workspaces, Next.js App Router, Fastify, Vitest, Google Drive API, node-cron, Zod, Oracle Cloud VM, Vercel.

---

### Task 1: Bootstrap The Workspace And Backend Env Parsing

**Files:**
- Create: `ideas/drive-media-library/package.json`
- Create: `ideas/drive-media-library/web/package.json`
- Create: `ideas/drive-media-library/backend/package.json`
- Create: `ideas/drive-media-library/backend/tsconfig.json`
- Create: `ideas/drive-media-library/backend/vitest.config.ts`
- Create: `ideas/drive-media-library/backend/.env.example`
- Create: `ideas/drive-media-library/backend/test/config.test.ts`
- Create: `ideas/drive-media-library/backend/src/config.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'

describe('loadConfig', () => {
  it('parses required environment values', () => {
    const config = loadConfig({
      PORT: '4000',
      DRIVE_ROOT_FOLDER_ID: 'folder123',
      SHARED_PASSWORD: 'secret',
      GOOGLE_CLIENT_EMAIL: 'bot@example.com',
      GOOGLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
    })

    expect(config.port).toBe(4000)
    expect(config.driveRootFolderId).toBe('folder123')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd ideas/drive-media-library && npm --workspace backend test -- --run test/config.test.ts`

Expected: FAIL with `Cannot find module '../src/config'`.

**Step 3: Write minimal implementation**

```ts
import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DRIVE_ROOT_FOLDER_ID: z.string().min(1),
  SHARED_PASSWORD: z.string().min(1),
  GOOGLE_CLIENT_EMAIL: z.string().email(),
  GOOGLE_PRIVATE_KEY: z.string().min(1),
})

export function loadConfig(source: Record<string, string | undefined>) {
  const env = envSchema.parse(source)

  return {
    port: env.PORT,
    driveRootFolderId: env.DRIVE_ROOT_FOLDER_ID,
    sharedPassword: env.SHARED_PASSWORD,
    googleClientEmail: env.GOOGLE_CLIENT_EMAIL,
    googlePrivateKey: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }
}
```

Also create minimal workspace manifests with scripts:

```json
{
  "private": true,
  "workspaces": ["web", "backend"],
  "scripts": {
    "test:backend": "npm --workspace backend test"
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd ideas/drive-media-library && npm install && npm --workspace backend test -- --run test/config.test.ts`

Expected: PASS with `1 passed`.

**Step 5: Commit**

```bash
cd ideas/drive-media-library && git init && git add . && git commit -m "chore: bootstrap drive media library workspace"
```

### Task 2: Build Recursive Drive Indexing And Cache Output

**Files:**
- Create: `ideas/drive-media-library/backend/test/indexer.test.ts`
- Create: `ideas/drive-media-library/backend/src/drive/types.ts`
- Create: `ideas/drive-media-library/backend/src/drive/indexer.ts`
- Create: `ideas/drive-media-library/backend/src/lib/classify-media.ts`
- Create: `ideas/drive-media-library/backend/src/lib/write-index.ts`
- Create: `ideas/drive-media-library/backend/data/.gitkeep`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildMediaIndex } from '../src/drive/indexer'

describe('buildMediaIndex', () => {
  it('flattens nested folders and classifies media', async () => {
    const index = await buildMediaIndex({
      rootFolderId: 'root',
      listFolder: async (folderId) => {
        if (folderId === 'root') {
          return [
            { id: 'folder-a', name: 'Trips', mimeType: 'application/vnd.google-apps.folder' },
            { id: 'video-1', name: 'clip.mp4', mimeType: 'video/mp4', modifiedTime: '2026-03-01T00:00:00.000Z', size: '10' },
          ]
        }

        return [
          { id: 'raw-1', name: 'frame.cr2', mimeType: 'image/x-canon-cr2', modifiedTime: '2026-03-01T00:00:00.000Z', size: '20' },
        ]
      },
    })

    expect(index.items).toHaveLength(2)
    expect(index.items[1].folderPath).toBe('Trips')
    expect(index.items[1].playbackMode).toBe('preview_only')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd ideas/drive-media-library && npm install && npm --workspace backend test -- --run test/indexer.test.ts`

Expected: FAIL with `Cannot find module '../src/drive/indexer'`.

**Step 3: Write minimal implementation**

```ts
export function classifyMedia(name: string, mimeType: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''

  if (mimeType.startsWith('video/') || ext === 'mp4') {
    return { kind: 'video', playbackMode: 'playable_in_browser' as const }
  }

  if (ext === 'cr2' || mimeType.includes('canon-cr2')) {
    return { kind: 'photo', playbackMode: 'preview_only' as const }
  }

  if (ext === 'heic') {
    return { kind: 'photo', playbackMode: 'preview_only' as const }
  }

  return { kind: 'photo', playbackMode: 'playable_in_browser' as const }
}
```

```ts
export async function buildMediaIndex({ rootFolderId, listFolder }) {
  const items = []

  async function walk(folderId: string, pathParts: string[]) {
    const children = await listFolder(folderId)

    for (const child of children) {
      if (child.mimeType === 'application/vnd.google-apps.folder') {
        await walk(child.id, [...pathParts, child.name])
        continue
      }

      const media = classifyMedia(child.name, child.mimeType)
      items.push({
        id: child.id,
        name: child.name,
        mimeType: child.mimeType,
        modifiedTime: child.modifiedTime,
        size: Number(child.size ?? 0),
        folderPath: pathParts.join('/'),
        ...media,
      })
    }
  }

  await walk(rootFolderId, [])

  return { generatedAt: new Date().toISOString(), items }
}
```

**Step 4: Run test to verify it passes**

Run: `cd ideas/drive-media-library && npm --workspace backend test -- --run test/indexer.test.ts`

Expected: PASS with nested folder flattening confirmed.

**Step 5: Commit**

```bash
cd ideas/drive-media-library && git add backend && git commit -m "feat: add drive media indexing"
```

### Task 3: Add Drive API Client And Sync Command

**Files:**
- Create: `ideas/drive-media-library/backend/test/sync-drive-index.test.ts`
- Create: `ideas/drive-media-library/backend/src/drive/client.ts`
- Create: `ideas/drive-media-library/backend/src/jobs/sync-drive-index.ts`
- Create: `ideas/drive-media-library/backend/src/lib/write-index.ts`
- Modify: `ideas/drive-media-library/backend/package.json`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { syncDriveIndex } from '../src/jobs/sync-drive-index'

describe('syncDriveIndex', () => {
  it('writes the generated index to disk', async () => {
    const writeFile = vi.fn()

    await syncDriveIndex({
      rootFolderId: 'root',
      listFolder: async () => [],
      writeFile,
    })

    expect(writeFile).toHaveBeenCalledOnce()
    expect(writeFile.mock.calls[0][0]).toContain('media-index.json')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd ideas/drive-media-library && npm --workspace backend test -- --run test/sync-drive-index.test.ts`

Expected: FAIL with `Cannot find module '../src/jobs/sync-drive-index'`.

**Step 3: Write minimal implementation**

```ts
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { buildMediaIndex } from '../drive/indexer'

export async function syncDriveIndex({ rootFolderId, listFolder, writeFile = fs.writeFile }) {
  const index = await buildMediaIndex({ rootFolderId, listFolder })
  const outputPath = path.join(process.cwd(), 'data', 'media-index.json')
  await writeFile(outputPath, JSON.stringify(index, null, 2), 'utf8')
  return outputPath
}
```

Add a CLI script in `package.json`:

```json
{
  "scripts": {
    "sync": "tsx src/jobs/sync-drive-index.ts"
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd ideas/drive-media-library && npm --workspace backend test -- --run test/sync-drive-index.test.ts`

Expected: PASS with one file write.

**Step 5: Commit**

```bash
cd ideas/drive-media-library && git add backend && git commit -m "feat: add drive sync job"
```

### Task 4: Expose Backend Media APIs And Password Validation

**Files:**
- Create: `ideas/drive-media-library/backend/test/server.test.ts`
- Create: `ideas/drive-media-library/backend/src/app.ts`
- Create: `ideas/drive-media-library/backend/src/server.ts`
- Create: `ideas/drive-media-library/backend/src/routes/health.ts`
- Create: `ideas/drive-media-library/backend/src/routes/media.ts`
- Create: `ideas/drive-media-library/backend/src/routes/auth.ts`
- Create: `ideas/drive-media-library/backend/src/lib/read-index.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app'

describe('media routes', () => {
  it('returns indexed items after password verification', async () => {
    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => ({ generatedAt: 'now', items: [{ id: '1', name: 'clip.mp4' }] }),
    })

    const auth = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { password: 'secret' },
    })

    expect(auth.statusCode).toBe(204)

    const media = await app.inject({
      method: 'GET',
      url: '/media',
      cookies: auth.cookies.reduce((acc, cookie) => ({ ...acc, [cookie.name]: cookie.value }), {}),
    })

    expect(media.statusCode).toBe(200)
    expect(media.json().items).toHaveLength(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd ideas/drive-media-library && npm --workspace backend test -- --run test/server.test.ts`

Expected: FAIL with `Cannot find module '../src/app'`.

**Step 3: Write minimal implementation**

```ts
import Fastify from 'fastify'
import cookie from '@fastify/cookie'

export function buildApp({ sharedPassword, readIndex }) {
  const app = Fastify()

  app.register(cookie)

  app.post('/auth/verify', async (request, reply) => {
    const body = request.body as { password?: string }
    if (body.password !== sharedPassword) {
      return reply.code(401).send({ message: 'Invalid password' })
    }

    reply.setCookie('media_session', sharedPassword, { httpOnly: true, sameSite: 'lax', path: '/' })
    return reply.code(204).send()
  })

  app.get('/media', async (request, reply) => {
    if (request.cookies.media_session !== sharedPassword) {
      return reply.code(401).send({ message: 'Unauthorized' })
    }

    return readIndex()
  })

  app.get('/health', async () => ({ ok: true }))

  return app
}
```

**Step 4: Run test to verify it passes**

Run: `cd ideas/drive-media-library && npm --workspace backend test -- --run test/server.test.ts`

Expected: PASS with `204` on auth and `200` on `/media`.

**Step 5: Commit**

```bash
cd ideas/drive-media-library && git add backend && git commit -m "feat: add backend auth and media routes"
```

### Task 5: Add Range-Based Video Streaming

**Files:**
- Create: `ideas/drive-media-library/backend/test/stream.test.ts`
- Create: `ideas/drive-media-library/backend/src/routes/stream.ts`
- Modify: `ideas/drive-media-library/backend/src/app.ts`
- Modify: `ideas/drive-media-library/backend/src/drive/client.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { buildApp } from '../src/app'

describe('stream route', () => {
  it('proxies byte ranges for mp4 playback', async () => {
    const getStream = vi.fn().mockResolvedValue({
      statusCode: 206,
      headers: {
        'content-type': 'video/mp4',
        'content-range': 'bytes 0-9/100',
      },
      body: Buffer.from('1234567890'),
    })

    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => ({ generatedAt: 'now', items: [] }),
      getDriveStream: getStream,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/stream/video-1',
      headers: { range: 'bytes=0-9', cookie: 'media_session=secret' },
    })

    expect(response.statusCode).toBe(206)
    expect(getStream).toHaveBeenCalledWith('video-1', 'bytes=0-9')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd ideas/drive-media-library && npm --workspace backend test -- --run test/stream.test.ts`

Expected: FAIL because `/stream/:id` does not exist.

**Step 3: Write minimal implementation**

```ts
app.get('/stream/:id', async (request, reply) => {
  if (request.cookies.media_session !== sharedPassword) {
    return reply.code(401).send({ message: 'Unauthorized' })
  }

  const { id } = request.params as { id: string }
  const range = request.headers.range
  const upstream = await getDriveStream(id, typeof range === 'string' ? range : undefined)

  reply.code(upstream.statusCode)
  for (const [key, value] of Object.entries(upstream.headers)) {
    if (value) reply.header(key, value)
  }

  return reply.send(upstream.body)
})
```

Drive client contract:

```ts
export async function getDriveStream(fileId: string, range?: string) {
  const headers: Record<string, string> = {}
  if (range) headers.Range = range

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers,
  })

  return {
    statusCode: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/octet-stream',
      'content-range': response.headers.get('content-range') ?? undefined,
      'accept-ranges': response.headers.get('accept-ranges') ?? 'bytes',
    },
    body: Buffer.from(await response.arrayBuffer()),
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd ideas/drive-media-library && npm --workspace backend test -- --run test/stream.test.ts`

Expected: PASS with `206` response.

**Step 5: Commit**

```bash
cd ideas/drive-media-library && git add backend && git commit -m "feat: add byte-range drive video streaming"
```

### Task 6: Create The Next.js Shell And Shared Password Gate

**Files:**
- Create: `ideas/drive-media-library/web/next.config.ts`
- Create: `ideas/drive-media-library/web/tsconfig.json`
- Create: `ideas/drive-media-library/web/src/middleware.ts`
- Create: `ideas/drive-media-library/web/src/middleware.test.ts`
- Create: `ideas/drive-media-library/web/src/app/layout.tsx`
- Create: `ideas/drive-media-library/web/src/app/page.tsx`
- Create: `ideas/drive-media-library/web/src/app/login/page.tsx`
- Create: `ideas/drive-media-library/web/src/app/login/actions.ts`
- Create: `ideas/drive-media-library/web/src/lib/backend.ts`
- Create: `ideas/drive-media-library/web/src/lib/types.ts`
- Create: `ideas/drive-media-library/web/src/components/password-form.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { isPublicPath } from '../src/middleware'

describe('isPublicPath', () => {
  it('allows login path and blocks home path', () => {
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/')).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd ideas/drive-media-library && npm --workspace web test -- --run src/middleware.test.ts`

Expected: FAIL because the middleware helper does not exist.

**Step 3: Write minimal implementation**

```ts
export function isPublicPath(pathname: string) {
  return pathname === '/login' || pathname.startsWith('/_next')
}

export function middleware(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const hasSession = request.cookies.get('media_session')?.value
  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}
```

Login server action:

```ts
'use server'

import { cookies } from 'next/headers'

export async function submitPassword(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const response = await fetch(`${process.env.BACKEND_URL}/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })

  if (!response.ok) {
    return { error: 'Invalid password' }
  }

  cookies().set('media_session', password, { httpOnly: true, sameSite: 'lax', secure: true, path: '/' })
  return { ok: true }
}
```

**Step 4: Run test to verify it passes**

Run: `cd ideas/drive-media-library && npm --workspace web test -- --run src/middleware.test.ts`

Expected: PASS with public/private path behavior confirmed.

**Step 5: Commit**

```bash
cd ideas/drive-media-library && git add web && git commit -m "feat: add frontend shell and password gate"
```

### Task 7: Render The Mixed Library Home Page

**Files:**
- Create: `ideas/drive-media-library/web/src/components/library-shell.tsx`
- Create: `ideas/drive-media-library/web/src/components/media-card.tsx`
- Create: `ideas/drive-media-library/web/src/components/filter-tabs.tsx`
- Modify: `ideas/drive-media-library/web/src/app/page.tsx`
- Create: `ideas/drive-media-library/web/src/app/page.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HomePage from './page'

describe('HomePage', () => {
  it('shows videos and photos from the backend index', async () => {
    const ui = await HomePage({
      searchParams: Promise.resolve({ filter: 'all' }),
    })

    render(ui)

    expect(screen.getByText('All')).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd ideas/drive-media-library && npm --workspace web test -- --run src/app/page.test.tsx`

Expected: FAIL because the page is not implemented.

**Step 3: Write minimal implementation**

```tsx
export default async function HomePage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const params = await searchParams
  const filter = params.filter ?? 'all'
  const media = await fetchMediaIndex()
  const items = media.items.filter((item) => filter === 'all' || item.kind === filter.slice(0, -1))

  return (
    <main>
      <h1>Drive Media Library</h1>
      <FilterTabs current={filter} />
      <LibraryShell items={items} />
    </main>
  )
}
```

Card behavior:

```tsx
export function MediaCard({ item }: { item: MediaItem }) {
  return item.kind === 'video' ? (
    <Link href={`/videos/${item.id}`}>{item.name}</Link>
  ) : (
    <Link href={`/photos/${item.id}`}>{item.name}</Link>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `cd ideas/drive-media-library && npm --workspace web test -- --run src/app/page.test.tsx`

Expected: PASS with filter tabs rendered.

**Step 5: Commit**

```bash
cd ideas/drive-media-library && git add web && git commit -m "feat: add mixed media home page"
```

### Task 8: Add Video And Photo Detail Pages With Fallbacks

**Files:**
- Create: `ideas/drive-media-library/web/src/app/videos/[id]/page.tsx`
- Create: `ideas/drive-media-library/web/src/app/photos/[id]/page.tsx`
- Create: `ideas/drive-media-library/web/src/components/video-player.tsx`
- Create: `ideas/drive-media-library/web/src/components/photo-viewer.tsx`
- Create: `ideas/drive-media-library/web/src/app/videos/[id]/page.test.tsx`
- Create: `ideas/drive-media-library/web/src/app/photos/[id]/page.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import VideoPage from './page'

describe('VideoPage', () => {
  it('renders an HTML5 player for browser-playable videos', async () => {
    const ui = await VideoPage({ params: Promise.resolve({ id: 'video-1' }) })
    render(ui)
    expect(screen.getByRole('video')).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd ideas/drive-media-library && npm --workspace web test -- --run src/app/videos/[id]/page.test.tsx`

Expected: FAIL because the detail page does not exist.

**Step 3: Write minimal implementation**

```tsx
export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await fetchMediaItem(id)

  if (item.playbackMode === 'playable_in_browser') {
    return <video controls src={`${process.env.NEXT_PUBLIC_BACKEND_URL}/stream/${id}`} />
  }

  if (item.playbackMode === 'preview_only') {
    return <a href={item.driveViewUrl}>Open preview in Drive</a>
  }

  return <a href={item.driveDownloadUrl}>Download video</a>
}
```

Photo fallback behavior:

```tsx
export function PhotoViewer({ item }: { item: MediaItem }) {
  if (item.extension === 'cr2') {
    return <a href={item.driveViewUrl}>Preview in Drive</a>
  }

  if (item.extension === 'heic') {
    return <a href={item.driveDownloadUrl}>Download HEIC</a>
  }

  return <img src={item.thumbnailUrl ?? item.driveDownloadUrl} alt={item.name} />
}
```

**Step 4: Run test to verify it passes**

Run: `cd ideas/drive-media-library && npm --workspace web test -- --run src/app/videos/[id]/page.test.tsx && npm --workspace web test -- --run src/app/photos/[id]/page.test.tsx`

Expected: PASS with correct fallback rendering.

**Step 5: Commit**

```bash
cd ideas/drive-media-library && git add web && git commit -m "feat: add media detail pages and fallbacks"
```

### Task 9: Wire Deployment And Scheduled Sync

**Files:**
- Create: `ideas/drive-media-library/backend/test/cron-command.test.ts`
- Create: `ideas/drive-media-library/backend/src/lib/build-cron-command.ts`
- Create: `ideas/drive-media-library/backend/ecosystem.config.cjs`
- Create: `ideas/drive-media-library/backend/scripts/run-sync-cron.sh`
- Create: `ideas/drive-media-library/web/vercel.json`
- Create: `ideas/drive-media-library/README.md`
- Modify: `ideas/drive-media-library/backend/package.json`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildCronCommand } from '../src/lib/build-cron-command'

describe('buildCronCommand', () => {
  it('returns the sync command used by the Oracle cron job', () => {
    expect(buildCronCommand()).toContain('npm run sync')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd ideas/drive-media-library && npm --workspace backend test -- --run test/cron-command.test.ts`

Expected: FAIL because the helper does not exist.

**Step 3: Write minimal implementation**

```ts
export function buildCronCommand() {
  return 'cd /opt/drive-media-library/backend && npm run sync >> /var/log/drive-media-sync.log 2>&1'
}
```

Oracle cron script:

```bash
#!/bin/sh
set -eu
cd /opt/drive-media-library/backend
npm run sync
```

README deployment section should include:

```md
- Deploy `web` to Vercel with `BACKEND_URL` and `NEXT_PUBLIC_BACKEND_URL`
- Deploy `backend` to Oracle VM behind Nginx or Caddy
- Add a cron entry such as `*/15 * * * * /opt/drive-media-library/backend/scripts/run-sync-cron.sh`
- Verify `curl https://backend.example.com/health` returns `{ "ok": true }`
```

**Step 4: Run test to verify it passes**

Run: `cd ideas/drive-media-library && npm --workspace backend test -- --run test/cron-command.test.ts`

Expected: PASS with the expected sync command.

**Step 5: Commit**

```bash
cd ideas/drive-media-library && git add . && git commit -m "docs: add deployment and sync instructions"
```

### Task 10: Final Verification Before Release

**Files:**
- Modify: `ideas/drive-media-library/README.md`

**Step 1: Write the failing test**

Document the manual verification checklist in `README.md`:

```md
## Verification Checklist

- Wrong password returns `401`
- Right password opens the library
- Nested folders appear as `folderPath`
- `mp4` seeks correctly in the browser
- `jpeg` renders in the photo view
- `cr2` opens in Drive preview
- `heic` shows fallback behavior
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix ideas/drive-media-library run test:backend`

Expected: FAIL until the remaining route and UI gaps are fixed.

**Step 3: Write minimal implementation**

Run and fix until all commands pass:

```bash
cd ideas/drive-media-library && npm install
cd ideas/drive-media-library && npm --workspace backend test -- --run
cd ideas/drive-media-library && npm --workspace web test -- --run
cd ideas/drive-media-library/web && npm run build
cd ideas/drive-media-library/backend && npm run sync
```

**Step 4: Run test to verify it passes**

Expected:

- backend tests pass
- frontend tests pass
- Next.js production build succeeds
- `data/media-index.json` is regenerated successfully

**Step 5: Commit**

```bash
cd ideas/drive-media-library && git add . && git commit -m "chore: verify drive media library v1"
```
