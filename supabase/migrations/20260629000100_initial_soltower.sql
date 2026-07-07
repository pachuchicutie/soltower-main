create extension if not exists pgcrypto;

create table if not exists public.auth_user_mappings (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  player_id text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.player_profiles (
  player_id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text unique not null,
  avatar text not null default 'M',
  account_level integer not null default 1,
  xp integer not null default 0,
  power integer not null default 0,
  selected_hero_id text not null default 'storm-archer',
  status text not null default 'ACTIVE',
  market_frozen boolean not null default false,
  blackjack_frozen boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_public_keys (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  public_key text unique not null,
  linked_at timestamptz not null default now(),
  last_authenticated_at timestamptz,
  risk_flag text,
  unlink_requires_owner boolean not null default true
);

create table if not exists public.wallet_auth_history (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  public_key text not null,
  wallet_name text not null,
  authenticated_at timestamptz not null default now(),
  ip_placeholder text
);

create table if not exists public.player_balances (
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  balance_type text not null check (balance_type in ('EARNED_GOLD', 'LOCKED_GOLD', 'TEST_TOKEN')),
  amount integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (player_id, balance_type)
);

create table if not exists public.economy_ledger (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  balance_type text not null,
  source_type text not null,
  amount integer not null check (amount > 0),
  direction text not null check (direction in ('CREDIT', 'DEBIT')),
  before_balance integer not null,
  after_balance integer not null,
  reason text not null,
  idempotency_key text unique not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by_admin_id uuid,
  reference_entity_type text,
  reference_entity_id text
);

create table if not exists public.player_presence (
  player_id text primary key references public.player_profiles(player_id) on delete cascade,
  presence_status text not null default 'OFFLINE',
  town_channel text not null default 'solbloom-1',
  last_seen_at timestamptz not null default now()
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  player_a_id text not null references public.player_profiles(player_id) on delete cascade,
  player_b_id text not null references public.player_profiles(player_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(player_a_id, player_b_id)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_player_id text not null references public.player_profiles(player_id) on delete cascade,
  to_player_id text not null references public.player_profiles(player_id) on delete cascade,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  from_player_id text references public.player_profiles(player_id) on delete set null,
  target_player_id text references public.player_profiles(player_id) on delete cascade,
  message text not null,
  moderation_state text not null default 'VISIBLE',
  created_at timestamptz not null default now()
);

create table if not exists public.raid_lobbies (
  id uuid primary key default gen_random_uuid(),
  host_player_id text not null references public.player_profiles(player_id) on delete cascade,
  lobby_type text not null,
  map_id text not null,
  recommended_power integer not null default 0,
  status text not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.raid_lobby_members (
  lobby_id uuid not null references public.raid_lobbies(id) on delete cascade,
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  hero_id text not null,
  account_level integer not null,
  power integer not null,
  ready boolean not null default false,
  host boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key(lobby_id, player_id)
);

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_player_id text not null references public.player_profiles(player_id) on delete cascade,
  gold_amount integer not null,
  price_per_gold integer not null,
  total_price integer not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buy_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_player_id text not null references public.player_profiles(player_id) on delete cascade,
  gold_amount integer not null,
  open_gold_amount integer not null,
  price_per_gold integer not null,
  escrow_remaining integer not null,
  status text not null default 'OPEN',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buy_order_fills (
  id uuid primary key default gen_random_uuid(),
  buy_order_id uuid not null references public.buy_orders(id) on delete cascade,
  seller_player_id text not null references public.player_profiles(player_id) on delete cascade,
  gold_amount integer not null,
  gross_test_token integer not null,
  tax_test_token integer not null,
  seller_net integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.blackjack_counters (
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  day date not null,
  earned_profit integer not null default 0,
  hands_played integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key(player_id, day)
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_admin_id uuid,
  actor_role text,
  action_type text not null,
  target_entity_type text not null,
  target_entity_id text not null,
  target_player_id text,
  before jsonb,
  after jsonb,
  reason text not null,
  ip_placeholder text,
  correlation_id text not null,
  module text not null,
  created_at timestamptz not null default now()
);

alter table public.auth_user_mappings enable row level security;
alter table public.player_profiles enable row level security;
alter table public.wallet_public_keys enable row level security;
alter table public.wallet_auth_history enable row level security;
alter table public.player_balances enable row level security;
alter table public.economy_ledger enable row level security;
alter table public.player_presence enable row level security;
alter table public.friendships enable row level security;
alter table public.friend_requests enable row level security;
alter table public.chat_messages enable row level security;
alter table public.raid_lobbies enable row level security;
alter table public.raid_lobby_members enable row level security;
alter table public.market_listings enable row level security;
alter table public.buy_orders enable row level security;
alter table public.buy_order_fills enable row level security;
alter table public.blackjack_counters enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "players can read own profile"
  on public.player_profiles for select
  using (auth.uid() = auth_user_id);

create policy "players can update own non-sensitive profile settings"
  on public.player_profiles for update
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create policy "players can read own wallet public keys"
  on public.wallet_public_keys for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = wallet_public_keys.player_id and p.auth_user_id = auth.uid()
  ));

create policy "players can read own wallet auth history"
  on public.wallet_auth_history for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = wallet_auth_history.player_id and p.auth_user_id = auth.uid()
  ));

create policy "players can read own balances"
  on public.player_balances for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = player_balances.player_id and p.auth_user_id = auth.uid()
  ));

create policy "players can read own ledger"
  on public.economy_ledger for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = economy_ledger.player_id and p.auth_user_id = auth.uid()
  ));

create policy "authenticated players can read visible presence"
  on public.player_presence for select
  using (auth.role() = 'authenticated');

create policy "players can read own friendships"
  on public.friendships for select
  using (exists (
    select 1 from public.player_profiles p
    where p.auth_user_id = auth.uid() and (p.player_id = friendships.player_a_id or p.player_id = friendships.player_b_id)
  ));

create policy "players can read own friend requests"
  on public.friend_requests for select
  using (exists (
    select 1 from public.player_profiles p
    where p.auth_user_id = auth.uid() and (p.player_id = friend_requests.from_player_id or p.player_id = friend_requests.to_player_id)
  ));

create policy "players can read approved chat messages"
  on public.chat_messages for select
  using (
    moderation_state = 'VISIBLE'
    and (
      channel in ('TOWN', 'SYSTEM')
      or exists (
        select 1 from public.player_profiles p
        where p.auth_user_id = auth.uid()
          and (p.player_id = chat_messages.from_player_id or p.player_id = chat_messages.target_player_id)
      )
    )
  );

create policy "authenticated players can read open lobbies"
  on public.raid_lobbies for select
  using (auth.role() = 'authenticated' and status = 'OPEN');

create policy "authenticated players can read lobby members"
  on public.raid_lobby_members for select
  using (auth.role() = 'authenticated');

create policy "authenticated players can read active market listings"
  on public.market_listings for select
  using (auth.role() = 'authenticated' and status = 'ACTIVE');

create policy "authenticated players can read open buy orders"
  on public.buy_orders for select
  using (auth.role() = 'authenticated' and status = 'OPEN');

create policy "players can read own buy-order fills"
  on public.buy_order_fills for select
  using (exists (
    select 1 from public.player_profiles p
    join public.buy_orders b on b.id = buy_order_fills.buy_order_id
    where p.auth_user_id = auth.uid()
      and (p.player_id = buy_order_fills.seller_player_id or p.player_id = b.buyer_player_id)
  ));

create policy "players can read own blackjack counters"
  on public.blackjack_counters for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = blackjack_counters.player_id and p.auth_user_id = auth.uid()
  ));

create index if not exists idx_player_profiles_auth_user on public.player_profiles(auth_user_id);
create index if not exists idx_wallet_public_keys_player on public.wallet_public_keys(player_id);
create index if not exists idx_ledger_player_time on public.economy_ledger(player_id, created_at desc);
create index if not exists idx_market_listings_status_created on public.market_listings(status, created_at desc);
create index if not exists idx_buy_orders_status_created on public.buy_orders(status, created_at desc);
create index if not exists idx_chat_channel_created on public.chat_messages(channel, created_at desc);
create index if not exists idx_audit_logs_target on public.admin_audit_logs(target_player_id, created_at desc);
