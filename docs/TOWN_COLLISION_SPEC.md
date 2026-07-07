# Town Collision Spec

Updated: 2026-07-01

## Collision Model

The authenticated town uses lightweight manual collision resolution in `TownScene`.

- Player movement resolves on X and Y separately so the Hero can slide around objects.
- Collision pushback uses the current movement direction, not post-overlap center comparisons, so walking into a counter or building stops the Hero instead of snapping them across the object.
- The player collision body is a compact feet/body rectangle, not the full 64x64 sprite.
- World object bodies are configured in `apps/web/src/game/config/townAssetManifest.ts`.
- Collision rectangles are intentionally smaller than visual sprites.
- Decorative grass, flowers, glows, and small ground details remain non-collidable.
- Collision boxes are hidden in normal player view and render only when `VITE_GAME_DEBUG=true`.

## Player Body

The active Hero uses this world-space collision body relative to the container anchor:

```ts
{ offsetX: -12, offsetY: -10, width: 24, height: 21 }
```

This keeps collision anchored around the Hero feet and lower body.

## Collidable World Objects

The following world object categories are now solid:

- Solheart Tower
- Raid Gate / portal
- Moonpetal Market
- Lanternroot Tavern
- Emberforge
- Starlight Vault
- Blacksmith exterior
- Market stall counters
- Quest Board
- Gold Market Board left
- Blackjack table
- Oak trees
- Pine trees
- Rock clusters
- Lamp posts
- Benches
- Barrel and crate clusters
- Fence rails
- Fountain
- Dock
- Boat
- Campfire
- NPC lower bodies

## Collision Body Rules

- Buildings collide around lower foundation and doorway walls, not their full roof or transparent canvas.
- Trees collide around trunks only; foliage can visually overlap the player through Y-depth sorting.
- Market stalls collide around the counter/table footprint.
- Lamps collide around the pole base.
- Fences collide as narrow rails.
- Boards/signs collide around posts and lower frame.
- Rocks, barrels, benches, campfires, docks, and boats use compact footprint bodies.

## Depth Rules

- Environment images use bottom-anchor placement and Y-based depth.
- The player depth is based on the Hero feet position.
- Objects with lower `y` render behind objects and players lower on screen.
- This lets the player appear behind upper building/tree portions and in front of lower foundations when positioned correctly.

## Validation

Static scene tests cover:

- Collision bodies exist for every physical asset category.
- The scene resolves player collision.
- Interactables have labels, anchors, and reachable ranges.
- Normal player view has no permanent collision-box, radius-circle, or triangle debug visuals.
- Debug visuals are gated behind `VITE_GAME_DEBUG=true`.
- Pixel-art rendering disables antialiasing.
