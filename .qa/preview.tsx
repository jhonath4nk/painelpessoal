import { createRoot } from 'react-dom/client'
import { HashRouter, NavLink, Routes, Route } from 'react-router-dom'
import { Dashboard } from '../src/features/tracking/pages/Dashboard'
import { Today } from '../src/features/tracking/pages/Today'
import { Activities } from '../src/features/tracking/pages/Activities'
import { Offensives } from '../src/features/tracking/pages/Offensives'
import { Journeys } from '../src/features/tracking/pages/Journeys'
import type { TrackingData } from '../src/features/tracking/api'
import '../src/styles/global.css'
import '../src/styles/workspace.css'
const data: TrackingData = {
  profile: { id: 'test', display_name: 'Verificação visual', timezone: 'America/Sao_Paulo' }, today: '2026-09-22',
  offensive: { id: 'period', name: 'Um ano de evolução', start_date: '2026-09-01', end_date: '2027-08-31', duration_days: 365, status: 'in_progress', description: '', created_at: '' },
  offensives: [], activities: [{ id: 'a', name: 'Estudar inglês', description: 'Uma sessão por dia', archived_at: null }, { id: 'b', name: 'Exercício', description: '', archived_at: null }],
  schedules: [{ id: 's', activity_id: 'a', kind: 'daily', weekdays: [], weekly_target: null, valid_from: '2026-09-01', valid_until: null }],
  logs: [{ id: '1', activity_id: 'a', name_snapshot: 'Estudar inglês', scheduled_date: '2026-09-22', weight_snapshot: 1, status: 'completed' }, { id: '2', activity_id: 'b', name_snapshot: 'Exercício', scheduled_date: '2026-09-22', weight_snapshot: 1, status: 'planned' }],
  summaries: Array.from({ length: 22 }, (_, i) => ({ day: `2026-09-${String(i+1).padStart(2,'0')}`, execution_percent: i%7 === 6 ? null : [100,66,33,100,0][i%5], planned_count: 3, completed_count: 2 })),
  note: null, journeys: [{ id: 'j1', name: 'Jiu-jitsu', description: 'Evoluir com consistência.', status: 'in_progress', start_date: '2026-09-01', due_date: '2027-04-10', completed_at: null, archived_at: null }], journeySteps: [{ id: 'js1', journey_id: 'j1', title: 'Matricular no jiu-jitsu', description: '', due_date: null, status: 'completed', position: 0, completed_at: '' }, { id: 'js2', journey_id: 'j1', title: 'Completar 1 mês', description: '', due_date: null, status: 'completed', position: 1, completed_at: '' }, { id: 'js3', journey_id: 'j1', title: 'Completar 6 meses', description: '', due_date: '2027-04-10', status: 'pending', position: 2, completed_at: null }], objectives: [], tasks: [], subtasks: [], needsMigration: false, needsJourneysMigration: false,
}
data.offensives = [data.offensive!]
const props = { data, busy: false, userId: 'test', run: async () => true }
createRoot(document.getElementById('root')!).render(<HashRouter><div className="workspace"><aside className="sidebar"><span className="brand">E↗ Evolução</span><p className="nav-label">DADOS DE TESTE · QA</p><nav><NavLink to="/">Visão geral</NavLink><NavLink to="/today">Hoje</NavLink><NavLink to="/activities">Atividades</NavLink><NavLink to="/journeys">Jornadas</NavLink><NavLink to="/offensives">Ofensiva</NavLink></nav></aside><div className="workspace-body"><header className="topbar">Verificação visual · dados fictícios, sem gravação</header><main className="page-content"><div className="page-heading"><h1>Acompanhamento pessoal</h1></div><Routes><Route path="/" element={<Dashboard data={data} />} /><Route path="/today" element={<Today {...props} />} /><Route path="/activities" element={<Activities {...props} />} /><Route path="/journeys" element={<Journeys {...props} />} /><Route path="/offensives" element={<Offensives {...props} />} /></Routes></main></div></div></HashRouter>)
