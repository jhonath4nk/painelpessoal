import { type ChangeEvent, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../profile/Avatar'
import { getAuthState, subscribeAuth } from './auth-store'

type Profile = { id: string; display_name: string; timezone: string; avatar_path: string | null; calendar_token: string | null }
type Props = { onProfileUpdated: () => Promise<void> }

export function AccountPage({ onProfileUpdated }: Props) {
  const { session } = useSyncExternalStore(subscribeAuth, getAuthState)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    if (!session || !supabase) return
    setError(''); setNotice(''); setProfile(null)
    supabase.from('profiles').select('id, display_name, timezone, avatar_path, calendar_token').eq('id', session.user.id).single().then(({ data, error: profileError }) => {
      if (!active) return
      if (profileError) setError('Não foi possível carregar seu perfil. Confira a conexão e se a atualização 006 foi aplicada.')
      else { setProfile(data); setName(data.display_name) }
    }, () => { if (active) setError('Não foi possível carregar o perfil. Tente novamente.') })
    return () => { active = false }
  }, [session, attempt])
  useEffect(() => {
    let active = true
    if (!profile?.avatar_path) { setAvatarUrl(null); return }
    supabase!.storage.from('avatars').createSignedUrl(profile.avatar_path, 3600).then(({ data, error: storageError }) => {
      if (active) setAvatarUrl(storageError ? null : data?.signedUrl || null)
    })
    return () => { active = false }
  }, [profile?.avatar_path])
  const calendarUrl = useMemo(() => profile?.calendar_token && import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar?token=${profile.calendar_token}` : '', [profile?.calendar_token])
  async function saveName() {
    if (!profile || !name.trim()) { setError('Informe como você quer ser chamado.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await supabase!.from('profiles').update({ display_name: name.trim() }).eq('id', profile.id).select('id, display_name, timezone, avatar_path, calendar_token').single()
      if (result.error) throw result.error
      setProfile(result.data); setName(result.data.display_name); setNotice('Nome salvo.'); await onProfileUpdated()
    } catch { setError('Não foi possível salvar seu nome. Tente novamente.') }
    finally { setBusy(false) }
  }
  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file || !profile || !session) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('Envie uma imagem JPG, PNG ou WebP de até 2 MB.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const path = `${session.user.id}/avatar`
      const upload = await supabase!.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (upload.error) throw upload.error
      const update = await supabase!.from('profiles').update({ avatar_path: path }).eq('id', profile.id).select('id, display_name, timezone, avatar_path, calendar_token').single()
      if (update.error) throw update.error
      setProfile(update.data); setNotice('Foto atualizada.'); await onProfileUpdated()
    } catch { setError('Não foi possível enviar a foto. Confirme se a atualização 006 foi aplicada no Supabase.') }
    finally { setBusy(false) }
  }
  async function copyCalendar() { try { await navigator.clipboard.writeText(calendarUrl); setNotice('Link copiado. No Calendário da Apple, escolha Arquivo > Nova Assinatura de Calendário.'); } catch { setError('Não foi possível copiar o link. Selecione-o e copie manualmente.') } }
  async function rotateCalendar() {
    if (!profile) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await supabase!.from('profiles').update({ calendar_token: crypto.randomUUID() }).eq('id', profile.id).select('id, display_name, timezone, avatar_path, calendar_token').single()
      if (result.error) throw result.error
      setProfile(result.data); setNotice('Novo link gerado. Atualize a assinatura no Calendário da Apple.'); await onProfileUpdated()
    } catch { setError('Não foi possível gerar um novo link. Tente novamente.') }
    finally { setBusy(false) }
  }
  async function logout() { setBusy(true); try { const result = await supabase!.auth.signOut(); if (result.error) setError('Não foi possível sair. Tente novamente.') } catch { setError('Não foi possível sair. Tente novamente.') } finally { setBusy(false) } }
  return <section className="panel account-settings"><div className="section-heading"><div><h2>Minha conta</h2><p>Personalize como seu espaço aparece para você.</p></div><button onClick={logout} disabled={busy}>{busy ? 'Saindo…' : 'Sair da conta'}</button></div>
    {error && <p role="alert" className="message error">{error}</p>}{notice && <p role="status" className="message success">{notice}</p>}
    {error && !profile ? <button onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button> : profile ? <div className="account-content">
      <section className="profile-editor"><Avatar name={profile.display_name} src={avatarUrl} className="profile-avatar" /><div><h3>Seu perfil</h3><p>Essa foto e esse nome aparecem no menu lateral.</p><label className="file-button">{busy ? 'Enviando…' : 'Escolher foto'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={busy} /></label><small>JPG, PNG ou WebP, até 2 MB.</small></div></section>
      <form className="account-form" onSubmit={event => { event.preventDefault(); saveName() }}><label htmlFor="display-name">Como quer ser chamado?<input id="display-name" value={name} onChange={event => setName(event.target.value)} maxLength={80} disabled={busy} required /></label><button className="primary" disabled={busy}>Salvar nome</button></form>
      <dl><dt>E-mail</dt><dd>{session?.user.email}</dd><dt>Fuso horário</dt><dd>{profile.timezone}</dd></dl>
      <section className="calendar-settings"><h3>Agenda do dia</h3><p>Assine este calendário no Apple Calendar para ver suas tarefas planejadas dos próximos 90 dias. Quando uma atividade muda no Evolução, a agenda se atualiza na próxima sincronização do calendário.</p>{calendarUrl ? <><label htmlFor="calendar-link">Link de assinatura<input id="calendar-link" value={calendarUrl} readOnly /></label><div className="form-actions calendar-actions"><button type="button" onClick={copyCalendar} disabled={busy}>Copiar link</button><button type="button" onClick={rotateCalendar} disabled={busy}>Gerar novo link</button></div><p className="muted">No Calendário da Apple: Arquivo &gt; Nova Assinatura de Calendário, cole o link e confirme.</p></> : <p className="muted">Aplique a atualização 006 do banco para gerar seu link de assinatura.</p>}</section>
    </div> : <p role="status">Carregando perfil…</p>}
  </section>
}
