# Town Interaction Spec

Updated: 2026-07-01

## Interaction Model

The Phaser town is a proximity interaction world, not a click-to-open map.

- Desktop primary interaction: `E`.
- Mobile primary interaction: contextual Interact button shown only while close enough.
- Pointer clicks/taps on world objects never open modals directly in game mode.
- Pointer clicks/taps may select the current nearby target only when the active Hero is already in range.
- Pressing `E` with no nearby interaction does nothing.
- Menus and modals disable town controls and clear the nearby prompt.

## Interaction Range

Default interaction range is `58` world pixels.

Current configured ranges:

- Large landmarks and buildings: `58` world pixels.
- Oversized buildings with broad fronts or side approaches may use larger configured ranges up to `160` world pixels.
- Boards, tables, and small props: `54` world pixels.
- NPCs: `58` world pixels.

Only the nearest valid target inside its configured radius becomes active. If two ranges overlap, distance wins.

## Active Interactables

| Target | Prompt | Modal |
| --- | --- | --- |
| Solheart Tower entrance | `[E] Enter Raid Board` | `raid-captain` |
| Raid Gate / portal | `[E] Enter Raid Board` | `raid-captain` |
| Moonpetal Market building | `[E] Open Auction House` | `market-broker` |
| West market stall | `[E] Open Auction House` | `market-broker` |
| Gold Market Board left | `[E] Open Gold Exchange` | `market-broker` |
| Quest Board east | `[E] View Quests` | `quest-board` |
| Blackjack table | `[E] Play Blackjack` | `blackjack` |
| Lanternroot Tavern entrance | `[E] Enter Tavern` | `tavern` |
| Emberforge building | `[E] Visit Emberforge` | `blacksmith` |
| Blacksmith exterior | `[E] Visit Emberforge` | `blacksmith` |
| Mira the Broker | `[E] Open Auction House` | `market-broker` |
| Emberforge NPC | `[E] Visit Emberforge` | `blacksmith` |
| Quest Board NPC | `[E] View Quests` | `quest-board` |
| Lady Vesper | `[E] Play Blackjack` | `blackjack` |
| Lanternroot Tavern NPC | `[E] Enter Tavern` | `tavern` |
| Event Board NPC | `[E] View Event Board` | `event-board` |

## Configured But Gated

| Target | Prompt | Modal | Status |
| --- | --- | --- | --- |
| Starlight Vault | `[E] Enter Starlight Vault` | `open_starlight_vault` | Ready and visible using `/assets/soltower/environment/structures/starlight-vault.png`. |

The Starlight Vault object is collidable/interactable in configuration and renders in normal player mode while `assetStatus` is `ready` and `enabledForPlayerUse` is `true`.

## Prompt UX

- Only one prompt is visible at a time.
- Prompt follows the nearest target anchor, not the player.
- Prompt uses a small premium `E` keycap plus the action label.
- No radius circle, triangle marker, persistent ring, or generic target marker appears in normal player view.
- NPC labels are clean text-only tags; hover emphasis is gated by proximity in game mode.

## Debug Overlays

Interaction radii, collision boxes, anchor markers, and target triangles are developer-only overlays.

- Normal `DEV_MODE` does not show them.
- Production does not show them.
- They render only when `VITE_GAME_DEBUG=true`.
- The fountain is a collidable decorative object and is not interactable.

## Source Of Truth

- Scene implementation: `apps/web/src/game/TownScene.ts`
- Asset and interaction configuration: `apps/web/src/game/config/townAssetManifest.ts`
- React shortcut bridge: `apps/web/src/hooks/useTownShortcuts.ts`
- Mobile contextual button: `apps/web/src/App.tsx`
