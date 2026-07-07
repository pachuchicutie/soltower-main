# Hero Art Bible

Updated: 2026-06-29

SolTower now has a first local Hero character asset pass. These assets are original generated pixel-art PNG files stored in the repository; no downloaded spritesheets, third-party asset packs, copied game art, or baked UI text are used.

## Asset Source

- Generator: `scripts/generate-hero-character-assets.mjs`
- Shared manifest: `packages/shared/src/heroAssetManifest.ts`
- Preview route: `http://localhost:5173/assets/soltower/heroes/source/hero-preview.html`
- Generation notes: `apps/web/public/assets/soltower/heroes/source/generated-hero-notes.md`
- Storm Archer source references:
  - `apps/web/public/assets/soltower/heroes/source/storm-archer-idle-source.png`
  - `apps/web/public/assets/soltower/heroes/source/storm-archer-walk-source.png`
  - `apps/web/public/assets/soltower/heroes/source/storm-archer-run-source.png`
  - `apps/web/public/assets/soltower/heroes/source/storm-archer-attack-source.png`
- Storm Archer 8-direction walk generator: `scripts/generate-storm-archer-8-direction-walk.mjs`
- Storm Archer 8-direction walk source: `apps/web/public/assets/soltower/heroes/storm-archer/profile.png`
- Storm Archer reference idle generator: `scripts/generate-storm-archer-idle-from-refs.mjs`
- Storm Archer reference idle sources:
  - Down row: `apps/web/public/assets/soltower/heroes/storm-archer/walk-bottom.png`
  - Left row: `apps/web/public/assets/soltower/heroes/storm-archer/walk-top-left.png`
  - Right row: `apps/web/public/assets/soltower/heroes/storm-archer/walk-right.png`
  - Up row: `apps/web/public/assets/soltower/heroes/storm-archer/walk-top.png`
- Storm Archer video row sources:
  - `apps/web/public/assets/soltower/heroes/storm-archer/walk-top-left.mp4`
  - `apps/web/public/assets/soltower/heroes/storm-archer/walk-left.mp4`
  - `apps/web/public/assets/soltower/heroes/storm-archer/walk-bottom-left.mp4`
  - `apps/web/public/assets/soltower/heroes/storm-archer/walk-top.mp4`
  - `apps/web/public/assets/soltower/heroes/storm-archer/walk-top-right.mp4`
  - `apps/web/public/assets/soltower/heroes/storm-archer/walk-right.mp4`
  - `apps/web/public/assets/soltower/heroes/storm-archer/walk-bottom-right.mp4`
  - `apps/web/public/assets/soltower/heroes/storm-archer/walk-bottom.mp4`

Run the generator when the first-pass Hero assets need to be regenerated:

```bash
node scripts/generate-hero-character-assets.mjs
```

## File Layout

- Storm Archer: `apps/web/public/assets/soltower/heroes/storm-archer/`
- Tide Mage: `apps/web/public/assets/soltower/heroes/tide-mage/`
- Bombardier: `apps/web/public/assets/soltower/heroes/bombardier/`
- Coral Alchemist: `apps/web/public/assets/soltower/heroes/coral-alchemist/`
- Starcaller: `apps/web/public/assets/soltower/heroes/starcaller/`
- Shared fallback assets: `apps/web/public/assets/soltower/heroes/shared/`
- Portrait aliases: `apps/web/public/assets/soltower/heroes/portraits/`
- Source and preview notes: `apps/web/public/assets/soltower/heroes/source/`

Each Hero folder contains:

- `icon.png`: 96x96 transparent profile and HUD icon.
- `portrait.png`: 192x192 transparent large portrait.
- `idle.png`: 256x256 transparent idle sprite sheet.
- `walk.png`: 256x256 transparent walk sprite sheet.
- `run.png`: 256x256 transparent run sprite sheet.
- `attack.png`: 256x256 transparent attack sprite sheet.
- `layers/portrait/*.png`: tint-safe portrait layers.
- `layers/world/{idle,walk,run,attack}/*.png`: tint-safe world sprite layers.

Shared fallback files:

- `apps/web/public/assets/soltower/heroes/shared/fallback-silhouette.png`
- `apps/web/public/assets/soltower/heroes/shared/fallback-idle.png`
- `apps/web/public/assets/soltower/heroes/shared/fallback-walk.png`
- `apps/web/public/assets/soltower/heroes/shared/fallback-run.png`
- `apps/web/public/assets/soltower/heroes/shared/fallback-attack.png`

Standalone Storm Archer 8-direction walking sheet:

- `apps/web/public/assets/soltower/heroes/storm-archer/walk-8dir.png`
- Sheet size: 256x512.
- Frame size: 64x64.
- Layout: 8 rows x 4 columns.
- Row order: top-left, left, bottom-left, top, top-right, right, bottom-right, bottom.
- Columns: four walking frames.
- Background: transparent PNG.
- Current video-backed rows: all eight directions are extracted from MP4 sources, keyed from black to transparent, and normalized into four 64x64 frames each.

## Sprite Sheet Contract

Town sheets are consistent across all five Heroes:

- Sheet size: 256x256.
- Frame size: 64x64.
- Action sheets: `idle.png`, `walk.png`, `run.png`, `attack.png`.
- Columns: `frame-1`, `frame-2`, `frame-3`, `frame-4`.
- Rows: `down`, `left`, `right`, `up`.
- Total frames: 16.
- Phaser origin/anchor: `{ x: 0.5, y: 0.88 }`.
- CSS and Phaser rendering should preserve crisp pixels with nearest-neighbor style rendering.

The current Phaser town scale is tuned for the existing player collision and camera framing. Future Hero sprites must keep this exact 64x64/action-sheet contract unless `heroAssetManifest`, `TownScene`, documentation, and asset tests are updated together.

Storm Archer `idle.png` is generated from the four reference PNGs listed above. It uses the standard 4-row world sheet layout: down, left, right, up. Each row currently repeats the same normalized idle reference across all four animation columns.

## Hero Silhouettes

- Storm Archer: bow-forward long-range guardian with lightning blue and warm gold accents.
- Tide Mage: staff caster with teal, aqua, pearl, and indigo robe/scarf reads.
- Bombardier: rune artillery specialist with copper, ember, bronze, charcoal, and a tool-pack silhouette.
- Coral Alchemist: flask and coral-inspired support/debuff Hero with aqua, green, coral, and purple details.
- Starcaller: celestial support mage with gold, indigo, violet, sky-blue, staff, charm, and star-cape reads.

## Customization Layers

The first pass supports tint-safe modular layers for both portrait and world sprites:

- Hair style: `storm-swept`, `soft-bob`, `crest`.
- Hair color: Sunlit Gold, Pearl White, Ember Brown, Seafoam, Star Blonde.
- Skin tone: Warm, Honey, Bronze, Sunlit.
- Outfit variant: `village-defender`, `traveler`, `ceremonial`.
- Accent color: Lightning Blue, Tide Teal, Ember Copper, Coral Rose, Starlit Violet, Tower Gold.
- Back accessory: `starter-cloak`, `long-cloak`, `wing-cape`.
- Weapon accent: Hero default, Magical blue, Rune violet, Warm gold.

The appearance preview layers are rendered through `HeroAppearancePreview`; the town world layers are rendered through `TownScene`. Existing player profiles receive normalized safe defaults by selected Hero without changing backend ownership, wallet, inventory, market, quest, or balance data.

## Usage Rules

- Import paths and layout metadata from `packages/shared/src/heroAssetManifest.ts`.
- Do not hardcode new Hero asset paths in UI components when a manifest helper exists.
- Keep Hero image paths under `/assets/soltower/heroes/`.
- Do not use letters, anonymous squares, triangles, or colored circles as final player avatars.
- Fallbacks should use the neutral silhouette assets, not geometric placeholders.
- Do not generate or introduce full town terrain, buildings, NPC portraits, raid maps, enemies, bosses, or combat effects as part of this character-first pass.

## Validation

Asset coverage is checked by `apps/web/src/ui-assets.test.ts` and `apps/web/src/game/town-scene.test.ts`.

The tests verify that Hero asset paths resolve locally, use transparent PNGs, avoid external image URLs, use the documented sprite dimensions/layout, preload through the manifest, and replace the player triangle/circle representation in the town player renderer.
