-- EVOLUÇÃO PESSOAL — INSTALAÇÃO INICIAL
-- Cole TODO este arquivo no SQL Editor do seu projeto Supabase e clique Run.
-- Uma transação aplica modelo, segurança e integridade juntos.
-- Não modifica auth.users nem cria senhas. Contas existentes recebem um perfil.
-- Não execute em projeto com instalação parcial: o bloqueio abaixo evita sobrescritas.
begin;
do $$
begin
  if to_regclass('public.profiles') is not null
     or to_regtype('public.item_status') is not null then
    raise exception 'Instalação já iniciada ou concluída. Execute verificar_instalacao.sql antes de continuar. Nenhum dado foi alterado.';
  end if;
end;
$$;

-- ===== 001_schema.sql =====
-- Phase 2: schema. Apply in order, once, on a new Supabase project.
create type public.item_status as enum ('not_started','in_progress','completed','archived');
create type public.priority_level as enum ('low','medium','high','critical');
create type public.recurrence_kind as enum ('daily','weekdays','weekly_target','once','manual');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  timezone text not null default 'America/Sao_Paulo',
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.offensives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  name text not null check (length(trim(name)) between 1 and 200),
  description text not null default '',
  start_date date not null,
  duration_days integer not null check (duration_days > 0),
  end_date date generated always as (start_date + duration_days - 1) stored,
  status public.item_status not null default 'not_started',
  completed_at timestamptz,
  archived_at timestamptz
);
create index offensives_owner_idx on public.offensives(user_id);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  offensive_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 200),
  kind text not null check (kind in ('month','quarter','semester','offensive','custom')),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  foreign key (offensive_id,user_id) references public.offensives(id,user_id)
);
create index cycles_owner_idx on public.cycles(user_id);

create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  name text not null check (length(trim(name)) between 1 and 200),
  description text not null default '',
  status public.item_status not null default 'not_started',
  priority public.priority_level not null default 'medium',
  weight numeric(10,2) not null default 1 check (weight > 0),
  due_date date,
  completed_at timestamptz,
  archived_at timestamptz
);
create index journeys_owner_idx on public.journeys(user_id);

create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  name text not null check (length(trim(name)) between 1 and 200),
  description text not null default '',
  status public.item_status not null default 'not_started',
  priority public.priority_level not null default 'medium',
  weight numeric(10,2) not null default 1 check (weight > 0),
  due_date date,
  completed_at timestamptz,
  archived_at timestamptz
,
  journey_id uuid not null,
  cycle_id uuid,
  foreign key (journey_id,user_id) references public.journeys(id,user_id),
  foreign key (cycle_id,user_id) references public.cycles(id,user_id)
);
create index objectives_owner_idx on public.objectives(user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  name text not null check (length(trim(name)) between 1 and 200),
  description text not null default '',
  status public.item_status not null default 'not_started',
  priority public.priority_level not null default 'medium',
  weight numeric(10,2) not null default 1 check (weight > 0),
  due_date date,
  completed_at timestamptz,
  archived_at timestamptz
,
  objective_id uuid not null,
  foreign key (objective_id,user_id) references public.objectives(id,user_id)
);
create index tasks_owner_idx on public.tasks(user_id);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  name text not null check (length(trim(name)) between 1 and 200),
  description text not null default '',
  status public.item_status not null default 'not_started',
  priority public.priority_level not null default 'medium',
  weight numeric(10,2) not null default 1 check (weight > 0),
  due_date date,
  completed_at timestamptz,
  archived_at timestamptz
,
  task_id uuid not null,
  foreign key (task_id,user_id) references public.tasks(id,user_id)
);
create index subtasks_owner_idx on public.subtasks(user_id);

create table public.daily_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  name text not null check (length(trim(name)) between 1 and 200),
  description text not null default '',
  task_id uuid,
  weight numeric(10,2) not null default 1 check (weight > 0),
  archived_at timestamptz,
  foreign key (task_id,user_id) references public.tasks(id,user_id)
);
create index daily_activities_owner_idx on public.daily_activities(user_id);

create table public.activity_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  activity_id uuid not null,
  kind public.recurrence_kind not null,
  valid_from date not null,
  valid_until date check (valid_until >= valid_from),
  weekdays smallint[] not null default '{}',
  weekly_target smallint,
  check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  check ((kind in ('weekdays','weekly_target') and cardinality(weekdays) between 1 and 7)
      or (kind not in ('weekdays','weekly_target') and cardinality(weekdays) = 0)),
  check ((kind = 'weekly_target' and weekly_target is not null and weekly_target between 1 and 7
      and cardinality(weekdays) = weekly_target) or (kind <> 'weekly_target' and weekly_target is null)),
  check (kind <> 'once' or (valid_until is not null and valid_until = valid_from)),
  foreign key (activity_id,user_id) references public.daily_activities(id,user_id)
);
create index activity_schedules_owner_idx on public.activity_schedules(user_id);

create table public.daily_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  activity_id uuid not null,
  scheduled_date date not null,
  name_snapshot text not null check (length(trim(name_snapshot)) between 1 and 200),
  weight_snapshot numeric(10,2) not null default 1 check (weight_snapshot > 0),
  status text not null default 'planned' check (status in ('planned','completed','skipped')),
  completed_at timestamptz,
  unique (user_id,activity_id,scheduled_date),
  foreign key (activity_id,user_id) references public.daily_activities(id,user_id)
);
create index daily_activity_logs_owner_idx on public.daily_activity_logs(user_id);

create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  day date not null,
  planned_count integer not null default 0 check (planned_count >= 0),
  completed_count integer not null default 0 check (completed_count between 0 and planned_count),
  planned_weight numeric not null default 0 check (planned_weight >= 0),
  completed_weight numeric not null default 0 check (completed_weight between 0 and planned_weight),
  execution_percent numeric generated always as
    (case when planned_weight > 0 then round(100 * completed_weight / planned_weight, 4) else null end) stored,
  unique (user_id,day)
);
create index daily_summaries_owner_idx on public.daily_summaries(user_id);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  activity_id uuid not null,
  unique (activity_id,user_id),
  foreign key (activity_id,user_id) references public.daily_activities(id,user_id)
);
create index habits_owner_idx on public.habits(user_id);

create table public.daily_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  day date not null,
  what_worked text not null default '',
  obstacles text not null default '',
  learning text not null default '',
  free_note text not null default '',
  energy smallint check (energy between 1 and 5),
  mood smallint check (mood between 1 and 5),
  unique (user_id,day)
);
create index daily_notes_owner_idx on public.daily_notes(user_id);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  week_start date not null check (extract(isodow from week_start) = 1),
  reflection text not null default '',
  next_priorities text not null default '',
  unique (user_id,week_start)
);
create index weekly_reviews_owner_idx on public.weekly_reviews(user_id);

create table public.backlog_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  name text not null check (length(trim(name)) between 1 and 200),
  description text not null default '',
  category text not null default 'idea' check (category in ('idea','task','project','course','book','plan','other')),
  priority public.priority_level not null default 'medium',
  archived_at timestamptz
);
create index backlog_items_owner_idx on public.backlog_items(user_id);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),

  entity_table text not null,
  entity_id uuid not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb
);
create index activity_events_owner_idx on public.activity_events(user_id);

create unique index one_active_offensive on public.offensives(user_id) where status = 'in_progress';
create index cycles_offensive_idx on public.cycles(user_id,offensive_id);
create index objectives_journey_idx on public.objectives(user_id,journey_id);
create index objectives_cycle_idx on public.objectives(user_id,cycle_id);
create index tasks_objective_idx on public.tasks(user_id,objective_id);
create index subtasks_task_idx on public.subtasks(user_id,task_id);
create index activities_task_idx on public.daily_activities(user_id,task_id);
create index schedules_activity_idx on public.activity_schedules(user_id,activity_id,valid_from);
create index logs_date_idx on public.daily_activity_logs(user_id,scheduled_date);
create index events_entity_idx on public.activity_events(user_id,entity_table,entity_id,created_at);
create index tasks_due_idx on public.tasks(user_id,due_date) where status in ('not_started','in_progress');

-- ===== 002_security.sql =====
-- Default-deny access. Clients cannot write summaries or audit events.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create function private.sync_status_dates() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' then new.completed_at := now();
    elsif old.status <> 'completed' then new.completed_at := now();
    else new.completed_at := old.completed_at; end if;
  else new.completed_at := null; end if;
  if new.status = 'archived' then
    if tg_op = 'INSERT' then new.archived_at := now();
    elsif old.status <> 'archived' then new.archived_at := now();
    else new.archived_at := old.archived_at; end if;
  else new.archived_at := null; end if;
  return new;
end;
$$;

create function private.validate_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid timezone' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger profile_timezone before insert or update on public.profiles
for each row execute function private.validate_profile();

create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id,coalesce(new.raw_user_meta_data->>'display_name',''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.create_profile();
insert into public.profiles(id,display_name)
select id,coalesce(raw_user_meta_data->>'display_name','') from auth.users
on conflict (id) do nothing;

create function private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare before_data jsonb; after_data jsonb; owner_id uuid; target_id uuid;
begin
  if tg_op <> 'INSERT' then before_data := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then after_data := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and (before_data - 'updated_at') = (after_data - 'updated_at') then return new; end if;
  owner_id := coalesce((after_data->>'user_id')::uuid,(before_data->>'user_id')::uuid);
  target_id := coalesce((after_data->>'id')::uuid,(before_data->>'id')::uuid);
  -- When Auth deletes a user, its cascading deletion should not re-create audit rows.
  if exists(select 1 from auth.users where id = owner_id) then
    insert into public.activity_events(user_id,entity_table,entity_id,action,old_data,new_data)
    values(owner_id,tg_table_name,target_id,tg_op,before_data,after_data);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
create policy owner_select on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create trigger touch_updated_at before update on public.profiles
for each row execute function private.touch_updated_at();
grant update on public.profiles to authenticated;
create policy owner_update on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

alter table public.offensives enable row level security;
revoke all on public.offensives from anon, authenticated;
grant select on public.offensives to authenticated;
create policy owner_select on public.offensives for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.offensives
for each row execute function private.touch_updated_at();
grant update on public.offensives to authenticated;
create policy owner_update on public.offensives for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant insert, delete on public.offensives to authenticated;
create policy owner_insert on public.offensives for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy owner_delete on public.offensives for delete to authenticated
using ((select auth.uid()) = user_id);
create trigger sync_status_dates before insert or update on public.offensives
for each row execute function private.sync_status_dates();
create trigger audit_change after insert or update or delete on public.offensives
for each row execute function private.audit_change();

alter table public.cycles enable row level security;
revoke all on public.cycles from anon, authenticated;
grant select on public.cycles to authenticated;
create policy owner_select on public.cycles for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.cycles
for each row execute function private.touch_updated_at();
grant update on public.cycles to authenticated;
create policy owner_update on public.cycles for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant insert, delete on public.cycles to authenticated;
create policy owner_insert on public.cycles for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy owner_delete on public.cycles for delete to authenticated
using ((select auth.uid()) = user_id);
create trigger audit_change after insert or update or delete on public.cycles
for each row execute function private.audit_change();

alter table public.journeys enable row level security;
revoke all on public.journeys from anon, authenticated;
grant select on public.journeys to authenticated;
create policy owner_select on public.journeys for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.journeys
for each row execute function private.touch_updated_at();
grant update on public.journeys to authenticated;
create policy owner_update on public.journeys for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant insert, delete on public.journeys to authenticated;
create policy owner_insert on public.journeys for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy owner_delete on public.journeys for delete to authenticated
using ((select auth.uid()) = user_id);
create trigger sync_status_dates before insert or update on public.journeys
for each row execute function private.sync_status_dates();
create trigger audit_change after insert or update or delete on public.journeys
for each row execute function private.audit_change();

alter table public.objectives enable row level security;
revoke all on public.objectives from anon, authenticated;
grant select on public.objectives to authenticated;
create policy owner_select on public.objectives for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.objectives
for each row execute function private.touch_updated_at();
grant update on public.objectives to authenticated;
create policy owner_update on public.objectives for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant insert, delete on public.objectives to authenticated;
create policy owner_insert on public.objectives for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy owner_delete on public.objectives for delete to authenticated
using ((select auth.uid()) = user_id);
create trigger sync_status_dates before insert or update on public.objectives
for each row execute function private.sync_status_dates();
create trigger audit_change after insert or update or delete on public.objectives
for each row execute function private.audit_change();

alter table public.tasks enable row level security;
revoke all on public.tasks from anon, authenticated;
grant select on public.tasks to authenticated;
create policy owner_select on public.tasks for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.tasks
for each row execute function private.touch_updated_at();
grant update on public.tasks to authenticated;
create policy owner_update on public.tasks for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant insert, delete on public.tasks to authenticated;
create policy owner_insert on public.tasks for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy owner_delete on public.tasks for delete to authenticated
using ((select auth.uid()) = user_id);
create trigger sync_status_dates before insert or update on public.tasks
for each row execute function private.sync_status_dates();
create trigger audit_change after insert or update or delete on public.tasks
for each row execute function private.audit_change();

alter table public.subtasks enable row level security;
revoke all on public.subtasks from anon, authenticated;
grant select on public.subtasks to authenticated;
create policy owner_select on public.subtasks for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.subtasks
for each row execute function private.touch_updated_at();
grant update on public.subtasks to authenticated;
create policy owner_update on public.subtasks for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant insert, delete on public.subtasks to authenticated;
create policy owner_insert on public.subtasks for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy owner_delete on public.subtasks for delete to authenticated
using ((select auth.uid()) = user_id);
create trigger sync_status_dates before insert or update on public.subtasks
for each row execute function private.sync_status_dates();
create trigger audit_change after insert or update or delete on public.subtasks
for each row execute function private.audit_change();

alter table public.daily_activities enable row level security;
revoke all on public.daily_activities from anon, authenticated;
grant select on public.daily_activities to authenticated;
create policy owner_select on public.daily_activities for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.daily_activities
for each row execute function private.touch_updated_at();
grant update on public.daily_activities to authenticated;
create policy owner_update on public.daily_activities for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant insert, delete on public.daily_activities to authenticated;
create policy owner_insert on public.daily_activities for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy owner_delete on public.daily_activities for delete to authenticated
using ((select auth.uid()) = user_id);
create trigger audit_change after insert or update or delete on public.daily_activities
for each row execute function private.audit_change();

alter table public.activity_schedules enable row level security;
revoke all on public.activity_schedules from anon, authenticated;
grant select on public.activity_schedules to authenticated;
create policy owner_select on public.activity_schedules for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.activity_schedules
for each row execute function private.touch_updated_at();
grant update on public.activity_schedules to authenticated;
create policy owner_update on public.activity_schedules for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant insert, delete on public.activity_schedules to authenticated;
create policy owner_insert on public.activity_schedules for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy owner_delete on public.activity_schedules for delete to authenticated
using ((select auth.uid()) = user_id);
create trigger audit_change after insert or update or delete on public.activity_schedules
for each row execute function private.audit_change();

alter table public.daily_activity_logs enable row level security;
revoke all on public.daily_activity_logs from anon, authenticated;
grant select on public.daily_activity_logs to authenticated;
create policy owner_select on public.daily_activity_logs for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.daily_activity_logs
for each row execute function private.touch_updated_at();
grant update on public.daily_activity_logs to authenticated;
create policy owner_update on public.daily_activity_logs for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant insert, delete on public.daily_activity_logs to authenticated;
create policy owner_insert on public.daily_activity_logs for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy owner_delete on public.daily_activity_logs for delete to authenticated
using ((select auth.uid()) = user_id);
create trigger audit_change after insert or update or delete on public.daily_activity_logs
for each row execute function private.audit_change();

alter table public.daily_summaries enable row level security;
revoke all on public.daily_summaries from anon, authenticated;
grant select on public.daily_summaries to authenticated;
create policy owner_select on public.daily_summaries for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.daily_summaries
for each row execute function private.touch_updated_at();

alter table public.habits enable row level security;
revoke all on public.habits from anon, authenticated;
grant select on public.habits to authenticated;
create policy owner_select on public.habits for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.habits
for each row execute function private.touch_updated_at();
grant update on public.habits to authenticated;
create policy owner_update on public.habits for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant insert, delete on public.habits to authenticated;
create policy owner_insert on public.habits for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy owner_delete on public.habits for delete to authenticated
using ((select auth.uid()) = user_id);
create trigger audit_change after insert or update or delete on public.habits
for each row execute function private.audit_change();

alter table public.daily_notes enable row level security;
revoke all on public.daily_notes from anon, authenticated;
grant select on public.daily_notes to authenticated;
create policy owner_select on public.daily_notes for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.daily_notes
for each row execute function private.touch_updated_at();
grant update on public.daily_notes to authenticated;
create policy owner_update on public.daily_notes for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant insert, delete on public.daily_notes to authenticated;
create policy owner_insert on public.daily_notes for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy owner_delete on public.daily_notes for delete to authenticated
using ((select auth.uid()) = user_id);

alter table public.weekly_reviews enable row level security;
revoke all on public.weekly_reviews from anon, authenticated;
grant select on public.weekly_reviews to authenticated;
create policy owner_select on public.weekly_reviews for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.weekly_reviews
for each row execute function private.touch_updated_at();
grant update on public.weekly_reviews to authenticated;
create policy owner_update on public.weekly_reviews for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant insert, delete on public.weekly_reviews to authenticated;
create policy owner_insert on public.weekly_reviews for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy owner_delete on public.weekly_reviews for delete to authenticated
using ((select auth.uid()) = user_id);

alter table public.backlog_items enable row level security;
revoke all on public.backlog_items from anon, authenticated;
grant select on public.backlog_items to authenticated;
create policy owner_select on public.backlog_items for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.backlog_items
for each row execute function private.touch_updated_at();
grant update on public.backlog_items to authenticated;
create policy owner_update on public.backlog_items for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant insert, delete on public.backlog_items to authenticated;
create policy owner_insert on public.backlog_items for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy owner_delete on public.backlog_items for delete to authenticated
using ((select auth.uid()) = user_id);
create trigger audit_change after insert or update or delete on public.backlog_items
for each row execute function private.audit_change();

alter table public.activity_events enable row level security;
revoke all on public.activity_events from anon, authenticated;
grant select on public.activity_events to authenticated;
create policy owner_select on public.activity_events for select to authenticated
using ((select auth.uid()) = user_id);
create trigger touch_updated_at before update on public.activity_events
for each row execute function private.touch_updated_at();

revoke all on all functions in schema private from public, anon, authenticated;

-- ===== 003_integrity.sql =====
-- Preserve ownership and daily summary integrity at the database boundary.
create function private.immutable_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.user_id <> old.user_id then
    raise exception 'Record identity and owner are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.check_schedule() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Serializes edits for the same activity so overlapping versions cannot race.
  perform 1 from public.daily_activities where id = new.activity_id and user_id = new.user_id for update;
  if cardinality(new.weekdays) <> (select count(distinct d) from unnest(new.weekdays) d)
      or array_position(new.weekdays,null) is not null then
    raise exception 'Weekdays must be unique, non-null ISO weekdays' using errcode = '23514';
  end if;
  if exists(select 1 from public.activity_schedules s
      where s.activity_id = new.activity_id and s.user_id = new.user_id and s.id <> new.id
      and daterange(s.valid_from,s.valid_until,'[]') && daterange(new.valid_from,new.valid_until,'[]')) then
    raise exception 'Schedule versions cannot overlap' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger check_schedule before insert or update on public.activity_schedules
for each row execute function private.check_schedule();

create function private.prepare_daily_log() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Lock the owner's profile to serialize writes affecting daily aggregates.
  perform 1 from public.profiles where id = new.user_id for update;
  if tg_op = 'UPDATE' then
    if new.activity_id <> old.activity_id or new.scheduled_date <> old.scheduled_date then
      raise exception 'Activity and date are immutable; use an explicit reschedule operation' using errcode = '23514';
    end if;
    if new.status = 'completed' and old.status = 'completed' then new.completed_at := old.completed_at;
    elsif new.status = 'completed' then new.completed_at := now();
    else new.completed_at := null; end if;
  elsif new.status = 'completed' then new.completed_at := now();
  else new.completed_at := null; end if;
  return new;
end;
$$;
create trigger prepare_daily_log before insert or update on public.daily_activity_logs
for each row execute function private.prepare_daily_log();

create function private.lock_log_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.profiles where id = old.user_id for update;
  return old;
end;
$$;
create trigger lock_log_delete before delete on public.daily_activity_logs
for each row execute function private.lock_log_delete();

create function private.refresh_daily_summary() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; log_day date;
begin
  if tg_op = 'DELETE' then owner_id := old.user_id; log_day := old.scheduled_date;
  else owner_id := new.user_id; log_day := new.scheduled_date; end if;
  if exists(select 1 from auth.users where id = owner_id) then
    insert into public.daily_summaries(user_id,day,planned_count,completed_count,planned_weight,completed_weight)
    select owner_id,log_day,
      count(*) filter (where status <> 'skipped'),count(*) filter (where status = 'completed'),
      coalesce(sum(weight_snapshot) filter (where status <> 'skipped'),0),
      coalesce(sum(weight_snapshot) filter (where status = 'completed'),0)
    from public.daily_activity_logs where user_id = owner_id and scheduled_date = log_day
    on conflict(user_id,day) do update set planned_count=excluded.planned_count,
      completed_count=excluded.completed_count,planned_weight=excluded.planned_weight,completed_weight=excluded.completed_weight;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger refresh_daily_summary after insert or update or delete on public.daily_activity_logs
for each row execute function private.refresh_daily_summary();
create trigger immutable_identity before update on public.offensives
for each row execute function private.immutable_identity();
create trigger immutable_identity before update on public.cycles
for each row execute function private.immutable_identity();
create trigger immutable_identity before update on public.journeys
for each row execute function private.immutable_identity();
create trigger immutable_identity before update on public.objectives
for each row execute function private.immutable_identity();
create trigger immutable_identity before update on public.tasks
for each row execute function private.immutable_identity();
create trigger immutable_identity before update on public.subtasks
for each row execute function private.immutable_identity();
create trigger immutable_identity before update on public.daily_activities
for each row execute function private.immutable_identity();
create trigger immutable_identity before update on public.activity_schedules
for each row execute function private.immutable_identity();
create trigger immutable_identity before update on public.daily_activity_logs
for each row execute function private.immutable_identity();
create trigger immutable_identity before update on public.daily_summaries
for each row execute function private.immutable_identity();
create trigger immutable_identity before update on public.habits
for each row execute function private.immutable_identity();
create trigger immutable_identity before update on public.daily_notes
for each row execute function private.immutable_identity();
create trigger immutable_identity before update on public.weekly_reviews
for each row execute function private.immutable_identity();
create trigger immutable_identity before update on public.backlog_items
for each row execute function private.immutable_identity();
create trigger immutable_identity before update on public.activity_events
for each row execute function private.immutable_identity();

revoke all on all functions in schema private from public, anon, authenticated;

-- ===== 004_daily_tracking.sql =====
-- Fase 3. Execute UMA VEZ, depois da instalação inicial.
-- Preserva contas, ofensivas e histórico existentes.

alter table public.activity_schedules add column name_snapshot text;
alter table public.activity_schedules add column weight_snapshot numeric(10,2);
update public.activity_schedules s set name_snapshot=a.name, weight_snapshot=a.weight
from public.daily_activities a where a.id=s.activity_id and a.user_id=s.user_id;
alter table public.activity_schedules alter column name_snapshot set not null;
alter table public.activity_schedules alter column weight_snapshot set not null;
alter table public.activity_schedules add constraint schedule_weight_positive check (weight_snapshot > 0);

create function private.snapshot_schedule() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    select name,weight into new.name_snapshot,new.weight_snapshot
    from public.daily_activities where id=new.activity_id and user_id=new.user_id;
  elsif new.name_snapshot is distinct from old.name_snapshot or new.weight_snapshot is distinct from old.weight_snapshot then
    raise exception 'Create a new schedule version instead of changing historical snapshots' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger snapshot_schedule before insert or update on public.activity_schedules
for each row execute function private.snapshot_schedule();

-- Internal helper. All callers validate Auth ownership; no direct client access.
create function private.sync_days(owner_id uuid, from_day date, to_day date) returns void
language plpgsql set search_path='' as $$
begin
  if from_day is null or to_day is null or from_day > to_day then return; end if;
  insert into public.daily_activity_logs(user_id,activity_id,scheduled_date,name_snapshot,weight_snapshot)
  select owner_id,s.activity_id,from_day+d.n,s.name_snapshot,s.weight_snapshot
  from generate_series(0,to_day-from_day) d(n)
  join public.activity_schedules s on s.user_id=owner_id
    and from_day+d.n >= s.valid_from and (s.valid_until is null or from_day+d.n <= s.valid_until)
  where s.kind in ('daily','once')
    or (s.kind in ('weekdays','weekly_target') and extract(isodow from from_day+d.n)::smallint = any(s.weekdays))
  on conflict(user_id,activity_id,scheduled_date) do nothing;
  insert into public.daily_summaries(user_id,day)
  select owner_id,from_day+n from generate_series(0,to_day-from_day) d(n)
  on conflict(user_id,day) do nothing;
end;
$$;

create function public.sync_tracking(p_from date,p_to date) returns void
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); local_today date;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select (now() at time zone timezone)::date into local_today from public.profiles where id=owner_id for update;
  if local_today is null then raise exception 'Profile not found'; end if;
  if p_from is null or p_to is null or p_from>p_to or p_to>local_today or p_to-p_from>365 then
    raise exception 'Invalid synchronization interval' using errcode='22023';
  end if;
  perform private.sync_days(owner_id,p_from,p_to);
end;
$$;

create function public.save_activity(
  p_name text, p_description text, p_kind public.recurrence_kind,
  p_weekdays smallint[], p_start date, p_activity_id uuid default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); local_today date; saved_id uuid; effective_date date; first_day date;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select (now() at time zone timezone)::date into local_today from public.profiles where id=owner_id for update;
  if local_today is null then raise exception 'Profile not found'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 200 then raise exception 'Invalid activity name'; end if;
  if p_kind is null or p_weekdays is null or p_start is null then raise exception 'Missing schedule fields'; end if;
  if p_activity_id is null then
    if p_start<local_today then raise exception 'New activities cannot change past days'; end if;
    effective_date:=p_start;
    insert into public.daily_activities(user_id,name,description) values(owner_id,trim(p_name),coalesce(p_description,'')) returning id into saved_id;
  else
    select id into saved_id from public.daily_activities where id=p_activity_id and user_id=owner_id and archived_at is null for update;
    if saved_id is null then raise exception 'Activity not found' using errcode='42501'; end if;
    effective_date:=greatest(p_start,local_today+1);
    select min(valid_from) into first_day from public.activity_schedules where user_id=owner_id and activity_id=p_activity_id;
    perform private.sync_days(owner_id,first_day,local_today);
    -- Only future versions may be replaced. Past versions and occurrences remain intact.
    delete from public.activity_schedules where user_id=owner_id and activity_id=p_activity_id and valid_from>=effective_date;
    update public.activity_schedules set valid_until=effective_date-1
      where user_id=owner_id and activity_id=p_activity_id and valid_from<effective_date and (valid_until is null or valid_until>=effective_date);
    update public.daily_activities set name=trim(p_name),description=coalesce(p_description,'') where id=p_activity_id and user_id=owner_id;
  end if;
  insert into public.activity_schedules(user_id,activity_id,kind,valid_from,valid_until,weekdays,weekly_target)
  values(owner_id,saved_id,p_kind,effective_date,case when p_kind='once' then effective_date else null end,
    p_weekdays,case when p_kind='weekly_target' then cardinality(p_weekdays) else null end);
  if effective_date=local_today then perform private.sync_days(owner_id,local_today,local_today); end if;
  return saved_id;
end;
$$;

create function public.archive_activity(p_activity_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); local_today date; first_day date;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select (now() at time zone timezone)::date into local_today from public.profiles where id=owner_id for update;
  if not exists(select 1 from public.daily_activities where id=p_activity_id and user_id=owner_id) then
    raise exception 'Activity not found' using errcode='42501';
  end if;
  select min(valid_from) into first_day from public.activity_schedules where user_id=owner_id and activity_id=p_activity_id;
  perform private.sync_days(owner_id,first_day,local_today);
  delete from public.activity_schedules where user_id=owner_id and activity_id=p_activity_id and valid_from>local_today;
  update public.activity_schedules set valid_until=local_today where user_id=owner_id and activity_id=p_activity_id and (valid_until is null or valid_until>local_today);
  update public.daily_activities set archived_at=now() where id=p_activity_id and user_id=owner_id;
end;
$$;

create function public.add_activity_today(p_activity_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); local_today date; activity public.daily_activities;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select (now() at time zone timezone)::date into local_today from public.profiles where id=owner_id for update;
  select * into activity from public.daily_activities where id=p_activity_id and user_id=owner_id and archived_at is null;
  if activity.id is null then raise exception 'Activity not found' using errcode='42501'; end if;
  insert into public.daily_activity_logs(user_id,activity_id,scheduled_date,name_snapshot,weight_snapshot)
  values(owner_id,activity.id,local_today,activity.name,activity.weight)
  on conflict(user_id,activity_id,scheduled_date) do update set status=case
    when public.daily_activity_logs.status='skipped' then 'planned' else public.daily_activity_logs.status end;
end;
$$;

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.sync_tracking(date,date) from public,anon;
revoke all on function public.save_activity(text,text,public.recurrence_kind,smallint[],date,uuid) from public,anon;
revoke all on function public.archive_activity(uuid) from public,anon;
revoke all on function public.add_activity_today(uuid) from public,anon;
grant execute on function public.sync_tracking(date,date) to authenticated;
grant execute on function public.save_activity(text,text,public.recurrence_kind,smallint[],date,uuid) to authenticated;
grant execute on function public.archive_activity(uuid) to authenticated;
grant execute on function public.add_activity_today(uuid) to authenticated;
notify pgrst,'reload schema';


-- ===== 005_journey_steps.sql =====
-- Jornadas de longo prazo: totalmente separadas da rotina e consistência diária.

alter table public.journeys add column start_date date;

create table public.journey_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  journey_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '',
  due_date date,
  status text not null default 'pending' check (status in ('pending','completed')),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, user_id),
  unique (journey_id, position),
  foreign key (journey_id, user_id) references public.journeys(id, user_id) on delete restrict
);
create index journey_steps_owner_journey_idx on public.journey_steps(user_id, journey_id, position);

alter table public.journey_steps enable row level security;
revoke all on public.journey_steps from anon, authenticated;
grant select, insert, update, delete on public.journey_steps to authenticated;
create policy owner_select on public.journey_steps for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.journey_steps for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_update on public.journey_steps for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_delete on public.journey_steps for delete to authenticated using ((select auth.uid()) = user_id);

create function private.prepare_journey_step() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op = 'UPDATE' and (new.id <> old.id or new.user_id <> old.user_id or new.journey_id <> old.journey_id) then
    raise exception 'Step identity, owner and journey are immutable' using errcode='23514';
  end if;
  new.updated_at := now();
  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status <> 'completed' then new.completed_at := now(); else new.completed_at := old.completed_at; end if;
  else new.completed_at := null; end if;
  return new;
end;
$$;
create trigger prepare_journey_step before insert or update on public.journey_steps
for each row execute function private.prepare_journey_step();

create function private.sync_journey_completion() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; parent_id uuid; total_steps integer; completed_steps integer;
begin
  owner_id := coalesce(new.user_id, old.user_id);
  parent_id := coalesce(new.journey_id, old.journey_id);
  select count(*), count(*) filter (where status='completed') into total_steps, completed_steps
  from public.journey_steps where user_id=owner_id and journey_id=parent_id;
  if total_steps > 0 and total_steps = completed_steps then
    update public.journeys set status='completed' where id=parent_id and user_id=owner_id and status <> 'archived';
  elsif exists(select 1 from public.journeys where id=parent_id and user_id=owner_id and status='completed') then
    update public.journeys set status='in_progress' where id=parent_id and user_id=owner_id;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger sync_journey_completion after insert or update or delete on public.journey_steps
for each row execute function private.sync_journey_completion();

create trigger audit_change after insert or update or delete on public.journey_steps
for each row execute function private.audit_change();

create function public.move_journey_step(p_step_id uuid, p_direction text) returns void
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); source record; target record;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_direction not in ('up','down') then raise exception 'Invalid direction' using errcode='22023'; end if;
  select * into source from public.journey_steps where id=p_step_id and user_id=owner_id for update;
  if source.id is null then raise exception 'Step not found' using errcode='42501'; end if;
  select * into target from public.journey_steps where journey_id=source.journey_id and user_id=owner_id
    and position = source.position + case when p_direction='up' then -1 else 1 end for update;
  if target.id is null then return; end if;
  update public.journey_steps set position=(select coalesce(max(position),0)+1 from public.journey_steps where journey_id=source.journey_id and user_id=owner_id) where id=source.id;
  update public.journey_steps set position=source.position where id=target.id;
  update public.journey_steps set position=target.position where id=source.id;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.move_journey_step(uuid,text) from public, anon;
grant execute on function public.move_journey_step(uuid,text) to authenticated;
notify pgrst, 'reload schema';


-- ===== 006_profile_preferences_calendar.sql =====
-- Perfil visual e assinatura privada de calendário.

alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists calendar_token uuid not null default gen_random_uuid();
create unique index if not exists profiles_calendar_token_key on public.profiles(calendar_token);

-- O schema storage existe nos projetos Supabase. O bloco condicional mantém os
-- testes locais de PostgreSQL independentes do serviço gerenciado de Storage.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
    execute 'create policy "avatar_select_own" on storage.objects for select to authenticated using (bucket_id = ''avatars'' and owner_id = (select auth.uid())::text)';
    execute 'create policy "avatar_insert_own" on storage.objects for insert to authenticated with check (bucket_id = ''avatars'' and owner_id = (select auth.uid())::text and (storage.foldername(name))[1] = (select auth.uid())::text)';
    execute 'create policy "avatar_update_own" on storage.objects for update to authenticated using (bucket_id = ''avatars'' and owner_id = (select auth.uid())::text) with check (bucket_id = ''avatars'' and owner_id = (select auth.uid())::text)';
  end if;
exception when duplicate_object then null;
end;
$$;

notify pgrst, 'reload schema';

commit;
