# SolTower

Cozy co-op tower defense adventure set in SolBloom Village.

SolTower is a browser-based 2D RPG/tower-defense MVP. The player app renders the landing page, spectate mode, town hub, NPC panels, market, Blackjack, social flows, lobbies, and a 60-second prototype raid. The admin app renders the operations portal.

## Active MVP Architecture

- `apps/web`: Vercel-hosted player game and landing page.
- `apps/admin`: Vercel-hosted admin portal for `admin.playsoltower.fun`.
- `packages/shared`: shared schemas, permissions, economy rules, Blackjack rules, and content constants.
- `packages/game-engine`: heroes, maps, waves, and raid reward formulas.
- `supabase/migrations`: PostgreSQL schema, private schema, RLS, and transactional economy RPCs.
- `supabase/functions`: Supabase Edge Functions for wallet auth, player bootstrap, market, buy orders, Blackjack, inventory, Starlight Vault, lobbies, raid prototype, quests, social actions, and admin actions.
- `supabase/seed.sql`: local development seed data.

`apps/server` and `prisma/` are retained only as legacy transition references. They are not in the active pnpm workspace and are not required for the MVP runtime.

## Backend Decision

The MVP is Supabase-first:

- Supabase PostgreSQL is the source of truth.
- Supabase Auth owns anonymous player sessions and admin email/password sessions.
- Supabase Edge Functions own sensitive mutations.
- Supabase RLS protects player-facing reads.
- Supabase Realtime is the MVP path for presence and broadcast social/raid prototype events.
- Vercel hosts `apps/web` and `apps/admin`.

The MVP does not require Fastify, Socket.IO, a Hostinger VPS, or a separate custom backend server. A dedicated authoritative multiplayer server may be added later for the full 5-8 minute live co-op raid.

## Public Player Experience

The root route now opens directly into the original Phaser-built SolBloom Village:

- `Play Now` opens wallet ownership onboarding.
- `Spectate` enables bounded read-only camera pan and zoom without exposing player menus or mutations.
- Phantom, Solflare, Backpack, OKX Wallet, and a generic injected Solana provider are detected.
- DEV_MODE also exposes a clearly labeled DEV Mock Wallet for hosted development checks.
- First-time wallets sign before character setup, then receive Storm Archer, starter equipment, Tower 1-1, and exactly 50 Locked Gold through the existing server ledger.
- Returning wallets load their existing Supabase-backed profile without another starter grant.

Wallet disconnect ends the local Supabase/wallet-provider session and returns to the public landing page. It does not delete or unlink the player profile.

## Authenticated Town Gameplay UX

After wallet entry, the active selected Hero is the player's town avatar, lobby character, and raid character. Authenticated SolBloom Village now uses a player-following camera with clamped world bounds and a mobile-safe framing bias.

Town shortcuts are centralized and only work while authenticated town controls are available:

- `W A S D` / arrow keys: move the active Hero.
- `E`: interact with the nearest eligible NPC, portal, or board.
- `I`: open or close Inventory.
- `Q`: open or close Quest Journal.
- `Escape`: close the topmost panel/modal.

The desktop HUD renders these shortcuts as compact premium keycaps, and the same keycap pattern is reused in Settings > Controls.

Shortcuts are ignored while text entry, select boxes, contenteditable regions, wallet UI, or React modals are active, except Escape for closing the modal. Opening a panel clears held movement keys.

Inventory includes Equipment, Consumables, Materials, and Cosmetics tabs with generated item icons, rarity frames, equipped-slot cards, and clean per-tab content. Equipment actions still route through secure Edge Functions; the browser does not mutate ownership, balances, or stats directly. Materials now include bound Starlight Vault duplicate materials when present. Cosmetics includes local appearance controls plus the server-backed Full Costume slot; full Hero costume sprites remain separate from Vault reward icons.

Hero / Loadout now separates Overview, Equipment, Stats, and Compare so the active Hero, equipment, and grouped stats are readable without duplicate section rows.

Quest Journal uses hosted Supabase quest records and renders a live server-time offset plus live daily/weekly reset countdowns. Daily/weekly progress is advanced only from verified server events such as prototype raid history, and reward claims use idempotent Edge Function/RPC logic with immutable ledger entries.

Settings now includes Audio, Motion, Accessibility, Controls, and Account tabs. Audio settings persist locally, apply immediately, respect mute states, and use original local generated audio previews.

Market Board V2 uses Browse, Sell Gold, Buy Orders, My Activity, and Live Feed tabs. It previews the 10% market tax before listing/order actions, labels market buying power as `$TOWER (DEV)` outside production, scopes My Activity to the current player, and subscribes to Supabase Realtime for readable market changes.

Raid Board now presents Map 1: Solheart Outskirts as a polished stage-selection and lobby surface. It uses paginated stage cards instead of horizontal wave/card scrolling, shows generated local PNG art for every Map 1 stage, enemy, boss, and reward type, and keeps locked stages visible with account-level and prior-clear requirements. Server-side Edge Functions enforce create, join, and run-start access checks; the browser display is not trusted for stage permissions. See [docs/RAID_SYSTEM_SPEC.md](docs/RAID_SYSTEM_SPEC.md).

Starlight Vault is a separate Gold-only Star Draw system with server-side RNG, pity, payment, reward authority, Full Costume ownership, duplicate material conversion, and production local PNG assets for banners, reward icons, rarity frames, and utility icons. The town Vault building is visible/interactable in normal player mode. See [docs/STARLIGHT_VAULT_SPEC.md](docs/STARLIGHT_VAULT_SPEC.md), [docs/COSTUME_SYSTEM_SPEC.md](docs/COSTUME_SYSTEM_SPEC.md), and [docs/ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md).

The profile menu now includes the active Hero icon, full wallet copy support, shortcuts to Hero / Loadout, Inventory, Quests, and Settings, plus confirmation dialogs for Disconnect Wallet and Log Out to Landing.

## Production UI And Asset Pass

This phase added an original local UI/item/audio kit without external art, sound packs, or copyrighted assets.

- UI icons: `apps/web/public/assets/ui/icons/`
- Item icons and rarity frames: `apps/web/public/assets/items/`
- Hero icons: `apps/web/public/assets/heroes/icons/`
- Currency icons: `apps/web/public/assets/currencies/`
- Audio: `apps/web/public/assets/audio/`
- Raid Board art: `apps/web/public/assets/raids/`
- Starlight Vault art: `apps/web/public/assets/vault/`
- Starlight Vault town building: `apps/web/public/assets/soltower/environment/structures/starlight-vault.png`
- Full Costume sprite target: `apps/web/public/assets/costumes/`
- Shared manifest: `packages/shared/src/uiAssetManifest.ts`
- Asset generator: `scripts/generate-ui-audio-assets.mjs`
- Raid Board asset generator: `scripts/generate-raid-board-assets.mjs`

See [docs/UI_ASSET_GUIDE.md](docs/UI_ASSET_GUIDE.md) for asset usage and [docs/ECONOMY_BALANCE_NOTES.md](docs/ECONOMY_BALANCE_NOTES.md) for the revised quest rewards and market-display rules.

## Hosted Supabase Status

The `sol-tower` hosted DEV project was linked, migrated, seeded, configured with custom Edge Function secrets, deployed, and smoke-tested on 2026-06-29. See [docs/BUILD_STATUS.md](docs/BUILD_STATUS.md) for the exact hosted result and any non-blocking provider warnings.

## Local Setup

Prerequisites:

- Node.js 22+
- pnpm 11+
- Project-local Supabase CLI from `pnpm install`

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
cp supabase/functions/.env.example supabase/functions/.env.local
pnpm exec supabase start
pnpm exec supabase db reset
pnpm exec supabase functions serve --env-file supabase/functions/.env.local
pnpm smoke:hosted:onboarding
pnpm dev
```

Useful Supabase commands:

```bash
pnpm exec supabase migration new your_change_name
pnpm exec supabase db reset
pnpm exec supabase db push
pnpm exec supabase functions serve --env-file supabase/functions/.env.local
pnpm exec supabase functions deploy
```

Default local URLs:

- Player app: `http://localhost:5173`
- Admin app: `http://localhost:5174`
- Supabase API: `http://127.0.0.1:54321`
- Supabase Studio: `http://127.0.0.1:54323`

## Environment Variables

Browser-safe Vercel variables for both `apps/web` and `apps/admin`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=production
```

Hosted Supabase Edge Functions receive platform Supabase credentials from Supabase. Configure only custom app secrets in the hosted function secret store:

```env
WALLET_NONCE_SECRET=
APP_URL=https://playsoltower.fun
ADMIN_URL=https://admin.playsoltower.fun
APP_ENV=production
```

Never put the service-role key in `apps/web`, `apps/admin`, Vercel frontend env vars, or bundled frontend source.

Hosted setup details are in [docs/SUPABASE_HOSTED_SETUP.md](docs/SUPABASE_HOSTED_SETUP.md).

## Local Development Accounts

Seeded player:

- Marky
- Level 10
- 300 Earned Gold
- 50 Locked Gold
- 250 Test Token
- Tower 1-1 through Tower 1-3 unlocked
- Storm Archer starter hero and starter equipment

Local admin users:

- `owner@local.playsoltower.fun` / `local-owner-change-me`
- `moderator@local.playsoltower.fun` / `local-moderator-change-me`

These are local-only seed credentials. Do not use or document production passwords in the repo.

## Wallet Safety

Wallet connection signs a plain-text login message only. It verifies wallet ownership; it does not request a transaction, token approval, private key, seed phrase, deposit, withdrawal, real token balance check, or on-chain marketplace settlement.

Anonymous Supabase Auth session persistence is used for the MVP. A future cross-device wallet-native login flow may require a dedicated SIWS/OIDC approach.

## Verification

```bash
pnpm lint
pnpm test
pnpm build
pnpm scan:frontend-secrets
```

## DEV_MODE Warning

Test Token is DEV_MODE mock value only. It has no crypto, cash, wallet, transfer, or on-chain meaning. No real Solana transfers exist in the MVP.
