create table if not exists private.equipment_swap_requests (
  idempotency_key text primary key,
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  new_item_id uuid not null,
  old_item_id uuid not null,
  slot text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function private.equipment_definition_slot(p_definition_id text)
returns text
language sql
immutable
as $$
  select case p_definition_id
    when 'basic-bow' then 'WEAPON'
    when 'ember-bow' then 'WEAPON'
    when 'basic-armor' then 'ARMOR'
    when 'tide-mantle' then 'ARMOR'
    when 'basic-relic' then 'RELIC'
    when 'starlit-relic' then 'RELIC'
    when 'basic-charm' then 'CHARM'
    else null
  end;
$$;

create or replace function private.equipment_definition_stats(p_definition_id text)
returns jsonb
language sql
immutable
as $$
  select case p_definition_id
    when 'basic-bow' then '{"damage":18,"range":12,"critChance":2}'::jsonb
    when 'ember-bow' then '{"damage":32,"critChance":5,"range":14}'::jsonb
    when 'basic-armor' then '{"power":50}'::jsonb
    when 'tide-mantle' then '{"power":120,"luck":6}'::jsonb
    when 'basic-relic' then '{"bossDamage":4}'::jsonb
    when 'starlit-relic' then '{"attackSpeed":9,"bossDamage":11}'::jsonb
    when 'basic-charm' then '{"luck":3}'::jsonb
    else '{}'::jsonb
  end;
$$;

create or replace function private.equipment_definition_name(p_definition_id text)
returns text
language sql
immutable
as $$
  select case p_definition_id
    when 'basic-bow' then 'Basic Bow'
    when 'ember-bow' then 'Emberstring Bow'
    when 'basic-armor' then 'Basic Armor'
    when 'tide-mantle' then 'Tideglass Mantle'
    when 'basic-relic' then 'Basic Relic'
    when 'starlit-relic' then 'Starlit Relay'
    when 'basic-charm' then 'Basic Charm'
    else p_definition_id
  end;
$$;

create or replace function private.equipment_definition_rarity(p_definition_id text)
returns text
language sql
immutable
as $$
  select case p_definition_id
    when 'ember-bow' then 'UNCOMMON'
    when 'tide-mantle' then 'RARE'
    when 'starlit-relic' then 'EPIC'
    else 'COMMON'
  end;
$$;

create or replace function private.recalculate_player_power(p_player_id text)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_power integer := 180;
  v_stat jsonb;
  v_value numeric;
begin
  for v_stat in
    select private.equipment_definition_stats(definition_id)
    from public.inventory_items
    where player_id = p_player_id
      and item_type = 'EQUIPMENT'
      and equipped_slot in ('WEAPON', 'ARMOR', 'RELIC', 'CHARM')
  loop
    for v_value in select value::numeric from jsonb_each_text(v_stat)
    loop
      v_power := v_power + floor(v_value)::integer;
    end loop;
  end loop;

  update public.player_profiles
  set power = v_power,
      updated_at = now()
  where player_id = p_player_id;

  return v_power;
end;
$$;

create or replace function private.swap_equipment_for_auth(
  p_auth_user_id uuid,
  p_new_item_id uuid,
  p_slot text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id text;
  v_existing private.equipment_swap_requests%rowtype;
  v_new public.inventory_items%rowtype;
  v_old public.inventory_items%rowtype;
  v_new_slot text;
  v_slot text := upper(p_slot);
  v_power integer;
  v_missing_slots text[];
  v_result jsonb;
begin
  if v_slot not in ('WEAPON', 'ARMOR', 'RELIC', 'CHARM') then
    raise exception 'Invalid equipment slot';
  end if;

  if length(coalesce(p_idempotency_key, '')) < 8 then
    raise exception 'Idempotency key required';
  end if;

  select player_id
  into v_player_id
  from public.player_profiles
  where auth_user_id = p_auth_user_id;

  if v_player_id is null then
    raise exception 'Player profile required';
  end if;

  select *
  into v_existing
  from private.equipment_swap_requests
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.player_id <> v_player_id or v_existing.new_item_id <> p_new_item_id or v_existing.slot <> v_slot then
      raise exception 'Idempotency key already used for a different equipment swap';
    end if;
    return v_existing.result;
  end if;

  perform 1
  from public.inventory_items
  where player_id = v_player_id
    and item_type = 'EQUIPMENT'
  for update;

  select *
  into v_new
  from public.inventory_items
  where id = p_new_item_id
    and player_id = v_player_id
    and item_type = 'EQUIPMENT';

  if not found then
    raise exception 'Replacement equipment not found';
  end if;

  v_new_slot := private.equipment_definition_slot(v_new.definition_id);
  if v_new_slot is null then
    raise exception 'Equipment definition missing';
  end if;
  if v_new_slot <> v_slot then
    raise exception 'Replacement equipment does not match % slot', v_slot;
  end if;
  if v_new.equipped_slot is not null then
    raise exception 'Replacement equipment is already equipped';
  end if;

  select *
  into v_old
  from public.inventory_items
  where player_id = v_player_id
    and item_type = 'EQUIPMENT'
    and equipped_slot = v_slot
  limit 1;

  if not found then
    raise exception 'Core equipment slot % has no equipped item', v_slot;
  end if;
  if v_old.id = v_new.id then
    raise exception 'Replacement equipment is already equipped in this slot';
  end if;

  update public.inventory_items
  set equipped_slot = null,
      updated_at = now()
  where id = v_old.id;

  update public.inventory_items
  set equipped_slot = v_slot,
      updated_at = now()
  where id = v_new.id;

  select array_agg(slot)
  into v_missing_slots
  from (
    select slot
    from unnest(array['WEAPON', 'ARMOR', 'RELIC', 'CHARM']) slot
    where (
      select count(*)
      from public.inventory_items
      where player_id = v_player_id
        and item_type = 'EQUIPMENT'
        and equipped_slot = slot
    ) <> 1
  ) missing;

  if v_missing_slots is not null then
    raise exception 'Core equipment slots must each contain exactly one item: %', array_to_string(v_missing_slots, ', ');
  end if;

  v_power := private.recalculate_player_power(v_player_id);

  v_result := jsonb_build_object(
    'slot', v_slot,
    'power', v_power,
    'equippedItem', jsonb_build_object(
      'id', v_new.id,
      'definitionId', v_new.definition_id,
      'name', private.equipment_definition_name(v_new.definition_id),
      'rarity', private.equipment_definition_rarity(v_new.definition_id),
      'slot', v_new_slot,
      'equippedSlot', v_slot,
      'level', 1,
      'bound', v_new.bound,
      'relistable', v_new.relistable,
      'stats', private.equipment_definition_stats(v_new.definition_id)
    ),
    'returnedItem', jsonb_build_object(
      'id', v_old.id,
      'definitionId', v_old.definition_id,
      'name', private.equipment_definition_name(v_old.definition_id),
      'rarity', private.equipment_definition_rarity(v_old.definition_id),
      'slot', private.equipment_definition_slot(v_old.definition_id),
      'equippedSlot', null,
      'level', 1,
      'bound', v_old.bound,
      'relistable', v_old.relistable,
      'stats', private.equipment_definition_stats(v_old.definition_id)
    )
  );

  insert into private.equipment_swap_requests(idempotency_key, player_id, new_item_id, old_item_id, slot, result)
  values (p_idempotency_key, v_player_id, p_new_item_id, v_old.id, v_slot, v_result);

  return v_result;
end;
$$;
