-- ════════════════════════════════════════════════════════════
-- Papertray — Sharing Schema Extension
-- Run AFTER schema.sql in Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── Invites ──────────────────────────────────────────────
create table if not exists public.invites (
  id            uuid primary key default uuid_generate_v4(),
  token         text not null unique default encode(gen_random_bytes(16), 'hex'),
  resource_type text not null check (resource_type in ('area', 'project')),
  resource_id   text not null,
  owner_id      uuid not null references auth.users on delete cascade,
  invitee_email text,
  accepted_by   uuid references auth.users on delete set null,
  expires_at    timestamptz not null default (now() + interval '7 days'),
  created_at    timestamptz not null default now()
);

alter table public.invites enable row level security;

create policy "Owners can insert invites"
  on public.invites for insert
  with check (auth.uid() = owner_id);

create policy "Owners can read their own invites"
  on public.invites for select
  using (auth.uid() = owner_id);

create policy "Authenticated users can read any invite"
  on public.invites for select
  using (auth.uid() is not null);

create policy "Owners can delete their invites"
  on public.invites for delete
  using (auth.uid() = owner_id);

-- ─── Shares ───────────────────────────────────────────────
create table if not exists public.shares (
  id            uuid primary key default uuid_generate_v4(),
  resource_type text not null check (resource_type in ('area', 'project')),
  resource_id   text not null,
  owner_id      uuid not null references auth.users on delete cascade,
  member_id     uuid not null references auth.users on delete cascade,
  member_email  text not null default '',
  created_at    timestamptz not null default now(),
  unique (resource_type, resource_id, member_id)
);

alter table public.shares enable row level security;

create policy "Owners can read their shares"
  on public.shares for select
  using (auth.uid() = owner_id);

create policy "Members can read their own shares"
  on public.shares for select
  using (auth.uid() = member_id);

create policy "Owners can delete their shares"
  on public.shares for delete
  using (auth.uid() = owner_id);

-- ─── New RLS on existing tables (additive) ────────────────

-- Allow reading profiles by any authenticated user (for invite previews)
create policy "Authenticated users can read any profile"
  on public.profiles for select
  using (auth.uid() is not null);

-- Areas: shared members can read
create policy "Shared members can read areas"
  on public.areas for select
  using (
    exists (
      select 1 from public.shares s
      where s.resource_type = 'area'
        and s.resource_id   = areas.id
        and s.member_id     = auth.uid()
    )
  );

-- Projects: shared members can read (direct share OR via shared area)
create policy "Shared members can read projects"
  on public.projects for select
  using (
    exists (
      select 1 from public.shares s
      where s.member_id = auth.uid()
        and (
          (s.resource_type = 'project' and s.resource_id = projects.id)
          or
          (s.resource_type = 'area'    and s.resource_id = projects.area_id)
        )
    )
  );

-- Headings: shared members can read
create policy "Shared members can read headings"
  on public.headings for select
  using (
    exists (
      select 1 from public.projects p
      join  public.shares s
        on  s.member_id = auth.uid()
        and (
          (s.resource_type = 'project' and s.resource_id = p.id)
          or
          (s.resource_type = 'area'    and s.resource_id = p.area_id)
        )
      where p.id = headings.project_id
    )
  );

-- Tasks: shared members can read
create policy "Shared members can read tasks"
  on public.tasks for select
  using (
    tasks.project_id is not null
    and exists (
      select 1 from public.projects p
      join  public.shares s
        on  s.member_id = auth.uid()
        and (
          (s.resource_type = 'project' and s.resource_id = p.id)
          or
          (s.resource_type = 'area'    and s.resource_id = p.area_id)
        )
      where p.id = tasks.project_id
    )
  );

-- Tasks: shared members can insert (their own tasks in shared projects)
create policy "Shared members can insert tasks"
  on public.tasks for insert
  with check (
    auth.uid() = user_id
    and project_id is not null
    and exists (
      select 1 from public.projects p
      join  public.shares s
        on  s.member_id = auth.uid()
        and (
          (s.resource_type = 'project' and s.resource_id = p.id)
          or
          (s.resource_type = 'area'    and s.resource_id = p.area_id)
        )
      where p.id = tasks.project_id
    )
  );

-- Tasks: shared members can update any task in shared projects
create policy "Shared members can update tasks"
  on public.tasks for update
  using (
    tasks.project_id is not null
    and exists (
      select 1 from public.projects p
      join  public.shares s
        on  s.member_id = auth.uid()
        and (
          (s.resource_type = 'project' and s.resource_id = p.id)
          or
          (s.resource_type = 'area'    and s.resource_id = p.area_id)
        )
      where p.id = tasks.project_id
    )
  )
  with check (true);

-- ─── accept_invite() RPC ───────────────────────────────────
create or replace function public.accept_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite       public.invites%rowtype;
  v_member_email text;
begin
  if auth.uid() is null              then return jsonb_build_object('error', 'not_authenticated'); end if;
  select * into v_invite from public.invites where token = p_token;
  if not found                       then return jsonb_build_object('error', 'not_found'); end if;
  if v_invite.expires_at < now()     then return jsonb_build_object('error', 'expired');   end if;
  if v_invite.accepted_by is not null then return jsonb_build_object('error', 'already_accepted'); end if;
  if v_invite.owner_id = auth.uid()  then return jsonb_build_object('error', 'own_invite'); end if;

  select coalesce(email, '') into v_member_email from public.profiles where id = auth.uid();

  insert into public.shares (resource_type, resource_id, owner_id, member_id, member_email)
  values (v_invite.resource_type, v_invite.resource_id, v_invite.owner_id, auth.uid(), coalesce(v_member_email, coalesce(v_invite.invitee_email, '')))
  on conflict (resource_type, resource_id, member_id) do nothing;

  update public.invites set accepted_by = auth.uid() where id = v_invite.id;

  return jsonb_build_object(
    'ok',            true,
    'resource_type', v_invite.resource_type,
    'resource_id',   v_invite.resource_id
  );
end;
$$;

revoke execute on function public.accept_invite(text) from public;
grant  execute on function public.accept_invite(text) to authenticated;

-- ─── get_invite_preview() — works unauthenticated ─────────
create or replace function public.get_invite_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite     public.invites%rowtype;
  v_owner_name text;
  v_res_name   text;
begin
  select * into v_invite from public.invites where token = p_token;
  if not found                   then return jsonb_build_object('error', 'not_found'); end if;
  if v_invite.expires_at < now() then return jsonb_build_object('error', 'expired');   end if;

  select coalesce(nullif(trim(first_name || ' ' || last_name), ''), email)
    into v_owner_name from public.profiles where id = v_invite.owner_id;

  if v_invite.resource_type = 'area' then
    select name into v_res_name from public.areas    where id = v_invite.resource_id;
  else
    select name into v_res_name from public.projects where id = v_invite.resource_id;
  end if;

  return jsonb_build_object(
    'resource_type',   v_invite.resource_type,
    'resource_name',   coalesce(v_res_name, 'workspace'),
    'owner_name',      coalesce(v_owner_name, 'Someone'),
    'invitee_email',   v_invite.invitee_email,
    'already_accepted', v_invite.accepted_by is not null
  );
end;
$$;

revoke execute on function public.get_invite_preview(text) from public;
grant  execute on function public.get_invite_preview(text) to anon, authenticated;

-- ─── Indexes ───────────────────────────────────────────────
create index if not exists invites_token   on public.invites (token);
create index if not exists invites_owner   on public.invites (owner_id);
create index if not exists shares_resource on public.shares  (resource_type, resource_id);
create index if not exists shares_member   on public.shares  (member_id);
