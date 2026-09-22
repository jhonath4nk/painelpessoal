-- Phase 2: schema. Apply in order, once, on a new Supabase project.
begin;
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
commit;
