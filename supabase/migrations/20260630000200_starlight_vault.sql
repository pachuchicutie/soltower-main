-- Starlight Vault: server-authoritative Star Draw system gated by manual art readiness.
-- This migration is non-destructive and does not enable any live reward whose art is incomplete.

alter table public.inventory_items
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists is_tradeable boolean not null default false,
  add column if not exists is_auctionable boolean not null default false,
  add column if not exists is_giftable boolean not null default false,
  add column if not exists is_sellable boolean not null default false,
  add column if not exists is_convertible boolean not null default false;

alter table public.inventory_items
  drop constraint if exists inventory_items_item_type_check;

alter table public.inventory_items
  add constraint inventory_items_item_type_check
  check (item_type in ('EQUIPMENT', 'CONSUMABLE', 'MATERIAL', 'COSMETIC'));

create table if not exists public.manual_asset_registry (
  id text primary key,
  asset_kind text not null check (asset_kind in ('BUILDING', 'FULL_COSTUME', 'WEAPON', 'ARMOR', 'RELIC', 'CHARM', 'BANNER', 'RARITY_FRAME')),
  owner_id text,
  hero_id text,
  reward_id text,
  asset_path text not null,
  required boolean not null default true,
  asset_status text not null default 'pending_manual_art' check (asset_status in ('pending_manual_art', 'partial', 'ready', 'disabled')),
  enabled_for_player_use boolean not null default false,
  source_dimensions jsonb,
  intended_render_scale numeric(6, 3) not null default 1.000,
  missing_assets text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.starlight_vault_banners (
  id text primary key,
  name text not null,
  tab text not null,
  draw_one_cost_gold integer not null default 50 check (draw_one_cost_gold = 50),
  draw_ten_cost_gold integer not null default 450 check (draw_ten_cost_gold = 450),
  requires_active_hero boolean not null default false,
  active boolean not null default true,
  rates jsonb not null,
  pity_rules jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.starlight_vault_pool_entries (
  id text primary key,
  banner_id text not null references public.starlight_vault_banners(id) on delete cascade,
  reward_id text not null,
  reward_type text not null check (reward_type in ('FULL_COSTUME', 'WEAPON', 'ARMOR', 'RELIC', 'CHARM')),
  reward_name text not null,
  rarity text not null check (rarity in ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY')),
  weight integer not null check (weight > 0),
  hero_compatibility text[] not null default '{}'::text[],
  item_tags text[] not null default '{}'::text[],
  asset_status text not null default 'pending_manual_art' check (asset_status in ('pending_manual_art', 'partial', 'ready', 'disabled')),
  enabled boolean not null default false,
  enabled_for_player_use boolean not null default false,
  duplicate_conversion_value integer not null default 0 check (duplicate_conversion_value >= 0),
  bound_metadata jsonb not null default jsonb_build_object(
    'source', 'starlight_vault',
    'is_bound', true,
    'is_tradeable', false,
    'is_auctionable', false,
    'is_giftable', false,
    'is_sellable', false,
    'is_convertible', false
  ),
  created_at timestamptz not null default now(),
  enabled_at timestamptz,
  unique (banner_id, reward_id)
);

create table if not exists public.starlight_vault_pity_counters (
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  banner_id text not null references public.starlight_vault_banners(id) on delete cascade,
  rare_counter integer not null default 0 check (rare_counter >= 0 and rare_counter <= 10),
  epic_counter integer not null default 0 check (epic_counter >= 0 and epic_counter <= 75),
  legendary_counter integer not null default 0 check (legendary_counter >= 0 and legendary_counter <= 300),
  updated_at timestamptz not null default now(),
  primary key (player_id, banner_id)
);

create table if not exists public.starlight_vault_pull_events (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  banner_id text not null references public.starlight_vault_banners(id),
  active_hero_id text,
  payment_balance_type text not null check (payment_balance_type in ('EARNED_GOLD', 'LOCKED_GOLD')),
  draw_count integer not null check (draw_count in (1, 10)),
  total_cost_gold integer not null check (total_cost_gold in (50, 450)),
  result jsonb not null,
  ledger_id uuid references public.economy_ledger(id) on delete set null,
  idempotency_key text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.starlight_vault_duplicate_conversions (
  id uuid primary key default gen_random_uuid(),
  pull_event_id uuid references public.starlight_vault_pull_events(id) on delete cascade,
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  banner_id text not null references public.starlight_vault_banners(id),
  reward_id text not null,
  reward_type text not null,
  rarity text not null,
  material_definition_id text not null check (material_definition_id in ('wardrobe-threads', 'starlight-shards')),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.player_full_costumes (
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  costume_id text not null,
  rarity text not null check (rarity in ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY')),
  source text not null default 'starlight_vault',
  is_bound boolean not null default true,
  is_tradeable boolean not null default false,
  is_auctionable boolean not null default false,
  is_giftable boolean not null default false,
  is_sellable boolean not null default false,
  is_convertible boolean not null default false,
  acquired_at timestamptz not null default now(),
  primary key (player_id, costume_id)
);

create table if not exists public.player_equipped_cosmetics (
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  hero_id text not null,
  cosmetic_slot text not null check (cosmetic_slot = 'FULL_COSTUME'),
  costume_id text,
  updated_at timestamptz not null default now(),
  primary key (player_id, hero_id, cosmetic_slot)
);

create table if not exists public.hero_compatible_item_tags (
  hero_id text not null,
  reward_type text not null check (reward_type in ('WEAPON', 'ARMOR', 'RELIC', 'CHARM')),
  item_tag text not null,
  primary key (hero_id, reward_type, item_tag)
);

create table if not exists private.starlight_vault_draw_requests (
  idempotency_key text primary key,
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  banner_id text not null,
  payment_balance_type text not null,
  draw_count integer not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_starlight_pool_live
  on public.starlight_vault_pool_entries(banner_id, asset_status, enabled, enabled_for_player_use);

create index if not exists idx_starlight_history_player
  on public.starlight_vault_pull_events(player_id, created_at desc);

create unique index if not exists idx_inventory_material_stack
  on public.inventory_items(player_id, definition_id)
  where item_type = 'MATERIAL';

alter table public.manual_asset_registry enable row level security;
alter table public.starlight_vault_banners enable row level security;
alter table public.starlight_vault_pool_entries enable row level security;
alter table public.starlight_vault_pity_counters enable row level security;
alter table public.starlight_vault_pull_events enable row level security;
alter table public.starlight_vault_duplicate_conversions enable row level security;
alter table public.player_full_costumes enable row level security;
alter table public.player_equipped_cosmetics enable row level security;
alter table public.hero_compatible_item_tags enable row level security;

drop policy if exists "players can read ready manual asset registry" on public.manual_asset_registry;
create policy "players can read ready manual asset registry"
  on public.manual_asset_registry for select
  using (asset_status = 'ready' and enabled_for_player_use = true);

drop policy if exists "players can read active starlight banners" on public.starlight_vault_banners;
create policy "players can read active starlight banners"
  on public.starlight_vault_banners for select
  using (active = true);

drop policy if exists "players can read live starlight pool entries" on public.starlight_vault_pool_entries;
create policy "players can read live starlight pool entries"
  on public.starlight_vault_pool_entries for select
  using (asset_status = 'ready' and enabled_for_player_use = true and enabled = true);

drop policy if exists "players can read own starlight pity" on public.starlight_vault_pity_counters;
create policy "players can read own starlight pity"
  on public.starlight_vault_pity_counters for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = starlight_vault_pity_counters.player_id and p.auth_user_id = auth.uid()
  ));

drop policy if exists "players can read own starlight pulls" on public.starlight_vault_pull_events;
create policy "players can read own starlight pulls"
  on public.starlight_vault_pull_events for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = starlight_vault_pull_events.player_id and p.auth_user_id = auth.uid()
  ));

drop policy if exists "players can read own starlight duplicate conversions" on public.starlight_vault_duplicate_conversions;
create policy "players can read own starlight duplicate conversions"
  on public.starlight_vault_duplicate_conversions for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = starlight_vault_duplicate_conversions.player_id and p.auth_user_id = auth.uid()
  ));

drop policy if exists "players can read own full costumes" on public.player_full_costumes;
create policy "players can read own full costumes"
  on public.player_full_costumes for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = player_full_costumes.player_id and p.auth_user_id = auth.uid()
  ));

drop policy if exists "players can read own equipped cosmetics" on public.player_equipped_cosmetics;
create policy "players can read own equipped cosmetics"
  on public.player_equipped_cosmetics for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = player_equipped_cosmetics.player_id and p.auth_user_id = auth.uid()
  ));

drop policy if exists "players can read compatible item tags" on public.hero_compatible_item_tags;
create policy "players can read compatible item tags"
  on public.hero_compatible_item_tags for select
  using (true);

insert into public.starlight_vault_banners(id, name, tab, requires_active_hero, rates, pity_rules)
values
  ('global-costume-collection-i', 'Global Costume Collection I', 'Costumes', false,
   '{"COMMON":75.00,"UNCOMMON":18.50,"RARE":5.40,"EPIC":1.00,"LEGENDARY":0.10}'::jsonb,
   '{"rare":{"threshold":10,"label":"Rare or higher"},"epic":{"threshold":75,"label":"Epic or higher"},"legendary":{"threshold":300,"label":"Legendary"}}'::jsonb),
  ('active-hero-weapon', 'Active Hero Weapon Banner', 'Weapons', true,
   '{"COMMON":75.00,"UNCOMMON":18.50,"RARE":5.40,"EPIC":1.00,"LEGENDARY":0.10}'::jsonb,
   '{"rare":{"threshold":10,"label":"Rare or higher"},"epic":{"threshold":75,"label":"Epic or higher"},"legendary":{"threshold":300,"label":"Legendary"}}'::jsonb),
  ('active-hero-armor', 'Active Hero Armor Banner', 'Armor', true,
   '{"COMMON":75.00,"UNCOMMON":18.50,"RARE":5.40,"EPIC":1.00,"LEGENDARY":0.10}'::jsonb,
   '{"rare":{"threshold":10,"label":"Rare or higher"},"epic":{"threshold":75,"label":"Epic or higher"},"legendary":{"threshold":300,"label":"Legendary"}}'::jsonb),
  ('active-hero-relics-charms', 'Active Hero Relics & Charms Banner', 'Relics & Charms', true,
   '{"COMMON":75.00,"UNCOMMON":18.50,"RARE":5.40,"EPIC":1.00,"LEGENDARY":0.10}'::jsonb,
   '{"rare":{"threshold":10,"label":"Rare or higher"},"epic":{"threshold":75,"label":"Epic or higher"},"legendary":{"threshold":300,"label":"Legendary"}}'::jsonb)
on conflict (id) do update
set name = excluded.name,
    tab = excluded.tab,
    requires_active_hero = excluded.requires_active_hero,
    rates = excluded.rates,
    pity_rules = excluded.pity_rules,
    updated_at = now();

insert into public.manual_asset_registry(id, asset_kind, owner_id, asset_path, asset_status, enabled_for_player_use, missing_assets)
values (
  'town-starlight-vault-building',
  'BUILDING',
  'starlight-vault',
  '/assets/town/infrastructure/starlight-vault.png',
  'pending_manual_art',
  false,
  array['/assets/town/infrastructure/starlight-vault.png']
)
on conflict (id) do update
set asset_path = excluded.asset_path,
    asset_status = excluded.asset_status,
    enabled_for_player_use = excluded.enabled_for_player_use,
    missing_assets = excluded.missing_assets,
    updated_at = now();

with costumes(costume_id) as (
  values
    ('default-noob'),
    ('banana-guardian'),
    ('capybara-vacation'),
    ('galactic-sigma'),
    ('midnight-drum-runner')
),
heroes(hero_id) as (
  values
    ('storm-archer'),
    ('tide-mage'),
    ('bombardier'),
    ('coral-alchemist'),
    ('starcaller')
)
insert into public.manual_asset_registry(
  id, asset_kind, owner_id, hero_id, reward_id, asset_path, asset_status, enabled_for_player_use, missing_assets
)
select
  'costume-' || c.costume_id || '-' || h.hero_id,
  'FULL_COSTUME',
  c.costume_id,
  h.hero_id,
  c.costume_id,
  '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/preview.png',
  'pending_manual_art',
  false,
  array[
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/preview.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/idle-top-left.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/idle-left.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/idle-bottom-left.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/idle-top.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/idle-top-right.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/idle-right.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/idle-bottom-right.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/idle-bottom.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/walk-top-left.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/walk-left.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/walk-bottom-left.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/walk-top.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/walk-top-right.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/walk-right.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/walk-bottom-right.png',
    '/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/walk-bottom.png'
  ]
from costumes c
cross join heroes h
on conflict (id) do update
set asset_path = excluded.asset_path,
    asset_status = excluded.asset_status,
    enabled_for_player_use = excluded.enabled_for_player_use,
    missing_assets = excluded.missing_assets,
    updated_at = now();

insert into public.hero_compatible_item_tags(hero_id, reward_type, item_tag)
values
  ('storm-archer', 'WEAPON', 'bow'),
  ('tide-mage', 'WEAPON', 'staff'),
  ('tide-mage', 'WEAPON', 'orb'),
  ('tide-mage', 'WEAPON', 'water-catalyst'),
  ('bombardier', 'WEAPON', 'launcher'),
  ('bombardier', 'WEAPON', 'bomb-kit'),
  ('bombardier', 'WEAPON', 'mechanic-tool'),
  ('coral-alchemist', 'WEAPON', 'flask'),
  ('coral-alchemist', 'WEAPON', 'alchemy-focus'),
  ('coral-alchemist', 'WEAPON', 'catalyst'),
  ('starcaller', 'WEAPON', 'celestial-staff'),
  ('starcaller', 'WEAPON', 'star-focus'),
  ('starcaller', 'WEAPON', 'charm-weapon'),
  ('storm-archer', 'ARMOR', 'storm-archer-armor'),
  ('tide-mage', 'ARMOR', 'tide-mage-armor'),
  ('bombardier', 'ARMOR', 'bombardier-armor'),
  ('coral-alchemist', 'ARMOR', 'coral-alchemist-armor'),
  ('starcaller', 'ARMOR', 'starcaller-armor')
on conflict do nothing;

insert into public.starlight_vault_pool_entries(
  id, banner_id, reward_id, reward_type, reward_name, rarity, weight,
  hero_compatibility, item_tags, asset_status, enabled, enabled_for_player_use, duplicate_conversion_value
)
values
  ('pool-default-noob', 'global-costume-collection-i', 'default-noob', 'FULL_COSTUME', 'Default Noob', 'COMMON', 7500, '{}'::text[], array['full-costume'], 'pending_manual_art', false, false, 10),
  ('pool-banana-guardian', 'global-costume-collection-i', 'banana-guardian', 'FULL_COSTUME', 'Banana Guardian', 'UNCOMMON', 1850, '{}'::text[], array['full-costume'], 'pending_manual_art', false, false, 25),
  ('pool-capybara-vacation', 'global-costume-collection-i', 'capybara-vacation', 'FULL_COSTUME', 'Capybara Vacation', 'RARE', 540, '{}'::text[], array['full-costume'], 'pending_manual_art', false, false, 60),
  ('pool-galactic-sigma', 'global-costume-collection-i', 'galactic-sigma', 'FULL_COSTUME', 'Galactic Sigma', 'EPIC', 100, '{}'::text[], array['full-costume'], 'pending_manual_art', false, false, 160),
  ('pool-midnight-drum-runner', 'global-costume-collection-i', 'midnight-drum-runner', 'FULL_COSTUME', 'Midnight Drum Runner', 'LEGENDARY', 10, '{}'::text[], array['full-costume'], 'pending_manual_art', false, false, 500)
on conflict (id) do update
set asset_status = excluded.asset_status,
    enabled = excluded.enabled,
    enabled_for_player_use = excluded.enabled_for_player_use,
    duplicate_conversion_value = excluded.duplicate_conversion_value;

insert into public.starlight_vault_pool_entries(
  id, banner_id, reward_id, reward_type, reward_name, rarity, weight,
  hero_compatibility, item_tags, asset_status, enabled, enabled_for_player_use, duplicate_conversion_value
)
values
  ('pool-storm-archer-vault-weapon', 'active-hero-weapon', 'storm-archer-starlight-weapon', 'WEAPON', 'Storm Archer Starlight Weapon', 'RARE', 540, array['storm-archer'], array['bow'], 'pending_manual_art', false, false, 50),
  ('pool-tide-mage-vault-weapon', 'active-hero-weapon', 'tide-mage-starlight-weapon', 'WEAPON', 'Tide Mage Starlight Weapon', 'RARE', 540, array['tide-mage'], array['staff', 'orb', 'water-catalyst'], 'pending_manual_art', false, false, 50),
  ('pool-bombardier-vault-weapon', 'active-hero-weapon', 'bombardier-starlight-weapon', 'WEAPON', 'Bombardier Starlight Weapon', 'RARE', 540, array['bombardier'], array['launcher', 'bomb-kit', 'mechanic-tool'], 'pending_manual_art', false, false, 50),
  ('pool-coral-alchemist-vault-weapon', 'active-hero-weapon', 'coral-alchemist-starlight-weapon', 'WEAPON', 'Coral Alchemist Starlight Weapon', 'RARE', 540, array['coral-alchemist'], array['flask', 'alchemy-focus', 'catalyst'], 'pending_manual_art', false, false, 50),
  ('pool-starcaller-vault-weapon', 'active-hero-weapon', 'starcaller-starlight-weapon', 'WEAPON', 'Starcaller Starlight Weapon', 'RARE', 540, array['starcaller'], array['celestial-staff', 'star-focus', 'charm-weapon'], 'pending_manual_art', false, false, 50),
  ('pool-storm-archer-vault-armor', 'active-hero-armor', 'storm-archer-starlight-armor', 'ARMOR', 'Storm Archer Starlight Armor', 'RARE', 540, array['storm-archer'], array['storm-archer-armor'], 'pending_manual_art', false, false, 50),
  ('pool-tide-mage-vault-armor', 'active-hero-armor', 'tide-mage-starlight-armor', 'ARMOR', 'Tide Mage Starlight Armor', 'RARE', 540, array['tide-mage'], array['tide-mage-armor'], 'pending_manual_art', false, false, 50),
  ('pool-bombardier-vault-armor', 'active-hero-armor', 'bombardier-starlight-armor', 'ARMOR', 'Bombardier Starlight Armor', 'RARE', 540, array['bombardier'], array['bombardier-armor'], 'pending_manual_art', false, false, 50),
  ('pool-coral-alchemist-vault-armor', 'active-hero-armor', 'coral-alchemist-starlight-armor', 'ARMOR', 'Coral Alchemist Starlight Armor', 'RARE', 540, array['coral-alchemist'], array['coral-alchemist-armor'], 'pending_manual_art', false, false, 50),
  ('pool-starcaller-vault-armor', 'active-hero-armor', 'starcaller-starlight-armor', 'ARMOR', 'Starcaller Starlight Armor', 'RARE', 540, array['starcaller'], array['starcaller-armor'], 'pending_manual_art', false, false, 50),
  ('pool-storm-archer-vault-relic', 'active-hero-relics-charms', 'storm-archer-starlight-relic', 'RELIC', 'Storm Archer Starlight Relic', 'EPIC', 100, array['storm-archer'], array['storm-archer-relic'], 'pending_manual_art', false, false, 140),
  ('pool-tide-mage-vault-relic', 'active-hero-relics-charms', 'tide-mage-starlight-relic', 'RELIC', 'Tide Mage Starlight Relic', 'EPIC', 100, array['tide-mage'], array['tide-mage-relic'], 'pending_manual_art', false, false, 140),
  ('pool-bombardier-vault-relic', 'active-hero-relics-charms', 'bombardier-starlight-relic', 'RELIC', 'Bombardier Starlight Relic', 'EPIC', 100, array['bombardier'], array['bombardier-relic'], 'pending_manual_art', false, false, 140),
  ('pool-coral-alchemist-vault-relic', 'active-hero-relics-charms', 'coral-alchemist-starlight-relic', 'RELIC', 'Coral Alchemist Starlight Relic', 'EPIC', 100, array['coral-alchemist'], array['coral-alchemist-relic'], 'pending_manual_art', false, false, 140),
  ('pool-starcaller-vault-relic', 'active-hero-relics-charms', 'starcaller-starlight-relic', 'RELIC', 'Starcaller Starlight Relic', 'EPIC', 100, array['starcaller'], array['starcaller-relic'], 'pending_manual_art', false, false, 140),
  ('pool-storm-archer-vault-charm', 'active-hero-relics-charms', 'storm-archer-starlight-charm', 'CHARM', 'Storm Archer Starlight Charm', 'EPIC', 100, array['storm-archer'], array['storm-archer-charm'], 'pending_manual_art', false, false, 140),
  ('pool-tide-mage-vault-charm', 'active-hero-relics-charms', 'tide-mage-starlight-charm', 'CHARM', 'Tide Mage Starlight Charm', 'EPIC', 100, array['tide-mage'], array['tide-mage-charm'], 'pending_manual_art', false, false, 140),
  ('pool-bombardier-vault-charm', 'active-hero-relics-charms', 'bombardier-starlight-charm', 'CHARM', 'Bombardier Starlight Charm', 'EPIC', 100, array['bombardier'], array['bombardier-charm'], 'pending_manual_art', false, false, 140),
  ('pool-coral-alchemist-vault-charm', 'active-hero-relics-charms', 'coral-alchemist-starlight-charm', 'CHARM', 'Coral Alchemist Starlight Charm', 'EPIC', 100, array['coral-alchemist'], array['coral-alchemist-charm'], 'pending_manual_art', false, false, 140),
  ('pool-starcaller-vault-charm', 'active-hero-relics-charms', 'starcaller-starlight-charm', 'CHARM', 'Starcaller Starlight Charm', 'EPIC', 100, array['starcaller'], array['starcaller-charm'], 'pending_manual_art', false, false, 140)
on conflict (id) do update
set asset_status = excluded.asset_status,
    enabled = excluded.enabled,
    enabled_for_player_use = excluded.enabled_for_player_use,
    duplicate_conversion_value = excluded.duplicate_conversion_value;

create or replace function private.starlight_rarity_rank(p_rarity text)
returns integer
language sql
immutable
as $$
  select case p_rarity
    when 'COMMON' then 1
    when 'UNCOMMON' then 2
    when 'RARE' then 3
    when 'EPIC' then 4
    when 'LEGENDARY' then 5
    else 0
  end
$$;

create or replace function private.secure_random_basis_points()
returns integer
language plpgsql
volatile
as $$
declare
  v_bytes bytea := gen_random_bytes(4);
  v_number bigint;
begin
  v_number :=
    (get_byte(v_bytes, 0)::bigint << 24) +
    (get_byte(v_bytes, 1)::bigint << 16) +
    (get_byte(v_bytes, 2)::bigint << 8) +
    get_byte(v_bytes, 3)::bigint;
  return (v_number % 10000)::integer + 1;
end;
$$;

create or replace function private.starlight_roll_base_rarity()
returns text
language plpgsql
volatile
as $$
declare
  v_roll integer := private.secure_random_basis_points();
begin
  if v_roll <= 7500 then return 'COMMON'; end if;
  if v_roll <= 9350 then return 'UNCOMMON'; end if;
  if v_roll <= 9890 then return 'RARE'; end if;
  if v_roll <= 9990 then return 'EPIC'; end if;
  return 'LEGENDARY';
end;
$$;

create or replace function private.grant_starlight_material(
  p_player_id text,
  p_material_definition_id text,
  p_quantity integer
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  update public.inventory_items
  set quantity = quantity + p_quantity,
      metadata = metadata || jsonb_build_object('source', 'starlight_vault'),
      updated_at = now()
  where player_id = p_player_id
    and definition_id = p_material_definition_id
    and item_type = 'MATERIAL';

  if not found then
    insert into public.inventory_items(
      player_id, definition_id, item_type, quantity, bound, acquired_from,
      relistable, is_tradeable, is_auctionable, is_giftable, is_sellable, is_convertible, metadata
    )
    values (
      p_player_id, p_material_definition_id, 'MATERIAL', p_quantity, true, 'STARLIGHT_VAULT',
      false, false, false, false, false, false,
      jsonb_build_object('source', 'starlight_vault')
    );
  end if;
end;
$$;

create or replace function private.starlight_vault_state_for_auth(p_auth_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id text := private.player_id_for_auth(p_auth_user_id);
begin
  if v_player_id is null then
    raise exception 'Player profile not found';
  end if;

  insert into public.starlight_vault_pity_counters(player_id, banner_id)
  select v_player_id, id from public.starlight_vault_banners
  on conflict do nothing;

  return jsonb_build_object(
    'banners', (
      select coalesce(jsonb_agg(to_jsonb(b) order by b.id), '[]'::jsonb)
      from public.starlight_vault_banners b
      where b.active
    ),
    'pityCounters', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.banner_id), '[]'::jsonb)
      from public.starlight_vault_pity_counters c
      where c.player_id = v_player_id
    ),
    'history', (
      select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc), '[]'::jsonb)
      from (
        select * from public.starlight_vault_pull_events
        where player_id = v_player_id
        order by created_at desc
        limit 25
      ) h
    ),
    'ownedCostumes', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.acquired_at desc), '[]'::jsonb)
      from public.player_full_costumes c
      where c.player_id = v_player_id
    ),
    'equippedCosmetics', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.hero_id), '[]'::jsonb)
      from public.player_equipped_cosmetics c
      where c.player_id = v_player_id
    )
  );
end;
$$;

create or replace function private.perform_starlight_vault_draw_for_auth(
  p_auth_user_id uuid,
  p_banner_id text,
  p_payment_balance_type text,
  p_draw_count integer,
  p_active_hero_id text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player public.player_profiles%rowtype;
  v_banner public.starlight_vault_banners%rowtype;
  v_existing private.starlight_vault_draw_requests%rowtype;
  v_cost integer;
  v_live_pool_count integer;
  v_pity public.starlight_vault_pity_counters%rowtype;
  v_results jsonb := '[]'::jsonb;
  v_draw_index integer;
  v_base_rarity text;
  v_final_rarity text;
  v_triggered text;
  v_entry public.starlight_vault_pool_entries%rowtype;
  v_material_id text;
  v_duplicate_quantity integer;
  v_ledger jsonb;
  v_event public.starlight_vault_pull_events%rowtype;
  v_duplicate boolean;
begin
  select * into v_player
  from public.player_profiles
  where auth_user_id = p_auth_user_id
  for update;

  if not found then
    raise exception 'Player profile not found';
  end if;

  select * into v_existing
  from private.starlight_vault_draw_requests
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.player_id <> v_player.player_id then
      raise exception 'Idempotency key belongs to another Starlight Vault request';
    end if;
    return v_existing.result;
  end if;

  if p_payment_balance_type not in ('EARNED_GOLD', 'LOCKED_GOLD') then
    raise exception 'Starlight Vault only accepts Earned Gold or Locked Gold';
  end if;

  if p_draw_count not in (1, 10) then
    raise exception 'Starlight Vault draw count must be 1 or 10';
  end if;

  v_cost := case when p_draw_count = 10 then 450 else 50 end;

  select * into v_banner
  from public.starlight_vault_banners
  where id = p_banner_id and active = true
  for update;

  if not found then
    raise exception 'Starlight Vault banner not found or inactive';
  end if;

  if v_banner.requires_active_hero and p_active_hero_id is distinct from v_player.selected_hero_id then
    raise exception 'Active Hero mismatch for Starlight Vault draw';
  end if;

  select count(*) into v_live_pool_count
  from public.starlight_vault_pool_entries e
  where e.banner_id = p_banner_id
    and e.enabled = true
    and e.enabled_for_player_use = true
    and e.asset_status = 'ready'
    and (
      e.hero_compatibility = '{}'::text[]
      or p_active_hero_id = any(e.hero_compatibility)
    );

  if v_live_pool_count = 0 then
    raise exception 'Starlight Vault banner has no live rewards with ready manual assets';
  end if;

  insert into public.starlight_vault_pity_counters(player_id, banner_id)
  values (v_player.player_id, p_banner_id)
  on conflict do nothing;

  select * into v_pity
  from public.starlight_vault_pity_counters
  where player_id = v_player.player_id and banner_id = p_banner_id
  for update;

  v_ledger := private.apply_balance_delta(
    v_player.player_id,
    p_payment_balance_type,
    'STARLIGHT_VAULT_DRAW',
    'DEBIT',
    v_cost,
    'Starlight Vault Star Draw',
    p_idempotency_key || ':gold-debit',
    'starlight_vault_banner',
    p_banner_id,
    jsonb_build_object('drawCount', p_draw_count, 'bannerId', p_banner_id, 'activeHeroId', p_active_hero_id)
  );

  for v_draw_index in 1..p_draw_count loop
    v_base_rarity := private.starlight_roll_base_rarity();
    v_final_rarity := v_base_rarity;
    v_triggered := null;

    v_pity.rare_counter := v_pity.rare_counter + 1;
    v_pity.epic_counter := v_pity.epic_counter + 1;
    v_pity.legendary_counter := v_pity.legendary_counter + 1;

    if v_pity.legendary_counter >= 300 then
      v_final_rarity := 'LEGENDARY';
      v_triggered := 'legendary';
    elsif v_pity.epic_counter >= 75 and private.starlight_rarity_rank(v_final_rarity) < private.starlight_rarity_rank('EPIC') then
      v_final_rarity := 'EPIC';
      v_triggered := 'epic';
    elsif v_pity.rare_counter >= 10 and private.starlight_rarity_rank(v_final_rarity) < private.starlight_rarity_rank('RARE') then
      v_final_rarity := 'RARE';
      v_triggered := 'rare';
    end if;

    select * into v_entry
    from public.starlight_vault_pool_entries e
    where e.banner_id = p_banner_id
      and e.enabled = true
      and e.enabled_for_player_use = true
      and e.asset_status = 'ready'
      and e.rarity = v_final_rarity
      and (
        e.hero_compatibility = '{}'::text[]
        or p_active_hero_id = any(e.hero_compatibility)
      )
    order by private.secure_random_basis_points()
    limit 1;

    if not found then
      raise exception 'No compatible ready reward exists for Starlight Vault rarity %', v_final_rarity;
    end if;

    v_duplicate := false;
    v_material_id := null;
    v_duplicate_quantity := 0;

    if v_entry.reward_type = 'FULL_COSTUME' then
      select exists (
        select 1 from public.player_full_costumes
        where player_id = v_player.player_id and costume_id = v_entry.reward_id
      ) into v_duplicate;

      if v_duplicate then
        v_material_id := 'wardrobe-threads';
        v_duplicate_quantity := v_entry.duplicate_conversion_value;
        perform private.grant_starlight_material(v_player.player_id, v_material_id, v_duplicate_quantity);
      else
        insert into public.player_full_costumes(
          player_id, costume_id, rarity, source,
          is_bound, is_tradeable, is_auctionable, is_giftable, is_sellable, is_convertible
        )
        values (
          v_player.player_id, v_entry.reward_id, v_entry.rarity, 'starlight_vault',
          true, false, false, false, false, false
        );
      end if;
    else
      select exists (
        select 1 from public.inventory_items
        where player_id = v_player.player_id
          and definition_id = v_entry.reward_id
          and acquired_from = 'STARLIGHT_VAULT'
      ) into v_duplicate;

      if v_duplicate then
        v_material_id := 'starlight-shards';
        v_duplicate_quantity := v_entry.duplicate_conversion_value;
        perform private.grant_starlight_material(v_player.player_id, v_material_id, v_duplicate_quantity);
      else
        insert into public.inventory_items(
          player_id, definition_id, item_type, quantity, equipped_slot, bound, acquired_from,
          relistable, is_tradeable, is_auctionable, is_giftable, is_sellable, is_convertible, metadata
        )
        values (
          v_player.player_id, v_entry.reward_id, 'EQUIPMENT', 1, null, true, 'STARLIGHT_VAULT',
          false, false, false, false, false, false,
          jsonb_build_object('source', 'starlight_vault', 'rewardType', v_entry.reward_type, 'rarity', v_entry.rarity)
        );
      end if;
    end if;

    if private.starlight_rarity_rank(v_final_rarity) >= private.starlight_rarity_rank('RARE') then
      v_pity.rare_counter := 0;
    end if;
    if private.starlight_rarity_rank(v_final_rarity) >= private.starlight_rarity_rank('EPIC') then
      v_pity.epic_counter := 0;
    end if;
    if v_final_rarity = 'LEGENDARY' then
      v_pity.legendary_counter := 0;
    end if;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'index', v_draw_index,
      'baseRarity', v_base_rarity,
      'rarity', v_entry.rarity,
      'triggeredGuarantee', v_triggered,
      'rewardId', v_entry.reward_id,
      'rewardType', v_entry.reward_type,
      'name', v_entry.reward_name,
      'bound', true,
      'duplicate', v_duplicate,
      'conversionMaterialId', v_material_id,
      'conversionQuantity', v_duplicate_quantity
    ));
  end loop;

  update public.starlight_vault_pity_counters
  set rare_counter = v_pity.rare_counter,
      epic_counter = v_pity.epic_counter,
      legendary_counter = v_pity.legendary_counter,
      updated_at = now()
  where player_id = v_player.player_id and banner_id = p_banner_id;

  insert into public.starlight_vault_pull_events(
    player_id, banner_id, active_hero_id, payment_balance_type, draw_count, total_cost_gold,
    result, ledger_id, idempotency_key
  )
  values (
    v_player.player_id, p_banner_id, p_active_hero_id, p_payment_balance_type, p_draw_count, v_cost,
    jsonb_build_object('results', v_results, 'pityCounters', to_jsonb(v_pity)),
    nullif(v_ledger->>'id', '')::uuid,
    p_idempotency_key
  )
  returning * into v_event;

  insert into public.starlight_vault_duplicate_conversions(
    pull_event_id, player_id, banner_id, reward_id, reward_type, rarity, material_definition_id, quantity
  )
  select
    v_event.id,
    v_player.player_id,
    p_banner_id,
    result->>'rewardId',
    result->>'rewardType',
    result->>'rarity',
    result->>'conversionMaterialId',
    (result->>'conversionQuantity')::integer
  from jsonb_array_elements(v_results) result
  where coalesce((result->>'conversionQuantity')::integer, 0) > 0;

  insert into private.starlight_vault_draw_requests(idempotency_key, player_id, banner_id, payment_balance_type, draw_count, result)
  values (
    p_idempotency_key,
    v_player.player_id,
    p_banner_id,
    p_payment_balance_type,
    p_draw_count,
    jsonb_build_object('event', to_jsonb(v_event), 'results', v_results, 'ledger', v_ledger)
  );

  return jsonb_build_object('event', to_jsonb(v_event), 'results', v_results, 'ledger', v_ledger);
end;
$$;

create or replace function private.equip_full_costume_for_auth(
  p_auth_user_id uuid,
  p_hero_id text,
  p_costume_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id text := private.player_id_for_auth(p_auth_user_id);
begin
  if v_player_id is null then
    raise exception 'Player profile not found';
  end if;

  if not exists (
    select 1 from public.player_heroes
    where player_id = v_player_id and hero_id = p_hero_id
  ) then
    raise exception 'Hero is not owned';
  end if;

  if p_costume_id is not null and not exists (
    select 1 from public.player_full_costumes
    where player_id = v_player_id and costume_id = p_costume_id
  ) then
    raise exception 'Full Costume is not owned';
  end if;

  insert into public.player_equipped_cosmetics(player_id, hero_id, cosmetic_slot, costume_id, updated_at)
  values (v_player_id, p_hero_id, 'FULL_COSTUME', p_costume_id, now())
  on conflict (player_id, hero_id, cosmetic_slot)
  do update set costume_id = excluded.costume_id, updated_at = now();

  return jsonb_build_object(
    'playerId', v_player_id,
    'heroId', p_hero_id,
    'cosmeticSlot', 'FULL_COSTUME',
    'costumeId', p_costume_id
  );
end;
$$;

revoke all on function private.starlight_rarity_rank(text) from public, anon, authenticated;
revoke all on function private.secure_random_basis_points() from public, anon, authenticated;
revoke all on function private.starlight_roll_base_rarity() from public, anon, authenticated;
revoke all on function private.grant_starlight_material(text, text, integer) from public, anon, authenticated;
revoke all on function private.starlight_vault_state_for_auth(uuid) from public, anon, authenticated;
revoke all on function private.perform_starlight_vault_draw_for_auth(uuid, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function private.equip_full_costume_for_auth(uuid, text, text) from public, anon, authenticated;

grant execute on function private.starlight_vault_state_for_auth(uuid) to service_role;
grant execute on function private.perform_starlight_vault_draw_for_auth(uuid, text, text, integer, text, text) to service_role;
grant execute on function private.equip_full_costume_for_auth(uuid, text, text) to service_role;
