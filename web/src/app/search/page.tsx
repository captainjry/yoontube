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

  // When filter is 'all', fetch videos and photos separately to group by type (videos first, then photos)
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
