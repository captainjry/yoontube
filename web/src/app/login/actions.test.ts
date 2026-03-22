import { describe, expect, it } from 'vitest'

import * as actionExports from './actions'

describe('login actions module', () => {
  it('exports only functions from the use server module', () => {
    for (const exportedValue of Object.values(actionExports)) {
      expect(typeof exportedValue).toBe('function')
    }
  })
})
