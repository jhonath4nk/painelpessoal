import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const user = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
let db: PGlite
let journeyId: string
async function row(sql: string) { return (await db.query<Record<string, unknown>>(sql)).rows[0] }
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users(id) values('${user}'),('${other}');`)
  for (const file of readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`)
}, 30000)
afterAll(async () => db.close())

describe('Jornadas e etapas', () => {
  it('keeps Journey records separate from daily tracking', async () => {
    journeyId = String((await row("insert into public.journeys(name,status,start_date,due_date) values('Jiu-jitsu','in_progress','2026-01-01','2027-04-10') returning id"))?.id)
    expect((await row('select count(*)::int as n from public.daily_activity_logs'))?.n).toBe(0)
  })
  it('calculates completion from steps, sets dates and reopens automatically', async () => {
    await db.exec(`insert into public.journey_steps(journey_id,title,position) values('${journeyId}','Matricular',0),('${journeyId}','Completar 1 mês',1);`)
    await db.exec(`update public.journey_steps set status='completed' where journey_id='${journeyId}' and position=0`)
    expect((await row(`select status from public.journeys where id='${journeyId}'`))?.status).toBe('in_progress')
    await db.exec(`update public.journey_steps set status='completed' where journey_id='${journeyId}' and position=1`)
    expect(await row(`select status, completed_at is not null as completed from public.journeys where id='${journeyId}'`)).toEqual({ status: 'completed', completed: true })
    await db.exec(`update public.journey_steps set status='pending' where journey_id='${journeyId}' and position=1`)
    expect(await row(`select status, completed_at from public.journeys where id='${journeyId}'`)).toEqual({ status: 'in_progress', completed_at: null })
  })
  it('enforces manual order and preserves the owning journey', async () => {
    await expect(db.exec(`insert into public.journey_steps(journey_id,title,position) values('${journeyId}','Duplicada',0)`)).rejects.toThrow()
    await expect(db.exec(`update public.journey_steps set journey_id='${other}' where journey_id='${journeyId}'`)).rejects.toThrow()
  })
  it('moves a step with the protected helper without changing its journey', async () => {
    await db.exec(`select public.move_journey_step((select id from public.journey_steps where journey_id='${journeyId}' and position=1),'up')`)
    expect(await row(`select title from public.journey_steps where journey_id='${journeyId}' and position=0`)).toEqual({ title: 'Completar 1 mês' })
  })
  it('isolates step access and supports archive/reactivate without deletion', async () => {
    await db.exec(`update public.journeys set status='archived' where id='${journeyId}'`)
    expect((await row(`select archived_at is not null as archived from public.journeys where id='${journeyId}'`))?.archived).toBe(true)
    await db.exec(`update public.journeys set status='in_progress' where id='${journeyId}'`)
    await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`)
    expect((await row('select count(*)::int as n from public.journey_steps'))?.n).toBe(0)
    await expect(db.exec(`insert into public.journey_steps(journey_id,title,position) values('${journeyId}','Ataque',3)`)).rejects.toThrow()
  })
})
