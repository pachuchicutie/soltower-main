-- Denormalize display names onto lobby members so open-party lists work from the browser
-- without needing service-role profile joins (player_profiles RLS is self-only).

alter table public.raid_lobby_members
  add column if not exists display_name text;

comment on column public.raid_lobby_members.display_name is
  'Snapshot of the player display name when joining/creating a party. Used for open-lobby lists.';

-- Backfill from current profiles where available.
update public.raid_lobby_members m
set display_name = p.display_name
from public.player_profiles p
where p.player_id = m.player_id
  and (m.display_name is null or btrim(m.display_name) = '');

-- Authenticated players can read public identity fields for guardians currently in open parties.
drop policy if exists "authenticated can read open lobby member profiles" on public.player_profiles;
create policy "authenticated can read open lobby member profiles"
  on public.player_profiles
  for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1
      from public.raid_lobby_members m
      join public.raid_lobbies l on l.id = m.lobby_id
      where m.player_id = player_profiles.player_id
        and l.status = 'OPEN'
    )
  );
