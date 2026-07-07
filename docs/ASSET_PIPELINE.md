# Asset Pipeline

Updated: 2026-07-01

## Town Environment Assets

Town environment PNGs live under:

`apps/web/public/assets/soltower/environment/`

The current generated asset batch is produced by:

`scripts/generate-town-environment-assets.mjs`

## Starlight Vault Assets

Starlight Vault uses local generated PNG assets committed under:

`apps/web/public/assets/vault/`

The current asset batch is produced by:

`scripts/generate-starlight-vault-assets.mjs`

Generated categories:

- `banners/`: five 960x320 banner PNGs.
- `rewards/`: 24 reward icon PNGs at 160x160.
- `rarity/`: Common, Uncommon, Rare, Epic, Legendary, and Mythical frame PNGs at 160x160.
- `icons/`: Earned Gold, Locked Gold, Pity, Rate Up, and Featured utility icons at 64x64.
- `source/README.md`: generation/source notes.

Configured town building path:

`apps/web/public/assets/soltower/environment/structures/starlight-vault.png`

Runtime URL:

`/assets/soltower/environment/structures/starlight-vault.png`

The building asset is tracked by `manual_asset_registry` as `town-starlight-vault-building` and is currently ready/enabled for normal player use.

Costume art root:

`apps/web/public/assets/costumes/`

Expected costume paths:

- `/{costumeId}/{heroId}/preview.png`
- `/{costumeId}/{heroId}/idle-{direction}.png`
- `/{costumeId}/{heroId}/walk-{direction}.png`

Directions:

- top-left
- left
- bottom-left
- top
- top-right
- right
- bottom-right
- bottom

Vault reward icons are ready local assets. Full Hero costume animation sprites are still separate future assets; costume reward icons can be shown before a full costume can visually replace a Hero sprite.

## Runtime Manifest

Do not render generated town assets at raw PNG dimensions by default.

The runtime source of truth is:

`apps/web/src/game/config/townAssetManifest.ts`

Each asset definition includes:

- source file path
- intended render width
- intended render height
- origin point
- default collision behavior
- default collision body
- depth behavior

Each placeable object can override:

- position
- `collidable`
- `interactable`
- `debugVisible`
- render dimensions
- origin
- collision body
- interaction anchor
- interaction range
- interaction label
- interaction action

## Current Display Dimensions

| Asset | Raw PNG | World render size |
| --- | ---: | ---: |
| `town-ground.png` | 1600x1000 | 1600x1000 |
| `solheart-tower.png` | 230x330 | 188x270 |
| `raid-portal.png` | 190x190 | 112x112 |
| `moonpetal-market.png` | 600x600 | 232x197 |
| `lanternroot-tavern.png` | 600x600 | 242x203 |
| `emberforge.png` | 232x196 | 270x228 |
| `quest-grove.png` | 232x196 | 270x227 |
| `blacksmith.png` | 600x600 | 336x300 max box, rendered aspect-safe |
| `starlight-vault.png` | 600x600 | 248x214 max box, rendered aspect-safe |
| `market-stall.png` | 600x600 | 144x120 max box, rendered aspect-safe |
| `quest-board.png` | 136x112 | 88x73 |
| `oak-tree.png` | 112x128 | 92x105 |
| `pine-tree.png` | 96x132 | 78x107 |
| `rock-cluster.png` | 600x600 | 58x48 max box, rendered aspect-safe |
| `lamp-post.png` | 600x600 | 42x76 max box, rendered aspect-safe |
| `lamp-glow.png` | 600x600 | 74x74 |
| `bench.png` | 600x600 | 84x44 max box, rendered aspect-safe |
| `barrel-crates.png` | 600x600 | 64x52 max box, rendered aspect-safe |
| `fence-rail.png` | 600x600 | 92x46 max box, rendered aspect-safe |
| `signpost.png` | 600x600 | 60x56 max box, rendered aspect-safe |
| `fountain.png` | 600x600 | 126x94 |
| `dock.png` | 270x150 | 172x96 |
| `boat.png` | 250x140 | 150x84 |
| `campfire.png` | 600x600 | 60x52 max box, rendered aspect-safe |

## Pixel Rendering

The Phaser game config sets:

- `pixelArt: true`
- `render.antialias: false`
- `render.roundPixels: true`

The town scene also sets loaded town and Hero textures to nearest-neighbor filtering.

## Debug Visibility

Town object placements explicitly declare:

- `collidable: true | false`
- `interactable: true | false`
- `debugVisible: false`

Normal player-facing views ignore interaction/collision debug rendering. Debug circles, collision boxes, anchor triangles, and target markers appear only when `VITE_GAME_DEBUG=true`.

## Rejected Assets

No current environment assets were rejected in this pass.

Future assets should be rejected or held back if they have:

- fake checkerboard transparency
- baked white or black backgrounds
- giant unused canvas padding that cannot be normalized with manifest sizing
- unusable cropping
- inconsistent pixel scale

## Adding Future Town Objects

1. Add the PNG under `apps/web/public/assets/soltower/environment/`.
2. Add or update its asset entry in `townAssetManifest`.
3. Add a `TownWorldObject` placement if it appears in the town scene.
4. Add a compact collision body if the object is physical.
5. Add an interaction anchor only if the player should interact with it.
6. Keep interaction range around 54-58 world pixels unless there is a strong gameplay reason.
7. Run `pnpm --filter @soltower/web test -- src/game/town-scene.test.ts --runInBand`.
