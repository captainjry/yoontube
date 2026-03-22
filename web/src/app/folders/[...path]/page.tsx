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
