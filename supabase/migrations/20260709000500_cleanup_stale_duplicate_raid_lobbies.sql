-- One-time + ongoing hygiene for raid open parties:
-- 1) Expire old OPEN lobbies
-- 2) Close stuck IN_PROGRESS runs
-- 3) Per host: keep only the latest OPEN party, close older duplicates
-- 4) Close OPEN lobbies with no members / no host

-- A) OPEN lobbies older than 1 hour -> EXPIRED
update public.raid_lobbies
set
  status = 'EXPIRED',
  updated_at = now()
where status = 'OPEN'
  and created_at < now() - interval '1 hour';

-- B) IN_PROGRESS stuck longer than 2 hours -> COMPLETED
update public.raid_lobbies
set
  status = 'COMPLETED',
  updated_at = now()
where status = 'IN_PROGRESS'
  and coalesce(updated_at, created_at) < now() - interval '2 hours';

-- C) OPEN lobbies with zero members -> EXPIRED
update public.raid_lobbies l
set
  status = 'EXPIRED',
  updated_at = now()
where l.status = 'OPEN'
  and not exists (
    select 1
    from public.raid_lobby_members m
    where m.lobby_id = l.id
  );

-- D) OPEN lobbies with members but no host flag -> EXPIRED
update public.raid_lobbies l
set
  status = 'EXPIRED',
  updated_at = now()
where l.status = 'OPEN'
  and not exists (
    select 1
    from public.raid_lobby_members m
    where m.lobby_id = l.id
      and m.host = true
  );

-- E) Duplicate OPEN parties per host: keep newest only
with ranked as (
  select
    id,
    host_player_id,
    created_at,
    row_number() over (
      partition by host_player_id
      order by created_at desc, id desc
    ) as rn
  from public.raid_lobbies
  where status = 'OPEN'
)
update public.raid_lobbies l
set
  status = 'DISBANDED',
  updated_at = now()
from ranked r
where l.id = r.id
  and r.rn > 1;

-- F) Remove members from closed lobbies so they cannot reappear via joins
delete from public.raid_lobby_members m
using public.raid_lobbies l
where m.lobby_id = l.id
  and l.status in ('EXPIRED', 'DISBANDED', 'COMPLETED');
