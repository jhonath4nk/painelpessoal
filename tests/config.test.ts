import { describe, expect, it } from 'vitest'
import { validateConfig } from '../src/lib/config'

describe('Public Supabase configuration', () => {
  it('requires both variables', () => expect(validateConfig('', '')).toBeTruthy())
  it('accepts publishable keys over HTTPS', () => expect(validateConfig('https://example.supabase.co', 'sb_publishable_test')).toBeNull())
  it('rejects private keys and insecure remote URLs', () => {
    expect(validateConfig('https://example.supabase.co', 'sb_secret_test')).toBeTruthy()
    expect(validateConfig('http://example.com', 'sb_publishable_test')).toBeTruthy()
    const payload = btoa(JSON.stringify({ role: 'service_role' }))
    expect(validateConfig('https://example.supabase.co', `a.${payload}.b`)).toBeTruthy()
  })
  it('accepts the legacy anon key', () => {
    const payload = btoa(JSON.stringify({ role: 'anon' }))
    expect(validateConfig('https://example.supabase.co', `a.${payload}.b`)).toBeNull()
  })
})
