-- ════════════════════════════════════════════════════════════
-- Papertray — Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ════════════════════════════════════════════════════════════

-- Enable UUID extension (already on by default in Supabase)
create extension if not exists "uuid-ossp";

-- ─── Profiles ─────────────────────────────────────────────────
-- One row per authenticated user (mirrors auth.users)
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  first_name   text not null default '',
  last_name    text not null default '',
  email        text not null default '',
  photo        text,                        -- base64 data-url or storage URL
  plan         text not null default 'Collaborator Pro',
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can upsert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ─── Areas ────────────────────────────────────────────────────
create table if not exists public.areas (
  id           text primary key,
  user_id      uuid not null references auth.users on delete cascade,
  name         text not null,
  is_shared    boolean not null default false,
  order_idx    integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.areas enable row level security;

create policy "Users manage their own areas"
  on public.areas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Projects ─────────────────────────────────────────────────
create table if not exists public.projects (
  id           text primary key,
  user_id      uuid not null references auth.users on delete cascade,
  area_id      text references public.areas on delete set null,
  name         text not null,
  order_idx    integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Users manage their own projects"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Headings ─────────────────────────────────────────────────
create table if not exists public.headings (
  id           text primary key,
  user_id      uuid not null references auth.users on delete cascade,
  project_id   text not null references public.projects on delete cascade,
  name         text not null,
  order_idx    integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.headings enable row level security;

create policy "Users manage their own headings"
  on public.headings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Tasks ────────────────────────────────────────────────────
create table if not exists public.tasks (
  id           text primary key,
  user_id      uuid not null references auth.users on delete cascade,
  project_id   text references public.projects on delete set null,
  name         text not null,
  status       text not null default 'open',   -- open | done | trash
  bucket       text not null default 'inbox',  -- inbox | today | upcoming | anytime | someday
  section      text,                            -- heading name (or null)
  assignee_id  text,                            -- collaborator key e.g. 'AL'
  tags         jsonb not null default '[]',
  due_label    text,
  due_date     date,
  order_idx    integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "Users manage their own tasks"
  on public.tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Useful indexes
create index if not exists tasks_user_bucket   on public.tasks (user_id, bucket);
create index if not exists tasks_user_project  on public.tasks (user_id, project_id);
create index if not exists tasks_user_status   on public.tasks (user_id, status);

-- ─── Trigger: auto-create profile on signup ────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name',  '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
