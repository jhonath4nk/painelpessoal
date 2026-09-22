import { createClient } from '@supabase/supabase-js'
import { validateConfig } from './config'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const configurationError = validateConfig(url, key)
export const supabase = configurationError ? null : createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export function authRedirectUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href
}
