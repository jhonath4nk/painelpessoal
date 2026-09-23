import { Link } from 'react-router-dom'
import { addDays, dateLabel, execution, offensiveTime, percentLabel, statistics, statusLabels, type Summary } from '../../../domain/tracking'
import type { TrackingData } from '../api'
import { Bar, ExecutionRing, Metric } from '../components'

function dayState(day: string, summary: Summary | undefined, today: string) {
  if (day > today) return 'future'
  if (!summary || summary.execution_percent === null) return 'unplanned'
  if (summary.completed_count === summary.planned_count) return 'complete'
  if (summary.completed_count === 0) return 'missed'
  return 'partial'
}

export function Dashboard({ data }: { data: TrackingData }) {
  const { offensive, today } = data
  if (!offensive) return <section className="panel welcome-panel"><div className="welcome-mark" aria-hidden="true">↗</div><p className="eyebrow">COMECE PELO SEU PERÍODO</p><h2>O primeiro passo é definir sua ofensiva.</h2><p>Escolha uma data de início e por quantos dias quer acompanhar sua consistência. Depois, adicione as atividades que fazem parte da sua rotina.</p><Link className="button primary" to="/offensives">Criar minha ofensiva →</Link><div className="welcome-steps"><span>01 · Defina seu período</span><span>02 · Planeje suas atividades</span><span>03 · Registre seu dia</span></div></section>
  const time = offensiveTime(offensive, today)
  const stats = statistics(data.summaries, today)
  const daily = execution(data.logs)
  const summaries = new Map(data.summaries.map(summary => [summary.day, summary]))
  const periodDays = Array.from({ length: offensive.duration_days }, (_, index) => addDays(offensive.start_date, index))
  const activeJourneys = data.journeys.filter(item => item.status !== 'archived')
  const journeyIds = new Set(activeJourneys.map(item => item.id))
  const journeySteps = data.journeySteps.filter(step => journeyIds.has(step.journey_id))
  const completedSteps = journeySteps.filter(step => step.status === 'completed').length
  const journeysPercent = journeySteps.length ? completedSteps / journeySteps.length * 100 : 0
  const journeys = activeJourneys.slice(0, 4)
  return <>
    <section className="period-map panel"><div className="period-map-heading"><div><p className="eyebrow">{statusLabels[offensive.status]} · {offensive.duration_days} DIAS</p><h2>{offensive.name}</h2><p>{dateLabel(offensive.start_date, true)} — {dateLabel(offensive.end_date, true)}</p></div><div className="period-map-day"><strong>{today < offensive.start_date ? 'Ainda não começou' : today > offensive.end_date ? 'Período encerrado' : `Dia ${time.current}`}<small>{today >= offensive.start_date && today <= offensive.end_date ? ` / ${offensive.duration_days}` : ''}</small></strong><span>{percentLabel(time.temporal)} do período · {time.remaining} dias restantes</span></div></div>
      <div className="period-map-legend" aria-label="Legenda do mapa de dias"><span><i className="complete" /> Tudo concluído</span><span><i className="partial" /> Faltou item</span><span><i className="missed" /> Nada concluído</span><span><i className="unplanned" /> Sem planejamento</span></div>
      <div className="period-grid" role="img" aria-label="Mapa de execução dos dias da ofensiva">{periodDays.map(day => { const summary = summaries.get(day); const state = dayState(day, summary, today); const completion = summary?.execution_percent === null || !summary ? 'sem planejamento' : `${summary.completed_count} de ${summary.planned_count} concluídas`; return <span className={`period-day ${state}`} key={day} title={`${dateLabel(day, true)}: ${completion}`} aria-label={`${dateLabel(day, true)}: ${completion}`} /> })}</div>
    </section>

    <div className="dashboard-split">
      <section className="dashboard-domain journey-domain"><div className="domain-heading"><div><p className="eyebrow">JORNADAS · LONGO PRAZO</p><h2>Para onde você está indo</h2><p>Progresso acumulado das metas. Ele não altera sua disciplina diária.</p></div><Link className="text-link" to="/journeys">Ver todas →</Link></div>
        <div className="journey-metrics"><Metric label="Progresso das jornadas" value={percentLabel(journeysPercent)} detail="Etapas concluídas em todas as jornadas" /><Metric label="Etapas concluídas" value={<>{completedSteps}<small> de {journeySteps.length}</small></>} detail="Caminho já percorrido" /></div>
        <section className="panel journey-overview"><div className="section-heading"><div><h2>Progresso por jornada</h2><p>Veja onde está e escolha a próxima etapa.</p></div></div>{journeys.length ? <div className="journey-progress">{journeys.map(item => { const steps = data.journeySteps.filter(step => step.journey_id === item.id); const value = steps.length ? steps.filter(step => step.status === 'completed').length / steps.length * 100 : 0; return <div key={item.id}><div><strong>{item.name}</strong><span>{percentLabel(value)}</span></div><Bar value={value} label={`Progresso de ${item.name}`} /></div> })}</div> : <p className="empty-copy">Nenhuma jornada ativa. Crie uma para acompanhar metas que não pertencem à rotina diária.</p>}<Link className="button journey-button" to="/journeys">Abrir Jornadas →</Link></section>
      </section>

      <section className="dashboard-domain daily-domain"><div className="domain-heading"><div><p className="eyebrow">DISCIPLINA · CURTO PRAZO</p><h2>Como você está no dia a dia</h2><p>Percentual de cumprimento das tarefas que você planejou.</p></div><Link className="text-link" to="/today">Abrir Hoje →</Link></div>
        <div className="daily-metrics"><Metric label="Média geral de disciplina" value={percentLabel(stats.average)} detail="Todos os dias encerrados com planejamento" /><Metric label="Disciplina neste mês" value={percentLabel(stats.month)} detail="Dias encerrados no mês atual" /></div>
        <section className="panel daily-overview"><div className="section-heading"><div><h2>Seu dia, hoje</h2><p>{daily.planned ? `${daily.completed} de ${daily.planned} atividades concluídas` : 'Sem atividades planejadas'}</p></div><span className="pill">Parcial</span></div><ExecutionRing value={daily.percent} /><Link className="button primary" to="/today">Abrir tarefas de hoje →</Link></section>
        <section className="panel daily-summary"><h2>Leitura rápida</h2><div className="focus-line"><span>Dias completos</span><strong>{stats.perfect}</strong></div><div className="focus-line"><span>Dias parciais</span><strong>{stats.partial}</strong></div><div className="focus-line"><span>Dias sem execução</span><strong>{stats.zero}</strong></div><p className="muted compact">Use o mapa acima para localizar padrões. Verde indica disciplina completa; azul mostra que faltou algo; vermelho pede atenção.</p></section>
      </section>
    </div>
  </>
}
