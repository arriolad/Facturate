-- Ejecutada una vez tras verificar que public.perfiles no existía.
begin;
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  creado_en timestamptz not null default now()
);
alter table public.perfiles enable row level security;
create policy "ver mi perfil" on public.perfiles
for select to authenticated using ((select auth.uid()) = id);
create policy "crear mi perfil" on public.perfiles
for insert to authenticated with check ((select auth.uid()) = id);
create policy "editar mi perfil" on public.perfiles
for update to authenticated using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
commit;
