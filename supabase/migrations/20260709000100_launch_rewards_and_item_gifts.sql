-- Launch mode: retire starter Gold, grant pre-registration rewards, and add audited item gifts.

create table if not exists public.inventory_item_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_player_id text not null references public.player_profiles(player_id) on delete cascade,
  recipient_player_id text not null references public.player_profiles(player_id) on delete cascade,
  item_kind text not null check (item_kind in ('INVENTORY_ITEM', 'FULL_COSTUME')),
  item_id text not null,
  definition_id text not null,
  transfer_type text not null default 'GIFT' check (transfer_type in ('GIFT', 'TRADE')),
  status text not null default 'COMPLETED' check (status in ('COMPLETED', 'CANCELLED', 'FAILED')),
  idempotency_key text unique not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.inventory_item_transfers enable row level security;

drop policy if exists "players can read own item transfers" on public.inventory_item_transfers;
create policy "players can read own item transfers"
  on public.inventory_item_transfers for select
  using (exists (
    select 1 from public.player_profiles p
    where p.auth_user_id = auth.uid()
      and (p.player_id = inventory_item_transfers.sender_player_id or p.player_id = inventory_item_transfers.recipient_player_id)
  ));

create index if not exists idx_inventory_item_transfers_players_time
  on public.inventory_item_transfers(sender_player_id, recipient_player_id, created_at desc);

create or replace function private.grant_pre_registration_rewards(
  p_player_id text,
  p_wallet_public_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_is_pre_registered boolean;
  v_ledger jsonb := null;
  v_selected_hero_id text;
  v_weapon_definition_id text;
  v_armor_definition_id text;
  v_costume_definition_id text;
  v_rare_costumes text[] := array[
    'capybara-vacation',
    'desert-nomad',
    'frostveil-guardian',
    'crimson-duelist',
    'mystic-lantern-keeper',
    'verdant-wildcaller'
  ];
  v_equipment_granted integer := 0;
  v_costume_granted integer := 0;
begin
  select exists (
    select 1
    from public.pre_registrations pr
    where pr.wallet_address = p_wallet_public_key
  ) into v_is_pre_registered;

  if not coalesce(v_is_pre_registered, false) then
    return jsonb_build_object('eligible', false, 'equipmentGranted', 0, 'costumeGranted', false, 'lockedGoldGranted', false);
  end if;

  select coalesce(selected_hero_id, 'storm-archer')
  into v_selected_hero_id
  from public.player_profiles
  where player_id = p_player_id;

  v_selected_hero_id := coalesce(v_selected_hero_id, 'storm-archer');

  v_weapon_definition_id := case v_selected_hero_id
    when 'storm-archer' then 'voidpiercer-crossbow'
    when 'tide-mage' then 'stormcall-javelin'
    when 'bombardier' then 'embershot-cannon'
    when 'coral-alchemist' then 'flameveil-dagger'
    when 'starcaller' then 'shadowwhisper-blade'
    else 'voidpiercer-crossbow'
  end;

  v_armor_definition_id := case v_selected_hero_id
    when 'storm-archer' then 'stormscale-vest'
    when 'tide-mage' then 'tideforged-cuirass'
    when 'bombardier' then 'forgebound-defender-mail'
    when 'coral-alchemist' then 'emberweave-cloak'
    when 'starcaller' then 'shadowveil-mantle'
    else 'stormscale-vest'
  end;

  v_costume_definition_id := v_rare_costumes[
    (mod(abs(hashtext(p_wallet_public_key)::bigint), array_length(v_rare_costumes, 1)::bigint) + 1)::integer
  ];

  v_ledger := private.apply_balance_delta(
    p_player_id,
    'LOCKED_GOLD',
    'PRE_REGISTRATION_REWARD',
    'CREDIT',
    100,
    'Pre-registration Locked Gold launch reward',
    'pre-registration-locked-gold:' || p_wallet_public_key,
    'pre_registration',
    p_wallet_public_key,
    jsonb_build_object('walletPublicKey', p_wallet_public_key, 'lockedGold', true)
  );

  insert into public.inventory_items(
    player_id, definition_id, item_type, quantity, equipped_slot, bound, acquired_from,
    relistable, is_tradeable, is_auctionable, is_giftable, is_sellable, is_convertible, metadata
  )
  select p_player_id, reward.definition_id, 'EQUIPMENT', 1, null, true, 'PRE_REGISTRATION',
         false, false, false, false, false, false,
         jsonb_build_object(
           'source', 'pre_registration',
           'walletPublicKey', p_wallet_public_key,
           'nonTradeableLaunchReward', true,
           'selectedHeroId', v_selected_hero_id,
           'launchRewardSlot', reward.launch_slot
         )
  from (values
    (v_weapon_definition_id, 'WEAPON'),
    (v_armor_definition_id, 'ARMOR')
  ) as reward(definition_id, launch_slot)
  where not exists (
    select 1
    from public.inventory_items item
    where item.player_id = p_player_id
      and item.acquired_from = 'PRE_REGISTRATION'
      and (
        item.metadata->>'launchRewardSlot' = reward.launch_slot
        or (
          reward.launch_slot = 'WEAPON'
          and item.definition_id in (
            'voidpiercer-crossbow',
            'stormcall-javelin',
            'embershot-cannon',
            'flameveil-dagger',
            'shadowwhisper-blade'
          )
        )
        or (
          reward.launch_slot = 'ARMOR'
          and item.definition_id in (
            'stormscale-vest',
            'tideforged-cuirass',
            'forgebound-defender-mail',
            'emberweave-cloak',
            'shadowveil-mantle'
          )
        )
      )
  );

  get diagnostics v_equipment_granted = row_count;

  insert into public.player_full_costumes(
    player_id, costume_id, rarity, source,
    is_bound, is_tradeable, is_auctionable, is_giftable, is_sellable, is_convertible
  )
  select
    p_player_id, v_costume_definition_id, 'RARE', 'pre_registration',
    true, false, false, false, false, false
  where not exists (
    select 1
    from public.player_full_costumes costume
    where costume.player_id = p_player_id
      and costume.source = 'pre_registration'
  )
  on conflict (player_id, costume_id) do nothing;

  get diagnostics v_costume_granted = row_count;

  return jsonb_build_object(
    'eligible', true,
    'selectedHeroId', v_selected_hero_id,
    'weaponDefinitionId', v_weapon_definition_id,
    'armorDefinitionId', v_armor_definition_id,
    'costumeDefinitionId', v_costume_definition_id,
    'equipmentGranted', v_equipment_granted,
    'costumeGranted', v_costume_granted > 0,
    'lockedGoldGranted', coalesce((v_ledger->>'source_type') = 'PRE_REGISTRATION_REWARD', true),
    'ledger', v_ledger
  );
end;
$$;

create or replace function private.create_profile_for_wallet(
  p_auth_user_id uuid,
  p_wallet_public_key text,
  p_display_name text,
  p_wallet_name text,
  p_selected_hero_id text default 'storm-archer'
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
  v_selected_hero_id text := coalesce(nullif(trim(p_selected_hero_id), ''), 'storm-archer');
begin
  if p_auth_user_id is null then
    raise exception 'Authenticated Supabase user is required';
  end if;

  if v_selected_hero_id not in (
    'storm-archer',
    'tide-mage',
    'bombardier',
    'coral-alchemist',
    'starcaller'
  ) then
    raise exception 'Unsupported starter hero: %', v_selected_hero_id;
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

    perform private.grant_pre_registration_rewards(v_player_id, p_wallet_public_key);

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
    v_selected_hero_id
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
  values (v_player_id, v_selected_hero_id)
  on conflict do nothing;

  insert into public.inventory_items(player_id, definition_id, item_type, equipped_slot, acquired_from)
  values
    (v_player_id, 'basic-bow', 'EQUIPMENT', 'WEAPON', 'STARTER'),
    (v_player_id, 'basic-armor', 'EQUIPMENT', 'ARMOR', 'STARTER'),
    (v_player_id, 'basic-charm', 'EQUIPMENT', 'CHARM', 'STARTER'),
    (v_player_id, 'basic-relic', 'EQUIPMENT', 'RELIC', 'STARTER');

  perform private.grant_pre_registration_rewards(v_player_id, p_wallet_public_key);

  v_is_new := true;
  return jsonb_build_object('playerId', v_player_id, 'isNewPlayer', v_is_new);
end;
$$;

create or replace function private.transfer_item_for_auth(
  p_auth_user_id uuid,
  p_item_kind text,
  p_item_id text,
  p_recipient_player_id text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_sender_id text := private.player_id_for_auth(p_auth_user_id);
  v_recipient public.player_profiles%rowtype;
  v_item public.inventory_items%rowtype;
  v_costume public.player_full_costumes%rowtype;
  v_transfer public.inventory_item_transfers%rowtype;
begin
  select * into v_transfer
  from public.inventory_item_transfers
  where idempotency_key = p_idempotency_key;

  if found then
    if v_sender_id is null or v_transfer.sender_player_id <> v_sender_id then
      raise exception 'Item transfer idempotency key conflict';
    end if;
    return to_jsonb(v_transfer);
  end if;

  if v_sender_id is null then
    raise exception 'Player profile required';
  end if;

  if p_recipient_player_id = v_sender_id then
    raise exception 'Cannot gift an item to yourself';
  end if;

  select * into v_recipient
  from public.player_profiles
  where player_id = p_recipient_player_id
    and status = 'ACTIVE';

  if not found then
    raise exception 'Recipient player not found';
  end if;

  if p_item_kind = 'INVENTORY_ITEM' then
    select * into v_item
    from public.inventory_items
    where id = p_item_id::uuid
      and player_id = v_sender_id
    for update;

    if not found then
      raise exception 'Inventory item not found';
    end if;

    if v_item.item_type <> 'EQUIPMENT' then
      raise exception 'Only equipment gifts are supported right now';
    end if;

    if v_item.equipped_slot is not null then
      raise exception 'Unequip this item before gifting it';
    end if;

    if v_item.quantity <> 1 then
      raise exception 'Stacked items cannot be gifted yet';
    end if;

    if v_item.bound or not (v_item.is_giftable or v_item.is_tradeable) or v_item.acquired_from = 'PRE_REGISTRATION' then
      raise exception 'This item is not giftable or tradeable';
    end if;

    update public.inventory_items
    set player_id = p_recipient_player_id,
        equipped_slot = null,
        updated_at = now(),
        metadata = metadata || jsonb_build_object('lastGiftedBy', v_sender_id, 'lastGiftedAt', now())
    where id = v_item.id;

    insert into public.inventory_item_transfers(
      sender_player_id, recipient_player_id, item_kind, item_id, definition_id,
      transfer_type, status, idempotency_key, metadata
    )
    values (
      v_sender_id, p_recipient_player_id, 'INVENTORY_ITEM', v_item.id::text, v_item.definition_id,
      'GIFT', 'COMPLETED', p_idempotency_key,
      jsonb_build_object('itemType', v_item.item_type, 'acquiredFrom', v_item.acquired_from)
    )
    returning * into v_transfer;

    return to_jsonb(v_transfer);
  end if;

  if p_item_kind = 'FULL_COSTUME' then
    select * into v_costume
    from public.player_full_costumes
    where player_id = v_sender_id
      and costume_id = p_item_id
    for update;

    if not found then
      raise exception 'Full Costume not found';
    end if;

    if exists (
      select 1 from public.player_equipped_cosmetics
      where player_id = v_sender_id
        and costume_id = p_item_id
    ) then
      raise exception 'Unequip this costume before gifting it';
    end if;

    if v_costume.is_bound or not (v_costume.is_giftable or v_costume.is_tradeable) or v_costume.source = 'pre_registration' then
      raise exception 'This costume is not giftable or tradeable';
    end if;

    if exists (
      select 1 from public.player_full_costumes
      where player_id = p_recipient_player_id
        and costume_id = p_item_id
    ) then
      raise exception 'Recipient already owns this costume';
    end if;

    delete from public.player_full_costumes
    where player_id = v_sender_id
      and costume_id = p_item_id;

    insert into public.player_full_costumes(
      player_id, costume_id, rarity, source,
      is_bound, is_tradeable, is_auctionable, is_giftable, is_sellable, is_convertible
    )
    values (
      p_recipient_player_id, v_costume.costume_id, v_costume.rarity, v_costume.source,
      v_costume.is_bound, v_costume.is_tradeable, v_costume.is_auctionable,
      v_costume.is_giftable, v_costume.is_sellable, v_costume.is_convertible
    );

    insert into public.inventory_item_transfers(
      sender_player_id, recipient_player_id, item_kind, item_id, definition_id,
      transfer_type, status, idempotency_key, metadata
    )
    values (
      v_sender_id, p_recipient_player_id, 'FULL_COSTUME', v_costume.costume_id, v_costume.costume_id,
      'GIFT', 'COMPLETED', p_idempotency_key,
      jsonb_build_object('rarity', v_costume.rarity, 'source', v_costume.source)
    )
    returning * into v_transfer;

    return to_jsonb(v_transfer);
  end if;

  raise exception 'Unsupported item kind';
end;
$$;

do $$
declare
  v_wallet record;
begin
  for v_wallet in
    select w.player_id, w.public_key
    from public.wallet_public_keys w
    inner join public.pre_registrations pr
      on pr.wallet_address = w.public_key
  loop
    perform private.grant_pre_registration_rewards(v_wallet.player_id, v_wallet.public_key);
  end loop;
end;
$$;

revoke all on function private.grant_pre_registration_rewards(text, text) from public, anon, authenticated;
revoke all on function private.create_profile_for_wallet(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function private.transfer_item_for_auth(uuid, text, text, text, text) from public, anon, authenticated;

grant execute on function private.grant_pre_registration_rewards(text, text) to service_role;
grant execute on function private.create_profile_for_wallet(uuid, text, text, text, text) to service_role;
grant execute on function private.transfer_item_for_auth(uuid, text, text, text, text) to service_role;
