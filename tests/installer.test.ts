import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

it('installs atomically, creates a profile for a pre-existing account and refuses reinstall', async () => {
  const db = new PGlite()
  const user = '55555555-5555-4555-8555-555555555555'
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin;
      create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users(id) values('${user}');`)
    const sql = readFileSync('supabase/instalar.sql', 'utf8')
    await db.exec(sql)
    expect((await db.query('select id from public.profiles')).rows).toEqual([{ id: user }])
    await db.exec(readFileSync('supabase/verificar_instalacao.sql', 'utf8'))
    await expect(db.exec(sql)).rejects.toThrow('Instalação já iniciada')
    await db.exec('rollback;')
    expect((await db.query('select id from public.profiles')).rows).toEqual([{ id: user }])
  } finally { await db.close() }
}, 30000)
