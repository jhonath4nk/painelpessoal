import { lazy, Suspense, useSyncExternalStore } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { getAuthState, subscribeAuth } from '../features/auth/auth-store'
import { AuthPage } from '../features/auth/AuthPage'
import { configurationError } from '../lib/supabase'

const Workspace = lazy(() => import('../features/tracking/Workspace').then(module => ({ default: module.Workspace })))

export function App() {
  const auth = useSyncExternalStore(subscribeAuth, getAuthState)
  if (configurationError) return <main className="setup"><p className="eyebrow">EVOLUÇÃO · CONFIGURAÇÃO INICIAL</p><h1>Vamos conectar seu espaço.</h1><p>{configurationError}</p><p>Copie <code>.env.example</code> para <code>.env.local</code>, preencha as configurações públicas e reinicie a aplicação.</p><p className="muted">As instruções de criação da conta e do banco estão no README do projeto.</p></main>
  if (auth.loading) return <main className="setup" role="status">Conectando…</main>
  if (auth.recovery) return <AuthPage />
  return <HashRouter><Routes>
    <Route path="/login" element={auth.session ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
    <Route path="/*" element={auth.session ? <Suspense fallback={<main className="setup" role="status">Abrindo seu acompanhamento…</main>}><Workspace key={auth.session.user.id} userId={auth.session.user.id} /></Suspense> : <Navigate to="/login" replace />} />
  </Routes></HashRouter>
}
