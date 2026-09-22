export type Status = 'not_started' | 'in_progress' | 'completed' | 'archived'
export type Kind = 'daily' | 'weekdays' | 'weekly_target' | 'once' | 'manual'
export type Profile = { id: string; display_name: string; timezone: string; avatar_path: string | null; calendar_token: string | null; preferences: { theme?: 'light' | 'dark' } }
export type Offensive = { id: string; name: string; description: string; start_date: string; end_date: string; duration_days: number; status: Status; created_at: string }
export type Activity = { id: string; name: string; description: string; archived_at: string | null }
export type Schedule = { id: string; activity_id: string; kind: Kind; weekdays: number[]; weekly_target: number | null; valid_from: string; valid_until: string | null }
export type DailyLog = { id: string; activity_id: string; scheduled_date: string; name_snapshot: string; weight_snapshot: number; status: 'planned' | 'completed' | 'skipped' }
export type Summary = { day: string; execution_percent: number | null; planned_count: number; completed_count: number }
export type Note = { what_worked: string; obstacles: string; learning: string; free_note: string; energy: number | null; mood: number | null }
export type ProgressItem = { id: string; name: string; status: Status; weight: number; due_date: string | null; journey_id?: string; objective_id?: string; task_id?: string }
export type Journey = { id: string; name: string; description: string; status: Status; start_date: string | null; due_date: string | null; completed_at: string | null; archived_at: string | null }
export type JourneyStep = { id: string; journey_id: string; title: string; description: string; due_date: string | null; status: 'pending' | 'completed'; position: number; completed_at: string | null }

const DAY = 86_400_000
export function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}
export function dayDistance(from: string, to: string) { return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY) }
export function todayIn(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find(value => value.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function dateLabel(day: string, short = false) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: short ? 'short' : 'long', ...(short ? {} : { year: 'numeric' }) }).format(new Date(`${day}T12:00:00Z`))
}
export function weekStart(day: string) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay() || 7
  return addDays(day, 1 - weekday)
}
export function offensiveTime(offensive: Offensive, today: string) {
  const elapsed = Math.max(0, Math.min(offensive.duration_days, dayDistance(offensive.start_date, today)))
  return { elapsed, remaining: offensive.duration_days - elapsed, temporal: elapsed / offensive.duration_days * 100,
    current: today < offensive.start_date ? 0 : Math.min(offensive.duration_days, elapsed + 1) }
}
export function execution(logs: DailyLog[]) {
  const planned = logs.filter(log => log.status !== 'skipped')
  const total = planned.reduce((sum, log) => sum + Number(log.weight_snapshot), 0)
  const done = planned.filter(log => log.status === 'completed')
  return { planned: planned.length, completed: done.length,
    percent: total ? done.reduce((sum, log) => sum + Number(log.weight_snapshot), 0) / total * 100 : null }
}
export function statistics(rows: Summary[], today: string) {
  const closed = rows.filter(row => row.day < today).sort((a, b) => a.day.localeCompare(b.day))
  const average = (values: Summary[]) => {
    const eligible = values.filter(value => value.execution_percent !== null)
    return eligible.length ? eligible.reduce((sum, value) => sum + Number(value.execution_percent), 0) / eligible.length : null
  }
  let streak = 0; let best = 0
  for (const row of closed) {
    if (row.execution_percent === null) continue
    streak = Number(row.execution_percent) === 100 ? streak + 1 : 0
    best = Math.max(best, streak)
  }
  const currentDay = rows.find(row => row.day === today)
  if (currentDay?.execution_percent !== null && Number(currentDay?.execution_percent) === 100) streak++
  best = Math.max(best, streak)
  return { average: average(closed), week: average(closed.filter(row => row.day >= weekStart(today))),
    month: average(closed.filter(row => row.day >= `${today.slice(0, 7)}-01`)), streak, best,
    perfect: closed.filter(row => Number(row.execution_percent) === 100).length,
    partial: closed.filter(row => row.execution_percent !== null && Number(row.execution_percent) > 0 && Number(row.execution_percent) < 100).length,
    zero: closed.filter(row => row.execution_percent !== null && Number(row.execution_percent) === 0).length,
    unplanned: closed.filter(row => row.execution_percent === null).length }
}
export function progress(item: ProgressItem, levels: ProgressItem[][]): number {
  const children = (levels[0] || []).filter(child => child.status !== 'archived' && [child.journey_id, child.objective_id, child.task_id].includes(item.id))
  if (!children.length) return item.status === 'completed' ? 100 : 0
  const total = children.reduce((sum, child) => sum + Number(child.weight), 0)
  return children.reduce((sum, child) => sum + progress(child, levels.slice(1)) * Number(child.weight), 0) / total
}
export const percentLabel = (value: number | null) => value === null ? '—' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}%`
export const statusLabels: Record<Status, string> = { not_started: 'Não iniciada', in_progress: 'Em andamento', completed: 'Concluída', archived: 'Arquivada' }
export const kindLabels: Record<Kind, string> = { daily: 'Todos os dias', weekdays: 'Dias da semana', weekly_target: 'Meta semanal', once: 'Pontual', manual: 'Sem recorrência' }
export const weekdayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
