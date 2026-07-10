-- Grant pre-registration launch rewards to the DEV test account and equip rares.
-- Already executed on hosted project ssczdxumcmdctoklworl for:
--   wallet: HqGWkAFinq8pv8UUe8E2uEo2nqcBus9rNaBnRTwVo7JL
--   player: player-b4e36f9ff6d9 (display name DEV)
-- Safe to re-run (idempotent grants).

insert into public.pre_registrations (wallet_address)
values ('HqGWkAFinq8pv8UUe8E2uEo2nqcBus9rNaBnRTwVo7JL')
on conflict do nothing;

select private.grant_pre_registration_rewards(
  'player-b4e36f9ff6d9',
  'HqGWkAFinq8pv8UUe8E2uEo2nqcBus9rNaBnRTwVo7JL'
) as grant_result;

-- Equip rare launch weapon + armor (swap off starter core pieces first).
update public.inventory_items
set equipped_slot = null
where player_id = 'player-b4e36f9ff6d9'
  and equipped_slot in ('WEAPON', 'ARMOR');

update public.inventory_items
set equipped_slot = 'WEAPON'
where player_id = 'player-b4e36f9ff6d9'
  and definition_id = 'voidpiercer-crossbow';

update public.inventory_items
set equipped_slot = 'ARMOR'
where player_id = 'player-b4e36f9ff6d9'
  and definition_id = 'stormscale-vest';

insert into public.player_equipped_cosmetics (player_id, hero_id, cosmetic_slot, costume_id, updated_at)
values ('player-b4e36f9ff6d9', 'storm-archer', 'FULL_COSTUME', 'desert-nomad', now())
on conflict (player_id, hero_id, cosmetic_slot)
do update set costume_id = excluded.costume_id, updated_at = now();

select private.recalculate_player_power('player-b4e36f9ff6d9') as power;
