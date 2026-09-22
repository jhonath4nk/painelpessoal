-- Default-deny access. Clients cannot write summaries or audit events.
begin;
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
commit;
