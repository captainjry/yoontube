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
