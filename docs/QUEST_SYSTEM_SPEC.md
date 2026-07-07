# Quest System Spec

Updated: 2026-06-29

## Runtime Model

The MVP quest system is hosted Supabase-backed and server-authoritative.

Core records:

- `public.quest_definitions`: daily, weekly, and achievement definitions.
- `public.player_quest_assignments`: per-player daily/weekly assignments for a reset period.
- `public.quest_progress_events`: append-only verified progress events.
- `public.player_achievements`: permanent achievement unlock/claim state.
- `public.quest_reward_claims`: idempotent reward claim records.
- `public.economy_ledger`: immutable Earned Gold reward entries.

Private RPCs:

- `private.record_quest_progress(...)`: atomically records a verified progress event once.
- `private.claim_player_quest_reward(...)`: atomically claims completed daily/weekly rewards.
- `private.claim_player_achievement(...)`: atomically marks unlocked achievements claimed.

Edge Functions:

- `get-player-quests`: assigns eligible quests using server time, refreshes achievements, and returns the Quest Journal payload.
- `claim-quest-reward`: claims one completed assignment or unlocked achievement using an idempotency key.
- `start-prototype-raid` / `finalize-prototype-raid`: update quest progress from verified prototype raid records.

## Daily Quests

At each UTC daily reset, the server assigns three eligible daily quests.

Current daily definitions:

- First Defense: complete 1 raid, reward 10 Earned Gold + 60 XP.
- Tower Watch: clear 12 total waves, reward 10 Earned Gold + 70 XP.
- Party Up: complete 2 raids with at least 2 active players, reward 15 Earned Gold + 90 XP.
- Skill in Motion: use active Hero skills 8 times, reward 10 Earned Gold + 70 XP.
- Bossbound: defeat 1 raid boss, reward 15 Earned Gold + 100 XP.
- Steady Defender: finish 1 raid without AFK flag, reward 10 Earned Gold + 60 XP.

Current MVP eligibility:

- First Defense, Tower Watch, Bossbound, and Steady Defender are eligible.
- Party Up is not assigned until party-size validation exists.
- Skill in Motion is not assigned until verified skill-use events exist.

Daily reward totals remain modest; the current eligible three-quest roll stays at approximately 40 Earned Gold or less.

## Weekly Quests

Current weekly definitions:

- Full Crew: complete 3 raids with a full active party of 4 players, reward 50 Earned Gold + 350 XP.
- Tower Vanguard: complete 5 raids during the week, reward 40 Earned Gold + 300 XP.
- Veteran of SolBloom: defeat 3 raid bosses during the week, reward 50 Earned Gold + 400 XP.

Current MVP eligibility:

- Tower Vanguard and Veteran of SolBloom are eligible.
- Full Crew is defined but not assigned until full-party raid validation exists.

## Achievements

Current achievement definitions:

- First Steps: complete first raid.
- Party Starter: complete first party raid.
- Full House: complete first full 4-player raid.
- Tower Climber: unlock Tower 1-2.
- Tower Veteran: unlock Tower 1-3.
- Gear Up: equip first non-starter item.
- Social Spark: add first friend.

Achievements are permanent and claimable once. Current achievements have no Gold reward; the claim record still prevents duplicate claims.

## Progress Security

The browser never sends raw quest progress such as `waves = 12`.

Progress comes from verified server-side facts:

- `raid_history.success`
- `raid_history.wave_count`
- `raid_history.boss_defeated`
- server-trusted non-AFK status for the prototype raid path
- future validated party size
- future validated skill-use events

Progress events use unique idempotency keys so the same raid cannot count twice for the same assignment.

## Claim Security

Claims are made through `claim-quest-reward` only.

The claim RPC:

- verifies the Supabase auth user owns the assignment or achievement.
- requires the assignment to be complete.
- locks the row during claim.
- writes one reward claim record.
- credits Earned Gold through `private.apply_balance_delta`.
- updates XP server-side.
- treats repeated idempotency keys and already-claimed rows as safe repeats.

## Current Placeholders

- Party quest progress is not active until party validation records active player count and AFK state.
- Full Crew remains unassigned until exactly-four-player validation exists.
- Skill in Motion remains unassigned until active Hero skill events are recorded by the raid server path.
- Quest UI uses text and card presentation only; no final quest art is included.
