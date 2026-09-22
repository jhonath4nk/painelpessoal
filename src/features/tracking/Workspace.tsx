import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { todayIn } from '../../domain/tracking'
import { AccountPage } from '../auth/AccountPage'
import { describeError, loadTracking, type TrackingData } from './api'
import { Dashboard } from './pages/Dashboard'
import { Today } from './pages/Today'
import { Activities } from './pages/Activities'
import { Offensives } from './pages/Offensives'
import { Journeys } from './pages/Journeys'
import '../../styles/workspace.css'

export type ActionRunner = (action: () => Promise<unknown>) => Promise<boolean>
export type PageProps = { data: TrackingData; run: ActionRunner; busy: boolean; userId: string }

export function Workspace({ userId }: { userId: string }) {
  const [data, setData] = useState<TrackingData | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const selected = useRef<string | null>(null)
  const generation = useRef(0)
  const working = useRef(false)
  const location = useLocation()

  const reload = useCallback(async () => {
    const request = ++generation.current
    setRefreshing(true)
    try {
      const loaded = await loadTracking(userId, selected.current)
      if (generation.current === request) { setData(loaded); setError('') }
    } finally { if (generation.current === request) setRefreshing(false) }
  }, [userId])

  useEffect(() => {
    const requestGeneration = generation
    reload().catch(error => setError(describeError(error)))
    return () => { requestGeneration.current++ }
  }, [reload])

  useEffect(() => {
    const updateDate = () => {
      if (data && !working.current && todayIn(data.profile.timezone) !== data.today) reload().catch(error => setError(describeError(error)))
    }
    const timer = window.setInterval(updateDate, 30_000)
    window.addEventListener('focus', updateDate)
    return () => { clearInterval(timer); window.removeEventListener('focus', updateDate) }
  }, [data, reload])

  const run: ActionRunner = async action => {
    if (working.current) return false
    working.current = true; setBusy(true); setError('')
    try {
      await action()
      try { await reload() }
      catch { setError('A alteração foi salva, mas não foi possível atualizar a tela. Clique em Tentar novamente para recarregar os dados.') }
      return true
    }
    catch (error) { setError(describeError(error)); return false }
    finally { working.current = false; setBusy(false) }
  }

  const titles: Record<string, string> = { '/dashboard': 'Visão geral', '/today': 'Hoje', '/activities': 'Atividades', '/journeys': 'Jornadas', '/offensives': 'Ofensiva', '/account': 'Minha conta' }
  const page = titles[location.pathname] || 'Visão geral'
  return <div className="workspace">
    <a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Ir para o conteúdo</a>
    <aside className="sidebar">
      <NavLink className="brand" to="/dashboard">E<span>↗</span> Evolução</NavLink>
      <p className="nav-label">ACOMPANHAMENTO</p>
      <nav aria-label="Menu principal">
        <NavLink to="/dashboard"><span aria-hidden="true">▦</span> Visão geral</NavLink>
        <NavLink to="/today"><span aria-hidden="true">✓</span> Hoje</NavLink>
        <NavLink to="/activities"><span aria-hidden="true">☷</span> Atividades</NavLink>
        <NavLink to="/journeys"><span aria-hidden="true">◇</span> Jornadas</NavLink>
        <NavLink to="/offensives"><span aria-hidden="true">◷</span> Ofensiva</NavLink>
      </nav>
      <div className="sidebar-bottom"><NavLink to="/account">Minha conta <span aria-hidden="true">↗</span></NavLink><p>Consistência no presente.<br />Evolução ao longo do tempo.</p></div>
    </aside>
    <div className="workspace-body">
      <header className="topbar"><div className="breadcrumb">Meu espaço <span>/</span> <strong>{page}</strong></div><NavLink to="/account" className="profile-badge" aria-label="Abrir minha conta"><span className="avatar" aria-hidden="true">{data?.profile.display_name?.slice(0, 1).toUpperCase() || 'E'}</span>{data?.profile.display_name || 'Meu acompanhamento'}</NavLink></header>
      <main className="page-content" id="main-content" tabIndex={-1}>
        {error && <div className="alert" role="alert"><p>{error}</p><button onClick={() => reload().catch(error => setError(describeError(error)))} disabled={busy || refreshing}>Tentar novamente</button></div>}
        {!data ? <div className="panel empty-state" role="status"><h1>{error ? 'Não foi possível abrir seu espaço' : 'Preparando seu acompanhamento…'}</h1><p>Carregando perfil, período e atividades.</p></div> : <>
          {data.needsMigration && <div className="alert" role="status"><p>A atualização do banco da fase 3 ainda não foi aplicada. Execute <strong>004_daily_tracking.sql</strong> no Supabase e clique em verificar.</p><button onClick={() => reload().catch(error => setError(describeError(error)))} disabled={refreshing}>Verificar atualização</button></div>}
          {data.needsJourneysMigration && <div className="alert" role="status"><p>Para usar Jornadas, execute <strong>005_journey_steps.sql</strong> no Supabase e clique em verificar.</p><button onClick={() => reload().catch(error => setError(describeError(error)))} disabled={refreshing}>Verificar atualização</button></div>}
          <div className="page-heading"><div><p className="eyebrow">{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${data.today}T12:00:00Z`))}</p><h1>{page}</h1></div><div className="period-picker">
            {data.offensives.length > 0 && <label className="sr-only" htmlFor="period">Período de acompanhamento</label>}
            {data.offensives.length > 0 && <select id="period" aria-label="Período de acompanhamento" disabled={busy || refreshing} value={data.offensive?.id || ''} onChange={event => { selected.current = event.target.value; reload().catch(error => setError(describeError(error))) }}>{data.offensives.map(item => <option key={item.id} value={item.id}>{item.name}{item.status === 'archived' ? ' · Arquivada' : ''}</option>)}</select>}
            <span className="sync-status" role="status">{busy ? 'Salvando…' : refreshing ? 'Atualizando…' : 'Dados atualizados'}</span>
          </div></div>
          <Routes>
            <Route path="/dashboard" element={<Dashboard data={data} />} />
            <Route path="/today" element={<Today data={data} run={run} busy={busy || data.needsMigration} userId={userId} />} />
            <Route path="/activities" element={<Activities data={data} run={run} busy={busy || data.needsMigration} userId={userId} />} />
            <Route path="/journeys" element={<Journeys data={data} run={run} busy={busy} userId={userId} />} />
            <Route path="/offensives" element={<Offensives data={data} run={run} busy={busy} userId={userId} />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </>}
      </main>
    </div>
  </div>
}

export async function saveRow(table: string, values: Record<string, unknown>, id?: string) {
  const query = id ? supabase!.from(table).update(values).eq('id', id).select('id').single() : supabase!.from(table).insert(values).select('id').single()
  const result = await query
  if (result.error) throw result.error
  return result.data
}
