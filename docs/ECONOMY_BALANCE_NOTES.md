# Economy Balance Notes

Updated: 2026-06-29

## Quest Reward Balance

Quest rewards are intentionally conservative. Daily and weekly quests should reward active play without flooding the Earned Gold economy.

The configurable reward source is `packages/shared/src/questRewards.ts`. The database update for hosted/local Supabase is in `supabase/migrations/20260629000500_quest_reward_rebalance.sql`.

Current daily practical target:

- Practical daily Earned Gold minimum: 12.
- Practical daily Earned Gold maximum: 20.
- XP can be more generous than Gold because XP is progression-bound and not the player-to-player market currency.

| Quest | Requirement | Earned Gold | XP |
| --- | --- | ---: | ---: |
| First Defense | Complete 1 raid | 4 | 60 |
| Tower Watch | Clear 12 total waves across raids | 5 | 70 |
| Party Up | Complete 2 raids with at least 2 active players | 6 | 90 |
| Skill in Motion | Use active Hero skills 8 times in raids | 4 | 65 |
| Bossbound | Defeat 1 raid boss | 6 | 100 |
| Steady Defender | Finish 1 raid without being flagged AFK | 4 | 60 |

| Weekly Quest | Requirement | Earned Gold | XP |
| --- | --- | ---: | ---: |
| Full Crew | Complete 3 raids with 4 active players | 20 | 300 |
| Tower Vanguard | Complete 5 raids during the week | 18 | 260 |
| Veteran of SolBloom | Defeat 3 raid bosses | 22 | 340 |

Achievements should stay mostly XP, cosmetics, titles, or small one-time Gold grants. Avoid large repeatable achievement Gold payouts.

## Market Terms

- Earned Gold is tradeable in-game Gold.
- Locked Gold is non-tradeable and cannot be listed, gifted, sold, converted to Test Token, or converted to Earned Gold.
- `$TOWER` is the market buying-power label.
- In development/test builds, player-facing premium surfaces label it as `$TOWER (DEV)` because no live on-chain settlement token exists.

## Market Tax

The current seller tax is 10% of gross `$TOWER`.

The shared rule is `calculateMarketTax` in `packages/shared/src/economy.ts`:

```ts
tax = Math.floor(goldAmount * pricePerGold * 0.1)
sellerReceives = grossTotal - tax
```

Market Board V2 previews:

- gross total
- market tax
- seller receives
- buy-order escrow required

The browser preview is informational only. Market listing creation, purchase, buy-order creation, and order fills remain server-authoritative through Edge Functions and database RPCs.

## Safety Notes

- Quest progress remains server-authoritative.
- Quest claims remain idempotent and use immutable ledger entries.
- Browser-provided rewards, balances, prices, and permissions must be ignored by backend code.
- Test Token and `$TOWER (DEV)` remain DEV_MODE mock values only.
