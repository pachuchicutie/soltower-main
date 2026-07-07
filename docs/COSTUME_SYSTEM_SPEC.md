# Costume System Spec

Updated: 2026-06-30

## Full Costume Slot

Full Costume is a separate cosmetic slot. It is not Weapon, Armor, Relic, or Charm.

Rules:

- global account ownership
- per-Hero equipped selection
- one selected Full Costume or default appearance per Hero
- can be used by any owned Hero
- never consumed on equip
- appearance-only
- no stats
- no class changes
- no weapon category changes
- no movement changes
- no ability changes

## Launch Costume Definitions

The initial data-only costume set is:

- Default Noob
- Banana Guardian
- Capybara Vacation
- Galactic Sigma
- Midnight Drum Runner

All launch costumes are:

- bound
- non-tradeable
- non-auctionable
- non-giftable
- non-sellable
- non-convertible except duplicate conversion during Starlight Vault grant resolution

## Manual Asset Registry

Costume art root:

`/assets/costumes/`

Expected per-costume/per-Hero paths:

`/assets/costumes/{costumeId}/{heroId}/preview.png`

`/assets/costumes/{costumeId}/{heroId}/idle-{direction}.png`

`/assets/costumes/{costumeId}/{heroId}/walk-{direction}.png`

Direction order:

1. top-left
2. left
3. bottom-left
4. top
5. top-right
6. right
7. bottom-right
8. bottom

Hero directories:

- storm-archer
- tide-mage
- bombardier
- coral-alchemist
- starcaller

The current implementation does not use fake fallback costume art. Until costume assets are present, registered, and approved, previews remain hidden and player use remains disabled.

## Database

Ownership table:

`public.player_full_costumes`

Equipped selection table:

`public.player_equipped_cosmetics`

Manual validation table:

`public.manual_asset_registry`

Equipping a Full Costume uses `equip-full-costume`, which calls `private.equip_full_costume_for_auth`. The RPC validates that the Hero is owned and that the costume is owned when a non-null costume is selected.

## Inventory Integration

Inventory > Cosmetics now shows:

- Active Hero appearance summary
- Full Costume slot
- Use Default Appearance action
- owned Full Costume cards
- manual-preview-hidden state until art is ready

Full Costume does not change protected equipment slots or server power calculations.
