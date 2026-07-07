# UI Asset Guide

Updated: 2026-06-29

SolTower now includes an original local UI/item/audio asset pass for the MVP. These assets are generated inside the repository and do not depend on external copyrighted icon packs, art packs, music packs, or sound packs.

## Source Of Truth

- Generator script: `scripts/generate-ui-audio-assets.mjs`
- Shared manifest: `packages/shared/src/uiAssetManifest.ts`
- Generation notes: `apps/web/public/assets/ui/source/generated-asset-notes.md`

Run the generator when the manifest set needs to be refreshed:

```bash
node scripts/generate-ui-audio-assets.mjs
```

## File Layout

- UI icons: `apps/web/public/assets/ui/icons/`
- Item icons: `apps/web/public/assets/items/`
- Rarity frames: `apps/web/public/assets/items/frames/`
- Hero icons: `apps/web/public/assets/heroes/icons/`
- Currency icons: `apps/web/public/assets/currencies/`
- UI sounds: `apps/web/public/assets/audio/ui/`
- Ambience loops: `apps/web/public/assets/audio/ambience/`
- Music loop: `apps/web/public/assets/audio/music/`

## Generated Icon Coverage

UI icons include inventory, quests, settings, market, hero/loadout, close, back, buy, sell, history, feed, timer, claim, sound, music, mute, logout, disconnect, wallet, copy, party, achievement, and mail/notifications.

Currency icons include Earned Gold, Locked Gold, and Tower Token.

Hero icons include Storm Archer, Tide Mage, Bombardier, Coral Alchemist, and Starcaller.

Item icons include Basic Bow, Basic Armor, Basic Relic, Basic Charm, Repair Kit, Mana Tonic, Scout Flare, Revive Feather, Treasure Compass, Tower Shard, Moss Thread, Ember Core, Tidal Pearl, and Starlit Dust.

Rarity frames include Common, Uncommon, Rare, Epic, and Legendary.

## Generated Audio Coverage

UI sounds:

- click
- hover
- open modal
- close modal
- tab switch
- success
- warning
- quest claim
- market listing created
- market sale completed

Ambience:

- soft village ambience loop
- fountain/wind ambience loop

Music:

- cozy fantasy village loop

The current audio assets are lightweight synthesized WAV files. Settings applies master/music/SFX volume, mute states, and preview playback immediately. Playback failures from browser autoplay policy are caught and ignored.

## Usage Rules

- Import asset paths from `uiAssetManifest` instead of hardcoding new paths in components.
- Keep browser assets under `/assets/...` so Vite serves them from `apps/web/public`.
- Use transparent SVG icons for UI/item/hero/currency surfaces.
- Keep item icons readable at small sizes.
- Keep rarity frames visually distinct but not louder than the item art.
- Continue to label development token buying power as `$TOWER (DEV)`.

## Validation

Asset validation lives in `apps/web/src/ui-assets.test.ts`.

The test checks that manifest paths:

- resolve to local files
- stay under `/assets/`
- do not use external URLs
- include SVG markup for icons
- include valid `RIFF`/`WAVE` headers for audio
