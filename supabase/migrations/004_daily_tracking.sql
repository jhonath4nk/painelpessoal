-- Fase 3. Execute UMA VEZ, depois da instalação inicial.
-- Preserva contas, ofensivas e histórico existentes.
begin;

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
commit;
