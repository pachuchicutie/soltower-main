alter table public.raid_lobbies
  add column if not exists needed_hero_ids jsonb not null default '[]'::jsonb;

comment on column public.raid_lobbies.needed_hero_ids is
  'Host-selected recruitment preferences. Open lobbies expire after one hour if the raid has not started.';

update public.raid_lobbies
set status = 'EXPIRED',
    updated_at = now()
where status = 'OPEN'
  and created_at < now() - interval '1 hour';

delete from public.raid_lobby_members m
using public.raid_lobbies l
where m.lobby_id = l.id
  and l.status = 'EXPIRED';
