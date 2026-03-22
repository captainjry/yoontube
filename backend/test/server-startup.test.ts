import { afterEach, describe, expect, it, vi } from 'vitest'

describe('server startup', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('passes getDriveStream from the drive client into buildApp', async () => {
    const getDriveStream = vi.fn()
    const listen = vi.fn().mockResolvedValue(undefined)
    const buildApp = vi.fn().mockReturnValue({ listen })
    const createDriveClient = vi.fn().mockReturnValue({ getDriveStream })

    vi.doMock('../src/config.js', () => ({
      loadConfig: vi.fn().mockReturnValue({
        port: 4000,
        sharedPassword: 'secret',
        googleClientEmail: 'service@example.com',
        googlePrivateKey: 'private-key',
      }),
    }))
    vi.doMock('../src/app.js', () => ({ buildApp }))
    vi.doMock('../src/lib/read-index.js', () => ({ readIndex: vi.fn() }))
    vi.doMock('../src/drive/client.js', () => ({ createDriveClient }))

    await import('../src/server.js')

    expect(createDriveClient).toHaveBeenCalledWith({
      clientEmail: 'service@example.com',
      privateKey: 'private-key',
    })
    expect(buildApp).toHaveBeenCalledWith(
      expect.objectContaining({
        sharedPassword: 'secret',
        getDriveStream,
      }),
    )
    expect(listen).toHaveBeenCalledWith({ host: '0.0.0.0', port: 4000 })
  })
})
