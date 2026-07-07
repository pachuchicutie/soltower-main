# Architecture

## Active Monorepo

```text
apps/
  web/
  admin/
packages/
  shared/
  game-engine/
supabase/
  migrations/
  functions/
  seed.sql
  config.toml
docs/
```

`apps/server` remains in the repository as a legacy Fastify/Socket.IO reference, but it is excluded from `pnpm-workspace.yaml` and is not required by `pnpm dev`, `pnpm build`, the player app, or the admin app.

## Runtime

Vercel hosts:

- `playsoltower.fun`: player app and landing page.
- `admin.playsoltower.fun`: admin portal.

Supabase hosts:

- PostgreSQL database.
- Supabase Auth.
- Realtime Presence and Broadcast.
- Database migrations.
- Row Level Security.
- Edge Functions.
- Storage later for assets and avatars.

## Client Apps

`apps/web` uses Supabase Auth anonymous sessions for Play Now, read-only spectate without auth, RLS reads for safe data, and Supabase Edge Functions for sensitive mutations.

`apps/admin` uses Supabase Auth email/password login. The frontend has route/UI guards, but permissions are enforced again in Edge Functions and database policies.

## Sensitive Mutations

The browser must not directly write balances, ledger entries, market trades, buy-order escrow, Blackjack state, raid rewards, inventory ownership, admin records, audit logs, game configuration, or moderation records.

Those actions route through named Edge Functions in `supabase/functions`. Financial changes use transactional SQL/RPC helpers in the `private` schema and append immutable ledger records with idempotency keys and before/after balances.

## Database Strategy

`public` contains player-facing tables protected by RLS. `private` contains sensitive internal state such as wallet login nonces, hidden Blackjack hands, and RPC helpers.

`supabase/migrations/20260629000100_initial_soltower.sql` creates the initial public model. `supabase/migrations/20260629000200_supabase_first_mvp.sql` adds the private schema, inventory/map/raid/trade tables, and transactional economy functions.

Prisma/SQLite is no longer an active source of truth. The old `prisma/` folder is legacy reference material only.

## Raid Boundary

The MVP raid is a simple 60-second event-based prototype with 10 quick waves and one boss. Rewards are issued by Edge Function/database logic. The MVP does not claim continuous authoritative multiplayer combat.

A future dedicated game server should replace only the battle runtime, without changing accounts, wallet links, inventory, economy, ledger, market, buy orders, friends, chat, admin portal, maps, hero data, or rewards.
