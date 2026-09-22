-- Perfil visual e assinatura privada de calendário.
begin;

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
