create or replace function private.equipment_definition_catalog()
returns table(definition_id text, name text, slot text, rarity text, stats jsonb)
language sql
immutable
as $$
  select *
  from (values
    ('basic-bow', 'Basic Bow', 'WEAPON', 'COMMON', '{"damage":18,"range":12,"critChance":2}'::jsonb),
    ('basic-armor', 'Basic Armor', 'ARMOR', 'COMMON', '{"power":50}'::jsonb),
    ('basic-charm', 'Basic Charm', 'CHARM', 'COMMON', '{"luck":3}'::jsonb),
    ('basic-relic', 'Basic Relic', 'RELIC', 'COMMON', '{"bossDamage":4}'::jsonb),
    ('ember-bow', 'Emberstring Bow', 'WEAPON', 'UNCOMMON', '{"damage":32,"critChance":5,"range":14}'::jsonb),
    ('tide-mantle', 'Tideglass Mantle', 'ARMOR', 'RARE', '{"power":120,"luck":6}'::jsonb),
    ('starlit-relic', 'Starlit Relay', 'RELIC', 'EPIC', '{"attackSpeed":9,"bossDamage":11}'::jsonb),
    ('worn-driftwood-bow', 'Worn Driftwood Bow', 'WEAPON', 'COMMON', '{"damage":20,"range":12}'::jsonb),
    ('reefguard-wand', 'Reefguard Wand', 'WEAPON', 'UNCOMMON', '{"damage":24,"attackSpeed":3,"range":13}'::jsonb),
    ('embershot-cannon', 'Embershot Cannon', 'WEAPON', 'RARE', '{"damage":38,"bossDamage":6}'::jsonb),
    ('voidpiercer-crossbow', 'Voidpiercer Crossbow', 'WEAPON', 'RARE', '{"damage":35,"critChance":12,"range":16}'::jsonb),
    ('flameveil-dagger', 'Flameveil Dagger', 'WEAPON', 'RARE', '{"damage":29,"attackSpeed":14,"critChance":7}'::jsonb),
    ('ironthorn-spear', 'Ironthorn Spear', 'WEAPON', 'RARE', '{"damage":41,"bossDamage":9,"range":14}'::jsonb),
    ('shadowwhisper-blade', 'Shadowwhisper Blade', 'WEAPON', 'RARE', '{"damage":33,"critChance":10,"luck":5}'::jsonb),
    ('stormcall-javelin', 'Stormcall Javelin', 'WEAPON', 'RARE', '{"damage":37,"attackSpeed":5,"range":17,"bossDamage":5}'::jsonb),
    ('tidecall-staff', 'Tidecall Staff', 'WEAPON', 'EPIC', '{"damage":42,"attackSpeed":7,"range":15}'::jsonb),
    ('stormpiercer-bow', 'Stormpiercer Bow', 'WEAPON', 'LEGENDARY', '{"damage":55,"critChance":9,"bossDamage":14,"range":18}'::jsonb),
    ('astral-tempest-relic-bow', 'Astral Tempest Relic Bow', 'WEAPON', 'MYTHIC', '{"damage":68,"critChance":12,"critDamage":20,"bossDamage":18,"range":20}'::jsonb),
    ('scout-leather-set', 'Scout Leather Set', 'ARMOR', 'COMMON', '{"power":55,"luck":2}'::jsonb),
    ('coralweave-vestments', 'Coralweave Vestments', 'ARMOR', 'UNCOMMON', '{"power":82,"luck":4}'::jsonb),
    ('forgebound-defender-mail', 'Forgebound Defender Mail', 'ARMOR', 'RARE', '{"power":130,"bossDamage":4}'::jsonb),
    ('obsidian-warden-plate', 'Obsidian Warden Plate', 'ARMOR', 'RARE', '{"power":125,"bossDamage":7}'::jsonb),
    ('emberweave-cloak', 'Emberweave Cloak', 'ARMOR', 'RARE', '{"power":110,"luck":8,"critChance":4}'::jsonb),
    ('tideforged-cuirass', 'Tideforged Cuirass', 'ARMOR', 'RARE', '{"power":135,"bossDamage":5,"luck":3}'::jsonb),
    ('shadowveil-mantle', 'Shadowveil Mantle', 'ARMOR', 'RARE', '{"power":118,"critChance":6,"luck":5}'::jsonb),
    ('stormscale-vest', 'Stormscale Vest', 'ARMOR', 'RARE', '{"power":122,"attackSpeed":4,"bossDamage":4}'::jsonb),
    ('moonlit-tide-robes', 'Moonlit Tide Robes', 'ARMOR', 'EPIC', '{"power":154,"attackSpeed":5,"luck":8}'::jsonb),
    ('stormwarden-battle-regalia', 'Stormwarden Battle Regalia', 'ARMOR', 'LEGENDARY', '{"power":205,"damage":12,"bossDamage":10}'::jsonb),
    ('celestial-aegis-armor', 'Celestial Aegis Armor', 'ARMOR', 'MYTHIC', '{"power":255,"damage":16,"luck":12,"bossDamage":12}'::jsonb),
    ('moss-thread-charm', 'Moss Thread Charm', 'CHARM', 'COMMON', '{"luck":4}'::jsonb),
    ('coral-seal', 'Coral Seal', 'RELIC', 'UNCOMMON', '{"power":36,"luck":5}'::jsonb),
    ('runeglass-totem', 'Runeglass Totem', 'RELIC', 'RARE', '{"bossDamage":9,"critChance":4}'::jsonb),
    ('starlit-focus-charm', 'Starlit Focus Charm', 'CHARM', 'EPIC', '{"attackSpeed":7,"luck":9}'::jsonb),
    ('solheart-relic', 'Solheart Relic', 'RELIC', 'LEGENDARY', '{"power":80,"bossDamage":16,"critDamage":12}'::jsonb),
    ('astral-tide-sigil', 'Astral Tide Sigil', 'CHARM', 'MYTHIC', '{"attackSpeed":10,"luck":16,"bossDamage":14}'::jsonb)
  ) as catalog(definition_id, name, slot, rarity, stats);
$$;

create or replace function private.equipment_definition_slot(p_definition_id text)
returns text
language sql
immutable
as $$
  select catalog.slot
  from private.equipment_definition_catalog() catalog
  where catalog.definition_id = p_definition_id;
$$;

create or replace function private.equipment_definition_stats(p_definition_id text)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (
      select catalog.stats
      from private.equipment_definition_catalog() catalog
      where catalog.definition_id = p_definition_id
    ),
    '{}'::jsonb
  );
$$;

create or replace function private.equipment_definition_name(p_definition_id text)
returns text
language sql
immutable
as $$
  select coalesce(
    (
      select catalog.name
      from private.equipment_definition_catalog() catalog
      where catalog.definition_id = p_definition_id
    ),
    p_definition_id
  );
$$;

create or replace function private.equipment_definition_rarity(p_definition_id text)
returns text
language sql
immutable
as $$
  select coalesce(
    (
      select catalog.rarity
      from private.equipment_definition_catalog() catalog
      where catalog.definition_id = p_definition_id
    ),
    'COMMON'
  );
$$;

revoke all on function private.equipment_definition_catalog() from public, anon, authenticated;
revoke all on function private.equipment_definition_slot(text) from public, anon, authenticated;
revoke all on function private.equipment_definition_stats(text) from public, anon, authenticated;
revoke all on function private.equipment_definition_name(text) from public, anon, authenticated;
revoke all on function private.equipment_definition_rarity(text) from public, anon, authenticated;
