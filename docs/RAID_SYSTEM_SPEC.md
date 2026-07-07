# Raid System Spec

Updated: 2026-06-30

## Current Scope

The active Raid Board is a stage-selection, lobby, and progression surface for the Supabase MVP. It does not add the later full real-time tower-defense combat runtime.

## Progression

SolTower uses three ten-stage maps:

- Map 1: `1-1` through `1-10`, Account Levels 1-10.
- Map 2: `2-1` through `2-10`, Account Levels 11-20.
- Map 3: `3-1` through `3-10`, Account Levels 21-30.

Map 1 is active as `Map 1: Solheart Outskirts`. Map 2 and Map 3 exist as locked progression data only.

Unlock rules:

- Stage `1-1` unlocks at Account Level 1.
- Every later stage requires its account level and completion of the prior stage.
- Stage `1-10` requires Account Level 10 and completion of `1-9`.
- Stage `2-1` requires Account Level 11 and completion of `1-10`, but Map 2 remains content-locked for now.

Existing `player_map_unlocks.map_id` values are treated as completed stage ids for this MVP progression gate.

## Map 1 Stages

| Stage | Name | Level | Status |
| --- | --- | ---: | --- |
| 1-1 | Sproutling Path | 1 | Active |
| 1-2 | Cinder Crossing | 2 | Active |
| 1-3 | Briar Hollow | 3 | Active |
| 1-4 | Glass Beetle Grotto | 4 | Active |
| 1-5 | Mistwood Watch | 5 | Active |
| 1-6 | Ashhound Trail | 6 | Active |
| 1-7 | Rune Grove | 7 | Active |
| 1-8 | Shardfall Rise | 8 | Active |
| 1-9 | Stormgate Approach | 9 | Active |
| 1-10 | Solheart Sentinel | 10 | Boss |

## Raid Board UX

The player-facing Raid Board:

- Shows `Map 1: Solheart Outskirts` with a chapter banner, level range, and cleared-stage count.
- Uses paginated stage cards instead of horizontal scrolling.
- Shows 5 stage cards per page on desktop, 3 on tablet/compact widths, and 1 on phone widths.
- Keeps locked stages visible with requirement text.
- Shows a large selected-stage preview, reward icons, enemy portraits, and a boss portrait/badge on `1-10`.
- Replaces the old horizontal wave strip with a vertical expandable `Show Waves & Enemies` / `Hide Waves & Enemies` list.
- Renders lobby parties with stage art, guardian display names, hero avatars, host badges, readiness pills, and server-backed Join/Ready/Leave/Kick/Start actions.
- Never renders raw `player-...` ids in the lobby UI; missing names fall back to `Unknown Guardian`.

## Generated Local Assets

All active Raid Board art is original local PNG under `apps/web/public/assets/raids/`.

- Chapter banners: `chapters/`
- Map 1 stage thumbnails: `stages/`
- Enemy portraits: `enemies/`
- Boss portrait: `enemies/solheart-sentinel.png`
- Reward icons: `rewards/`
- Source notes: `source/README.md`

The generator is `scripts/generate-raid-board-assets.mjs`.

Preview screenshots generated for this pass:

- `tmp/raid-board-stage-grid.png`
- `tmp/raid-board-selected-stage.png`

## Server Authority

The browser renders stage lock state for clarity, but Edge Functions enforce access:

- `create-lobby` checks stage access before inserting a lobby.
- `join-lobby` checks lobby status, capacity, and stage access before membership upsert.
- `start-prototype-raid` checks stage access and requires the current player to be the lobby host when a lobby id is provided.

Stage access is denied when:

- the map id is unknown,
- the player account level is too low,
- the prior stage completion is missing,
- the requested stage belongs to locked future content.

## Current Combat Runtime

The MVP still uses the existing server-recorded run path for rewards and quest progress. Full 5-8 minute synchronized combat, enemy movement, towers, abilities, wave simulation, and anti-cheat combat telemetry remain the next raid-combat phase.
