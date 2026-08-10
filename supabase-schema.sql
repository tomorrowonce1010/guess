create table if not exists public.player_progress (
  player_name text primary key,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_progress enable row level security;

drop policy if exists "player_progress_public_select" on public.player_progress;
drop policy if exists "player_progress_public_insert" on public.player_progress;
drop policy if exists "player_progress_public_update" on public.player_progress;
drop policy if exists "player_progress_public_delete" on public.player_progress;

create policy "player_progress_public_select"
  on public.player_progress for select
  using (true);

create policy "player_progress_public_insert"
  on public.player_progress for insert
  with check (true);

create policy "player_progress_public_update"
  on public.player_progress for update
  using (true)
  with check (true);

create policy "player_progress_public_delete"
  on public.player_progress for delete
  using (true);
