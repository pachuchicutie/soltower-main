# Equipment System Spec

Updated: 2026-06-30

## Core Slot Rule

Every active Hero must always have exactly one equipped item in each protected core slot:

- Weapon
- Armor
- Relic
- Charm

Core slots cannot be empty. Players cannot become unarmed, remove starter gear into an empty slot, or unequip a protected slot without equipping a replacement.

## Starter Equipment

Starter equipment is the permanent fallback set:

- Basic Bow
- Basic Armor
- Basic Relic
- Basic Charm

Starter items are bound, non-tradeable, and valid forever. When a starter item is replaced, it returns to Inventory as an unequipped owned item and can be equipped again later. It cannot be sold, gifted, or traded.

## Swap Flow

Equipment changes use a swap flow:

1. The equipped slot card shows item icon, item name, rarity, bound/tradeable state, stat modifiers, `Equipped`, and `Change`.
2. `Change` opens a replacement picker filtered to the exact slot.
3. Replacement cards show item icon, name, rarity, level, bound/tradeable state, stats, and positive/negative stat deltas against the current item.
4. Choosing a replacement opens a confirmation state:

```text
Equip Emberstring Bow?

Your Basic Bow will return to your Inventory.
```

5. Confirming the swap equips the new item, returns the old item to unequipped Inventory, refreshes Inventory and Loadout data, and shows:

```text
Emberstring Bow equipped. Basic Bow returned to Inventory.
```

No item is destroyed by swapping.

## Inventory Layout

The Equipment tab layout is:

1. Active Hero summary.
2. Equipped slots.
3. Optional replacement picker when a slot is being changed.
4. Owned Equipment.

Owned Equipment hides currently equipped items by default. `Show Equipped Items` can reveal them for review, but equipped items are not duplicated in the default list.

Default empty state:

```text
No replacement equipment yet.
Clear more stages, craft gear, or visit the Market Board.
```

## Hero / Loadout Layout

Hero / Loadout > Equipment shows only the four equipped slots by default. Each slot has `Change`; no `Unequip` action is rendered. A replacement detail/picker appears only after the player actively chooses to change a slot.

## Server Authority

Equipment changes are server-authoritative. The active path is:

- Browser calls `/api/inventory/swap`.
- Browser API maps to Supabase Edge Function `swap-equipment`.
- Edge Function validates the Zod payload and calls private RPC `private.swap_equipment_for_auth`.
- The RPC locks the player's equipment rows and atomically swaps one slot.

The private RPC validates:

- authenticated player profile exists,
- player owns the replacement item,
- replacement item is equipment,
- replacement item matches the requested slot,
- replacement item is not already equipped,
- current slot has exactly one equipped item,
- replacement is not the same item,
- after the swap every core slot has exactly one equipped item,
- idempotency keys cannot duplicate or lose equipment.

The legacy `unequip-item` Edge Function is retained as an entrypoint for compatibility, but it rejects core equipment removal with:

```text
Core equipment slots cannot be unequipped. Choose a replacement item instead.
```

## Current Limits

The current equipment definition lookup is mirrored in SQL for the active starter/shop definitions. When new equipment definitions are added, update the private SQL definition helpers in the next migration or move definitions into a database content table.
