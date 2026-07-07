# SolTower Engineering Notes

SolTower is built as a pnpm workspace with player, admin, shared, and game-engine packages. Supabase is the active MVP backend.

## Working Rules

- Keep economy, Blackjack, raid rewards, admin actions, and player restrictions server-authoritative.
- Validate every mutation payload with Zod.
- Use append-only ledger and audit records. Corrections are reversing entries, never edits.
- Treat Test Token as DEV_MODE mock value only. Do not imply on-chain settlement exists.
- Do not add copied game art, copied layouts, copied names, wallet private-key handling, or real Solana transfers.
- Prefer shared schemas and game-engine formulas over duplicating business rules in apps.
- Update `docs/BUILD_STATUS.md` after major phases.

## Current Runtime

- `apps/web` renders the player landing page, town hub, and game flows.
- `apps/admin` renders the internal operations portal at `admin.playsoltower.fun`.
- `supabase/migrations` owns PostgreSQL schema, private schema, RLS, and transactional RPCs.
- `supabase/functions` owns sensitive wallet, economy, Blackjack, raid, social, inventory, and admin mutations.
- `packages/shared` owns config, schemas, permissions, and reusable types.
- `packages/game-engine` owns raid balance, waves, heroes, and reward formulas.
- `apps/server` is legacy Fastify/Socket.IO reference code only and is not active in the MVP workspace.

## Review Checklist

- Do ledger entries include idempotency keys and before/after balances?
- Are role checks enforced by backend code, not only hidden UI?
- Are browser-provided prices, balances, rewards, card results, and permissions ignored?
- Are DEV_MODE-only tools guarded on both route and UI?
