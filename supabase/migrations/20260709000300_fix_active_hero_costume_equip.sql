insert into public.player_heroes(player_id, hero_id)
select
  profile.player_id,
  coalesce(nullif(profile.selected_hero_id, ''), 'storm-archer')
from public.player_profiles profile
where coalesce(nullif(profile.selected_hero_id, ''), 'storm-archer') in (
  'storm-archer',
  'tide-mage',
  'bombardier',
  'coral-alchemist',
  'starcaller'
)
on conflict do nothing;

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
  v_player public.player_profiles%rowtype;
  v_hero_id text := coalesce(nullif(trim(p_hero_id), ''), 'storm-archer');
begin
  select *
  into v_player
  from public.player_profiles
  where auth_user_id = p_auth_user_id;

  if not found then
    raise exception 'Player profile not found';
  end if;

  if v_hero_id not in (
    'storm-archer',
    'tide-mage',
    'bombardier',
    'coral-alchemist',
    'starcaller'
  ) then
    raise exception 'Unsupported Hero';
  end if;

  if not exists (
    select 1 from public.player_heroes
    where player_id = v_player.player_id and hero_id = v_hero_id
  ) then
    if v_hero_id = coalesce(nullif(v_player.selected_hero_id, ''), 'storm-archer') then
      insert into public.player_heroes(player_id, hero_id)
      values (v_player.player_id, v_hero_id)
      on conflict do nothing;
    else
      raise exception 'Hero is not owned';
    end if;
  end if;

  if p_costume_id is not null and not exists (
    select 1 from public.player_full_costumes
    where player_id = v_player.player_id and costume_id = p_costume_id
  ) then
    raise exception 'Full Costume is not owned';
  end if;

  insert into public.player_equipped_cosmetics(player_id, hero_id, cosmetic_slot, costume_id, updated_at)
  values (v_player.player_id, v_hero_id, 'FULL_COSTUME', p_costume_id, now())
  on conflict (player_id, hero_id, cosmetic_slot)
  do update set costume_id = excluded.costume_id, updated_at = now();

  return jsonb_build_object(
    'playerId', v_player.player_id,
    'heroId', v_hero_id,
    'cosmeticSlot', 'FULL_COSTUME',
    'costumeId', p_costume_id
  );
end;
$$;

revoke all on function private.equip_full_costume_for_auth(uuid, text, text) from public, anon, authenticated;
grant execute on function private.equip_full_costume_for_auth(uuid, text, text) to service_role;
