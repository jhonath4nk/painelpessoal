import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: mock } }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubGlobal('window', { location: { hash: '#/account', pathname: '/painelpessoal/', search: '' }, history: { replaceState: vi.fn() } })
  mock.getSession.mockResolvedValue({ data: { session: null }, error: null })
})
afterEach(() => vi.unstubAllGlobals())

describe('Auth initialization before HashRouter', () => {
  it('preserves regular application routes', async () => {
    const store = await import('../src/features/auth/auth-store')
    await store.initializeAuth()
    expect(store.getAuthState().loading).toBe(false)
    expect(window.history.replaceState).not.toHaveBeenCalled()
  })
  it('subscribes before restoring session and captures password recovery', async () => {
    window.location.hash = '#access_token=example&type=recovery'
    const session = { user: { id: 'test-user' } }
    mock.getSession.mockImplementation(async () => {
      expect(mock.onAuthStateChange).toHaveBeenCalledOnce()
      mock.onAuthStateChange.mock.calls[0][0]('PASSWORD_RECOVERY', session)
      return { data: { session }, error: null }
    })
    const store = await import('../src/features/auth/auth-store')
    await store.initializeAuth()
    expect(store.getAuthState().recovery).toBe(true)
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/painelpessoal/')
    store.finishRecovery()
    expect(store.getAuthState().recovery).toBe(false)
  })
  it('clears expired link fragments and reports an error', async () => {
    window.location.hash = '#error_description=Token+expired'
    const store = await import('../src/features/auth/auth-store')
    await store.initializeAuth()
    expect(store.getAuthState().error).toContain('expirou')
    expect(window.history.replaceState).toHaveBeenCalledOnce()
  })
  it('finishes loading on a connection failure', async () => {
    mock.getSession.mockRejectedValue(new Error('Network error'))
    const store = await import('../src/features/auth/auth-store')
    await store.initializeAuth()
    expect(store.getAuthState().loading).toBe(false)
    expect(store.getAuthState().error).toContain('conectar')
  })
  it('clears recovery mode and session after logout', async () => {
    const store = await import('../src/features/auth/auth-store')
    await store.initializeAuth()
    const callback = mock.onAuthStateChange.mock.calls[0][0]
    callback('PASSWORD_RECOVERY', { user: { id: 'test-user' } })
    callback('SIGNED_OUT', null)
    expect(store.getAuthState()).toMatchObject({ session: null, recovery: false })
  })
})
