import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import LoginPage from './page'

describe('LoginPage', () => {
  it('renders the redesigned editorial login shell', () => {
    const html = renderToStaticMarkup(<LoginPage />)

    expect(html).toContain('Enter the private screening room')
    expect(html).toContain('Shared password')
    expect(html).toContain('Unlock library')
  })
})
