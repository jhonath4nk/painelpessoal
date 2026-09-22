import { useState, type FormEvent } from 'react'
import { addDays, dateLabel, offensiveTime, statusLabels, type Offensive, type Status } from '../../../domain/tracking'
import { Modal, Bar } from '../components'
import { saveRow, type PageProps } from '../Workspace'

export function Offensives({ data, run, busy, userId }: PageProps) {
  const [editing, setEditing] = useState<Offensive | 'new' | null>(null)
  return <><div className="section-heading"><p className="muted">Defina os períodos em que quer acompanhar sua evolução.</p><button className="primary" onClick={() => setEditing('new')}>Nova ofensiva +</button></div>
    {!data.offensives.length && <section className="panel empty-state"><h2>Qual será o seu próximo período?</h2><p>Pode ser 30, 90, 365 dias ou a duração que fizer sentido para você.</p><button onClick={() => setEditing('new')} className="primary">Criar primeira ofensiva</button></section>}
    <div className="offensive-list">{data.offensives.map(item => { const time = offensiveTime(item, data.today); return <article className="panel" key={item.id}><div className="section-heading"><h2>{item.name}</h2><span className="pill">{statusLabels[item.status]}</span></div><p className="muted">{dateLabel(item.start_date)} — {dateLabel(item.end_date)}</p>{item.description && <p>{item.description}</p>}<Bar value={time.temporal} label="Tempo transcorrido" /><div className="section-heading"><p className="muted compact">{time.elapsed} dias decorridos · {time.remaining} restantes</p><button onClick={() => setEditing(item)} disabled={busy}>Editar</button></div></article> })}</div>
    {editing && <OffensiveForm key={typeof editing === 'string' ? 'new' : editing.id} item={editing === 'new' ? null : editing} today={data.today} busy={busy} close={() => setEditing(null)} save={async values => { const ok = await run(() => saveRow('offensives', { ...values, user_id: userId }, editing === 'new' ? undefined : editing.id)); if (ok) setEditing(null); return ok }} />}
  </>
}

function OffensiveForm({ item, today, busy, close, save }: { item: Offensive | null; today: string; busy: boolean; close: () => void; save: (values: Record<string, unknown>) => Promise<boolean> }) {
  const [name, setName] = useState(item?.name || '')
  const [description, setDescription] = useState(item?.description || '')
  const [start, setStart] = useState(item?.start_date || today)
  const [duration, setDuration] = useState(String(item?.duration_days || 365))
  const [status, setStatus] = useState<Status>(item?.status || 'in_progress')
  const [error, setError] = useState('')
  const days = Number(duration)
  const end = start && Number.isInteger(days) && days > 0 && days <= 36500 ? addDays(start, days - 1) : null
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    if (!end || !name.trim()) { setError('Informe nome, data e uma duração entre 1 e 36.500 dias.'); return }
    if (!await save({ name: name.trim(), description, start_date: start, duration_days: days, status })) setError('Não foi possível salvar. Verifique se já existe outra ofensiva em andamento ou se a conexão falhou.')
  }
  return <Modal title={item ? 'Editar ofensiva' : 'Sua nova ofensiva'} close={close} busy={busy}><form onSubmit={submit}>
    <label>Nome<input autoFocus required maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Um ano de evolução" /></label>
    <div className="form-grid"><label>Data inicial<input required type="date" value={start} onChange={e => setStart(e.target.value)} /></label><label>Duração em dias<input required type="number" min={1} max={36500} step={1} value={duration} onChange={e => setDuration(e.target.value)} /></label></div>
    <p className="form-hint">Data final: <strong>{end ? dateLabel(end) : 'Preencha o período'}</strong></p>
    <label>Status<select value={status} onChange={e => setStatus(e.target.value as Status)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Descrição <span className="optional">opcional</span><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} /></label>
    {item && <p className="form-hint">Alterar o período muda as métricas exibidas, mas preserva seus registros diários. Arquivar mantém a ofensiva disponível para consulta.</p>}
    {error && <p role="alert" className="message error">{error}</p>}<div className="form-actions"><button type="button" onClick={close} disabled={busy}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar ofensiva'}</button></div>
  </form></Modal>
}
