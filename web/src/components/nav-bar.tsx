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
