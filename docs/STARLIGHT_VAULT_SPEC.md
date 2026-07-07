# Starlight Vault Spec

Updated: 2026-07-01

## Purpose

Starlight Vault is SolTower's separate Gold pull-shop system for server-authoritative Star Draws. It is not the Auction House, Gold Exchange, Blackjack, Raid Board, Inventory, or a normal shop.

## Player UI

Player-facing copy uses Star Draw, Pull, Banner, Draw Results, and Vault Odds.

Pull categories:

- Featured
- Weapons
- Armor
- Relics & Charms
- Costumes

Utility views:

- Collection
- Pull History
- Vault Odds

The player-facing UI must not show `pending_manual_art`, `FULL COSTUME` labels in non-costume tabs, or “manual assets must be supplied” placeholder copy.

## Assets

Local Vault assets live under `apps/web/public/assets/vault/` and are registered in `packages/shared/src/starlightVault.ts`.

- Five banner PNGs at 960x320.
- Twenty-four reward icon PNGs at 160x160.
- Six rarity frame PNGs at 160x160: Common, Uncommon, Rare, Epic, Legendary, Mythical.
- Five utility icon PNGs at 64x64.

The town building uses `/assets/soltower/environment/structures/starlight-vault.png` and is visible/interactable in normal player mode.

Full Hero costume animation sprites remain a separate future asset requirement. Costume reward icons can be shown in the Vault before full costume sprites are ready.

## Payment

Allowed payment sources:

- Locked Gold
- Earned Gold

Not allowed:

- Test Token
- `$TOWER`
- wallet funds
- real money
- silent mixed-balance fallback

Costs:

- 1 pull: 50 Gold
- 10 pulls: 450 Gold

The browser chooses the intended balance type, but the Edge Function/RPC validates and debits server-side with an idempotency key.

## Rates And Pity

Shared registry odds:

| Rarity | Rate |
| --- | ---: |
| Common | 74.99% |
| Uncommon | 18.50% |
| Rare | 5.40% |
| Epic | 1.00% |
| Legendary | 0.10% |
| Mythical | 0.01% |

Pity counters are per player and per banner:

- Rare or higher: within 10 draws.
- Epic or higher: within 75 draws.
- Legendary: within 300 draws.
- Mythical: within 600 draws in the shared UI/registry layer.

Current hosted database rarity constraints support Common through Legendary live reward selection. Mythical assets and UI registry rows are prepared, but Mythical live award selection requires a follow-up database rarity migration.

## Server Authority

Database migrations:

- `supabase/migrations/20260630000200_starlight_vault.sql`
- `supabase/migrations/20260701000100_starlight_vault_live_assets.sql`

Edge Functions:

- `starlight-vault-state`
- `starlight-vault-draw`
- `equip-full-costume`

Private RPCs:

- `private.starlight_vault_state_for_auth`
- `private.perform_starlight_vault_draw_for_auth`
- `private.equip_full_costume_for_auth`

The browser never decides RNG, pity result, Gold debit, reward grant, duplicate conversion, Hero compatibility, asset readiness, or final ownership state.

## Duplicate Conversion

Duplicate Full Costume rewards convert to bound Wardrobe Threads. Duplicate equipment rewards convert to bound Starlight Shards. These materials are bound and cannot be traded, auctioned, gifted, sold, or converted.
