import { describe, expect, it } from 'vitest'

import { buildCronCommand } from '../src/lib/build-cron-command.js'

describe('buildCronCommand', () => {
  it('returns the sync command used by the Oracle cron job', () => {
    expect(buildCronCommand()).toBe('cd "/opt/yoontube/backend" && npm run sync')
  })

  it('quotes backend paths so cron still works with spaces', () => {
    expect(buildCronCommand('/opt/yoontube media/backend')).toBe('cd "/opt/yoontube media/backend" && npm run sync')
  })
})
