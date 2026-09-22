import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildIcal, type CalendarTask } from './ical.ts'

type Schedule = { activity_id: string; name_snapshot: string; valid_from: string; valid_until: string | null; kind: 'daily' | 'weekdays' | 'weekly_target' | 'once'; weekdays: number[]; daily_activities: { description: string } | null }
const addDays = (day: string, amount: number) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10) }
const todayIn = (timezone: string) => { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(); const value = (type: string) => parts.find(part => part.type === type)?.value || ''; return `${value('year')}-${value('month')}-${value('day')}` }
const isoDay = (day: string) => { const value = new Date(`${day}T12:00:00Z`).getUTCDay(); return value === 0 ? 7 : value }

Deno.serve(async request => {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) return new Response('Link de calendário inválido.', { status: 400 })
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: profile } = await client.from('profiles').select('id,display_name,timezone').eq('calendar_token', token).maybeSingle()
  if (!profile) return new Response('Link de calendário inválido.', { status: 404 })
  const start = todayIn(profile.timezone); const end = addDays(start, 90)
  const [{ data: schedules, error }, { data: logs }] = await Promise.all([
    client.from('activity_schedules').select('activity_id,name_snapshot,valid_from,valid_until,kind,weekdays,daily_activities(description)').eq('user_id', profile.id).lte('valid_from', end).or(`valid_until.is.null,valid_until.gte.${start}`),
    client.from('daily_activity_logs').select('activity_id,scheduled_date,status,name_snapshot').eq('user_id', profile.id).gte('scheduled_date', start).lte('scheduled_date', end),
  ])
  if (error) return new Response('Não foi possível gerar a agenda.', { status: 500 })
  const overrides = new Map((logs || []).map(log => [`${log.activity_id}:${log.scheduled_date}`, log]))
  const tasks: CalendarTask[] = []
  for (const schedule of (schedules || []) as Schedule[]) for (let day = start; day <= end; day = addDays(day, 1)) {
    if (day < schedule.valid_from || (schedule.valid_until && day > schedule.valid_until)) continue
    const recurring = schedule.kind === 'daily' || schedule.kind === 'once' || ((schedule.kind === 'weekdays' || schedule.kind === 'weekly_target') && schedule.weekdays.includes(isoDay(day)))
    if (!recurring) continue
    const log = overrides.get(`${schedule.activity_id}:${day}`)
    tasks.push({ id: schedule.activity_id, name: log?.name_snapshot || schedule.name_snapshot, description: schedule.daily_activities?.description, day, status: log?.status || 'planned' })
  }
  return new Response(buildIcal(tasks, `Evolução — ${profile.display_name || 'agenda'}`), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="evolucao.ics"', 'cache-control': 'no-store' } })
})
