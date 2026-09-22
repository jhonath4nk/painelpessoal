-- Jornadas de longo prazo: totalmente separadas da rotina e consistência diária.
begin;

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
commit;
