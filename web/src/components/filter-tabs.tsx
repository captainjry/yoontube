import React from 'react'
import Link from 'next/link'

import type { MediaFilter } from '../lib/types'

type FilterTabsProps = {
  activeFilter: MediaFilter
}

const FILTERS: Array<{ label: string; value: MediaFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Videos', value: 'videos' },
  { label: 'Photos', value: 'photos' },
]

export function FilterTabs({ activeFilter }: FilterTabsProps) {
  return (
    <nav aria-label="Media filters" className="filter-nav">
      {FILTERS.map((filter) => {
        const href = filter.value === 'all' ? '/' : `/?filter=${filter.value}`
        const isActive = filter.value === activeFilter

        return (
          <Link
            key={filter.value}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`filter-pill ${isActive ? 'filter-pill--active' : 'filter-pill--inactive'}`}
          >
            {filter.label}
          </Link>
        )
      })}
    </nav>
  )
}
