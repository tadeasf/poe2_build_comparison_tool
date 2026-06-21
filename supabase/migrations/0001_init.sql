-- PoE2 Build Comparison Tool — initial schema
-- Tables: profiles (1:1 auth.users), builds (imported PoB2 builds), comparisons.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.builds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  class       text,
  ascendancy  text,
  level       int,
  pob_string  text not null,
  parsed      jsonb not null,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists builds_user_id_idx on public.builds (user_id);
create index if not exists builds_ascendancy_idx on public.builds (ascendancy);

create table if not exists public.comparisons (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  source_build_id uuid not null references public.builds (id) on delete cascade,
  target_build_id uuid not null references public.builds (id) on delete cascade,
  created_at      timestamptz not null default now()
);

create index if not exists comparisons_user_id_idx on public.comparisons (user_id);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at maintenance + auto-create profile on signup
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists builds_set_updated_at on public.builds;
create trigger builds_set_updated_at before update on public.builds
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.builds enable row level security;
alter table public.comparisons enable row level security;

-- profiles: owner-only
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- builds: owner read/write; public builds readable by anyone
create policy "builds_select_own_or_public" on public.builds
  for select using (auth.uid() = user_id or is_public);
create policy "builds_insert_own" on public.builds
  for insert with check (auth.uid() = user_id);
create policy "builds_update_own" on public.builds
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "builds_delete_own" on public.builds
  for delete using (auth.uid() = user_id);

-- comparisons: owner-only
create policy "comparisons_select_own" on public.comparisons
  for select using (auth.uid() = user_id);
create policy "comparisons_insert_own" on public.comparisons
  for insert with check (auth.uid() = user_id);
create policy "comparisons_delete_own" on public.comparisons
  for delete using (auth.uid() = user_id);
