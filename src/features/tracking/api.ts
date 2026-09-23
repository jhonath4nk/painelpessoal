import { supabase } from '../../lib/supabase'
import { addDays, todayIn, type Activity, type DailyLog, type Journey, type JourneyStep, type Note, type Offensive, type Profile, type ProgressItem, type Schedule, type Summary } from '../../domain/tracking'

export type TrackingData = { profile: Profile; today: string; offensives: Offensive[]; offensive: Offensive | null;
  activities: Activity[]; schedules: Schedule[]; logs: DailyLog[]; yesterdayLogs: DailyLog[]; summaries: Summary[]; note: Note | null;
  journeys: Journey[]; journeySteps: JourneyStep[]; objectives: ProgressItem[]; tasks: ProgressItem[]; subtasks: ProgressItem[]; needsMigration: boolean; needsJourneysMigration: boolean }

export function describeError(error: unknown): string {
  const value = error as { code?: string; message?: string }
  if (value.code === '23505') return 'Já existe um registro equivalente. Apenas uma ofensiva pode estar em andamento.'
  if (value.code === 'PGRST202') return 'Falta aplicar a atualização SQL da fase 3 no Supabase.'
  if (value.code === '42501') return 'Sua sessão não tem acesso a esta operação. Entre novamente e tente outra vez.'
  return 'Não foi possível salvar ou carregar os dados. Confira sua conexão e tente novamente.'
}
export async function rpc(name: string, args: Record<string, unknown>) {
  const result = await supabase!.rpc(name, args)
  if (result.error) throw result.error
  return result.data
}
async function rows<T>(table: string, userId: string, date?: { column: string; from: string; to: string }): Promise<T[]> {
  const all: T[] = []
  for (let offset = 0; ; offset += 1000) {
    let query = supabase!.from(table).select('*').eq('user_id', userId).order('id').range(offset, offset + 999)
    if (date) query = query.gte(date.column, date.from).lte(date.column, date.to)
    const result = await query
    if (result.error) throw result.error
    all.push(...result.data as T[])
    if (result.data.length < 1000) return all
  }
}
export async function loadTracking(userId: string, selected: string | null): Promise<TrackingData> {
  const [profileResult, offensives] = await Promise.all([
    supabase!.from('profiles').select('id,display_name,timezone,avatar_path,calendar_token,preferences').eq('id', userId).single(), rows<Offensive>('offensives', userId),
  ])
  if (profileResult.error) throw profileResult.error
  const profile = profileResult.data as Profile
  const today = todayIn(profile.timezone)
  offensives.sort((a, b) => b.created_at.localeCompare(a.created_at))
  const offensive = offensives.find(item => item.id === selected) || offensives.find(item => item.status === 'in_progress') || offensives[0] || null
  let needsMigration = false
  const sync = async (from: string, to: string) => {
    try { await rpc('sync_tracking', { p_from: from, p_to: to }) }
    catch (error) { if ((error as { code?: string }).code === 'PGRST202') needsMigration = true; else throw error }
  }
  // Today remains usable even outside an offensive. Older periods are synchronized in bounded batches.
  await sync(addDays(today, -1), today)
  const until = offensive && offensive.end_date < today ? offensive.end_date : today
  if (!needsMigration && offensive) {
    for (let from = offensive.start_date; from <= until; from = addDays(from, 366)) {
      await sync(from, addDays(from, 365) < until ? addDays(from, 365) : until)
    }
  }
  const journeySteps = await rows<JourneyStep>('journey_steps', userId).catch(error => {
    const code = (error as { code?: string }).code
    if (code === 'PGRST205' || code === '42P01') return null
    throw error
  })
  const [activities, schedules, logs, yesterdayLogs, summaries, notes, journeys, objectives, tasks, subtasks] = await Promise.all([
    rows<Activity>('daily_activities', userId), rows<Schedule>('activity_schedules', userId),
    rows<DailyLog>('daily_activity_logs', userId, { column: 'scheduled_date', from: today, to: today }),
    rows<DailyLog>('daily_activity_logs', userId, { column: 'scheduled_date', from: addDays(today, -1), to: addDays(today, -1) }),
    offensive && offensive.start_date <= until ? rows<Summary>('daily_summaries', userId, { column: 'day', from: offensive.start_date, to: until }) : Promise.resolve([]),
    rows<Note>('daily_notes', userId, { column: 'day', from: today, to: today }),
    rows<Journey>('journeys', userId), rows<ProgressItem>('objectives', userId), rows<ProgressItem>('tasks', userId), rows<ProgressItem>('subtasks', userId),
  ])
  return { profile, today, offensives, offensive, activities, schedules, logs, yesterdayLogs, summaries, note: notes[0] || null, journeys, journeySteps: journeySteps || [], objectives, tasks, subtasks, needsMigration, needsJourneysMigration: journeySteps === null }
}
