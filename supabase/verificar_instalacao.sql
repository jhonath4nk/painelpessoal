-- Consulta somente de leitura. Não revela e-mails, senhas nem dados pessoais.
-- Esperado: 16 tabelas, RLS=true, anon_sem_acesso=true em todas.
with expected(name) as (
  values ('profiles'),('offensives'),('cycles'),('journeys'),('objectives'),
    ('tasks'),('subtasks'),('daily_activities'),('activity_schedules'),
    ('daily_activity_logs'),('daily_summaries'),('habits'),('daily_notes'),
    ('weekly_reviews'),('backlog_items'),('activity_events')
)
select e.name as tabela,
  c.oid is not null as existe,
  coalesce(c.relrowsecurity,false) as rls_ativa,
  case when c.oid is null then false else
    not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') end as anon_sem_acesso,
  (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=e.name) as politicas
from expected e
left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=e.name and c.relkind='r'
order by e.name;

-- Esperado: três funções presentes e false para acesso direto do frontend.
select p.proname as funcao,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as frontend_pode_executar
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and p.proname in ('create_profile','audit_change','refresh_daily_summary')
order by p.proname;
