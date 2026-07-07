# Armor Banner Spec

Updated: 2026-07-01

## Banner

`active-hero-armor`

The Armor banner is active-Hero scoped. The server validates the player's selected Hero before a draw.

## Compatibility Tags

Allowed armor tags:

| Hero | Armor tag |
| --- | --- |
| Storm Archer | storm-archer-armor |
| Tide Mage | tide-mage-armor |
| Bombardier | bombardier-armor |
| Coral Alchemist | coral-alchemist-armor |
| Starcaller | starcaller-armor |

Armor rewards are equipment items, not cosmetics. They may affect stats after being equipped through the existing server-authoritative equipment swap flow.

## Live Assets

Armor reward icons are local ready PNGs under `apps/web/public/assets/vault/rewards/armor/`. Current database-supported Common through Legendary armor rewards can enter live pools when their pool rows are `asset_status = ready`, `enabled = true`, and `enabled_for_player_use = true`.

Mythical armor art is generated and visible in the shared UI registry, but live Mythical award selection requires a follow-up database rarity migration.
