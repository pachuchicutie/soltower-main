drop function if exists private.create_profile_for_wallet(uuid, text, text, text);

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
    jsonb_build_object(
      'walletPublicKey', p_wallet_public_key,
      'starterHeroId', v_selected_hero_id
    )
  );

  v_is_new := true;
  return jsonb_build_object('playerId', v_player_id, 'isNewPlayer', v_is_new);
end;
$$;

revoke all on function private.create_profile_for_wallet(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function private.create_profile_for_wallet(uuid, text, text, text, text) to service_role;
