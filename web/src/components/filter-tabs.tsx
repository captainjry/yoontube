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
