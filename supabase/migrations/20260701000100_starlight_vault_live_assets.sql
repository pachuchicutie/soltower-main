-- Starlight Vault: enable the first local PNG reward pools without destructive resets.
-- Mythical remains a UI-preview tier until the database rarity constraints are widened in a separate migration.

insert into public.starlight_vault_banners(
  id, name, tab, requires_active_hero, rates, pity_rules, active
)
values
  ('featured-starlight-selection', 'Featured Starlight Selection', 'Featured', true,
   '{"COMMON":75.00,"UNCOMMON":18.50,"RARE":5.40,"EPIC":1.00,"LEGENDARY":0.10}'::jsonb,
   '{"rare":{"threshold":10,"label":"Rare or higher"},"epic":{"threshold":75,"label":"Epic or higher"},"legendary":{"threshold":300,"label":"Legendary"}}'::jsonb,
   true),
  ('active-hero-weapon', 'Active Hero Weapon Banner', 'Weapons', true,
   '{"COMMON":75.00,"UNCOMMON":18.50,"RARE":5.40,"EPIC":1.00,"LEGENDARY":0.10}'::jsonb,
   '{"rare":{"threshold":10,"label":"Rare or higher"},"epic":{"threshold":75,"label":"Epic or higher"},"legendary":{"threshold":300,"label":"Legendary"}}'::jsonb,
   true),
  ('active-hero-armor', 'Active Hero Armor Banner', 'Armor', true,
   '{"COMMON":75.00,"UNCOMMON":18.50,"RARE":5.40,"EPIC":1.00,"LEGENDARY":0.10}'::jsonb,
   '{"rare":{"threshold":10,"label":"Rare or higher"},"epic":{"threshold":75,"label":"Epic or higher"},"legendary":{"threshold":300,"label":"Legendary"}}'::jsonb,
   true),
  ('active-hero-relics-charms', 'Active Hero Relics & Charms Banner', 'Relics & Charms', true,
   '{"COMMON":75.00,"UNCOMMON":18.50,"RARE":5.40,"EPIC":1.00,"LEGENDARY":0.10}'::jsonb,
   '{"rare":{"threshold":10,"label":"Rare or higher"},"epic":{"threshold":75,"label":"Epic or higher"},"legendary":{"threshold":300,"label":"Legendary"}}'::jsonb,
   true),
  ('global-costume-collection-i', 'Global Costume Collection I', 'Costumes', false,
   '{"COMMON":75.00,"UNCOMMON":18.50,"RARE":5.40,"EPIC":1.00,"LEGENDARY":0.10}'::jsonb,
   '{"rare":{"threshold":10,"label":"Rare or higher"},"epic":{"threshold":75,"label":"Epic or higher"},"legendary":{"threshold":300,"label":"Legendary"}}'::jsonb,
   true)
on conflict (id) do update
set name = excluded.name,
    tab = excluded.tab,
    requires_active_hero = excluded.requires_active_hero,
    rates = excluded.rates,
    pity_rules = excluded.pity_rules,
    active = excluded.active,
    updated_at = now();

insert into public.manual_asset_registry(
  id, asset_kind, owner_id, reward_id, asset_path, asset_status, enabled_for_player_use, missing_assets, approved_at
)
values
  ('vault-banner-featured-starlight-selection', 'BANNER', 'starlight-vault', 'featured-starlight-selection', '/assets/vault/banners/featured-starlight-selection.png', 'ready', true, '{}'::text[], now()),
  ('vault-banner-active-hero-weapon', 'BANNER', 'starlight-vault', 'active-hero-weapon', '/assets/vault/banners/weapons-active-hero-banner.png', 'ready', true, '{}'::text[], now()),
  ('vault-banner-active-hero-armor', 'BANNER', 'starlight-vault', 'active-hero-armor', '/assets/vault/banners/armor-active-hero-banner.png', 'ready', true, '{}'::text[], now()),
  ('vault-banner-active-hero-relics-charms', 'BANNER', 'starlight-vault', 'active-hero-relics-charms', '/assets/vault/banners/relics-charms-active-hero-banner.png', 'ready', true, '{}'::text[], now()),
  ('vault-banner-global-costume-collection-i', 'BANNER', 'starlight-vault', 'global-costume-collection-i', '/assets/vault/banners/costumes-global-collection-1.png', 'ready', true, '{}'::text[], now()),
  ('town-starlight-vault-building', 'BUILDING', 'starlight-vault', 'starlight-vault', '/assets/soltower/environment/structures/starlight-vault.png', 'ready', true, '{}'::text[], now())
on conflict (id) do update
set asset_path = excluded.asset_path,
    asset_status = excluded.asset_status,
    enabled_for_player_use = excluded.enabled_for_player_use,
    missing_assets = excluded.missing_assets,
    approved_at = excluded.approved_at,
    updated_at = now();

insert into public.starlight_vault_pool_entries(
  id, banner_id, reward_id, reward_type, reward_name, rarity, weight,
  hero_compatibility, item_tags, asset_status, enabled, enabled_for_player_use, duplicate_conversion_value
)
values
  ('pool-featured-worn-driftwood-bow', 'featured-starlight-selection', 'worn-driftwood-bow', 'WEAPON', 'Worn Driftwood Bow', 'COMMON', 7500, '{}'::text[], array['bow'], 'ready', true, true, 8),
  ('pool-featured-reefguard-wand', 'featured-starlight-selection', 'reefguard-wand', 'WEAPON', 'Reefguard Wand', 'UNCOMMON', 1850, '{}'::text[], array['staff','orb','water-catalyst'], 'ready', true, true, 20),
  ('pool-featured-embershot-cannon', 'featured-starlight-selection', 'embershot-cannon', 'WEAPON', 'Embershot Cannon', 'RARE', 540, '{}'::text[], array['launcher','bomb-kit'], 'ready', true, true, 50),
  ('pool-featured-moonlit-tide-robes', 'featured-starlight-selection', 'moonlit-tide-robes', 'ARMOR', 'Moonlit Tide Robes', 'EPIC', 100, '{}'::text[], array['tide-mage-armor'], 'ready', true, true, 140),
  ('pool-featured-stormpiercer-bow', 'featured-starlight-selection', 'stormpiercer-bow', 'WEAPON', 'Stormpiercer Bow', 'LEGENDARY', 10, '{}'::text[], array['bow'], 'ready', true, true, 420),

  ('pool-weapon-worn-driftwood-bow', 'active-hero-weapon', 'worn-driftwood-bow', 'WEAPON', 'Worn Driftwood Bow', 'COMMON', 7500, '{}'::text[], array['bow'], 'ready', true, true, 8),
  ('pool-weapon-reefguard-wand', 'active-hero-weapon', 'reefguard-wand', 'WEAPON', 'Reefguard Wand', 'UNCOMMON', 1850, '{}'::text[], array['staff','orb','water-catalyst'], 'ready', true, true, 20),
  ('pool-weapon-embershot-cannon', 'active-hero-weapon', 'embershot-cannon', 'WEAPON', 'Embershot Cannon', 'RARE', 540, '{}'::text[], array['launcher','bomb-kit'], 'ready', true, true, 50),
  ('pool-weapon-tidecall-staff', 'active-hero-weapon', 'tidecall-staff', 'WEAPON', 'Tidecall Staff', 'EPIC', 100, '{}'::text[], array['staff','orb'], 'ready', true, true, 140),
  ('pool-weapon-stormpiercer-bow', 'active-hero-weapon', 'stormpiercer-bow', 'WEAPON', 'Stormpiercer Bow', 'LEGENDARY', 10, '{}'::text[], array['bow'], 'ready', true, true, 420),

  ('pool-armor-scout-leather-set', 'active-hero-armor', 'scout-leather-set', 'ARMOR', 'Scout Leather Set', 'COMMON', 7500, '{}'::text[], array['light-armor'], 'ready', true, true, 8),
  ('pool-armor-coralweave-vestments', 'active-hero-armor', 'coralweave-vestments', 'ARMOR', 'Coralweave Vestments', 'UNCOMMON', 1850, '{}'::text[], array['tide-mage-armor'], 'ready', true, true, 20),
  ('pool-armor-forgebound-defender-mail', 'active-hero-armor', 'forgebound-defender-mail', 'ARMOR', 'Forgebound Defender Mail', 'RARE', 540, '{}'::text[], array['bombardier-armor'], 'ready', true, true, 50),
  ('pool-armor-moonlit-tide-robes', 'active-hero-armor', 'moonlit-tide-robes', 'ARMOR', 'Moonlit Tide Robes', 'EPIC', 100, '{}'::text[], array['tide-mage-armor'], 'ready', true, true, 140),
  ('pool-armor-stormwarden-battle-regalia', 'active-hero-armor', 'stormwarden-battle-regalia', 'ARMOR', 'Stormwarden Battle Regalia', 'LEGENDARY', 10, '{}'::text[], array['storm-archer-armor'], 'ready', true, true, 420),

  ('pool-relics-moss-thread-charm', 'active-hero-relics-charms', 'moss-thread-charm', 'CHARM', 'Moss Thread Charm', 'COMMON', 7500, '{}'::text[], array['charm'], 'ready', true, true, 8),
  ('pool-relics-coral-seal', 'active-hero-relics-charms', 'coral-seal', 'RELIC', 'Coral Seal', 'UNCOMMON', 1850, '{}'::text[], array['relic'], 'ready', true, true, 20),
  ('pool-relics-runeglass-totem', 'active-hero-relics-charms', 'runeglass-totem', 'RELIC', 'Runeglass Totem', 'RARE', 540, '{}'::text[], array['relic'], 'ready', true, true, 50),
  ('pool-relics-starlit-focus-charm', 'active-hero-relics-charms', 'starlit-focus-charm', 'CHARM', 'Starlit Focus Charm', 'EPIC', 100, '{}'::text[], array['charm','star-focus'], 'ready', true, true, 140),
  ('pool-relics-solheart-relic', 'active-hero-relics-charms', 'solheart-relic', 'RELIC', 'Solheart Relic', 'LEGENDARY', 10, '{}'::text[], array['relic'], 'ready', true, true, 420),

  ('pool-costume-village-initiate', 'global-costume-collection-i', 'village-initiate', 'FULL_COSTUME', 'Village Initiate', 'COMMON', 7500, '{}'::text[], array['full-costume'], 'ready', true, true, 10),
  ('pool-costume-banana-guardian', 'global-costume-collection-i', 'banana-guardian', 'FULL_COSTUME', 'Banana Guardian', 'UNCOMMON', 1850, '{}'::text[], array['full-costume'], 'ready', true, true, 25),
  ('pool-costume-capybara-vacation', 'global-costume-collection-i', 'capybara-vacation', 'FULL_COSTUME', 'Capybara Vacation', 'RARE', 540, '{}'::text[], array['full-costume'], 'ready', true, true, 60),
  ('pool-costume-galactic-sigma', 'global-costume-collection-i', 'galactic-sigma', 'FULL_COSTUME', 'Galactic Sigma', 'EPIC', 100, '{}'::text[], array['full-costume'], 'ready', true, true, 160),
  ('pool-costume-midnight-drum-runner', 'global-costume-collection-i', 'midnight-drum-runner', 'FULL_COSTUME', 'Midnight Drum Runner', 'LEGENDARY', 10, '{}'::text[], array['full-costume'], 'ready', true, true, 500)
on conflict (banner_id, reward_id) do update
set reward_type = excluded.reward_type,
    reward_name = excluded.reward_name,
    rarity = excluded.rarity,
    weight = excluded.weight,
    hero_compatibility = excluded.hero_compatibility,
    item_tags = excluded.item_tags,
    asset_status = excluded.asset_status,
    enabled = excluded.enabled,
    enabled_for_player_use = excluded.enabled_for_player_use,
    duplicate_conversion_value = excluded.duplicate_conversion_value,
    enabled_at = now();
