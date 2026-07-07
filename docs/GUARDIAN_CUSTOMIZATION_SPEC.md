# Guardian Customization Spec

Updated: 2026-06-29

Guardian customization is the first client-visible Hero identity pass. It is currently a local visual layer system for the selected Hero; it does not grant Heroes, duplicate rewards, mutate economy state, or imply any on-chain settlement.

## Goals

- Show an actual Hero portrait/sprite instead of text-only cosmetic values.
- Let the selected Hero determine HUD, profile, inventory, lobby, chat/friends, and town identity.
- Give existing players a safe normalized default appearance for their current selected Hero.
- Keep the system modular so backend-persisted cosmetics can be added later without replacing the UI contract.

## Current Storage

- Client storage key: `soltower:hero-appearance:v1`.
- Runtime helper: `apps/web/src/lib/heroAppearance.ts`.
- Shared normalization: `packages/shared/src/heroAssetManifest.ts`.

The local store is intentionally cosmetic-only. It does not affect balances, owned Heroes, inventory, quests, market permissions, admin permissions, or wallet linking.

## Visible Options

The Cosmetics tab in Inventory currently exposes:

- Hair: Storm swept, Soft bob, Crest.
- Hair Color: Sunlit Gold, Pearl White, Ember Brown, Seafoam, Star Blonde.
- Skin Tone: Warm, Honey, Bronze, Sunlit.
- Outfit Variant: Village defender, Traveler, Ceremonial.
- Accent Color: Lightning Blue, Tide Teal, Ember Copper, Coral Rose, Starlit Violet, Tower Gold.
- Cloak / Back: Starter cloak, Long cloak, Wing cape.
- Weapon Accent: Hero default, Magical blue, Rune violet, Warm gold.

Changing any visible option updates the portrait preview immediately. Hair style, outfit variant, and back accessory also update preview data attributes used by tests. Tint options update the visible tint-safe layers.

## Screens Using Hero Visuals

- Top-left HUD profile avatar.
- Town player sprite.
- Inventory active Hero card.
- Inventory Cosmetics preview.
- Hero / Loadout overview header.
- Profile hero summary.
- Settings account card.
- Lobby member avatar strip.
- Friends list avatars.
- Chat avatar fallback.
- Future raid HUD foundation through existing Hero preview and lobby avatar usage.

## Town Sprite Behavior

`TownScene` preloads every Hero action sprite sheet and per-action layer sheet from the manifest. The active player container renders:

- A neutral ellipse shadow.
- Base Hero town sprite.
- Skin, outfit, cloak, hair, accent, and weapon layers.
- Nameplate text.

The selected Hero and normalized appearance are refreshed when React sends updated town options. If a specific texture is missing, the neutral fallback silhouette/action-sheet path is used.

All current and future Hero town sheets use the production sprite standard:

- `idle.png`, `walk.png`, `run.png`, and `attack.png`.
- 64x64 pixels per frame.
- 256x256 pixels per sheet.
- Four direction rows: down, left, right, up.
- Four animation columns.
- Phaser origin recommendation: `{ x: 0.5, y: 0.88 }`.

## UI Layout Rules

- Cosmetics metadata and controls use wrapping grid/flex layouts.
- Labels and values must never share cramped inline space on narrow widths.
- Mobile layouts collapse to a single column.
- Buttons, tabs, and cards keep visible `:focus-visible` rings, but idle selected/active states must not look like permanent keyboard focus.
- The HUD profile uses a calm dark panel and Hero portrait; it should not have a persistent thick cyan active border.

## Backend Follow-Up

The next backend step is to add an explicit persisted cosmetic appearance table or profile column with Zod validation and server-authoritative ownership checks. That future mutation should be append/audit friendly and must not alter wallet, market, quest, balance, or inventory data outside the appearance record.
