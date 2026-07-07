alter table public.player_presence
  add column if not exists world_x integer not null default 627,
  add column if not exists world_y integer not null default 776,
  add column if not exists facing_x real not null default 0,
  add column if not exists facing_y real not null default 1,
  add column if not exists position_updated_at timestamptz not null default now();

alter table public.player_presence
  drop constraint if exists player_presence_world_position_check;

alter table public.player_presence
  add constraint player_presence_world_position_check check (
    world_x between 54 and 1200
    and world_y between 120 and 1208
    and facing_x between -1 and 1
    and facing_y between -1 and 1
  );

comment on column public.player_presence.world_x is
  'Last server-accepted SolBloom town X coordinate used to restore the authenticated player after refresh or login.';

comment on column public.player_presence.world_y is
  'Last server-accepted SolBloom town Y coordinate used to restore the authenticated player after refresh or login.';
