import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'

let db: PGlite
const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
let today: string
let activityId: string
async function result(sql: string) { return (await db.query<Record<string, string | number | null>>(sql)).rows[0] }
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`)
  for (const name of readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${name}`, 'utf8'))
  await db.exec(`insert into auth.users(id) values('${alice}'),('${bob}'); update public.profiles set timezone='UTC';
    set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false);`)
  today = String((await result('select current_date::text as day')).day)
}, 30000)
afterAll(async () => { await db?.close() })

describe('Daily tracking RPCs', () => {
  it('atomically creates activities and rejects invalid schedules without orphan rows', async () => {
    activityId = String((await result(`select public.save_activity('Leitura','','daily','{}','${today}') as id`)).id)
    const before = (await result('select count(*)::int as n from public.daily_activities')).n
    await expect(db.exec(`select public.save_activity('Invalid','','weekdays','{1,1}','${today}')`)).rejects.toThrow()
    expect((await result('select count(*)::int as n from public.daily_activities')).n).toBe(before)
  })
  it('materializes missed days once and preserves completed records', async () => {
    await db.exec(`update public.activity_schedules set valid_from=current_date-4 where activity_id='${activityId}';
      select public.sync_tracking(current_date-4,current_date);
      update public.daily_activity_logs set status='completed' where scheduled_date=current_date;
      select public.sync_tracking(current_date-4,current_date);`)
    expect((await result('select count(*)::int as n from public.daily_activity_logs')).n).toBe(5)
    expect((await result('select count(*)::int as n from public.daily_summaries where execution_percent=0')).n).toBe(4)
    expect(Number((await result('select execution_percent from public.daily_summaries where day=current_date')).execution_percent)).toBe(100)
  })
  it('creates null summaries for unplanned days and refuses future synchronization', async () => {
    await db.exec('select public.sync_tracking(current_date-5,current_date-5)')
    expect((await result('select execution_percent from public.daily_summaries where day=current_date-5')).execution_percent).toBeNull()
    await expect(db.exec('select public.sync_tracking(current_date,current_date+1)')).rejects.toThrow()
  })
  it('preserves historical name snapshots when revising tomorrow’s routine', async () => {
    await db.exec(`select public.save_activity('Livro novo','','weekdays','{1,3,5}',current_date,'${activityId}')`)
    expect((await result('select count(*)::int as n from public.daily_activity_logs where name_snapshot=\'Leitura\'')).n).toBe(5)
    expect((await result('select name_snapshot from public.activity_schedules where valid_from=current_date+1')).name_snapshot).toBe('Livro novo')
    await db.exec('select public.sync_tracking(current_date-4,current_date)')
    expect((await result('select count(*)::int as n from public.daily_activity_logs')).n).toBe(5)
  })
  it('adds manual activities only when explicitly planned for today', async () => {
    const id = (await result(`select public.save_activity('Organizar','','manual','{}',current_date) as id`)).id
    expect((await result(`select count(*)::int as n from public.daily_activity_logs where activity_id='${id}'`)).n).toBe(0)
    await db.exec(`select public.add_activity_today('${id}'); select public.add_activity_today('${id}')`)
    expect((await result(`select count(*)::int as n from public.daily_activity_logs where activity_id='${id}'`)).n).toBe(1)
  })
  it('archives without losing execution history or changing today’s plan', async () => {
    await db.exec(`select public.archive_activity('${activityId}')`)
    expect((await result(`select count(*)::int as n from public.daily_activity_logs where activity_id='${activityId}'`)).n).toBe(5)
    expect((await result(`select count(*)::int as n from public.activity_schedules where activity_id='${activityId}' and valid_from>current_date`)).n).toBe(0)
  })
  it('rejects cross-user IDs and unauthenticated function calls', async () => {
    await db.exec(`select set_config('request.jwt.claim.sub','${bob}',false)`)
    await expect(db.exec(`select public.archive_activity('${activityId}')`)).rejects.toThrow('Activity not found')
    await expect(db.exec(`select public.add_activity_today('${activityId}')`)).rejects.toThrow('Activity not found')
    await db.exec(`reset role; set role anon; select set_config('request.jwt.claim.sub','',false)`)
    await expect(db.exec('select public.sync_tracking(current_date,current_date)')).rejects.toThrow()
  })
})
