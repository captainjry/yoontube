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
