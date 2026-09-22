import { useEffect, useState, useSyncExternalStore } from 'react'
import { supabase } from '../../lib/supabase'
import { getAuthState, subscribeAuth } from './auth-store'

type Profile = { id: string; display_name: string; timezone: string }

export function AccountPage() {
  const { session } = useSyncExternalStore(subscribeAuth, getAuthState)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    if (!session || !supabase) return
    setError(''); setProfile(null)
    supabase.from('profiles').select('id, display_name, timezone').eq('id', session.user.id).single()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError('Não foi possível carregar seu perfil. Confira a conexão e se as migrações foram aplicadas.')
        else setProfile(data)
      }, () => { if (active) setError('Não foi possível carregar o perfil. Tente novamente.') })
    return () => { active = false }
  }, [session, attempt])
  async function logout() {
    setBusy(true)
    try {
      const result = await supabase!.auth.signOut()
      if (result.error) setError('Não foi possível sair. Tente novamente.')
    } catch { setError('Não foi possível sair. Tente novamente.') }
    finally { setBusy(false) }
  }
  return <main className="account"><header><a className="brand" href="#/account">E<span>↗</span> Evolução</a><button onClick={logout} disabled={busy}>{busy ? 'Saindo…' : 'Sair da conta'}</button></header>
    <section className="account-card"><p className="eyebrow">SUA CONTA</p><h1>{profile ? `Olá${profile.display_name ? `, ${profile.display_name}` : ''}.` : 'Conectando seu espaço…'}</h1>
      {error ? <><p role="alert" className="message error">{error}</p><button onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></> : profile ? <><p>Sua autenticação e seu perfil estão conectados.</p><dl><dt>E-mail</dt><dd>{session?.user.email}</dd><dt>Fuso horário</dt><dd>{profile.timezone}</dd></dl><p className="muted">O painel e a configuração da primeira ofensiva serão construídos na próxima fase.</p></> : <p role="status">Carregando perfil…</p>}
    </section></main>
}
