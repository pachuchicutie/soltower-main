# Security Model

## Current Controls

- Supabase Auth for anonymous player sessions and admin email/password sessions.
- Server-side wallet nonce/signature verification in Edge Functions.
- Zod validation in Edge Functions.
- PostgreSQL RLS on player-facing tables.
- Private schema for hidden wallet nonce metadata, Blackjack state, and economy RPC helpers.
- Append-only economy ledger with idempotency keys and before/after balances.
- Admin audit logs for privileged actions.
- DEV_MODE indicators and guards for local-only tools.

## Trust Boundaries

The browser may request actions but never supplies authoritative balances, prices, rewards, card outcomes, contribution, player power, wallet ownership, admin permissions, or moderation authority.

Sensitive mutations go through Supabase Edge Functions using server-only privileged database access. Browser clients use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Wallet Login

The MVP flow is:

1. Visitor presses Play Now.
2. The player app creates or reuses an anonymous Supabase Auth session.
3. The frontend requests a short-lived challenge from `create-wallet-nonce`.
4. The challenge binds the wallet, anonymous Auth user, nonce, request ID, provider, and issue time.
5. The Edge Function stores the canonical UTF-8 message bytes as `message_base64` plus `message_sha256`.
6. The player signs the exact decoded `messageBase64` bytes returned by the Edge Function.
7. The browser normalizes the provider result to a canonical base64-encoded 64-byte Ed25519 signature.
8. `verify-wallet-signature` loads the stored challenge by `challengeId` and verifies stored message bytes, wallet, signature, expiry, and replay status.
9. Expected failures return a safe structured code without exposing signatures, challenge text, tokens, or secrets.
10. In production, the Edge Function checks the connected wallet for the configured `$TOWER` mint before town entry is allowed.
11. The wallet public key is linked to one player profile.
12. New profiles receive exactly 50 Locked Gold once through the ledger.

Wallet connection never requests seed phrases, private keys, transactions, token approvals, deposits, withdrawals, or real Solana transfers.

The current production token gates are server-side only:

- Town entry requires at least `1,000 $TOWER` in the connected wallet.
- Creating Gold listings and fulfilling buy orders require account Level 10 plus at least `10,000 $TOWER`.
- Future auction item listings must use the same Level 10 plus `10,000 $TOWER` seller gate before any server mutation is added.
- Buying Gold or future auction items does not require the seller gate.
- DEV_MODE displays the requirements but skips SPL wallet-balance enforcement for local testing.

Wallet verification logs are metadata-only: provider, challenge ID, submitted/challenge/current public keys, masked nonce identifier, timestamps, consumed status, byte lengths, stored message hash, encoding, verifier name, and final result. Raw signatures, full challenge messages, authorization headers, and secrets are never logged.

Anonymous auth session persistence is used in the MVP. A future cross-device wallet-native login solution may require SIWS/OIDC.

## RLS And Secrets

- The service-role key is only for Supabase Edge Functions and local function development.
- The service-role key must never appear in `apps/web`, `apps/admin`, Vercel frontend variables, or frontend bundles.
- Players can read only their own private player data plus explicitly public/visible data such as active market listings and approved town chat.
- Players cannot directly insert, update, or delete balances, ledger entries, market transactions, buy-order fills, Blackjack state, raid rewards, admin records, economy config, or audit logs.
- Admin tables are not directly readable from the player app.
- Town chat server selection is Edge Function-authoritative. `select-town-server` and `send-chat-message` validate one of five fixed `solbloom-*` servers and enforce the 40-player capacity before updating presence or accepting a town message.

## Quests

Quest assignment, progress, completion, and reward claims are server-authoritative.

- The browser reads Quest Journal state through `get-player-quests`.
- The browser claims completed quests through `claim-quest-reward` with an idempotency key.
- The browser cannot submit raw progress values.
- Prototype raid quest progress is derived from verified `raid_history` rows created by Edge Functions.
- Quest progress events are append-only and deduplicated by idempotency key.
- Quest rewards use the private balance RPC and create immutable `QUEST_REWARD` ledger entries.
- Party-size, full-party, and skill-use quests are not assigned until those server-verified event streams exist.

## Hosted Verification

The hosted DEV project was smoke-tested after migration, seed, secret configuration, and Edge Function deployment. The checks verified that public spectators cannot mutate balances, authenticated players cannot directly update balances through RLS, quest assignment/progress/claim paths work from verified raid history, browser quest progress mutation is blocked/no-op under RLS, a safe Edge Function invocation succeeds, the wallet verification path can link Marky, player bootstrap can read required server-side data, and frontend bundles do not contain the service-role key value or service-role literals.

## Realtime

Use Supabase Presence for town/friend/spectator/lobby status and Broadcast for future realtime fan-out of town chat, party chat, whispers, ready state, invites, notifications, and prototype raid events. The current MVP also persists approved town chat messages by `town_channel` so the HUD can load the latest messages per server.

Do not create unrestricted public channels containing private player data. Persist important data such as chat messages, friend requests, lobbies, market activity, and raid history.

## Production Gaps

- Add durable rate limiting for Edge Functions.
- Add structured security logging and alerting.
- Add anti-fraud/risk scoring around wallet login, market, Blackjack, and raid rewards.
- Add production moderation workflows and report review queues.
- Review any future real transaction integration for custody, signing, compliance, audited contracts, reconciliation, and incident response.
