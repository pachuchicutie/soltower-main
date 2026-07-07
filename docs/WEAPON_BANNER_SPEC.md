# Weapon Banner Spec

Updated: 2026-07-01

## Banner

`active-hero-weapon`

The Weapon banner is active-Hero scoped. The server validates that the requested active Hero matches the player's selected Hero before any draw resolves.

## Payment And Rates

- 1 pull: 50 Earned or Locked Gold
- 10 pulls: 450 Earned or Locked Gold
- Test Token, wallet funds, and `$TOWER` are not accepted

Rates and pity are defined in `docs/STARLIGHT_VAULT_SPEC.md` and shared across all Vault banners.

## Compatibility Tags

Allowed weapon tags:

| Hero | Weapon tags |
| --- | --- |
| Storm Archer | bow |
| Tide Mage | staff, orb, water-catalyst |
| Bombardier | launcher, bomb-kit, mechanic-tool |
| Coral Alchemist | flask, alchemy-focus, catalyst |
| Starcaller | celestial-staff, star-focus, charm-weapon |

The browser may display these tags, but the server checks compatibility through `public.hero_compatible_item_tags` and Starlight pool metadata.

## Live Assets

Weapon reward icons are local ready PNGs under `apps/web/public/assets/vault/rewards/weapons/`. Current database-supported Common through Legendary weapon rewards can enter live pools when their pool rows are `asset_status = ready`, `enabled = true`, and `enabled_for_player_use = true`.

Mythical weapon art is generated and visible in the shared UI registry, but live Mythical award selection requires a follow-up database rarity migration.
