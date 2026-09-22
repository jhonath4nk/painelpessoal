-- Preserve ownership and daily summary integrity at the database boundary.
begin;
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
commit;
