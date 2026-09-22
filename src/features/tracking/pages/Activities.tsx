import { useState, type FormEvent } from 'react'
import { addDays, dateLabel, kindLabels, weekdayLabels, type Activity, type Kind, type Schedule } from '../../../domain/tracking'
import { rpc } from '../api'
import { Modal } from '../components'
import type { PageProps } from '../Workspace'

export function Activities({ data, run, busy }: PageProps) {
  const [editing, setEditing] = useState<Activity | 'new' | null>(null)
  const [archiving, setArchiving] = useState<Activity | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState('')
  const list = data.activities.filter(item => showArchived ? !!item.archived_at : !item.archived_at)
  const scheduleFor = (id: string) => data.schedules.filter(schedule => schedule.activity_id === id).sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0]
  return <><div className="section-heading"><p className="muted">Configure o que faz parte da sua rotina. As atividades aparecem em Hoje nas datas planejadas.</p><button className="primary" disabled={busy} onClick={() => setEditing('new')}>Nova atividade +</button></div>
    <div className="filter-tabs"><button className={!showArchived ? 'selected' : ''} onClick={() => setShowArchived(false)}>Ativas</button><button className={showArchived ? 'selected' : ''} onClick={() => setShowArchived(true)}>Arquivadas</button></div>
    {!list.length && <section className="panel empty-state"><h2>{showArchived ? 'Nenhuma atividade arquivada' : 'Comece com o essencial'}</h2><p>{showArchived ? 'Seu histórico será preservado quando arquivar uma atividade.' : 'Adicione atividades como exercício, estudo ou leitura e escolha a frequência.'}</p></section>}
    <div className="routine-list">{list.map(item => { const schedule = scheduleFor(item.id); return <article className="panel routine-card" key={item.id}><div><h2>{item.name}</h2>{item.description && <p>{item.description}</p>}<div className="routine-meta"><span className="pill">{schedule ? kindLabels[schedule.kind] : 'Sem recorrência'}</span>{!!schedule?.weekdays.length && <span>{schedule.weekdays.map(day => weekdayLabels[day - 1]).join(' · ')}</span>}{schedule?.kind === 'weekly_target' && <span>{schedule.weekly_target} vezes/semana</span>}{schedule && schedule.valid_from > data.today && <span>A partir de {dateLabel(schedule.valid_from, true)}</span>}{schedule?.kind === 'once' && schedule.valid_from <= data.today && <span>{dateLabel(schedule.valid_from, true)}</span>}</div></div>{!item.archived_at && <div className="row-actions"><button disabled={busy} onClick={() => setEditing(item)}>Editar</button><button disabled={busy} onClick={() => { setArchiving(item); setError('') }}>Arquivar</button></div>}</article> })}</div>
    {editing && <ActivityForm key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? null : editing} schedule={editing === 'new' ? undefined : scheduleFor(editing.id)} today={data.today} busy={busy} close={() => setEditing(null)} save={async values => { const ok = await run(() => rpc('save_activity', { ...values, p_activity_id: editing === 'new' ? null : editing.id })); if (ok) setEditing(null); return ok }} />}
    {archiving && <Modal title="Arquivar atividade" close={() => setArchiving(null)} busy={busy}><p>Arquivar <strong>{archiving.name}</strong> interrompe o planejamento futuro. Hoje e o histórico permanecem salvos.</p>{error && <p className="message error" role="alert">{error}</p>}<div className="form-actions"><button disabled={busy} onClick={() => setArchiving(null)}>Cancelar</button><button className="primary" disabled={busy} onClick={async () => { const ok = await run(() => rpc('archive_activity', { p_activity_id: archiving.id })); if (ok) setArchiving(null); else setError('Não foi possível arquivar. Tente novamente.') }}>Arquivar</button></div></Modal>}
  </>
}

function ActivityForm({ item, schedule, today, busy, close, save }: { item: Activity | null; schedule?: Schedule; today: string; busy: boolean; close: () => void; save: (values: Record<string, unknown>) => Promise<boolean> }) {
  const [name, setName] = useState(item?.name || '')
  const [description, setDescription] = useState(item?.description || '')
  const [kind, setKind] = useState<Kind>(schedule?.kind || 'daily')
  const [weekdays, setWeekdays] = useState<number[]>(schedule?.weekdays || [1, 3, 5])
  const minimum = item ? addDays(today, 1) : today
  const [start, setStart] = useState(schedule && schedule.valid_from > minimum ? schedule.valid_from : minimum)
  const [error, setError] = useState('')
  const withWeekdays = kind === 'weekdays' || kind === 'weekly_target'
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    if (!name.trim() || withWeekdays && !weekdays.length) { setError('Informe um nome e selecione ao menos um dia.'); return }
    const ok = await save({ p_name: name.trim(), p_description: description, p_kind: kind, p_weekdays: withWeekdays ? [...weekdays].sort() : [], p_start: start })
    if (!ok) setError('Não foi possível salvar. Confira sua conexão e a atualização do banco.')
  }
  return <Modal title={item ? 'Editar rotina' : 'Nova atividade'} close={close} busy={busy}><form onSubmit={submit}>
    <label>Nome<input autoFocus required maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Estudar inglês" /></label>
    <label>Descrição <span className="optional">opcional</span><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} /></label>
    <label>Frequência<select value={kind} onChange={e => setKind(e.target.value as Kind)}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {withWeekdays && <fieldset><legend>Dias planejados{kind === 'weekly_target' ? ` · meta de ${weekdays.length} vezes por semana` : ''}</legend><div className="weekday-picker">{weekdayLabels.map((label, index) => <label key={label} className={weekdays.includes(index + 1) ? 'checked' : ''}><input type="checkbox" checked={weekdays.includes(index + 1)} onChange={() => setWeekdays(weekdays.includes(index + 1) ? weekdays.filter(day => day !== index + 1) : [...weekdays, index + 1])} />{label}</label>)}</div></fieldset>}
    <label>{kind === 'once' ? 'Data da atividade' : 'Começa em'}<input type="date" required min={minimum} value={start} onChange={e => setStart(e.target.value)} /></label>
    <p className="form-hint">{item ? 'Mudanças na rotina passam a valer a partir de amanhã. Para mudar só hoje, use a tela Hoje.' : kind === 'manual' ? 'Não aparece automaticamente. Você poderá adicioná-la quando quiser, na tela Hoje.' : kind === 'weekly_target' ? 'A meta corresponde aos dias selecionados. Para remanejar, remova do dia e adicione no dia escolhido em Hoje.' : 'A atividade aparecerá automaticamente nas datas planejadas.'}</p>
    {error && <p role="alert" className="message error">{error}</p>}<div className="form-actions"><button type="button" disabled={busy} onClick={close}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar atividade'}</button></div>
  </form></Modal>
}
