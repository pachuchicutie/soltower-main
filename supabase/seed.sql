insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000010',
    'authenticated',
    'authenticated',
    'owner@local.playsoltower.fun',
    extensions.crypt('local-owner-change-me', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"displayName":"Local Owner"}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000011',
    'authenticated',
    'authenticated',
    'moderator@local.playsoltower.fun',
    extensions.crypt('local-moderator-change-me', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"displayName":"Local Moderator"}'::jsonb,
    false
  )
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000010',
    '{"sub":"00000000-0000-0000-0000-000000000010","email":"owner@local.playsoltower.fun"}'::jsonb,
    'email',
    'owner@local.playsoltower.fun',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000011',
    '{"sub":"00000000-0000-0000-0000-000000000011","email":"moderator@local.playsoltower.fun"}'::jsonb,
    'email',
    'moderator@local.playsoltower.fun',
    now(),
    now(),
    now()
  )
on conflict (provider, provider_id) do nothing;

insert into public.admin_users (auth_user_id, email, role, display_name, active)
values
  ('00000000-0000-0000-0000-000000000010', 'owner@local.playsoltower.fun', 'OWNER', 'Local Owner', true),
  ('00000000-0000-0000-0000-000000000011', 'moderator@local.playsoltower.fun', 'MODERATOR', 'Local Moderator', true)
on conflict (email) do update
set auth_user_id = excluded.auth_user_id,
    role = excluded.role,
    display_name = excluded.display_name,
    active = excluded.active;

insert into public.player_profiles (
  player_id,
  display_name,
  avatar,
  account_level,
  xp,
  power,
  selected_hero_id,
  status
)
values (
  'player-marky',
  'Marky',
  'M',
  10,
  1250,
  1280,
  'storm-archer',
  'ACTIVE'
)
on conflict (player_id) do update
set display_name = excluded.display_name,
    account_level = excluded.account_level,
    xp = excluded.xp,
    power = excluded.power,
    selected_hero_id = excluded.selected_hero_id,
    status = excluded.status;

insert into public.wallet_public_keys (player_id, public_key, linked_at, last_authenticated_at)
values ('player-marky', 'DevMockMarky111111111111111111111111111111111', now(), now())
on conflict (public_key) do nothing;

insert into public.player_balances (player_id, balance_type, amount)
values
  ('player-marky', 'EARNED_GOLD', 300),
  ('player-marky', 'LOCKED_GOLD', 50),
  ('player-marky', 'TEST_TOKEN', 250)
on conflict (player_id, balance_type) do update set amount = excluded.amount, updated_at = now();

insert into public.economy_ledger (
  player_id,
  balance_type,
  source_type,
  direction,
  amount,
  before_balance,
  after_balance,
  reason,
  idempotency_key,
  reference_entity_type,
  reference_entity_id,
  metadata
)
values
  ('player-marky', 'EARNED_GOLD', 'RAID_REWARD', 'CREDIT', 300, 0, 300, 'Local seed Earned Gold', 'seed-marky-earned-gold', 'seed', 'player-marky', '{}'::jsonb),
  ('player-marky', 'LOCKED_GOLD', 'STARTER_LOCKED_GOLD', 'CREDIT', 50, 0, 50, 'Local seed starter Locked Gold', 'seed-marky-locked-gold', 'seed', 'player-marky', '{}'::jsonb),
  ('player-marky', 'TEST_TOKEN', 'ADMIN_DEV_GRANT', 'CREDIT', 250, 0, 250, 'Local seed Test Token', 'seed-marky-test-token', 'seed', 'player-marky', '{"devMode":true}'::jsonb)
on conflict (idempotency_key) do nothing;

insert into public.player_presence (player_id, presence_status, town_channel)
values ('player-marky', 'OFFLINE', 'solbloom-1')
on conflict (player_id) do update set presence_status = excluded.presence_status;

insert into public.player_map_unlocks (player_id, map_id)
values
  ('player-marky', 'tower-1-1'),
  ('player-marky', 'tower-1-2'),
  ('player-marky', 'tower-1-3')
on conflict do nothing;

insert into public.player_heroes (player_id, hero_id, level, xp)
values ('player-marky', 'storm-archer', 5, 400)
on conflict (player_id, hero_id) do update set level = excluded.level, xp = excluded.xp;

insert into public.inventory_items (player_id, definition_id, item_type, equipped_slot, acquired_from)
values
  ('player-marky', 'basic-bow', 'EQUIPMENT', 'WEAPON', 'STARTER'),
  ('player-marky', 'basic-armor', 'EQUIPMENT', 'ARMOR', 'STARTER'),
  ('player-marky', 'basic-charm', 'EQUIPMENT', 'CHARM', 'STARTER'),
  ('player-marky', 'basic-relic', 'EQUIPMENT', 'RELIC', 'STARTER')
on conflict do nothing;
