import { afterEach, describe, expect, it, vi } from 'vitest'

import { authenticateBrowserInfluxConnection } from '@/services/influx/browserDataSource'

describe('authenticateBrowserInfluxConnection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('skips browser sign-in for token auth', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const connection = await authenticateBrowserInfluxConnection({
      url: 'http://127.0.0.1:8086',
      org: 'influx-vue',
      token: 'demo-token',
      authMethod: 'token',
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(connection.token).toBe('demo-token')
    expect(connection.authMethod).toBe('token')
  })

  it('signs in with username and password for same-origin URLs', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }))

    const connection = await authenticateBrowserInfluxConnection({
      url: '/influx',
      org: 'influx-vue',
      token: 'stale-token',
      authMethod: 'password',
      username: 'influx',
      password: 'influx-password-123',
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/influx/api/v2/signin',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
        }),
      }),
    )
    expect(connection.token).toBe('')
    expect(connection.authMethod).toBe('password')
  })

  it('rejects password auth for cross-origin browser URLs', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await expect(
      authenticateBrowserInfluxConnection({
        url: 'http://127.0.0.1:8086',
        org: 'influx-vue',
        token: '',
        authMethod: 'password',
        username: 'influx',
        password: 'influx-password-123',
      }),
    ).rejects.toThrow('same-origin URL or reverse proxy')

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
