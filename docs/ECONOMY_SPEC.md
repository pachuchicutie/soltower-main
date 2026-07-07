# Economy Spec

Updated: 2026-06-30

## Source Of Truth

Supabase PostgreSQL and private RPCs are the source of truth for balances, ledger entries, market state, Blackjack, quest rewards, raid rewards, equipment purchases, equipment swaps, and Starlight Vault Star Draws.

The browser never decides final balances, rewards, prices, permissions, random outcomes, or ownership.

## Ledger

Economy changes use append-only ledger entries. Corrections should be reversing entries, not edits.

Starlight Vault debits use:

`STARLIGHT_VAULT_DRAW`

The debit is recorded with:

- player id
- balance type
- before balance
- after balance
- amount
- direction
- reason
- idempotency key
- banner reference
- draw metadata

## Gold Types

Starlight Vault accepts only:

- Earned Gold
- Locked Gold

It does not accept:

- Test Token
- `$TOWER`
- wallet funds
- real money
- mixed balance fallback

## Starlight Materials

Starlight duplicate materials are inventory material rows:

- Wardrobe Threads
- Starlight Shards

They are bound and cannot be traded, auctioned, gifted, sold, or converted.

## DEV_MODE

Test Token remains DEV_MODE-only mock value. It must not be used for Starlight Vault pulls or described as on-chain settlement.
