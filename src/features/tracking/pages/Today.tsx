import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { execution, percentLabel, type DailyLog, type Note } from '../../../domain/tracking'
import { supabase } from '../../../lib/supabase'
import { rpc } from '../api'
import { Bar, Modal } from '../components'
import { saveRow, type PageProps } from '../Workspace'

export function Today({ data, run, busy, userId }: PageProps) {
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState<DailyLog | null>(null)
  const current = execution(data.logs)
  const planned = data.logs.filter(item => item.status !== 'skipped').sort((a, b) => a.name_snapshot.localeCompare(b.name_snapshot))
  const skipped = data.logs.filter(item => item.status === 'skipped')
  return <div className="today-layout"><div>
    <section className="panel daily-plan"><div className="section-heading"><div><h2>O que importa hoje</h2><p>{current.planned ? `${current.completed} de ${current.planned} concluídas` : 'Planeje o seu dia, no seu ritmo.'}</p></div><strong className="daily-percent">{percentLabel(current.percent)}</strong></div><Bar value={current.percent} label="Execução de hoje" />
      <div className="activity-checklist">{planned.map(item => <article className={`checklist-row ${item.status === 'completed' ? 'is-complete' : ''}`} key={item.id}>
        <label className="activity-check"><input type="checkbox" checked={item.status === 'completed'} disabled={busy} onChange={() => run(() => saveRow('daily_activity_logs', { status: item.status === 'completed' ? 'planned' : 'completed' }, item.id))} /><span><b>{item.name_snapshot}</b><small>{item.status === 'completed' ? 'Concluída' : 'Ainda não concluída'}</small></span></label>
        <div className="row-actions"><button disabled={busy} onClick={() => setRenaming(item)} aria-label={`Editar ${item.name_snapshot} apenas hoje`}>Editar</button><button disabled={busy} onClick={() => run(() => saveRow('daily_activity_logs', { status: 'skipped' }, item.id))} aria-label={`Remover ${item.name_snapshot} do planejamento de hoje`}>Remover</button></div>
      </article>)}</div>
      {!planned.length && <div className="empty-state"><div className="empty-icon" aria-hidden="true">☀</div><h3>Sem atividades planejadas</h3><p>Este dia não será contado como falha. Adicione uma atividade ou configure sua rotina.</p></div>}
      <div className="section-heading"><button className="primary" disabled={busy} onClick={() => setAdding(true)}>Adicionar a hoje +</button><Link className="text-link" to="/activities">Gerenciar rotina →</Link></div>
      {skipped.length > 0 && <details className="removed-activities"><summary>Removidas de hoje ({skipped.length})</summary>{skipped.map(item => <div key={item.id}><span>{item.name_snapshot}</span><button disabled={busy} onClick={() => run(() => saveRow('daily_activity_logs', { status: 'planned' }, item.id))}>Restaurar</button></div>)}</details>}
    </section><div className="quiet-note"><span aria-hidden="true">↗</span><p>Concluir uma atividade registra sua consistência. O avanço dos objetivos será acompanhado separadamente.</p></div>
  </div><DailyNotes key={data.today} note={data.note} busy={busy} save={async values => run(async () => {
    const result = await supabase!.from('daily_notes').upsert({ ...values, user_id: userId, day: data.today }, { onConflict: 'user_id,day' })
    if (result.error) throw result.error
  })} />
    {adding && <AddToday data={data} busy={busy} run={run} close={() => setAdding(false)} />}
    {renaming && <RenameToday item={renaming} busy={busy} close={() => setRenaming(null)} save={async name => { const ok = await run(() => saveRow('daily_activity_logs', { name_snapshot: name }, renaming.id)); if (ok) setRenaming(null); return ok }} />}
  </div>
}

function RenameToday({ item, busy, close, save }: { item: DailyLog; busy: boolean; close: () => void; save: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState(item.name_snapshot)
  const [error, setError] = useState('')
  return <Modal title="Editar apenas hoje" close={close} busy={busy}><form onSubmit={async event => { event.preventDefault(); if (!await save(name.trim())) setError('Não foi possível salvar. Tente novamente.') }}><label>Nome da atividade<input autoFocus required maxLength={200} pattern=".*\S.*" value={name} onChange={e => setName(e.target.value)} /></label><p className="form-hint">A rotina e os outros dias permanecem como estavam.</p>{error && <p className="message error" role="alert">{error}</p>}<button className="primary" disabled={busy}>Salvar alteração</button></form></Modal>
}

function AddToday({ data, busy, run, close }: Pick<PageProps, 'data' | 'busy' | 'run'> & { close: () => void }) {
  const [name, setName] = useState('')
  const [existing, setExisting] = useState('')
  const [error, setError] = useState('')
  const available = data.activities.filter(item => !item.archived_at && !data.logs.some(log => log.activity_id === item.id && log.status !== 'skipped'))
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    const ok = await run(async () => {
      if (existing) await rpc('add_activity_today', { p_activity_id: existing })
      else await rpc('save_activity', { p_name: name.trim(), p_description: '', p_kind: 'once', p_weekdays: [], p_start: data.today })
    })
    if (ok) close(); else setError('Não foi possível adicionar. Confira a conexão e a atualização do banco.')
  }
  return <Modal title="Adicionar ao seu dia" close={close} busy={busy}><form onSubmit={submit}>
    {!!available.length && <label>Usar uma atividade existente<select value={existing} onChange={e => setExisting(e.target.value)}><option value="">Criar uma atividade só para hoje</option>{available.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {!existing && <label>Nome<input autoFocus required maxLength={200} pattern=".*\S.*" value={name} onChange={e => setName(e.target.value)} placeholder="O que você quer fazer hoje?" /></label>}
    <p className="form-hint">A atividade será incluída apenas no planejamento de hoje.</p>{error && <p className="message error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Adicionando…' : 'Adicionar atividade'}</button>
  </form></Modal>
}

const emptyNote: Note = { what_worked: '', obstacles: '', learning: '', free_note: '', energy: null, mood: null }
function DailyNotes({ note, busy, save }: { note: Note | null; busy: boolean; save: (values: Note) => Promise<boolean> }) {
  const [draft, setDraft] = useState<Note>(note || emptyNote)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const fields = { what_worked: 'O que funcionou?', obstacles: 'O que atrapalhou?', learning: 'O que você aprendeu?', free_note: 'Observação livre' } as const
  return <section className="panel notes-panel"><h2>Uma pausa para refletir</h2><p className="muted">Opcional. Um registro simples do seu dia.</p><form onSubmit={async event => { event.preventDefault(); const ok = await save(draft); setError(!ok); setMessage(ok ? 'Notas salvas.' : 'Não foi possível salvar. Seu texto continua aqui para tentar novamente.') }}>
    <div className="form-grid">{(['energy', 'mood'] as const).map(field => <label key={field}>{field === 'energy' ? 'Energia' : 'Humor'}<select value={draft[field] || ''} onChange={e => { setDraft({ ...draft, [field]: e.target.value ? Number(e.target.value) : null }); setMessage('') }}><option value="">Não registrar</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} — {['Muito baixo', 'Baixo', 'Regular', 'Bom', 'Muito bom'][value - 1]}</option>)}</select></label>)}</div>
    {Object.entries(fields).map(([key, label]) => <label key={key}>{label}<textarea rows={2} value={draft[key as keyof typeof fields]} onChange={e => { setDraft({ ...draft, [key]: e.target.value }); setMessage('') }} /></label>)}
    {message && <p className={`message ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>{message}</p>}<button disabled={busy}>{busy ? 'Salvando…' : 'Salvar notas do dia'}</button>
  </form></section>
}
