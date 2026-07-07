# Relic And Charm Banner Spec

Updated: 2026-07-01

## Banner

`active-hero-relics-charms`

This banner contains Relic and Charm rewards. Entries may be universal or active-Hero compatible. Current database-supported Common through Legendary rewards have local ready PNG icons and can enter live pools when their pool rows are ready/enabled.

## Rules

- Relics and Charms remain core equipment slot items.
- Pulling a Relic or Charm does not auto-equip it.
- Equipping still uses the server-authoritative equipment swap flow.
- Existing equipped Weapon, Armor, Relic, and Charm slots cannot be emptied.

## Duplicate Conversion

Duplicate Relic and Charm rewards convert to bound Starlight Shards during the server draw transaction.

## Live Assets

Relic and Charm reward icons are local ready PNGs under `apps/web/public/assets/vault/rewards/relics/`.

Mythical Relic/Charm art is generated and visible in the shared UI registry, but live Mythical award selection requires a follow-up database rarity migration.
