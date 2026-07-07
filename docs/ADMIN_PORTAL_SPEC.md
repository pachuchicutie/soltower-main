# Admin Portal Spec

The admin portal runs at `admin.playsoltower.fun` and uses Supabase Auth email/password sessions.

## Roles

- `OWNER`: full access, high-risk approvals, role management, audit access.
- `ADMIN`: player management, moderation, content, market monitoring, low-risk economy actions.
- `ECONOMY_MANAGER`: economy dashboards and approved economy actions.
- `GAME_DESIGNER`: content and balance drafts, no player balance controls.
- `MODERATOR`: chat moderation, reports, mutes, temporary suspensions.
- `SUPPORT`: view player/account history and add limited notes.

## Navigation

Dashboard, Players, Economy, Market Board, Blackjack, Raids, Content, Quests and Events, Chat and Reports, Moderation, Announcements, Audit Logs, Admin Users and Roles, System Health, and DEV Tools in DEV_MODE.

## Required Behavior

- Supabase Auth email/password login.
- Frontend route guards.
- Edge Function role checks.
- Database policies where appropriate.
- Data tables for players, wallet public keys, balances, immutable ledger, market listings, market trades, buy orders, escrow, Blackjack history, raid history, reports, moderation actions, admin notes, config versions, audit logs, and system activity.
- Visible DEV_MODE indicator.
- No wallet private keys, seed phrases, or signing secrets.
- No casual raw balance editor.
- All admin mutations require a reason and audit log entry.
- Economy/admin mutations use idempotency keys where money or inventory can change.
- DEV tools are unavailable when DEV_MODE is false.

## Current MVP Coverage

The portal shell is wired to Supabase Auth and `admin-bootstrap`/admin action Edge Functions. The data views are Supabase-backed where tables exist, with deeper content editor workflows still represented as versioned/audited extension points.
