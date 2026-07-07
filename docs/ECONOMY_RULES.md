# Economy Rules

Supabase PostgreSQL is the MVP source of truth for balances, market state, buy orders, Blackjack wagers/payouts, raid rewards, and admin adjustments.

## Balances

- `EARNED_GOLD`
- `LOCKED_GOLD`
- `TEST_TOKEN`

Do not label a balance as "Unlocked Gold" in player UI.

## Locked Gold

Locked Gold comes from starter grants, Test Token purchases, market purchases, bound rewards, and locked admin grants. It can be spent in game but cannot be sold, listed, gifted, converted to Test Token, or converted to Earned Gold.

Every new player receives exactly 50 Locked Gold once through an idempotent starter ledger entry.

## Earned Gold

Earned Gold comes from raids, quests, eligible Blackjack wins, and future eligible events. It can be listed for sale only when the account is Level 10+ and within daily sell capacity.

Market-purchased Gold cannot be relisted because buyers receive Locked Gold.

## Market

- Minimum listing: 100 Earned Gold.
- Seller tax: exactly 10% Test Token.
- Buyer pays Test Token.
- Buyer receives Locked Gold.
- Seller receives Test Token net of tax.
- Buy-order Test Token is escrowed immediately.
- Partial fills reduce open Gold and escrow.
- Cancellation releases remaining escrow.
- All player-to-player Gold transfer must happen through the Market Board.

## Blackjack

- Uses Gold only.
- Browser cannot determine card outcomes.
- Earned wagers settle as Earned Gold until the daily Earned profit cap is reached.
- Additional Earned-profit after the cap becomes Locked Gold.
- Locked wagers always settle as Locked Gold.
- Test Token never enters Blackjack.

## Ledger

Every balance mutation is append-only, idempotent, and records:

- player ID
- balance type
- source type
- direction
- amount
- before balance
- after balance
- reason
- idempotency key
- reference entity
- metadata
- timestamp
- admin actor when relevant

Ledger records are immutable. Corrections use reversing entries, never edits.
