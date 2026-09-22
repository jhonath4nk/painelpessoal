import { useState } from 'react'
import { dateLabel, percentLabel, type Journey, type JourneyStep } from '../../../domain/tracking'
import { rpc } from '../api'
import { Bar, Modal } from '../components'
import { saveRow, type PageProps } from '../Workspace'
import { supabase } from '../../../lib/supabase'

const journeyStatus = (status: Journey['status']) => ({ in_progress: 'Ativa', completed: 'Concluída', archived: 'Arquivada', not_started: 'Ativa' })[status]

export function Journeys({ data, run, busy, userId }: PageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Journey | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const journeys = data.journeys.filter(item => showArchived ? item.status === 'archived' : item.status !== 'archived')
  if (data.needsJourneysMigration) return <section className="panel empty-state"><h2>Jornadas precisam da atualização do banco</h2><p>Execute o arquivo SQL 005 no Supabase e atualize esta página. As atividades diárias continuam inalteradas.</p></section>
  const stepsFor = (id: string) => data.journeySteps.filter(step => step.journey_id === id).sort((a, b) => a.position - b.position)
  const selected = selectedId ? data.journeys.find(item => item.id === selectedId) : null
  if (selected) return <JourneyDetail journey={selected} steps={stepsFor(selected.id)} run={run} busy={busy} userId={userId} back={() => setSelectedId(null)} />
  return <>
    <div className="section-heading"><p className="muted">Objetivos de médio e longo prazo. Eles não entram na execução do dia ou da ofensiva.</p><button className="primary" onClick={() => setEditing('new')} disabled={busy}>Nova jornada +</button></div>
    <div className="filter-tabs"><button className={!showArchived ? 'selected' : ''} onClick={() => setShowArchived(false)}>Ativas</button><button className={showArchived ? 'selected' : ''} onClick={() => setShowArchived(true)}>Arquivadas</button></div>
    {!journeys.length && <section className="panel empty-state"><h2>{showArchived ? 'Nenhuma jornada arquivada' : 'Comece uma jornada'}</h2><p>{showArchived ? 'Jornadas arquivadas permanecem disponíveis aqui.' : 'Use jornadas para metas como uma formação, projeto pessoal, viagem ou nova habilidade.'}</p>{!showArchived && <button className="primary" onClick={() => setEditing('new')}>Criar jornada</button>}</section>}
    <div className="journey-cards">{journeys.map(journey => <JourneyCard key={journey.id} journey={journey} steps={stepsFor(journey.id)} open={() => setSelectedId(journey.id)} />)}</div>
    {editing && <JourneyForm journey={editing === 'new' ? null : editing} busy={busy} close={() => setEditing(null)} save={async values => { const ok = await run(() => saveRow('journeys', { ...values, user_id: userId }, editing === 'new' ? undefined : editing.id)); if (ok) setEditing(null); return ok }} />}
  </>
}

function JourneyCard({ journey, steps, open }: { journey: Journey; steps: JourneyStep[]; open: () => void }) {
  const completed = steps.filter(step => step.status === 'completed').length
  const value = steps.length ? completed / steps.length * 100 : 0
  const next = steps.find(step => step.status === 'pending')
  const nextDue = next?.due_date || journey.due_date
  return <button className="panel journey-card" onClick={open}><div className="section-heading"><h2>{journey.name}</h2><span className="pill">{journeyStatus(journey.status)}</span></div><strong className="journey-percent">{percentLabel(value)}</strong><Bar value={value} label={`Progresso de ${journey.name}`} /><p className="journey-count">{completed} de {steps.length} etapas concluídas</p><div className="journey-next"><span>Próxima etapa</span><strong>{next?.title || (steps.length ? 'Todas concluídas' : 'Adicione a primeira etapa')}</strong>{nextDue && <small>Próximo prazo: {dateLabel(nextDue)}</small>}{journey.due_date && <small>Prazo geral: {dateLabel(journey.due_date)}</small>}</div></button>
}

function JourneyDetail({ journey, steps, run, busy, userId, back }: { journey: Journey; steps: JourneyStep[]; run: PageProps['run']; busy: boolean; userId: string; back: () => void }) {
  const [editingJourney, setEditingJourney] = useState(false)
  const [editingStep, setEditingStep] = useState<JourneyStep | 'new' | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const completed = steps.filter(step => step.status === 'completed').length
  const value = steps.length ? completed / steps.length * 100 : 0
  const saveJourney = async (values: Record<string, unknown>) => { const ok = await run(() => saveRow('journeys', { ...values, user_id: userId }, journey.id)); if (ok) setEditingJourney(false); return ok }
  return <><button className="back-link" onClick={back}>← Voltar para Jornadas</button><section className="panel journey-detail-header"><div className="section-heading"><div><span className="pill">{journeyStatus(journey.status)}</span><h2>{journey.name}</h2></div><div className="row-actions"><button disabled={busy} onClick={() => setEditingJourney(true)}>Editar</button>{journey.status === 'archived' ? <button disabled={busy} onClick={() => run(() => saveRow('journeys', { status: 'in_progress' }, journey.id))}>Reativar</button> : <button disabled={busy} onClick={() => setConfirmArchive(true)}>Arquivar</button>}</div></div>{journey.description && <p className="muted">{journey.description}</p>}<div className="journey-detail-progress"><div><strong>{percentLabel(value)}</strong><span>{completed} de {steps.length} etapas concluídas</span></div><Bar value={value} label={`Progresso de ${journey.name}`} /></div><div className="journey-dates">{journey.start_date && <span>Início: <strong>{dateLabel(journey.start_date)}</strong></span>}{journey.due_date && <span>Prazo geral: <strong>{dateLabel(journey.due_date)}</strong></span>}</div>{journey.status === 'completed' && <button className="text-link" disabled={busy} onClick={() => run(() => saveRow('journeys', { status: 'in_progress' }, journey.id))}>Reabrir jornada</button>}</section>
    <section className="panel steps-panel"><div className="section-heading"><div><h2>Etapas</h2><p>A ordem organiza a visualização; você pode concluir qualquer etapa.</p></div>{journey.status !== 'archived' && <button className="primary" disabled={busy} onClick={() => setEditingStep('new')}>Nova etapa +</button>}</div>{steps.length ? <ol className="steps-list">{steps.map((step, index) => <li key={step.id} className={step.status === 'completed' ? 'is-complete' : ''}><label><input type="checkbox" aria-label={`Concluir ${step.title}`} checked={step.status === 'completed'} disabled={busy || journey.status === 'archived'} onChange={() => run(() => saveRow('journey_steps', { status: step.status === 'completed' ? 'pending' : 'completed' }, step.id))} /><span><b>{step.title}</b>{step.description && <small>{step.description}</small>}{step.due_date && <small>Prazo: {dateLabel(step.due_date)}</small>}</span></label><div className="row-actions"><button disabled={busy || index === 0 || journey.status === 'archived'} onClick={() => run(() => rpc('move_journey_step', { p_step_id: step.id, p_direction: 'up' }))} aria-label={`Mover ${step.title} para cima`}>↑</button><button disabled={busy || index === steps.length - 1 || journey.status === 'archived'} onClick={() => run(() => rpc('move_journey_step', { p_step_id: step.id, p_direction: 'down' }))} aria-label={`Mover ${step.title} para baixo`}>↓</button><button disabled={busy || journey.status === 'archived'} onClick={() => setEditingStep(step)}>Editar</button><button disabled={busy || journey.status === 'archived'} onClick={() => run(async () => { const result = await supabaseDeleteStep(step.id); if (!result) throw new Error('Delete failed') })}>Excluir</button></div></li>)}</ol> : <div className="empty-state"><p>Adicione etapas para acompanhar o progresso desta jornada.</p></div>}</section>
    {editingJourney && <JourneyForm journey={journey} busy={busy} close={() => setEditingJourney(false)} save={saveJourney} />}
    {editingStep && <StepForm step={editingStep === 'new' ? null : editingStep} journeyId={journey.id} position={steps.length} busy={busy} close={() => setEditingStep(null)} save={async values => { const ok = await run(() => saveRow('journey_steps', { ...values, user_id: userId, journey_id: journey.id, position: editingStep === 'new' ? steps.length : undefined }, editingStep === 'new' ? undefined : editingStep.id)); if (ok) setEditingStep(null); return ok }} />}
    {confirmArchive && <Modal title="Arquivar jornada" close={() => setConfirmArchive(false)} busy={busy}><p>Arquivar <strong>{journey.name}</strong> a remove da lista ativa, preservando as etapas e o histórico.</p><div className="form-actions"><button disabled={busy} onClick={() => setConfirmArchive(false)}>Cancelar</button><button className="primary" disabled={busy} onClick={async () => { const ok = await run(() => saveRow('journeys', { status: 'archived' }, journey.id)); if (ok) { setConfirmArchive(false); back() } }}>Arquivar</button></div></Modal>}
  </>
}

async function supabaseDeleteStep(id: string) { const result = await supabase!.from('journey_steps').delete().eq('id', id); return !result.error }

function JourneyForm({ journey, busy, close, save }: { journey: Journey | null; busy: boolean; close: () => void; save: (values: Record<string, unknown>) => Promise<boolean> }) {
  const [name, setName] = useState(journey?.name || '')
  const [description, setDescription] = useState(journey?.description || '')
  const [start, setStart] = useState(journey?.start_date || '')
  const [due, setDue] = useState(journey?.due_date || '')
  const [error, setError] = useState('')
  return <Modal title={journey ? 'Editar jornada' : 'Nova jornada'} close={close} busy={busy}><form onSubmit={async event => { event.preventDefault(); if (!name.trim()) { setError('Informe um título.'); return }; if (!await save({ name: name.trim(), description, start_date: start || null, due_date: due || null, status: journey?.status || 'in_progress' })) setError('Não foi possível salvar. Tente novamente.') }}><label>Título<input autoFocus required maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Jiu-jitsu" /></label><label>Descrição <span className="optional">opcional</span><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} /></label><div className="form-grid"><label>Data de início <span className="optional">opcional</span><input type="date" value={start} onChange={e => setStart(e.target.value)} /></label><label>Prazo geral <span className="optional">opcional</span><input type="date" value={due} onChange={e => setDue(e.target.value)} /></label></div>{error && <p role="alert" className="message error">{error}</p>}<div className="form-actions"><button type="button" onClick={close} disabled={busy}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar jornada'}</button></div></form></Modal>
}

function StepForm({ step, journeyId, position, busy, close, save }: { step: JourneyStep | null; journeyId: string; position: number; busy: boolean; close: () => void; save: (values: Record<string, unknown>) => Promise<boolean> }) {
  const [title, setTitle] = useState(step?.title || '')
  const [description, setDescription] = useState(step?.description || '')
  const [due, setDue] = useState(step?.due_date || '')
  const [error, setError] = useState('')
  return <Modal title={step ? 'Editar etapa' : 'Nova etapa'} close={close} busy={busy}><form onSubmit={async event => { event.preventDefault(); if (!title.trim()) { setError('Informe um título.'); return }; if (!await save({ title: title.trim(), description, due_date: due || null, status: step?.status || 'pending', position, journey_id: journeyId })) setError('Não foi possível salvar. Tente novamente.') }}><label>Título<input autoFocus required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Completar 1 mês" /></label><label>Descrição <span className="optional">opcional</span><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} /></label><label>Prazo <span className="optional">opcional</span><input type="date" value={due} onChange={e => setDue(e.target.value)} /></label>{error && <p role="alert" className="message error">{error}</p>}<div className="form-actions"><button type="button" onClick={close} disabled={busy}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar etapa'}</button></div></form></Modal>
}
