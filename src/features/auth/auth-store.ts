import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

type AuthState = { session: Session | null; loading: boolean; recovery: boolean; error: string | null }
let state: AuthState = { session: null, loading: !!supabase, recovery: false, error: null }
const listeners = new Set<() => void>()
function update(patch: Partial<AuthState>) {
  state = { ...state, ...patch }
  listeners.forEach(listener => listener())
}
export const subscribeAuth = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const getAuthState = () => state
export function finishRecovery() { update({ recovery: false }) }

// Register before mounting HashRouter: Supabase's implicit email callback also uses a hash.
let initialized = false
export async function initializeAuth() {
  if (!supabase || initialized) return
  initialized = true
  const callback = new URLSearchParams(window.location.hash.slice(1))
  const isAuthCallback = callback.has('access_token') || callback.has('error_description')
  if (callback.has('error_description')) {
    update({ error: 'O link de acesso expirou ou é inválido. Solicite um novo link.' })
  }
  supabase.auth.onAuthStateChange((event, session) => {
    update({ session, loading: false, ...(event === 'PASSWORD_RECOVERY' ? { recovery: true } : {}) })
    if (event === 'SIGNED_OUT') update({ recovery: false })
  })
  try {
    const { data, error } = await supabase.auth.getSession()
    update({ session: data.session, loading: false, ...(error ? { error: 'Não foi possível restaurar a sessão. Entre novamente.' } : {}) })
  } catch {
    update({ loading: false, error: 'Não foi possível conectar. Verifique sua conexão e tente novamente.' })
  }
  if (isAuthCallback) window.history.replaceState(null, '', window.location.pathname + window.location.search)
}
