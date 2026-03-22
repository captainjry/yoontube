// src/lib/queries.ts (stub — will be expanded in Task 9)
import { createClient } from '@/lib/supabase/server'

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
