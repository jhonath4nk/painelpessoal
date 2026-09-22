import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'

const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
let db: PGlite
async function asUser(id: string) {
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`)
}
async function row(sql: string) { return (await db.query<Record<string, unknown>>(sql)).rows[0] }

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
    $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;`)
  for (const file of readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
  }
  await db.exec(`insert into auth.users(id,raw_user_meta_data) values
    ('${alice}','{"display_name":"Alice"}'),('${bob}','{"display_name":"Bob"}');`)
}, 30000)
afterAll(async () => { await db?.close() })

describe('PostgreSQL schema and RLS with two users', () => {
  it('creates profiles and enables RLS on every public table', async () => {
    expect((await row("select count(*)::int as n from public.profiles"))?.n).toBe(2)
    expect((await row("select count(*)::int as n from pg_tables where schemaname='public' and not rowsecurity"))?.n).toBe(0)
  })
  it('allows reading and editing only the current profile', async () => {
    await asUser(alice)
    expect((await row('select count(*)::int as n from public.profiles'))?.n).toBe(1)
    await db.exec("update public.profiles set display_name='Alice Updated'")
    expect((await row('select display_name from public.profiles'))?.display_name).toBe('Alice Updated')
    await expect(db.exec("update public.profiles set timezone='Invalid/Timezone'")).rejects.toThrow('Invalid timezone')
    expect((await db.query(`update public.profiles set display_name='Hacked' where id='${bob}' returning id`)).rows).toHaveLength(0)
  })
  it('rejects owner spoofing and cross-owner relationships', async () => {
    await asUser(bob)
    await db.exec("insert into public.journeys(id,name) values('33333333-3333-4333-8333-333333333333','Bob journey')")
    await asUser(alice)
    await expect(db.exec(`insert into public.journeys(user_id,name) values('${bob}','Forged')`)).rejects.toThrow()
    expect((await row('select count(*)::int as n from public.journeys'))?.n).toBe(0)
    await expect(db.exec("insert into public.objectives(journey_id,name) values('33333333-3333-4333-8333-333333333333','Cross owner')")).rejects.toThrow()
    expect((await db.query("delete from public.journeys returning id")).rows).toHaveLength(0)
  })
  it('calculates inclusive offensive dates and restricts active offensives', async () => {
    await db.exec("insert into public.offensives(name,start_date,duration_days,status) values('Sprint','2028-02-28',3,'in_progress')")
    expect(String((await row('select end_date::text from public.offensives'))?.end_date)).toBe('2028-03-01')
    await expect(db.exec("insert into public.offensives(name,start_date,duration_days,status) values('Second','2028-02-28',3,'in_progress')")).rejects.toThrow()
    await expect(db.exec("insert into public.offensives(name,start_date,duration_days) values('Zero','2028-02-28',0)")).rejects.toThrow()
    await db.exec("update public.offensives set status='archived'")
    expect((await row('select archived_at is not null as ok from public.offensives'))?.ok).toBe(true)
  })
  it('tracks status timestamps and prevents forged audit entries', async () => {
    await db.exec("insert into public.journeys(name,status) values('Alice journey','completed')")
    expect((await row('select completed_at is not null as ok from public.journeys'))?.ok).toBe(true)
    await db.exec("update public.journeys set status='in_progress'")
    expect((await row('select completed_at from public.journeys'))?.completed_at).toBe(null)
    expect(Number((await row('select count(*)::int as n from public.activity_events'))?.n)).toBeGreaterThan(0)
    await expect(db.exec("delete from public.activity_events")).rejects.toThrow()
    await expect(db.exec(`insert into public.activity_events(entity_table,entity_id,action) values('tasks','${alice}','INSERT')`)).rejects.toThrow()
    await asUser(bob)
    expect((await row("select count(*)::int as n from public.activity_events where user_id <> auth.uid()"))?.n).toBe(0)
    await asUser(alice)
  })
  it('preserves owner identity and foreign keys on delete', async () => {
    await expect(db.exec(`update public.journeys set user_id='${bob}'`)).rejects.toThrow()
    await db.exec("insert into public.objectives(journey_id,name) select id,'Goal' from public.journeys")
    await expect(db.exec('delete from public.journeys')).rejects.toThrow()
  })
  it('rejects overlapping schedule versions and invalid weekdays', async () => {
    await db.exec("insert into public.daily_activities(id,name) values('44444444-4444-4444-8444-444444444444','Read')")
    await db.exec("insert into public.activity_schedules(activity_id,kind,valid_from,valid_until,weekdays,weekly_target) values('44444444-4444-4444-8444-444444444444','weekly_target','2026-09-01','2026-09-30','{1,3,5}',3)")
    await expect(db.exec("insert into public.activity_schedules(activity_id,kind,valid_from) values('44444444-4444-4444-8444-444444444444','daily','2026-09-20')")).rejects.toThrow('overlap')
    await expect(db.exec("insert into public.activity_schedules(activity_id,kind,valid_from,weekdays) values('44444444-4444-4444-8444-444444444444','weekdays','2026-10-01','{1,1}')")).rejects.toThrow()
    await db.exec("insert into public.activity_schedules(activity_id,kind,valid_from) values('44444444-4444-4444-8444-444444444444','daily','2026-10-01')")
  })
  it('maintains daily summaries on completion, reopening and removal', async () => {
    await db.exec("insert into public.daily_activity_logs(activity_id,scheduled_date,name_snapshot) values('44444444-4444-4444-8444-444444444444','2026-09-22','Read')")
    expect(Number((await row('select execution_percent from public.daily_summaries'))?.execution_percent)).toBe(0)
    await db.exec("update public.daily_activity_logs set status='completed'")
    expect(Number((await row('select execution_percent from public.daily_summaries'))?.execution_percent)).toBe(100)
    expect((await row('select completed_at is not null as ok from public.daily_activity_logs'))?.ok).toBe(true)
    await db.exec("update public.daily_activity_logs set status='planned'")
    expect((await row('select completed_at from public.daily_activity_logs'))?.completed_at).toBe(null)
    await db.exec("update public.daily_activity_logs set status='skipped'")
    expect((await row('select execution_percent from public.daily_summaries'))?.execution_percent).toBe(null)
    await expect(db.exec('update public.daily_summaries set completed_weight=999')).rejects.toThrow()
    await expect(db.exec("update public.daily_activity_logs set scheduled_date='2026-09-23'")).rejects.toThrow()
    await expect(db.exec("delete from public.daily_activities")).rejects.toThrow()
    await db.exec('delete from public.daily_activity_logs')
    expect((await row('select execution_percent from public.daily_summaries'))?.execution_percent).toBe(null)
  })
  it('denies anonymous data access', async () => {
    await db.exec("reset role; set role anon; select set_config('request.jwt.claim.sub','',false);")
    for (const table of ['profiles','journeys','daily_activity_logs','daily_summaries','activity_events']) {
      await expect(db.exec(`select * from public.${table}`)).rejects.toThrow()
    }
  })
})
