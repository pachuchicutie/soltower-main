create schema if not exists private;

revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to service_role;

alter table public.admin_users
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;

drop policy if exists "players can update own non-sensitive profile settings" on public.player_profiles;

alter table public.market_listings
  add column if not exists idempotency_key text unique,
  add column if not exists source_balance_type text not null default 'EARNED_GOLD';

alter table public.buy_orders
  add column if not exists idempotency_key text unique;

alter table public.buy_order_fills
  add column if not exists idempotency_key text unique;

create table if not exists private.wallet_login_nonces (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  public_key text not null,
  nonce text unique not null,
  message text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists private.blackjack_hands (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  balance_type text not null check (balance_type in ('EARNED_GOLD', 'LOCKED_GOLD')),
  bet integer not null check (bet > 0),
  total_wager integer not null check (total_wager > 0),
  status text not null default 'ACTIVE',
  player_cards jsonb not null,
  dealer_cards jsonb not null,
  shoe_seed_hash text not null,
  result_metadata jsonb not null default '{}'::jsonb,
  idempotency_key text unique not null,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table if not exists public.player_map_unlocks (
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  map_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key(player_id, map_id)
);

create table if not exists public.player_heroes (
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  hero_id text not null,
  level integer not null default 1,
  xp integer not null default 0,
  unlocked_at timestamptz not null default now(),
  primary key(player_id, hero_id)
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  definition_id text not null,
  item_type text not null check (item_type in ('EQUIPMENT', 'CONSUMABLE')),
  quantity integer not null default 1,
  equipped_slot text,
  bound boolean not null default true,
  acquired_from text not null default 'STARTER',
  relistable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_trades (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.market_listings(id) on delete set null,
  buyer_player_id text not null references public.player_profiles(player_id) on delete cascade,
  seller_player_id text not null references public.player_profiles(player_id) on delete cascade,
  gold_amount integer not null,
  gross_test_token integer not null,
  tax_test_token integer not null,
  seller_net integer not null,
  idempotency_key text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.raid_history (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid references public.raid_lobbies(id) on delete set null,
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  map_id text not null,
  duration_seconds integer not null,
  wave_count integer not null,
  boss_defeated boolean not null,
  success boolean not null,
  reward_earned_gold integer not null,
  reward_xp integer not null,
  idempotency_key text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.player_blocks (
  blocker_player_id text not null references public.player_profiles(player_id) on delete cascade,
  blocked_player_id text not null references public.player_profiles(player_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_player_id, blocked_player_id)
);

create table if not exists public.economy_config_versions (
  id uuid primary key default gen_random_uuid(),
  config_key text not null,
  version integer not null,
  config jsonb not null,
  published_by_admin_id uuid references public.admin_users(id) on delete set null,
  published_at timestamptz not null default now(),
  reason text not null,
  unique(config_key, version)
);

alter table public.player_map_unlocks enable row level security;
alter table public.player_heroes enable row level security;
alter table public.inventory_items enable row level security;
alter table public.market_trades enable row level security;
alter table public.raid_history enable row level security;
alter table public.player_blocks enable row level security;
alter table public.economy_config_versions enable row level security;

create policy "players can read own map unlocks"
  on public.player_map_unlocks for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = player_map_unlocks.player_id and p.auth_user_id = auth.uid()
  ));

create policy "players can read own heroes"
  on public.player_heroes for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = player_heroes.player_id and p.auth_user_id = auth.uid()
  ));

create policy "players can read own inventory"
  on public.inventory_items for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = inventory_items.player_id and p.auth_user_id = auth.uid()
  ));

create policy "players can read own market trades"
  on public.market_trades for select
  using (exists (
    select 1 from public.player_profiles p
    where p.auth_user_id = auth.uid()
      and (p.player_id = market_trades.buyer_player_id or p.player_id = market_trades.seller_player_id)
  ));

create policy "players can read own raid history"
  on public.raid_history for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = raid_history.player_id and p.auth_user_id = auth.uid()
  ));

create policy "players can read own block list"
  on public.player_blocks for select
  using (exists (
    select 1 from public.player_profiles p
    where p.auth_user_id = auth.uid()
      and (p.player_id = player_blocks.blocker_player_id or p.player_id = player_blocks.blocked_player_id)
  ));

create index if not exists idx_wallet_nonces_lookup on private.wallet_login_nonces(auth_user_id, public_key, nonce);
create index if not exists idx_blackjack_hands_player_time on private.blackjack_hands(player_id, created_at desc);
create index if not exists idx_inventory_player on public.inventory_items(player_id);
create index if not exists idx_market_trades_player_time on public.market_trades(buyer_player_id, seller_player_id, created_at desc);
create index if not exists idx_raid_history_player_time on public.raid_history(player_id, created_at desc);

create or replace function private.player_id_for_auth(p_auth_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select player_id
  from public.player_profiles
  where auth_user_id = p_auth_user_id
  limit 1
$$;

create or replace function private.apply_balance_delta(
  p_player_id text,
  p_balance_type text,
  p_source_type text,
  p_direction text,
  p_amount integer,
  p_reason text,
  p_idempotency_key text,
  p_reference_entity_type text default null,
  p_reference_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_created_by_admin_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_before integer;
  v_after integer;
  v_ledger public.economy_ledger%rowtype;
begin
  if p_balance_type not in ('EARNED_GOLD', 'LOCKED_GOLD', 'TEST_TOKEN') then
    raise exception 'Unsupported balance type %', p_balance_type;
  end if;

  if p_direction not in ('CREDIT', 'DEBIT') then
    raise exception 'Unsupported ledger direction %', p_direction;
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select * into v_ledger
  from public.economy_ledger
  where idempotency_key = p_idempotency_key;

  if found then
    return to_jsonb(v_ledger);
  end if;

  insert into public.player_balances(player_id, balance_type, amount)
  values (p_player_id, p_balance_type, 0)
  on conflict (player_id, balance_type) do nothing;

  select amount into v_before
  from public.player_balances
  where player_id = p_player_id and balance_type = p_balance_type
  for update;

  if p_direction = 'DEBIT' and v_before < p_amount then
    raise exception 'Insufficient % balance', p_balance_type;
  end if;

  v_after := case
    when p_direction = 'CREDIT' then v_before + p_amount
    else v_before - p_amount
  end;

  update public.player_balances
  set amount = v_after, updated_at = now()
  where player_id = p_player_id and balance_type = p_balance_type;

  insert into public.economy_ledger(
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
    metadata,
    created_by_admin_id
  )
  values (
    p_player_id,
    p_balance_type,
    p_source_type,
    p_direction,
    p_amount,
    v_before,
    v_after,
    p_reason,
    p_idempotency_key,
    p_reference_entity_type,
    p_reference_entity_id,
    coalesce(p_metadata, '{}'::jsonb),
    p_created_by_admin_id
  )
  returning * into v_ledger;

  return to_jsonb(v_ledger);
end;
$$;

create or replace function private.create_profile_for_wallet(
  p_auth_user_id uuid,
  p_wallet_public_key text,
  p_display_name text,
  p_wallet_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id text;
  v_display_name text;
  v_base_display_name text;
  v_suffix integer := 1;
  v_is_new boolean := false;
begin
  if p_auth_user_id is null then
    raise exception 'Authenticated Supabase user is required';
  end if;

  select player_id into v_player_id
  from public.wallet_public_keys
  where public_key = p_wallet_public_key;

  if v_player_id is not null then
    update public.player_profiles
    set auth_user_id = p_auth_user_id, updated_at = now()
    where player_id = v_player_id;

    insert into public.auth_user_mappings(auth_user_id, player_id)
    values (p_auth_user_id, v_player_id)
    on conflict (auth_user_id) do update set player_id = excluded.player_id;

    update public.wallet_public_keys
    set last_authenticated_at = now()
    where public_key = p_wallet_public_key;

    insert into public.wallet_auth_history(player_id, public_key, wallet_name)
    values (v_player_id, p_wallet_public_key, coalesce(p_wallet_name, 'Solana Wallet'));

    return jsonb_build_object('playerId', v_player_id, 'isNewPlayer', false);
  end if;

  v_player_id := 'player-' || replace(left(gen_random_uuid()::text, 13), '-', '');
  v_base_display_name := coalesce(nullif(trim(p_display_name), ''), 'Guardian');
  v_display_name := v_base_display_name;

  while exists(select 1 from public.player_profiles where lower(display_name) = lower(v_display_name)) loop
    v_suffix := v_suffix + 1;
    v_display_name := left(v_base_display_name, 18) || ' ' || v_suffix::text;
  end loop;

  insert into public.player_profiles(
    player_id,
    auth_user_id,
    display_name,
    avatar,
    account_level,
    xp,
    power,
    selected_hero_id
  )
  values (
    v_player_id,
    p_auth_user_id,
    v_display_name,
    upper(left(v_display_name, 1)),
    1,
    0,
    180,
    'storm-archer'
  );

  insert into public.auth_user_mappings(auth_user_id, player_id)
  values (p_auth_user_id, v_player_id)
  on conflict (auth_user_id) do update set player_id = excluded.player_id;

  insert into public.wallet_public_keys(player_id, public_key, last_authenticated_at)
  values (v_player_id, p_wallet_public_key, now());

  insert into public.wallet_auth_history(player_id, public_key, wallet_name)
  values (v_player_id, p_wallet_public_key, coalesce(p_wallet_name, 'Solana Wallet'));

  insert into public.player_balances(player_id, balance_type, amount)
  values
    (v_player_id, 'EARNED_GOLD', 0),
    (v_player_id, 'LOCKED_GOLD', 0),
    (v_player_id, 'TEST_TOKEN', 0)
  on conflict (player_id, balance_type) do nothing;

  insert into public.player_presence(player_id, presence_status)
  values (v_player_id, 'IN_TOWN')
  on conflict (player_id) do update set presence_status = 'IN_TOWN', last_seen_at = now();

  insert into public.player_map_unlocks(player_id, map_id)
  values (v_player_id, 'tower-1-1')
  on conflict do nothing;

  insert into public.player_heroes(player_id, hero_id)
  values (v_player_id, 'storm-archer')
  on conflict do nothing;

  insert into public.inventory_items(player_id, definition_id, item_type, equipped_slot, acquired_from)
  values
    (v_player_id, 'basic-bow', 'EQUIPMENT', 'WEAPON', 'STARTER'),
    (v_player_id, 'basic-armor', 'EQUIPMENT', 'ARMOR', 'STARTER'),
    (v_player_id, 'basic-charm', 'EQUIPMENT', 'CHARM', 'STARTER'),
    (v_player_id, 'basic-relic', 'EQUIPMENT', 'RELIC', 'STARTER');

  perform private.apply_balance_delta(
    v_player_id,
    'LOCKED_GOLD',
    'STARTER_LOCKED_GOLD',
    'CREDIT',
    50,
    'Starter Locked Gold grant',
    'starter-locked-gold:' || v_player_id,
    'player_profile',
    v_player_id,
    jsonb_build_object('walletPublicKey', p_wallet_public_key)
  );

  v_is_new := true;
  return jsonb_build_object('playerId', v_player_id, 'isNewPlayer', v_is_new);
end;
$$;

create or replace function private.create_market_listing_for_auth(
  p_auth_user_id uuid,
  p_gold_amount integer,
  p_price_per_gold integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player public.player_profiles%rowtype;
  v_listing public.market_listings%rowtype;
  v_total integer;
begin
  select * into v_listing from public.market_listings where idempotency_key = p_idempotency_key;
  if found then
    return to_jsonb(v_listing);
  end if;

  select * into v_player from public.player_profiles where auth_user_id = p_auth_user_id;
  if not found then raise exception 'Player profile required'; end if;
  if v_player.market_frozen then raise exception 'Market access is frozen'; end if;
  if v_player.account_level < 10 then raise exception 'Earned Gold listings unlock at Level 10'; end if;
  if p_gold_amount < 100 then raise exception 'Minimum market listing is 100 Gold'; end if;

  v_total := p_gold_amount * p_price_per_gold;

  perform private.apply_balance_delta(
    v_player.player_id,
    'EARNED_GOLD',
    'MARKET_SALE',
    'DEBIT',
    p_gold_amount,
    'Escrow Earned Gold for market listing',
    p_idempotency_key || ':seller-earned-escrow',
    'market_listing',
    null,
    jsonb_build_object('pricePerGold', p_price_per_gold)
  );

  insert into public.market_listings(
    seller_player_id,
    gold_amount,
    price_per_gold,
    total_price,
    status,
    idempotency_key,
    source_balance_type
  )
  values (
    v_player.player_id,
    p_gold_amount,
    p_price_per_gold,
    v_total,
    'ACTIVE',
    p_idempotency_key,
    'EARNED_GOLD'
  )
  returning * into v_listing;

  return to_jsonb(v_listing);
end;
$$;

create or replace function private.cancel_market_listing_for_auth(
  p_auth_user_id uuid,
  p_listing_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id text;
  v_listing public.market_listings%rowtype;
begin
  v_player_id := private.player_id_for_auth(p_auth_user_id);
  if v_player_id is null then raise exception 'Player profile required'; end if;

  select * into v_listing from public.market_listings where id = p_listing_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if v_listing.seller_player_id <> v_player_id then raise exception 'Only the seller can cancel this listing'; end if;

  if v_listing.status = 'ACTIVE' then
    update public.market_listings
    set status = 'CANCELLED', updated_at = now()
    where id = p_listing_id
    returning * into v_listing;

    perform private.apply_balance_delta(
      v_player_id,
      'EARNED_GOLD',
      'REFUND',
      'CREDIT',
      v_listing.gold_amount,
      'Return Earned Gold from cancelled market listing',
      p_idempotency_key || ':seller-earned-return',
      'market_listing',
      p_listing_id::text
    );
  end if;

  return to_jsonb(v_listing);
end;
$$;

create or replace function private.buy_market_listing_for_auth(
  p_auth_user_id uuid,
  p_listing_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_buyer_id text;
  v_listing public.market_listings%rowtype;
  v_trade public.market_trades%rowtype;
  v_tax integer;
  v_seller_net integer;
begin
  select * into v_trade from public.market_trades where idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_trade); end if;

  v_buyer_id := private.player_id_for_auth(p_auth_user_id);
  if v_buyer_id is null then raise exception 'Player profile required'; end if;

  select * into v_listing from public.market_listings where id = p_listing_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if v_listing.status <> 'ACTIVE' then raise exception 'Listing is not active'; end if;
  if v_listing.seller_player_id = v_buyer_id then raise exception 'Cannot buy your own listing'; end if;

  v_tax := floor(v_listing.total_price * 0.10);
  v_seller_net := v_listing.total_price - v_tax;

  perform private.apply_balance_delta(
    v_buyer_id,
    'TEST_TOKEN',
    'MARKET_PURCHASE',
    'DEBIT',
    v_listing.total_price,
    'Pay Test Token for market Gold listing',
    p_idempotency_key || ':buyer-test-token',
    'market_listing',
    p_listing_id::text
  );

  perform private.apply_balance_delta(
    v_buyer_id,
    'LOCKED_GOLD',
    'MARKET_PURCHASE',
    'CREDIT',
    v_listing.gold_amount,
    'Market-purchased Gold becomes Locked Gold',
    p_idempotency_key || ':buyer-locked-gold',
    'market_listing',
    p_listing_id::text
  );

  perform private.apply_balance_delta(
    v_listing.seller_player_id,
    'TEST_TOKEN',
    'MARKET_SALE',
    'CREDIT',
    v_seller_net,
    'Seller receives Test Token after 10% tax',
    p_idempotency_key || ':seller-test-token',
    'market_listing',
    p_listing_id::text,
    jsonb_build_object('taxTestToken', v_tax)
  );

  update public.market_listings
  set status = 'SOLD', updated_at = now()
  where id = p_listing_id;

  insert into public.market_trades(
    listing_id,
    buyer_player_id,
    seller_player_id,
    gold_amount,
    gross_test_token,
    tax_test_token,
    seller_net,
    idempotency_key
  )
  values (
    p_listing_id,
    v_buyer_id,
    v_listing.seller_player_id,
    v_listing.gold_amount,
    v_listing.total_price,
    v_tax,
    v_seller_net,
    p_idempotency_key
  )
  returning * into v_trade;

  return to_jsonb(v_trade);
end;
$$;

create or replace function private.create_buy_order_for_auth(
  p_auth_user_id uuid,
  p_gold_amount integer,
  p_price_per_gold integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_buyer_id text;
  v_order public.buy_orders%rowtype;
  v_total integer;
begin
  select * into v_order from public.buy_orders where idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_order); end if;

  v_buyer_id := private.player_id_for_auth(p_auth_user_id);
  if v_buyer_id is null then raise exception 'Player profile required'; end if;
  if p_gold_amount < 100 then raise exception 'Minimum buy order is 100 Gold'; end if;

  v_total := p_gold_amount * p_price_per_gold;

  perform private.apply_balance_delta(
    v_buyer_id,
    'TEST_TOKEN',
    'BUY_ORDER_ESCROW',
    'DEBIT',
    v_total,
    'Escrow Test Token for buy order',
    p_idempotency_key || ':buyer-test-token-escrow',
    'buy_order',
    null
  );

  insert into public.buy_orders(
    buyer_player_id,
    gold_amount,
    open_gold_amount,
    price_per_gold,
    escrow_remaining,
    status,
    idempotency_key
  )
  values (
    v_buyer_id,
    p_gold_amount,
    p_gold_amount,
    p_price_per_gold,
    v_total,
    'OPEN',
    p_idempotency_key
  )
  returning * into v_order;

  return to_jsonb(v_order);
end;
$$;

create or replace function private.cancel_buy_order_for_auth(
  p_auth_user_id uuid,
  p_order_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_buyer_id text;
  v_order public.buy_orders%rowtype;
  v_remaining_escrow integer;
begin
  v_buyer_id := private.player_id_for_auth(p_auth_user_id);
  if v_buyer_id is null then raise exception 'Player profile required'; end if;

  select * into v_order from public.buy_orders where id = p_order_id for update;
  if not found then raise exception 'Buy order not found'; end if;
  if v_order.buyer_player_id <> v_buyer_id then raise exception 'Only the buyer can cancel this buy order'; end if;

  if v_order.status = 'OPEN' then
    v_remaining_escrow := v_order.escrow_remaining;

    update public.buy_orders
    set status = 'CANCELLED', escrow_remaining = 0, updated_at = now()
    where id = p_order_id
    returning * into v_order;

    if v_remaining_escrow > 0 then
      perform private.apply_balance_delta(
        v_buyer_id,
        'TEST_TOKEN',
        'BUY_ORDER_RELEASE',
        'CREDIT',
        v_remaining_escrow,
        'Release remaining Test Token escrow',
        p_idempotency_key || ':buyer-test-token-release',
        'buy_order',
        p_order_id::text
      );
    end if;
  end if;

  return to_jsonb(v_order);
end;
$$;

create or replace function private.fill_buy_order_for_auth(
  p_auth_user_id uuid,
  p_order_id uuid,
  p_gold_amount integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_seller_id text;
  v_order public.buy_orders%rowtype;
  v_fill public.buy_order_fills%rowtype;
  v_gross integer;
  v_tax integer;
  v_seller_net integer;
begin
  select * into v_fill from public.buy_order_fills where idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_fill); end if;

  v_seller_id := private.player_id_for_auth(p_auth_user_id);
  if v_seller_id is null then raise exception 'Player profile required'; end if;

  select * into v_order from public.buy_orders where id = p_order_id for update;
  if not found then raise exception 'Buy order not found'; end if;
  if v_order.status <> 'OPEN' then raise exception 'Buy order is not open'; end if;
  if v_order.buyer_player_id = v_seller_id then raise exception 'Cannot fill your own buy order'; end if;
  if p_gold_amount > v_order.open_gold_amount then raise exception 'Fill amount exceeds open Gold'; end if;

  v_gross := p_gold_amount * v_order.price_per_gold;
  if v_gross > v_order.escrow_remaining then raise exception 'Fill amount exceeds escrow'; end if;
  v_tax := floor(v_gross * 0.10);
  v_seller_net := v_gross - v_tax;

  perform private.apply_balance_delta(
    v_seller_id,
    'EARNED_GOLD',
    'MARKET_SALE',
    'DEBIT',
    p_gold_amount,
    'Sell Earned Gold into buy order',
    p_idempotency_key || ':seller-earned-gold',
    'buy_order',
    p_order_id::text
  );

  perform private.apply_balance_delta(
    v_order.buyer_player_id,
    'LOCKED_GOLD',
    'MARKET_PURCHASE',
    'CREDIT',
    p_gold_amount,
    'Buy-order Gold becomes Locked Gold',
    p_idempotency_key || ':buyer-locked-gold',
    'buy_order',
    p_order_id::text
  );

  perform private.apply_balance_delta(
    v_seller_id,
    'TEST_TOKEN',
    'MARKET_SALE',
    'CREDIT',
    v_seller_net,
    'Seller receives Test Token after 10% tax',
    p_idempotency_key || ':seller-test-token',
    'buy_order',
    p_order_id::text,
    jsonb_build_object('taxTestToken', v_tax)
  );

  insert into public.buy_order_fills(
    buy_order_id,
    seller_player_id,
    gold_amount,
    gross_test_token,
    tax_test_token,
    seller_net,
    idempotency_key
  )
  values (
    p_order_id,
    v_seller_id,
    p_gold_amount,
    v_gross,
    v_tax,
    v_seller_net,
    p_idempotency_key
  )
  returning * into v_fill;

  update public.buy_orders
  set open_gold_amount = open_gold_amount - p_gold_amount,
      escrow_remaining = escrow_remaining - v_gross,
      status = case when open_gold_amount - p_gold_amount = 0 then 'FILLED' else 'OPEN' end,
      updated_at = now()
  where id = p_order_id;

  return to_jsonb(v_fill);
end;
$$;

create or replace function private.admin_adjust_balance_for_auth(
  p_auth_user_id uuid,
  p_player_id text,
  p_balance_type text,
  p_amount integer,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_admin public.admin_users%rowtype;
  v_direction text;
  v_ledger jsonb;
begin
  select * into v_admin
  from public.admin_users
  where auth_user_id = p_auth_user_id and active = true;

  if not found then
    raise exception 'Admin account required';
  end if;

  if v_admin.role not in ('OWNER', 'ADMIN', 'ECONOMY_MANAGER') then
    raise exception 'Admin role cannot change economy balances';
  end if;

  v_direction := case when p_amount >= 0 then 'CREDIT' else 'DEBIT' end;

  v_ledger := private.apply_balance_delta(
    p_player_id,
    p_balance_type,
    'ADMIN_ADJUSTMENT',
    v_direction,
    abs(p_amount),
    p_reason,
    p_idempotency_key,
    'admin_adjustment',
    p_player_id,
    jsonb_build_object('adminRole', v_admin.role),
    v_admin.id
  );

  insert into public.admin_audit_logs(
    actor_admin_id,
    actor_role,
    action_type,
    target_entity_type,
    target_entity_id,
    target_player_id,
    before,
    after,
    reason,
    correlation_id,
    module
  )
  values (
    v_admin.id,
    v_admin.role,
    'ADMIN_ECONOMY_ADJUSTMENT',
    'player_balance',
    p_player_id,
    p_player_id,
    null,
    v_ledger,
    p_reason,
    p_idempotency_key,
    'economy'
  );

  return v_ledger;
end;
$$;

revoke all on function private.player_id_for_auth(uuid) from public, anon, authenticated;
revoke all on function private.apply_balance_delta(text, text, text, text, integer, text, text, text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function private.create_profile_for_wallet(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.create_market_listing_for_auth(uuid, integer, integer, text) from public, anon, authenticated;
revoke all on function private.cancel_market_listing_for_auth(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.buy_market_listing_for_auth(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.create_buy_order_for_auth(uuid, integer, integer, text) from public, anon, authenticated;
revoke all on function private.cancel_buy_order_for_auth(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.fill_buy_order_for_auth(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function private.admin_adjust_balance_for_auth(uuid, text, text, integer, text, text) from public, anon, authenticated;

grant execute on function private.player_id_for_auth(uuid) to service_role;
grant execute on function private.apply_balance_delta(text, text, text, text, integer, text, text, text, text, jsonb, uuid) to service_role;
grant execute on function private.create_profile_for_wallet(uuid, text, text, text) to service_role;
grant execute on function private.create_market_listing_for_auth(uuid, integer, integer, text) to service_role;
grant execute on function private.cancel_market_listing_for_auth(uuid, uuid, text) to service_role;
grant execute on function private.buy_market_listing_for_auth(uuid, uuid, text) to service_role;
grant execute on function private.create_buy_order_for_auth(uuid, integer, integer, text) to service_role;
grant execute on function private.cancel_buy_order_for_auth(uuid, uuid, text) to service_role;
grant execute on function private.fill_buy_order_for_auth(uuid, uuid, integer, text) to service_role;
grant execute on function private.admin_adjust_balance_for_auth(uuid, text, text, integer, text, text) to service_role;
