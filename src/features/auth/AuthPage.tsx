import { useState, useSyncExternalStore, type FormEvent } from 'react'
import { getAuthState, subscribeAuth, finishRecovery } from './auth-store'
import { authRedirectUrl, supabase } from '../../lib/supabase'

export function AuthPage() {
  const auth = useSyncExternalStore(subscribeAuth, getAuthState)
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const recovery = auth.recovery

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase || busy) return
    setError(null); setNotice('')
    if (recovery && password !== confirmation) { setError('As senhas precisam ser iguais.'); return }
    setBusy(true)
    try {
      if (recovery) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setPassword(''); setConfirmation(''); finishRecovery()
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl() })
        if (error) throw error
        setNotice('Se o endereço estiver cadastrado, você receberá um link para redefinir a senha.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      }
    } catch {
      setError(recovery ? 'Não foi possível atualizar a senha. Use uma senha diferente, com pelo menos 12 caracteres, ou solicite outro link.' : mode === 'forgot' ? 'Não foi possível enviar o link agora. Aguarde um pouco e tente novamente.' : 'Não foi possível entrar. Confira e-mail, senha e conexão.')
    } finally { setBusy(false) }
  }

  return <main className="auth-layout">
    <section className="intro">
      <a className="brand" href="#/">E<span>↗</span> Evolução</a>
      <div><p className="eyebrow">SEU ESPAÇO DE ACOMPANHAMENTO</p><h1>Um dia de cada vez.<br /><span>Uma vida em evolução.</span></h1><p className="intro-copy">Acompanhe o que você faz hoje e o que está construindo para o futuro.</p></div>
      <div className="principles"><div><b>01 / Consistência</b><p>Presença nas atividades que importam.</p></div><div><b>02 / Evolução</b><p>Avanço nos seus objetivos de vida.</p></div></div>
    </section>
    <section className="auth-panel" aria-label="Acesso à conta"><div className="auth-card">
      <p className="eyebrow">ACESSO PESSOAL</p><h2>{recovery ? 'Escolha sua nova senha' : mode === 'forgot' ? 'Recupere seu acesso' : 'Bem-vindo de volta'}</h2>
      <p className="muted">{recovery ? 'Proteja sua conta com uma senha única.' : mode === 'forgot' ? 'Enviaremos um link para o seu e-mail.' : 'Entre para continuar seu acompanhamento.'}</p>
      <form onSubmit={submit}>
        {!recovery && <label>E-mail<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} placeholder="voce@exemplo.com" /></label>}
        {(recovery || mode === 'login') && <label>{recovery ? 'Nova senha' : 'Senha'}<input type="password" autoComplete={recovery ? 'new-password' : 'current-password'} required minLength={recovery ? 12 : 1} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>}
        {recovery && <label>Confirme a nova senha<input type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></label>}
        {(error || auth.error) && <p className="message error" role="alert">{error || auth.error}</p>}
        {notice && <p className="message success" role="status">{notice}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Aguarde…' : recovery ? 'Salvar nova senha' : mode === 'forgot' ? 'Enviar link de recuperação' : 'Entrar na minha conta →'}</button>
      </form>
      {!recovery && <button className="text-button" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setError(null); setNotice(''); setPassword('') }}>{mode === 'login' ? 'Esqueci minha senha' : 'Voltar para o login'}</button>}
      <p className="footnote">Seu espaço é privado. O acesso é restrito à sua conta.</p>
    </div></section>
  </main>
}
