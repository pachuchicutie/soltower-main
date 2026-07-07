# Build Status

Updated: 2026-07-05

## Temporary TOWER Token Access Gates

- Added production-only wallet token checks for the temporary `$TOWER` mint:
  - Mint: `FX1mwQ5CZHutv5jCAMJ4jxE7XYeYBpVuX2Qk5MuRpump`.
  - Entering SolBloom Village requires at least `1,000 $TOWER` in the connected wallet outside DEV_MODE.
  - Creating Gold listings and fulfilling buy orders require Level 10 plus at least `10,000 $TOWER` outside DEV_MODE.
  - Token-gate failures now return structured Edge Function codes (`tower_token_gate` and `tower_token_check_unavailable`) so wallet login does not misreport them as signature failures.
  - DEV_MODE keeps the requirements visible but skips wallet-token enforcement for local testing.
- The Edge Function gate checks SPL token accounts through Solana JSON-RPC.
  - `SOLANA_RPC_URL` can be configured; otherwise the default mainnet-beta RPC endpoint is used.
  - Browser balances and mock `TEST_TOKEN` values are not trusted for production access decisions.
- Market and onboarding UX now explain the 1k/10k requirements and link to Jupiter for the temporary `$TOWER` mint.
- Added a Market Board `Auction House` tab that displays the Level 10 plus `10,000 $TOWER` seller requirement.
  - Buying auction items is documented as not requiring this seller gate.
  - A server-side auction listing mutation is not present yet, so there is no auction listing backend path to enforce in this pass.
- Verification for this pass:
  - Focused: `pnpm exec vitest run apps/web/src/components/landing-onboarding.test.tsx apps/web/src/lib/walletAuth.test.ts supabase/tests/supabase-first.test.ts` passed, 48 tests.
  - `pnpm lint`: passing.
  - `pnpm test`: 155 passed, 1 failed. The failure is the existing Raid Board PNG format assertion for `/assets/raids/stages/stage-1-1-sproutling-path.png`, where the test expects PNG color type `6` and the current file reports `2`.
  - `pnpm build`: passing. Existing Vite large-chunk warnings and the existing Reown/Rollup pure-annotation warning remain.

## Gameplay Sound Effects Pass

- Generated original local WAV sound effects under `apps/web/public/assets/audio/ui/`.
  - Blackjack: deal, card flip, hit, stand, double-down, win, lose, and push cues.
  - Town: nearby interaction, interaction open, NPC talk, structure open, walk footsteps, and run footsteps.
  - Raid/dungeon-ready cues: raid start, raid hit, raid damage, raid win, and raid lose.
- Shared UI asset manifest now exposes every new sound so gameplay code references repository-local assets only.
- Audio playback now supports per-sound volume multipliers and throttling, preventing footsteps and proximity pings from stacking too aggressively.
- Blackjack now plays sounds on deal/action/server result and adds stronger premium win/loss/push visual highlights around the live table.
- Town interactions now play sounds when nearby prompts appear, when NPC/structure modals open, and while the local player walks or runs.
- Raid lobby start/result actions now play raid start and server-result sounds; dedicated hit/damage cues are available for the playable raid scene.
- Verification for this pass:
  - Focused: `pnpm exec vitest run apps/web/src/components/panels/BlackjackPanel.test.tsx apps/web/src/components/panels/RaidPanel.test.tsx apps/web/src/components/landing-onboarding.test.tsx apps/web/src/ui-assets.test.ts apps/web/src/game/town-scene.test.ts` is 73 passing / 1 failing.
  - Full: `pnpm test` is 140 passing / 1 failing.
  - The remaining failure is the pre-existing unrelated asset assertion: `apps/web/src/ui-assets.test.ts` expects `/assets/soltower/environment/structures/solheart-tower.png` to be `230x330`, but the current file is `600x600`.
  - `pnpm lint`: passing.
  - `pnpm build`: passing. Existing Vite large-chunk warnings and the existing Reown/Rollup pure-annotation warning remain.
  - `pnpm scan:frontend-secrets`: passing.

## Raid Lobby Recruitment Filters And Expiry

- Open raid parties now have a one-hour recruitment window.
  - New migration: `supabase/migrations/20260703000200_raid_lobby_recruitment.sql`.
  - `raid_lobbies.needed_hero_ids` stores host-requested recruitment needs as validated starter Hero ids.
  - Stale `OPEN` lobbies older than one hour are marked `EXPIRED` and their members are removed.
  - Lobby create, join, ready, kick, leave/disband, and raid start actions all run stale-lobby cleanup before mutating.
  - Joining or starting an expired lobby is rejected server-side.
- Raid Board lobby UX now supports recruiting quality-of-life controls.
  - Hosts can select up to three needed Heroes before creating a party.
  - Open party cards show the remaining requested Heroes; when a matching Hero joins, that need disappears from the card.
  - Open parties are paginated at three per page.
  - Sort controls were added for `Most recent`, `Near full`, and `Needs my hero`.
  - Sort changes reset to page one so the best matching parties are immediately visible.
  - Empty or hostless lobby shells remain hidden from the player-facing list.
- Verification for this pass:
  - Focused: `pnpm exec vitest run apps/web/src/components/panels/RaidPanel.test.tsx apps/web/src/components/panels/BlackjackPanel.test.tsx packages/shared/src/blackjack.test.ts supabase/tests/supabase-first.test.ts` passed, 29 tests.
  - `pnpm lint`: passing.
  - `pnpm build`: passing. Existing Vite large-chunk warnings and the existing Reown/Rollup pure-annotation warning remain.
  - `pnpm test`: currently 140 passing / 1 failing. The failure is the existing unrelated environment asset assertion: `apps/web/src/ui-assets.test.ts` expects `/assets/soltower/environment/structures/solheart-tower.png` to be `230x330`, but the current file is `600x600`.

## Raid Lobby Host Party Rules

- Raid lobby UX now treats the current player as being in exactly one open party at a time.
  - If the player is already in an open party, Create Public Lobby, Create Private Lobby, Quick Join, and Join Party for other lobbies are disabled.
  - A host no longer sees a generic `Leave` action on their own party.
  - Host action now reads `Disband Party`, closing the party for everyone.
  - Non-host members still see `Ready` / `Unready` and `Leave Party`.
  - Hosts can kick joined non-host members from their party.
- Server authority was tightened in `supabase/functions/_shared/actions.ts`.
  - `create-lobby` rejects creating another lobby while the player is already in any open lobby.
  - `join-lobby` returns idempotently if the player is already in that lobby and rejects joining a different open lobby.
  - Host disband marks the lobby `DISBANDED` and removes lobby members.
  - Kick remains host-only and cannot be used to kick the host/self.
- Verification completed:
  - Focused: `pnpm exec vitest run apps/web/src/components/panels/RaidPanel.test.tsx supabase/tests/supabase-first.test.ts` passed, 21 tests.
  - `pnpm lint`: passing.
  - `pnpm test`: passing, 131 tests.
  - `pnpm build`: passing. Existing Vite large-chunk warnings and the existing Reown/Rollup pure-annotation warning remain.
  - `pnpm scan:frontend-secrets`: passing.

## Premium Raid Board And Lobby Refresh

- Generated and wired a new local Map 1 Raid Board asset set under `apps/web/public/assets/raids/`.
  - Chapter banner: `chapters/solheart-outskirts-banner.png` at 960x320.
  - Stage previews: 10 Map 1 PNGs under `stages/`, each 640x360.
  - Enemy portraits: Sproutling, Ember Mite, Briar Crawler, Glass Beetle, Mist Wisp, Ash Hound, Rune Warden, Shard Golem, Storm Sentinel, and Solheart Sentinel under `enemies/`.
  - Reward icons: Earned Gold, XP Crystal, Moss Thread, Tower Shard, Ember Core, Tidal Pearl, Starlit Dust, Chest Reward, Rare Chest Reward, and Boss Chest Reward under `rewards/`.
  - Source notes: `apps/web/public/assets/raids/source/README.md`.
- Added `packages/game-engine/src/raidAssets.ts` as the central Raid Board asset registry.
- Updated Map 1 stage data to use the production asset filenames and requested enemy naming.
- Raid Board UI now defaults wave details collapsed with `Show Waves & Enemies` / `Hide Waves & Enemies`.
- Stage pagination is 5 cards on desktop, 3 on tablet/compact widths, and 1 on phone widths.
- Lobby cards now show selected-stage art, public/private status, player count, host, hero avatar, hero name, account level, power, readiness, and server-backed Join/Ready/Leave/Kick/Start controls.
- Raw lobby player ids are no longer rendered as display names.
  - Edge Function lobby payloads enrich members from `player_profiles.display_name`.
  - Browser fallback lobby reads also join `player_profiles`.
  - Missing or raw-looking names render as `Unknown Guardian`.
- Server authority was tightened for starts: solo host runs are allowed, but group runs require every non-host member to be ready.
- Focused verification passed:
  - `pnpm exec vitest run apps/web/src/components/panels/RaidPanel.test.tsx apps/web/src/ui-assets.test.ts packages/game-engine/src/maps.test.ts supabase/tests/supabase-first.test.ts`: 39 tests passing.
- Full verification for this pass:
  - `pnpm lint`: passing.
  - `pnpm test`: passing, 126 tests.
  - `pnpm build`: passing. Existing Vite large-chunk warnings and the Reown/Rollup pure-annotation warning remain.
  - `pnpm scan:frontend-secrets`: passing.

## Premium Starter Hero Onboarding

- The `Create Your Guardian` onboarding modal is now a starter Hero selection experience instead of a single hardcoded Storm Archer block.
  - The profile step shows all current starter Heroes from the shared game-engine roster: Storm Archer, Tide Mage, Bombardier, Coral Alchemist, and Starcaller.
  - Each Hero card uses the real local generated Hero icon from `heroAssetManifest`.
  - The selected Hero panel uses the real local walking sprite sheet from `heroAssetManifest` and renders a crisp CSS frame animation from 64x64 frames.
  - The old abstract placeholder starter-Hero art block and leftover placeholder CSS were removed.
- Hero definitions now include onboarding content.
  - Added class name, attack type, tagline, description, stat bars, strengths, tradeoffs, best-for copy, and starter gear summary fields.
  - Starter selection remains data-driven from `packages/game-engine/src/heroes.ts` and `packages/shared/src/heroAssetManifest.ts`.
- Guardian creation now submits the selected starter Hero id.
  - Browser request body includes `heroId`.
  - Edge Function validation accepts only the current starter Hero ids.
  - Supabase profile creation stores `selected_hero_id` and inserts the chosen Hero into `player_heroes`.
  - Starter equipment and the 50 Locked Gold starter grant remain unchanged.
- Hosted Supabase status:
  - Migration dry run succeeded and showed only `20260630000400_starter_hero_selection.sql` pending.
  - `supabase db push` applied `20260630000400_starter_hero_selection.sql` to the hosted project.
  - `create-player-profile` was deployed successfully with the updated shared action bundle.
  - Docker was not running, but hosted function upload completed successfully.
- Visual/dev note:
  - Browser smoke confirmed Play Now opens the wallet modal without auto-connecting.
  - The local DEV mock wallet cannot reach the profile step against hosted verification because its fake `DevMock...` public key is intentionally not a real Solana public key; real wallet verification remains required for live onboarding.
- Verification completed for this phase.
  - `sips` confirmed every starter Hero `walk.png` sheet is 256x256, matching the 4-column/4-row, 64x64 frame manifest.
  - `pnpm lint`: passing.
  - `pnpm test`: passing, 117 tests.
  - `pnpm build`: passing for shared, game-engine, web, admin, and Supabase checks. Existing Vite large-chunk warnings remain.
  - `pnpm scan:frontend-secrets`: passing.
  - `pnpm smoke:hosted:wallet`: passing.

## Wallet Sign-In Diagnostics And Tab Stability

- OKX follow-up:
  - Hosted diagnostics confirmed matching challenge/submitted/current public keys and a correctly decoded 64-byte signature, but cryptographic verification returned `invalid_signature`.
  - OKX's official Solana extension signer requires the explicit `"utf8"` encoding argument.
  - Desktop OKX now uses the matching injected Solana provider directly with `signMessage(messageBytes, "utf8")`; mobile/WalletConnect and other wallets remain on Reown's standard provider path.
  - A mismatched exposed OKX public key is never used.
- Wallet signature transport now uses canonical base64 for exactly 64 Ed25519 signature bytes.
  - Reown provider byte arrays, ArrayBuffers, typed-array views, base58 strings, base64 strings, arrays, and `{ signature }` wrappers are normalized before submission.
  - The browser validates the Solana public key, challenge ID, signature encoding/length, request ID, provider, and current wallet before invoking verification.
- Wallet challenges now store canonical UTF-8 message bytes as `message_base64` plus `message_sha256`.
  - The browser signs decoded `messageBase64` bytes from the Edge Function.
  - The browser no longer rebuilds or sends the challenge message string for verification.
- `verify-wallet-signature` now loads the challenge by `challengeId`, decodes stored message bytes, validates 32-byte public keys and 64-byte signatures, verifies with `tweetnacl`, and consumes the nonce only after success.
- `verify-wallet-signature` returns safe structured failure codes for stale, expired, consumed, duplicate, changed-wallet, key-mismatch, message-byte mismatch, signature encoding, signature length, public-key length, signature, missing-field, and unexpected failures.
- Edge logs contain only approved diagnostic metadata. Raw signatures, full challenge messages, auth headers, and secrets are not logged.
- Retry discards the previous challenge and signature, creates a new request ID and nonce, and requires a fresh wallet signature.
- Browser tab focus no longer refetches the player bootstrap automatically.
  - React Query window-focus and reconnect refetches are disabled.
  - The full-screen `Lighting SolBloom lanterns...` state is restricted to the initial bootstrap with no cached player data.
- Opening Play Now no longer authenticates a wallet remembered by Reown.
  - The wallet modal waits for an explicit Connect Wallet click before requesting a nonce, opening a picker, or requesting a signature.
  - The remembered connection is used only after that explicit player action.
- Hosted deployment:
  - `create-wallet-nonce`: deployed successfully.
  - `verify-wallet-signature`: deployed successfully.
  - Migration dry run succeeded.
  - `supabase db push` applied pending migrations:
    - `20260629000500_quest_reward_rebalance.sql`
    - `20260630000100_equipment_core_slot_swaps.sql`
    - `20260630000200_starlight_vault.sql`
    - `20260630000300_wallet_challenge_bytes.sql`
  - Docker was not running, but hosted function deploy completed successfully.
- Hosted wallet smoke result:
  - Controlled invalid proof returned `invalid_signature`.
  - A valid Ed25519 proof succeeded.
  - Reusing the consumed request returned `duplicate_submission`.
  - Focused hosted wallet auth smoke passed via `pnpm smoke:hosted:wallet`.
  - The broader onboarding smoke reached wallet/profile flow and then stopped at the unrelated existing assertion that exactly three daily quests must be assigned.
  - Manual OKX browser signing still needs user verification because Codex cannot approve the wallet popup.
- Verification:
  - `pnpm lint`: passing.
  - `pnpm test`: passing, 117 tests.
  - `pnpm build`: passing.
  - `pnpm scan:frontend-secrets`: passing.
  - Existing Vite large-chunk warnings remain.

## Starlight Vault System Phase

- Starlight Vault has been upgraded from a placeholder shell into a production-facing Gold-only Star Draw UI.
  - It is separate from Auction House, Gold Exchange, Blackjack, Raid Board, Inventory, and normal shops.
  - Player-facing copy uses Star Draw / Pull / Banner / Draw Results / Vault Odds terminology.
  - Pull categories are Featured, Weapons, Armor, Relics & Charms, and Costumes.
  - Utility views are Collection, Pull History, and Vault Odds.
  - Player-facing placeholder copy such as `pending_manual_art`, “manual assets must be supplied”, and “No rewards are live” was removed from the Vault UI.
- Local production Vault assets were generated and wired.
  - Generator: `scripts/generate-starlight-vault-assets.mjs`.
  - Banners: five 960x320 PNGs under `apps/web/public/assets/vault/banners/`.
  - Reward icons: 24 160x160 PNGs under `apps/web/public/assets/vault/rewards/`.
  - Rarity frames: Common, Uncommon, Rare, Epic, Legendary, and Mythical 160x160 PNGs under `apps/web/public/assets/vault/rarity/`.
  - Utility icons: Earned Gold, Locked Gold, Pity, Rate Up, and Featured 64x64 PNGs under `apps/web/public/assets/vault/icons/`.
  - Source notes: `apps/web/public/assets/vault/source/README.md`.
- Shared rules were updated in `packages/shared/src/starlightVault.ts`.
  - Registry odds: Common 74.99%, Uncommon 18.50%, Rare 5.40%, Epic 1.00%, Legendary 0.10%, Mythical 0.01%.
  - Costs: 1 pull for 50 Gold, 10 pulls for 450 Gold.
  - Payment sources: Earned Gold or Locked Gold only.
  - Pity: Rare within 10, Epic within 75, Legendary within 300, and Mythical within 600 in the shared UI/registry layer.
  - Duplicate Full Costumes convert to Wardrobe Threads.
  - Duplicate equipment converts to Starlight Shards.
  - Vault gear definitions were added to the shared equipment catalog so pulled equipment resolves to names, slots, rarity, icons, and stats in Inventory.
- Supabase migration added: `supabase/migrations/20260630000200_starlight_vault.sql`.
  - Adds `manual_asset_registry`, `starlight_vault_banners`, `starlight_vault_pool_entries`, `starlight_vault_pity_counters`, `starlight_vault_pull_events`, `starlight_vault_duplicate_conversions`, `player_full_costumes`, `player_equipped_cosmetics`, `hero_compatible_item_tags`, and private idempotency records.
  - Adds private RPCs for Vault state, server-authoritative draws, and Full Costume equip.
  - Seeds the original four banner definitions, launch costume rewards, active-Hero Weapon/Armor/Relic/Charm rewards, and manual registry rows for every launch costume/Hero pairing.
  - Draw RPC validates player, active Hero, payment source, live asset readiness, exact-rarity reward selection, duplicate conversion, and idempotency ownership.
  - Full Costume equip validates owned Hero and owned costume.
  - This base migration was pushed during the hosted wallet/auth phase.
- Supabase migration added: `supabase/migrations/20260701000100_starlight_vault_live_assets.sql`.
  - Upserts the Featured Starlight Selection banner.
  - Marks the town Vault building and current local banner/reward assets ready.
  - Enables Common through Legendary live reward pool entries for current database-supported rarities.
  - Mythical remains generated and visible in the UI/registry, but is not inserted into the live database pool until a follow-up database rarity constraint migration is intentionally performed.
- Edge Function routes were added locally.
  - `starlight-vault-state`
  - `starlight-vault-draw`
  - `equip-full-costume`
- Starlight Vault UI was rebuilt.
  - Component: `apps/web/src/components/panels/StarlightVaultPanel.tsx`.
  - Modal action: `open_starlight_vault`.
  - Shows Gold balances, production banner art, featured reward cards, category-specific reward pools, collection, pull history, odds, pity meters, and explicit confirmation before server draw submission.
- Town infrastructure is configured and visible.
  - Building path: `/assets/soltower/environment/structures/starlight-vault.png`.
  - Prompt: `[E] Enter Starlight Vault`.
  - The object is `assetStatus: "ready"` and `enabledForPlayerUse: true`.
- Inventory integration was added.
  - Inventory > Cosmetics now has a server-backed Full Costume slot.
  - Full Costume is account-owned, per-Hero selected, and appearance-only.
  - Inventory > Materials now includes Starlight Vault duplicate materials when present.
- Docs added or updated.
  - `docs/STARLIGHT_VAULT_SPEC.md`
  - `docs/COSTUME_SYSTEM_SPEC.md`
  - `docs/WEAPON_BANNER_SPEC.md`
  - `docs/ARMOR_BANNER_SPEC.md`
  - `docs/RELIC_CHARM_BANNER_SPEC.md`
  - `docs/ECONOMY_SPEC.md`
  - `docs/ASSET_PIPELINE.md`
  - `docs/TOWN_INTERACTION_SPEC.md`
  - `docs/GAME_SPEC.md`
  - `README.md`
- Verification completed for this phase.
  - Focused suite passed: `pnpm exec vitest run packages/shared/src/starlightVault.test.ts apps/web/src/components/panels/StarlightVaultPanel.test.tsx apps/web/src/ui-assets.test.ts apps/web/src/game/town-scene.test.ts supabase/tests/supabase-first.test.ts` with 60 tests passing.
  - Latest full validation also passed: `pnpm lint`, `pnpm test` with 131 tests, `pnpm build`, and `pnpm scan:frontend-secrets`.

## Town Proximity, Collision, And Asset Scale Phase

- Latest town scale pass:
  - Town object rendering now preserves source image aspect ratio instead of forcing width and height independently, so square source assets like the blacksmith, props, and boards no longer look stretched.
  - Props were enlarged through the manifest and object placement scales, including market boards, benches, barrels/crates, fences, lamps, rocks, signposts, and campfire.
  - Blacksmith exterior interaction range was widened so the building can be opened from nearby sides instead of requiring the player to stand at one narrow front-side point.
  - Gold Exchange / Market Board now remains only on the left path end.
  - Authenticated town camera supports mouse-wheel zoom and stores the value in Settings as Camera Height.
  - Settings > Motion now includes Camera Height, which persists locally and updates the Phaser camera.
  - Blacksmith now renders as a major structure instead of using the previous `0.78` object shrink.
  - Blacksmith placement was pulled up-left toward the tavern-side path so it reads as reachable infrastructure instead of a small detached prop in the grass.
  - Emberforge was enlarged and moved closer to lower walking routes for better village scale balance.
  - Market stalls and quest board were slightly enlarged to stay readable beside the larger buildings.
  - Landmark labels now render on a high readable layer with explicit label positions above buildings instead of being drawn at blocked interaction anchors.
  - Removed the lower west market-stall prop that visually read as a third Market Board near Emberforge.
  - The right path-end Gold Exchange board was removed and replaced with the smaller Quest Board interactable, matching the latest placement request.
- Authenticated Phaser town interaction now uses proximity instead of distant click activation.
  - Pointer clicks/taps on world objects no longer open modals in game mode.
  - `E` opens only the current nearest interaction target in range.
  - Mobile Interact remains contextual and is shown only when the scene reports a nearby target.
  - NPC labels are clean text-only tags; hover emphasis is gated by proximity in game mode.
- World scale was rebalanced after the debug-visual cleanup.
  - Authenticated desktop town camera now uses a closer zoom floor.
  - Generated buildings, stalls, trees, and props render slightly larger from the manifest so they read better beside the 64px Hero.
- One reusable town asset/object manifest was added.
  - Manifest: `apps/web/src/game/config/townAssetManifest.ts`.
  - Defines source paths, render dimensions, origins, collision bodies, interaction anchors, interaction ranges, labels, and actions.
  - Every town object placement now declares `collidable`, `interactable`, and `debugVisible`.
  - Fountain is `collidable: true`, `interactable: false`, and remains decorative.
  - Generated 600x600 building canvases are now displayed at configured town-scale dimensions instead of raw image size.
- Town collision was implemented.
  - Player movement resolves against configured object bodies on X and Y separately.
  - Collision pushback now uses movement direction instead of object-center comparisons, preventing snap/teleport behavior when walking into infrastructure fronts.
  - Player body is a compact lower-body/feet rectangle.
  - Buildings collide around lower foundations; trees collide around trunks; props use compact footprints.
  - Collidable categories include buildings, tower, raid gate, market counters, boards, blackjack table, trees, rocks, fences, lamps, benches, barrels/crates, signposts, fountain, dock, boat, campfire, and NPC lower bodies.
- Prompt UX was updated.
  - Only one nearest prompt appears.
  - Prompt uses a premium `E` keycap plus the action label.
  - Normal player view does not render interaction radius circles, triangle markers, persistent rings, collision boxes, or generic target markers.
  - Debug collision boxes, proximity circles, and anchor triangles render only when `VITE_GAME_DEBUG=true`.
  - Placeholder NPC triangle/circle indicators were removed from the normal town view.
- Pixel-art rendering was tightened.
  - Phaser game config now uses `pixelArt: true`, `render.antialias: false`, and `render.roundPixels: true`.
  - Town and Hero textures are set to nearest-neighbor filtering at scene creation.
- Docs added.
  - `docs/TOWN_INTERACTION_SPEC.md`.
  - `docs/TOWN_COLLISION_SPEC.md`.
  - `docs/ASSET_PIPELINE.md`.
- Verification completed for this phase.
  - Latest `pnpm lint`: passing.
  - Latest `pnpm test`: passing, 94 tests.
  - Latest `pnpm build`: passing for shared, game-engine, web, admin, and Supabase checks. Vite still reports existing large-chunk warnings for web/admin bundles.
  - Latest `pnpm scan:frontend-secrets`: passing.

## Core Equipment Swap UX And Rules

- Core equipment slots are now protected by design.
  - Weapon, Armor, Relic, and Charm cannot be emptied.
  - Equipped slot cards no longer render `Unequip`.
  - Inventory and Hero / Loadout use `Change` actions that open slot-filtered replacement pickers.
- Inventory Equipment tab was cleaned up.
  - Layout is Active Hero summary, Equipped slots, optional replacement picker, then Owned Equipment.
  - Owned Equipment hides equipped items by default.
  - `Show Equipped Items` can reveal equipped items for review.
  - Empty replacement state reads: `No replacement equipment yet. Clear more stages, craft gear, or visit the Market Board.`
- Hero / Loadout Equipment tab was cleaned up.
  - Shows four equipped slots only by default.
  - No duplicate detail card renders unless a replacement flow is active.
  - Stats use current equipment totals.
- Swap flow implemented.
  - Replacement picker is filtered to the exact slot.
  - Replacement cards show rarity, level, bound/tradeable state, stats, and positive/negative stat deltas.
  - Confirmation shows the new item and states that the old item returns to Inventory.
  - Success notice uses: `<new item> equipped. <old item> returned to Inventory.`
- Server authority implemented.
  - Migration: `supabase/migrations/20260630000100_equipment_core_slot_swaps.sql`.
  - Private RPC: `private.swap_equipment_for_auth`.
  - Edge Function route: `swap-equipment`.
  - Browser route: `/api/inventory/swap`.
  - Legacy `unequip-item` now rejects core slot removal.
  - RPC validates ownership, exact slot match, existing current item, not-already-equipped replacement, one item per core slot after swap, and idempotency key reuse.
- Tests added.
  - `apps/web/src/components/panels/InventoryPanel.test.tsx`.
  - `packages/shared/src/equipmentRules.test.ts`.
  - `supabase/tests/supabase-first.test.ts` updated for swap RPC/source guards.
- Verification completed for this phase.
  - `pnpm lint`: passing.
  - `pnpm test`: passing, 71 tests.
  - `pnpm build`: passing for shared, game-engine, web, admin, and Supabase checks. Vite still reports existing large-chunk warnings for web/admin bundles.

## Raid Board Stage Selection And Asset Pass

- Raid Board was rebuilt from the old prototype panel into a stage-selection, lobby, and progression surface.
  - Component: `apps/web/src/components/panels/RaidPanel.tsx`.
  - Stage/progression data: `packages/game-engine/src/maps.ts`.
  - Spec: `docs/RAID_SYSTEM_SPEC.md`.
- Map 1 content is active as `Map 1: Solheart Outskirts`.
  - Stages: `1-1` through `1-10`.
  - Account levels: 1 through 10.
  - Boss stage: `1-10 Solheart Sentinel`.
  - Map 2 and Map 3 exist as locked progression data only.
- Horizontal Raid Board scrolling was removed.
  - The old `.wave-strip` implementation was removed from the component and stylesheet.
  - Stage cards paginate with arrows.
  - Desktop shows 5 cards per page, compact/tablet layouts show 3, and phone widths show 1.
  - Wave preview is now an expandable vertical list with enemy portraits.
- Original local Raid Board PNG assets were generated.
  - Generator: `scripts/generate-raid-board-assets.mjs`.
  - Asset root: `apps/web/public/assets/raids/`.
  - Chapter banners: `solheart-outskirts-banner.png`, `emberfall-reach-locked.png`, `stormpeak-aerie-locked.png`.
  - Stage thumbnails: 10 Map 1 thumbnails under `stages/`.
  - Enemy portraits: Sproutling, Ember Mite, Briar Crawler, Glass Beetle, Mist Wisp, Ash Hound, Rune Warden, Shard Golem, Storm Sentinel, and Solheart Sentinel.
  - Boss portrait: `enemies/solheart-sentinel.png`.
  - Reward icons: Earned Gold, XP Crystal, Tower Shard, Moss Thread, Ember Core, Tidal Pearl, Starlit Dust, Chest Reward, Rare Chest Reward, and Boss Chest Reward.
  - Source notes: `apps/web/public/assets/raids/source/README.md`.
- Screenshot previews generated for review.
  - `tmp/raid-board-stage-grid.png`.
  - `tmp/raid-board-selected-stage.png`.
- Server-authoritative raid access was tightened in Supabase Edge Functions.
  - `create-lobby` checks stage access before insert.
  - `join-lobby` checks lobby status, capacity, and stage access before membership upsert.
  - `start-prototype-raid` checks stage access and requires the current player to be the lobby host when a lobby id is supplied.
  - Group starts require all non-host lobby members to be ready; solo host starts remain valid.
- Tests added or updated.
  - `packages/game-engine/src/maps.test.ts`: stage progression and pagination rules.
  - `apps/web/src/components/panels/RaidPanel.test.tsx`: rendered stage thumbnails, selected-stage preview, enemy portraits, and boss portrait.
  - `apps/web/src/ui-assets.test.ts`: local Raid Board asset resolution and PNG dimensions.
  - `supabase/tests/supabase-first.test.ts`: source guard for server-side raid access checks.
- Verification completed for this phase.
  - `pnpm lint`: passing.
  - `pnpm test`: passing, 64 tests.
  - `pnpm build`: passing for shared, game-engine, web, admin, and Supabase checks. Vite still reports existing large-chunk warnings for web/admin bundles.
  - `pnpm scan:frontend-secrets`: passing.
- Out of scope for this pass.
  - No new raid combat runtime was added.
  - No Supabase migration was needed or run.
  - No Edge Functions were deployed in this local UI/code pass.

## Environment Art Replacement

- Placeholder town environment art was audited and replaced with a first production-ready pixel-art asset batch.
  - Audit: `docs/ENVIRONMENT_ASSET_AUDIT.md`.
  - Generator: `scripts/generate-town-environment-assets.mjs`.
  - Asset root: `apps/web/public/assets/soltower/environment/`.
- New world ground and reusable tile assets were generated.
  - `ground/town-ground.png`: 1600x1000 full town ground layer.
  - `ground/grass-tile.png`: 128x128 grass tile.
  - `ground/cobble-path-tile.png`: 128x64 cobble tile.
- New transparent structure sprites were generated.
  - `solheart-tower.png`, `raid-portal.png`, `moonpetal-market.png`, `lanternroot-tavern.png`, `emberforge.png`, `quest-grove.png`, and `blacksmith.png`.
- New transparent prop sprites were generated.
  - Trees, bushes, rocks, lamp post/glow, benches, barrels/crates/sacks, fences, signposts, quest board, market stall, fountain, dock, boat, and campfire.
- `TownScene` now preloads the environment asset manifest and places environment sprites through `placeWorldObject`.
  - Removed the old flat world rectangle and diamond grass tile field from active rendering.
  - Replaced primitive path/plaza geometry with the baked pixel-art `town-ground.png` layer.
  - Replaced primitive tower, portal, buildings, market stalls, trees, lamps, benches, quest board, and props with PNG sprites.
  - Interaction positions now use per-object anchors and proximity ranges.
  - Camera framing and player movement bounds were preserved.

## Hero Sprite Sheet Production Normalization

- Movement control update.
  - Desktop: holding `Shift` while moving now runs.
  - Mobile: authenticated town now has a movement pad; inner drag walks and outer-ring drag runs.
  - HUD and Settings shortcut hints include `Shift Run`.
- Storm Archer idle sheet regenerated from the new direction reference PNGs.
  - Path: `apps/web/public/assets/soltower/heroes/storm-archer/idle.png`.
  - Size: 256x256.
  - Frames: 64x64.
  - Direction rows: down, left, right, up.
  - Sources: `walk-bottom.png`, `walk-top-left.png`, `walk-right.png`, and `walk-top.png`.
  - Generator: `scripts/generate-storm-archer-idle-from-refs.mjs`.
  - Background: transparent PNG after black-keying and foreground normalization.
  - Town runtime: Storm Archer idle now uses this sheet through an explicit cache-busted path.
- Storm Archer 8-direction walking sheet generated.
  - Path: `apps/web/public/assets/soltower/heroes/storm-archer/walk-8dir.png`.
  - Size: 256x512.
  - Frames: 64x64.
  - Layout: 8 direction rows x 4 walking columns.
  - Row order: top-left, left, bottom-left, top, top-right, right, bottom-right, bottom.
  - Background: transparent PNG.
  - Generator: `scripts/generate-storm-archer-8-direction-walk.mjs`.
  - Source: `apps/web/public/assets/soltower/heroes/storm-archer/profile.png`.
  - Video test sources: all eight rows are currently extracted from `apps/web/public/assets/soltower/heroes/storm-archer/walk-top-left.mp4`, `apps/web/public/assets/soltower/heroes/storm-archer/walk-left.mp4`, `apps/web/public/assets/soltower/heroes/storm-archer/walk-bottom-left.mp4`, `apps/web/public/assets/soltower/heroes/storm-archer/walk-top.mp4`, `apps/web/public/assets/soltower/heroes/storm-archer/walk-top-right.mp4`, `apps/web/public/assets/soltower/heroes/storm-archer/walk-right.mp4`, `apps/web/public/assets/soltower/heroes/storm-archer/walk-bottom-right.mp4`, and `apps/web/public/assets/soltower/heroes/storm-archer/walk-bottom.mp4`, black-keyed to transparent, and normalized into 64x64 frames.
  - Video-backed rows preserve disconnected lower-foot/boot pixels inside the 64x64 frame instead of applying the legacy generated-row foot cleanup or largest-component-only masking.
  - The top-right, right, bottom-right, and bottom rows use direction-specific source frames `[0, 6, 12, 18]` to preserve readable 4-frame walk cycles.
  - Town runtime: Storm Archer now uses this sheet for walking movement; idle/run/attack remain on the standard action sheets.
- Storm Archer source references were saved into the repository and normalized into production sheets.
  - `apps/web/public/assets/soltower/heroes/source/storm-archer-idle-source.png`
  - `apps/web/public/assets/soltower/heroes/source/storm-archer-walk-source.png`
  - `apps/web/public/assets/soltower/heroes/source/storm-archer-run-source.png`
  - `apps/web/public/assets/soltower/heroes/source/storm-archer-attack-source.png`
- All current Hero world sprites now use the same production spritesheet standard.
  - Per-frame size: 64x64.
  - Per-sheet size: 256x256.
  - Action sheets per Hero: `idle.png`, `walk.png`, `run.png`, `attack.png`.
  - Direction rows: down, left, right, up.
  - Animation columns: frame-1, frame-2, frame-3, frame-4.
  - Phaser origin/anchor recommendation: `{ x: 0.5, y: 0.88 }`.
  - Final sheets are transparent PNG.
- Legacy mixed-size world sheets were removed from the active asset set.
  - No active `town-spritesheet.png` files remain under `apps/web/public/assets/soltower/heroes/`.
  - No active `fallback-spritesheet.png` remains under `apps/web/public/assets/soltower/heroes/shared/`.
- Manifest and Phaser runtime updated.
  - `packages/shared/src/heroAssetManifest.ts` now exposes `worldSpritePaths` for `idle`, `walk`, `run`, and `attack`.
  - `TownScene` preloads every Hero action sheet plus per-action world customization layers.
  - Authenticated town currently switches between `idle` and `walk`; `run` and `attack` are loaded and game-ready for later gameplay states.
- Dev preview updated.
  - Route: `http://localhost:5173/assets/soltower/heroes/source/hero-preview.html`.
  - Shows Hero name, sprite dimensions, action controls, animated playback, and the frame grid.
  - Browser QA confirmed 5 Hero cards, 4 action controls, 256x256 loaded grids, no horizontal overflow, and no console errors.
- Verification for this normalization pass.
  - `pnpm lint`: passing.
  - `pnpm test`: passing, 46 tests.
  - `pnpm build`: passing for shared, game-engine, web, admin, and Supabase static checks. Vite still reports existing large-chunk warnings for web/admin bundles.
  - `pnpm scan:frontend-secrets`: passing.
- Out of scope for this pass.
  - No Supabase migrations were needed or run.
  - No Edge Functions were changed or deployed.
  - No new gameplay systems were added.
  - No terrain, building, NPC, enemy, boss, or combat VFX asset pass was generated.

## Critical UI Cleanup And First Hero Character Asset Pass

- UI active/focus cleanup implemented.
  - The idle HUD profile no longer uses a persistent thick cyan/blue active border.
  - Default HUD cards, profile affordances, modal icon badges, tab states, and Hero portrait framing were toned down to dark glass, neutral borders, and restrained gold accents.
  - Keyboard accessibility is preserved through `:focus-visible` and the shared elegant focus ring instead of always-on active styling.
- Text collision and spacing cleanup implemented.
  - Cosmetics metadata/control rows now use grid/flex wrapping with `min-width: 0`, gaps, and mobile collapse behavior.
  - Hero stat cards, inventory item cards, modal headers, HUD profile layout, and shortcut hints were tightened to avoid cramped text and horizontal overflow.
  - Browser QA found no horizontal overflow at 1440x900, 1024x768, 390x844, or 375x812.
- First Hero character asset pass generated.
  - Generator: `scripts/generate-hero-character-assets.mjs`.
  - Manifest: `packages/shared/src/heroAssetManifest.ts`.
  - Preview route: `http://localhost:5173/assets/soltower/heroes/source/hero-preview.html`.
  - Generated assets live under `apps/web/public/assets/soltower/heroes/`.
  - Heroes covered: Storm Archer, Tide Mage, Bombardier, Coral Alchemist, Starcaller.
  - Shared fallback files: `shared/fallback-silhouette.png`, `shared/fallback-idle.png`, `shared/fallback-walk.png`, `shared/fallback-run.png`, and `shared/fallback-attack.png`.
  - Each Hero has `icon.png`, `portrait.png`, `idle.png`, `walk.png`, `run.png`, `attack.png`, portrait layers, and per-action world layers.
- Sprite layout documented and tested.
  - Frame size: 64x64.
  - Sheet size: 256x256.
  - Action sheets: idle, walk, run, attack.
  - Columns: frame-1, frame-2, frame-3, frame-4.
  - Rows: down, left, right, up.
  - Origin/anchor: `{ x: 0.5, y: 0.88 }`.
- Hero identity integration implemented.
  - HUD profile, town player sprite, Inventory active Hero card, Cosmetics preview, Hero / Loadout overview, Profile summary, Settings account card, lobby member strip, Friends list, and chat fallback now use selected Hero visuals.
  - The town player renderer now loads Hero sprites and tint-safe layers from the manifest rather than drawing the active player as a triangle/circle placeholder.
  - Existing players receive normalized safe default appearance values for their selected Hero without duplicating Gold, Heroes, wallet records, market data, quest data, or inventory data.
- Customization options visible in Inventory > Cosmetics.
  - Hair style, hair color, skin tone, outfit variant, accent color, cloak/back accessory, and weapon accent update the live Hero preview immediately.
  - Browser QA verified Hair `Crest` and Accent Color `Starlit Violet` update the visible preview state.
- Browser QA completed locally on `http://localhost:5173/`.
  - 1440x900: HUD Hero portrait loaded, desktop keycaps visible, Cosmetics modal fit, no text/control overlap, no horizontal overflow.
  - 1024x768: HUD Hero portrait loaded, compact/mobile rail path used, desktop shortcut hint hidden, Cosmetics modal fit, no horizontal overflow.
  - 390x844: HUD Hero portrait loaded, mobile shortcut simplification active, Cosmetics modal fit, no horizontal overflow.
  - 375x812: HUD Hero portrait loaded, mobile shortcut simplification active, Cosmetics modal fit, no horizontal overflow.
  - Hero preview route loaded 5 cards and 10 images with no unloaded images and no console errors.
- Verification for this phase.
  - Focused web suite: `pnpm --filter @soltower/web test -- --runInBand` passed, 34 tests.
  - `pnpm lint`: passing.
  - `pnpm test`: passing, 46 tests.
  - `pnpm build`: passing for shared, game-engine, web, admin, and Supabase static checks. Vite still reports existing large-chunk warnings for web/admin bundles.
  - `pnpm scan:frontend-secrets`: passing.
- Out of scope for this phase.
  - No Supabase migrations were needed or run.
  - No Edge Functions were changed or deployed.
  - No wallet, market, quest, onboarding, economy, or admin architecture was rewritten.
  - No full town terrain, building, NPC portrait, raid map, enemy, boss, or combat effect asset pass was generated.
  - Cosmetic appearance persistence is currently local client storage only; backend-persisted cosmetics remain a later phase.

## Production UI Polish, Asset Pass, And Market Board V2

- Redundancies removed.
  - Authenticated-town dialogs now use one shared header pattern with icon badge, eyebrow, title, subtitle, and top-right close control.
  - Repeated title/eyebrow blocks and redundant modal action rows were removed from the main NPC modal shell.
  - Inventory, Quest Journal, Settings, Hero / Loadout, and Market Board each use one primary tab strip.
  - Market Board no longer shows browse, sell, order, activity, and feed content at the same time.
- Dialogs cleaned up.
  - Inventory: Equipment, Consumables, Materials, and Cosmetics tabs with generated item icons, rarity frames, bound/tradeable labels, and a clean empty state.
  - Hero / Loadout: Overview, Equipment, Stats, and Compare tabs with generated Hero and item icons plus grouped stat sections.
  - Quest Journal: Daily, Weekly, and Achievements tabs with progress cards, reward chips, claim states, server UTC, and live reset countdowns.
  - Settings: Audio, Motion, Accessibility, Controls, and Account tabs with persistent local settings.
  - Market Board: Browse, Sell Gold, Buy Orders, My Activity, and Live Feed tabs.
  - Profile / wallet menu: active Hero icon, wallet copy, quick links, Disconnect Wallet, Log Out to Landing, and confirmation dialogs.
- Shortcut hints polished.
  - Town HUD and Settings > Controls render `W`, `A`, `S`, `D`, `E`, `I`, `Q`, and `Esc` as premium keycaps instead of plain text.
- Assets generated.
  - UI icons: `apps/web/public/assets/ui/icons/`.
  - Item icons and rarity frames: `apps/web/public/assets/items/`.
  - Hero icons: `apps/web/public/assets/heroes/icons/`.
  - Currency icons: `apps/web/public/assets/currencies/`.
  - Shared manifest: `packages/shared/src/uiAssetManifest.ts`.
  - Generator script: `scripts/generate-ui-audio-assets.mjs`.
- Audio generated.
  - UI sounds: `apps/web/public/assets/audio/ui/`.
  - Ambience loops: `apps/web/public/assets/audio/ambience/`.
  - Music loop: `apps/web/public/assets/audio/music/`.
  - Audio is lightweight local synthesized WAV and is controlled through Settings volume/mute preferences.
- Quest reward tuning implemented in code.
  - Shared reward config added in `packages/shared/src/questRewards.ts`.
  - Migration added: `supabase/migrations/20260629000500_quest_reward_rebalance.sql`.
  - The migration was not pushed to hosted Supabase in this UI/product pass; hosted Supabase activation from the prior phase remains unchanged.
  - Daily rewards: First Defense 4 EG/60 XP, Tower Watch 5/70, Party Up 6/90, Skill in Motion 4/65, Bossbound 6/100, Steady Defender 4/60.
  - Weekly rewards: Full Crew 20 EG/300 XP, Tower Vanguard 18/260, Veteran of SolBloom 22/340.
- Market Board V2 behavior implemented.
  - Browse shows active listings with seller, Gold amount, price per Gold, total price, timestamp, and buy action.
  - Sell Gold previews gross `$TOWER (DEV)`, 10% tax, and seller receives.
  - Buy Orders shows public orders, escrow, fulfill action, and create-order fields.
  - My Activity is scoped to the current account.
  - Live Feed combines readable listings, readable buy orders, and readable trades with filters for All, Listings, Sales, Buy Orders, and Fills.
  - Supabase Realtime subscriptions invalidate market queries for readable listing/order/trade changes.
  - Current caveat: global fill events are not fully available until a public market feed view or policy is added; the Fills filter can show an empty state.
- Timer fix implemented.
  - Quest Journal fetches authoritative server time once, computes a client offset, and ticks displayed server UTC plus daily/weekly reset countdowns every second without polling every second.
- Settings additions implemented.
  - Audio sliders and mute toggles persist locally and apply immediately.
  - Motion, accessibility, controls, and account/session tools are available in one modal.
  - Disconnect and Log Out actions use confirmation dialogs and preserve profile data.
- Local verification for this phase.
  - `pnpm --filter @soltower/web test -- --runInBand`: passing, 28 web tests.
  - `pnpm lint`: passing.
  - `pnpm test`: passing, 40 tests.
  - `pnpm build`: passing for shared, game-engine, web, admin, and Supabase static checks.
  - `pnpm scan:frontend-secrets`: passing.
  - Browser QA: passing locally on `http://localhost:5173/`.
    - 1440x900: authenticated HUD rendered, keycaps showed W/A/S/D/E/I/Q with border/glow/shadow styling, no horizontal overflow, and no console errors.
    - 1440x900: Inventory, Market Board, Settings, and Profile panels rendered with one tab strip where applicable and no horizontal overflow.
    - 1440x900: Market Sell Gold showed gross 200 `$TOWER (DEV)`, tax 20, and seller receives 180 for the default 100 Gold at 2.
    - 390x844: desktop town keycap hint was hidden, HUD balances fit, Inventory modal fit within viewport, and no horizontal overflow or console errors were observed.
- Out of scope for this phase.
  - No wallet auth rewrite.
  - No Supabase auth architecture rewrite.
  - No new core game systems.
  - No final full town-core environment art.
  - No hosted Supabase reset or linked reset command was run.

## Authenticated Town Gameplay UX And Quest Phase

- Camera behavior implemented.
  - Public landing keeps cinematic fixed framing.
  - Spectate keeps free drag/pinch/wheel camera and no player control.
  - Authenticated SolBloom Village now follows the active selected Hero with rounded, clamped camera scroll and mobile-safe framing.
  - Settings includes `Center Camera`, which recenters the camera on the active Hero.
- Keyboard shortcuts implemented through a centralized React input governor.
  - `W A S D` / arrows move only in authenticated town mode.
  - `E` interacts with the nearest eligible target.
  - `I` opens/closes Inventory.
  - `Q` opens/closes Quest Journal.
  - `Escape` closes the topmost modal/panel and exits Spectate where applicable.
  - Editable fields, selects, contenteditable, IME composition, wallet UI, and active React modals block gameplay shortcuts except safe close behavior.
  - Opening panels clears held movement keys.
- Interaction targets implemented.
  - Captain Rook -> Raid Lobby.
  - Mira the Broker -> Auction House.
  - Gold Market Boards left/right -> Gold Exchange.
  - Emberforge -> Blacksmith / Equipment.
  - Lady Vesper -> Blackjack.
  - Quest Board -> Quest Journal.
  - Raid Portal -> Raid Lobby entry.
  - Lanternroot Tavern -> Friends / chat.
  - Event Board remains as an existing placeholder event interaction.
  - Desktop shows contextual world prompts; mobile shows a bottom-rail contextual interaction button when in range.
- Inventory implemented as a tabbed modal.
  - Tabs: Equipment, Consumables, Materials, Cosmetics.
  - Equipment shows active selected Hero, slots, stats, rarity borders, and secure equipment actions.
  - Consumables show MVP consumable definitions and quantities.
  - Materials currently show the polished empty state.
  - Cosmetics show active Hero appearance categories and a disabled placeholder customization button.
- Quest Journal implemented as a tabbed modal.
  - Tabs: Daily Quests, Weekly Quests, Achievements.
  - Reads hosted server-backed quest assignment/progress data.
  - Shows server UTC reset information.
- Quest backend implemented.
  - Added migration `20260629000400_quest_system.sql`.
  - Added tables for quest definitions, assignments, progress events, achievement state, and reward claims.
  - Added private RPCs for atomic progress and idempotent reward/achievement claims.
  - Added Edge Functions:
    - `get-player-quests`
    - `claim-quest-reward`
  - Updated and redeployed raid functions so verified prototype raid history advances quest progress:
    - `start-prototype-raid`
    - `finalize-prototype-raid`
- Hosted Supabase results for this phase.
  - Linking: already linked and usable.
  - Migration inspection: `supabase migration list --linked` showed only `20260629000400` pending.
  - Dry run: `supabase db push --linked --dry-run` listed only `20260629000400_quest_system.sql`.
  - Migration push: succeeded for `20260629000400_quest_system.sql`.
  - Seed data: no new seed file was run in this phase.
  - Edge Functions deployed: `get-player-quests`, `claim-quest-reward`, `start-prototype-raid`, `finalize-prototype-raid`.
  - Hosted smoke passed:
    - public world status invocation.
    - spectator RLS/mutation rejection.
    - invalid signature and nonce replay rejection.
    - profile bootstrap.
    - direct balance update no-op under RLS.
    - daily quest assignment.
    - quest progress from verified prototype raid.
    - idempotent quest reward claim.
- Browser QA passed locally on `http://localhost:5174/`.
  - 1440x900: authenticated canvas rendered, camera kept player visible after moving in all directions, Inventory/Quest/Settings worked, no horizontal overflow.
  - 390x844: mobile rail visible, desktop hint hidden, Inventory modal fit, no horizontal overflow.
  - 375x812: mobile camera kept Marky visible, contextual interaction button appeared, balances fit without page overflow.
- Placeholder-only after this phase.
  - Final town buildings, final terrain, NPC portraits, audio, and combat sprite sheets are still placeholders.
  - Party Up, Full Crew, and Skill in Motion are defined but not assigned until verified party/skill event streams exist.
  - Materials collection is empty.
  - `Customize Active Hero` is present as a disabled placeholder.

## Landing, Spectate, And Wallet Onboarding Phase

- Root landing route: complete in `apps/web`.
  - Full-viewport live Phaser SolBloom Village background.
  - Original shape-built Solheart Tower, plaza, portal, buildings, props, lighting, particles, and demo guardians.
  - Responsive desktop/mobile camera framing and reduced-motion/mobile effect reductions.
  - Hosted backend-derived DEV world and seeded/demo presence counts; no fabricated player, price, volume, or token metrics.
- Spectate mode: complete.
  - Marketing content is removed while spectating.
  - Minimal logo, Exit Spectate, and Play Now overlay.
  - Bounded drag/keyboard pan, wheel/trackpad zoom, and touch drag/pinch implementation.
  - NPC selection produces a wallet-entry prompt.
  - No player HUD, protected menus, profile, inventory, market, Blackjack, chat, lobby, or mutation controls are mounted for spectators.
- Wallet onboarding: complete for injected-provider MVP support.
  - Phantom, Solflare, Backpack, OKX Wallet, and generic injected Solana provider detection.
  - DEV Mock Wallet is shown only outside production.
  - Focus trap, Escape close, safe-area spacing, internal mobile scroll, 48px+ commands, loading, retry, and error states.
  - Login requests only a clear-text ownership signature.
- First-time player flow: complete and hosted-verified.
  - Signature verification now precedes display-name and character setup.
  - Name availability is read from hosted Supabase.
  - `create-player-profile` requires consumed, unexpired wallet proof.
  - Existing RPC grants Storm Archer, starter gear, Tower 1-1, and exactly 50 Locked Gold once.
- Returning player flow: complete and hosted-verified from a fresh anonymous session.
  - Stale temporary auth mapping is rotated only after valid wallet proof.
  - Existing profile and real balances load without duplicate rewards.
- Authenticated town: complete for the current MVP panels.
  - Actual profile, wallet, level, balances, hero, Power, maps, sell capacity, and Blackjack tier load from Supabase.
  - Disconnect ends the local session and returns to the landing page without deleting or unlinking profile data.

## Hosted Product-Phase Results

- No database migrations, resets, pulls, or schema architecture changes were run in this phase.
- Updated Edge Functions deployed successfully:
  - `verify-wallet-signature`
  - `create-player-profile`
  - `get-player-bootstrap-data`
- Hosted onboarding smoke: passed.
  - Public world status invocation succeeds with anon key.
  - Spectator inventory returns no rows under RLS.
  - Spectator market mutation is rejected.
  - Invalid wallet signature is rejected.
  - Consumed nonce replay is rejected.
  - Deterministic DEV smoke guardian exists with one 50 Locked Gold starter ledger entry.
  - Repeated profile creation returns the same player and does not duplicate Gold.
  - A second fresh anonymous session reclaims the linked profile as a returning player.
  - Player bootstrap returns the linked hosted profile.
- Nonce expiry: five-minute issuance and expiry rejection remain covered by Edge Function guard tests; the hosted suite does not wait five real minutes.
- Browser QA passed at 1280x720 and 390x844.
  - Phaser canvas rendered nonblank at exact viewport dimensions.
  - No horizontal overflow or console errors.
  - Spectate drag and wheel zoom visibly changed the world frame.
  - NPC spectator gating, wallet modal, Escape close, returning Marky flow, authenticated HUD/profile, and disconnect were exercised.
- Real wallet extensions installed in the in-app test browser: none.
  - All five provider detection branches are covered by automated tests.
  - DEV Mock returning flow was exercised against hosted Supabase.
  - Live extension approval/signature UX still requires manual testing in browsers with each wallet installed.

## Completed In This Phase

- Missing private env files were created from the root `.env` without printing secret values:
  - `apps/web/.env.local`
  - `apps/admin/.env.local`
  - `supabase/functions/.env.local`
- Frontend env files contain only browser-safe Vite values.
- `supabase/functions/.env.local` contains local Edge Function development values and a local wallet nonce secret.
- `supabase/functions/.env.hosted.local` contains only custom hosted Edge Function secrets/URLs for later `secrets set`; it does not include Supabase platform keys.
- `.gitignore` now explicitly ignores root env files, app env files, function env files, and Supabase temp link metadata.
- Supabase CLI was installed as a project-local root dev dependency (`supabase`), not as a global package.
- Hosted project ref was derived from the Supabase URL and stored locally in ignored Supabase temp metadata without printing private env values.
- Migration ordering was inspected locally and against the linked hosted project:
  - `20260629000100_initial_soltower.sql`
  - `20260629000200_supabase_first_mvp.sql`
  - `20260629000300_private_schema_edge_access.sql`
- Frontend source, Vite config, frontend env files, and browser bundles were scanned for service-role/server-only exposure.

## Hosted Supabase Activation Status

- Hosted Supabase linking: succeeded for the `sol-tower` hosted project using the project-local Supabase CLI.
- Migration inspection: succeeded. The hosted migration table was inspected before applying changes, and `db push --dry-run` showed the expected pending local migrations with no remote conflict.
- Migrations pushed: yes.
  - `20260629000100_initial_soltower.sql`
  - `20260629000200_supabase_first_mvp.sql`
  - `20260629000300_private_schema_edge_access.sql`
- Seed data inserted into hosted Supabase: yes, using idempotent DEV seed data.
  - Marky: level 10, 300 Earned Gold, 50 Locked Gold, 250 Test Token.
  - Tower 1-1 through Tower 1-3 unlocked.
  - Storm Archer and starter equipment seeded.
  - Starter ledger rows inserted.
  - DEV admin accounts seeded through the DEV seed file only.
- Edge Function secrets configured in hosted Supabase: yes. Custom hosted function secrets were set from the private custom-only env file without printing values.
- Edge Functions deployed: yes.
  - `accept-friend-request`
  - `admin-bootstrap`
  - `admin-config-action`
  - `admin-economy-action`
  - `admin-market-action`
  - `admin-moderation-action`
  - `admin-player-action`
  - `blackjack-double-down`
  - `blackjack-hit`
  - `blackjack-stand`
  - `block-player`
  - `buy-bound-shop-item`
  - `buy-market-listing`
  - `cancel-buy-order`
  - `cancel-market-listing`
  - `create-buy-order`
  - `create-lobby`
  - `create-market-listing`
  - `create-player-profile`
  - `create-wallet-nonce`
  - `equip-item`
  - `fill-buy-order`
  - `finalize-prototype-raid`
  - `get-player-bootstrap-data`
  - `join-lobby`
  - `kick-lobby-player`
  - `leave-lobby`
  - `select-town-server`
  - `send-chat-message`
  - `send-friend-request`
  - `set-ready-state`
  - `start-blackjack-hand`
  - `start-prototype-raid`
  - `unequip-item`
  - `verify-wallet-signature`
- Hosted smoke tests run: yes.
  - Marky seed exists.
  - Marky balances match the requested DEV values.
  - Starter ledger exists.
  - Tower unlocks and starter equipment exist.
  - Public spectator cannot mutate balances.
  - RLS blocks direct authenticated balance updates.
  - A safe Edge Function invocation succeeds.
  - Wallet verification links Marky.
  - Player bootstrap returns required server-side data.
  - Frontend anon key can read allowed public data without service-role exposure.
- Supabase config push note: `pnpm exec supabase config push` reported a hosted storage vector-bucket paid-tier warning, but Auth anonymous sign-in and API schema changes needed for the smoke tests were applied and verified.
- Edge Function deploy note: the CLI warned Docker was not running, but hosted function deployment succeeded.

## Town Chat And Server Channels

- Implemented authenticated town chat in `apps/web` with a desktop bottom-left HUD, mobile Chat rail button, and mobile modal.
- Chat input fields are marked with `data-game-input="text"` and Phaser global keyboard capture is disabled, so `W`, `A`, `S`, `D`, `E`, `I`, and `Q` remain typeable in focused text fields.
- Sent local chat messages render as a compact bubble above the active Hero and fade after roughly 4-5 seconds.
- The chat HUD shows the latest 10 messages for the active town server.
- Added five fixed town servers: `solbloom-1` through `solbloom-5`, each capped at 40 active players.
- Added and pushed hosted migration `20260630000500_town_chat_servers.sql`.
  - Adds `chat_messages.town_channel`.
  - Adds town-channel constraints for `chat_messages` and `player_presence`.
  - Adds indexes for chat by server and presence by server.
- Deployed hosted Edge Functions:
  - `send-chat-message` version 2.
  - `select-town-server` version 1.
- Docker was still not running locally during function deploy, but the Supabase CLI reported both hosted deployments succeeded.

## Current Supabase MVP State In Code

- MVP backend architecture is Supabase-first.
- `apps/web` routes legacy `/api/...` UI calls to Supabase Auth, RLS reads, and named Supabase Edge Functions instead of `localhost:4000`.
- `apps/admin` uses Supabase Auth email/password and admin Edge Functions instead of Fastify cookie login.
- `private` schema migration includes wallet nonce state, hidden Blackjack state, transactional ledger RPCs, market/buy-order RPCs, inventory/map/raid/trade tables, and RLS policies.
- Direct browser profile update policy from the initial migration is dropped in the Supabase-first migration so profile mutations can move through Edge Functions.
- Fastify/Socket.IO is isolated as legacy code in `apps/server`; it is not active in `pnpm-workspace.yaml`.
- Prisma/SQLite is legacy reference only and is not an active source of truth.

## Verification Results

- `pnpm lint`: passing.
- `pnpm test`: passing, 120 tests across React behavior, town input/camera guards, wallet boundary checks, market UI checks, asset checks, quest reward balance checks, Starlight Vault checks, and Supabase security guards.
- `pnpm build`: passing for shared, game-engine, web, admin, and Supabase function static checks.
- Frontend bundle secret scan: passing; no service-role identifier, `service_role` literal, or actual local service-role value found in `apps/web/dist` or `apps/admin/dist`.
- Supabase migration list confirms local and remote are aligned through `20260630000500`.
- Vite warns the player and admin bundles are large and should be code-split later. The player build also reports a third-party Rollup pure-annotation warning from the Reown dependency tree.

## Starlight Vault Reward Presentation

- Removed the developer-facing Asset Registry and local asset-path diagnostics from the player Starlight Vault.
- Reward cards now expose a keyboard-accessible hover/focus preview with rarity drop chance, reward-type strength profile, specialty, and duplicate material return.
- Costumes are presented as full visual sets with collection prestige and Wardrobe Thread duplicate value; they do not claim combat bonuses.
- The featured reward spotlight shows the same reward advantage profile without requiring hover.
- Verification: focused Starlight Vault tests pass (4/4), `pnpm lint` passes, and `pnpm build` passes.

## Hosted DEV Blackjack Practice Mode

- Hosted migration `20260703000100_blackjack_practice_mode.sql` is applied.
  - Practice hands allow exactly `0` wager and `0` total wager.
  - Paid hands still require a positive wager.
- Hosted Edge Function environment is explicitly set to `APP_ENV=development`.
- Practice mode remains server-authoritative:
  - The server rejects practice requests outside development/test mode.
  - Practice deals do not debit Gold.
  - Wins, pushes, and double-down actions do not credit or debit Gold.
  - Production mode restores the normal Earned/Locked Gold wager flow.
- Deployed hosted functions:
  - `get-player-bootstrap-data` version 5.
  - `start-blackjack-hand` version 4.
  - `blackjack-hit` version 4.
  - `blackjack-stand` version 4.
  - `blackjack-double-down` version 4.
- Migration push initially stopped on a pre-existing Starlight Vault pool uniqueness conflict. The seed was corrected to use the actual `(banner_id, reward_id)` uniqueness key, then the migration push completed without a reset.
- Hosted migration list is aligned through `20260703000200`.
- Verification: Blackjack UI tests pass (3/3), web lint passes, and the web production build passes.
- Authenticated browser deal smoke test was not rerun because the browser session returned to the landing screen after refresh; reconnecting the wallet and reopening Lady Vesper's table should now show `DEV Practice Table`, `0 Gold` entry, and `0 Gold` rewards.

## Player Session Persistence

- Blackjack hand history remains stored in `private.blackjack_hands` and is loaded from the server whenever Lady Vesper's table mounts or the browser regains focus.
- User-scoped Blackjack query data is cleared on wallet logout so a later wallet cannot inherit another player's cached history.
- Hosted migration `20260704000100_player_town_position.sql` is applied.
  - Adds bounded `world_x`, `world_y`, and facing coordinates to `player_presence`.
  - Existing players receive the safe plaza spawn once; later movement replaces it with their last saved location.
- Player movement snapshots are throttled to one server write per second and the final position is flushed when Phaser shuts down during refresh/navigation.
- Bootstrap restores the saved position after refresh and future wallet logins.
- Collision-invalid saved coordinates fall back to the safe plaza spawn instead of placing a player inside water or a structure.
- Position writes are authenticated, Zod-validated, world-bounded, and handled by the `save-town-position` Edge Function rather than direct browser table updates.
- Hosted functions deployed:
  - `get-player-bootstrap-data`.
  - `save-town-position`.
- Verification: 52 focused web tests pass, 15 Supabase architecture tests pass, and lint passes.

## Town Background Music

- The supplied `Starlight Vault Walk.mp3` is the authenticated SolBloom town background track.
- Town music uses one persistent `HTMLAudioElement`, loops automatically, and is not recreated when opening panels or switching UI tabs.
- Browser tab visibility changes do not pause or restart the track.
- Autoplay rejection is handled by retrying on the next player click, touch, or key press.
- Existing master/music volume and mute controls apply to the track.
- Leaving the authenticated town pauses the track so it does not play in landing, logout, or future dungeon/raid scenes.
- Verification: lint, production build, the supplied-MP3 asset test, and the persistent town-music lifecycle test pass.
- The broader `ui-assets.test.ts` dimensions have since been updated for the current production assets, and the full `pnpm test` run now passes.

## Private Env Ignore Verification

`git check-ignore -v` confirms these files are ignored:

- `.env`
- `.env.local`
- `.env.*.local`
- `apps/web/.env.local`
- `apps/admin/.env.local`
- `supabase/functions/.env.local`
- `supabase/functions/.env.hosted.local`
- `supabase/.temp/project-ref`

## Manual Command Needed

None for Supabase CLI login or project linking. Hosted activation is complete for the current Supabase MVP phase.

## Next Phase Readiness

The Landing Page, Spectate Mode, and Play Now wallet onboarding phase is implemented and hosted-verified for DEV_MODE. The next product task should replace shape-built placeholder art with an original production asset kit and manually certify Phantom, Solflare, Backpack, and OKX approval/signature behavior on desktop and mobile before a production launch.

## Realtime Multiplayer And Playable Raid Pass

- Fixed the Vite transform error in `apps/web/src/game/TownScene.ts`; the shared type import list was missing a comma before `TownRealtimePlayer`.
- Added Supabase Realtime town multiplayer:
  - Presence is scoped to the selected SolBloom server.
  - Online counts now prefer live Supabase Presence data instead of stale database rows.
  - Movement is broadcast at a throttled 125 ms cadence and interpolated inside Phaser so other players move smoothly without forcing React rerenders per packet.
  - Presence is keyed by browser session and deduped by player ID so refreshes do not leave duplicate online players in the normal view.
- Added player position continuity:
  - The latest valid town position is cached locally by player/server and still saved to the server through the existing authenticated `save-town-position` path.
  - Refresh/login restores the closest valid saved position instead of always returning to the plaza spawn.
- Added playable raid flow from the Raid Board:
  - The host `Start Raid` action opens a full-screen battle overlay with a 5-second countdown.
  - Party members subscribed to the same lobby receive the realtime `raid_start` broadcast and begin from the same start timestamp.
  - Enemies move down the lane, guardians hold fixed posts, guardians attack only when enemies are inside range, the base has stage-scaled HP, and the battle can end in victory or defeat.
  - Victory calls the hosted `start-prototype-raid` function to settle rewards through the server ledger.
- Hardened raid settlement:
  - Hosted `start-prototype-raid` now settles all party members instead of only the host.
  - Settlement uses per-member idempotency keys and marks the lobby completed.
  - This is playable and server-settled, but full production anti-cheat still needs a server-authoritative combat tick or signed replay verification.
- Replaced Event Board placeholders with a real leaderboard view:
  - Period filters: Today, Last 7 Days, All Time.
  - Ranking filters: Raid Clears, Bosses, Gold, Fastest.
  - Empty state now says no leaderboard entries yet instead of showing placeholder cards.
- Confirmed DEV Blackjack practice support remains server-controlled:
  - Hosted bootstrap and Blackjack actions expose zero-wager practice only when Edge Function `APP_ENV` is development/test.
  - Production mode remains wagered Gold only.
- Hosted Edge Functions deployed after this pass:
  - `get-player-bootstrap-data`
  - `start-prototype-raid`
- Verification:
  - `pnpm lint`: passed.
  - `pnpm test`: passed, 154 tests.
  - `pnpm build`: passed for shared, game-engine, web, admin, and Supabase function checks.
  - Hosted function deploys completed with Supabase CLI API deployment.
- Remaining multiplayer hardening:
  - Raid combat currently runs deterministically on subscribed clients and settles server-side after victory. For launch-grade PvE economy protection, move combat ticking or replay validation fully server-side.
  - Raid realtime start sync requires party members to have the Raid Board/lobby subscription open.

## Hosted DEV Blackjack Practice Redeploy

- The hosted Supabase Edge Function secret `APP_ENV` was explicitly set to `development`.
- Redeployed hosted functions after setting the environment flag:
  - `get-player-bootstrap-data`
  - `start-blackjack-hand`
  - `blackjack-hit`
  - `blackjack-stand`
  - `blackjack-double-down`
- Expected player-facing DEV behavior:
  - Lady Vesper's table shows `DEV Practice Table`.
  - Wager source and wager input are hidden.
  - The deal button says `Deal Practice Hand`.
  - Practice hands use `0 Gold` entry cost and `0 Gold` rewards.
  - Production mode still requires a normal Gold wager.
- Verification:
  - Focused web Blackjack tests passed.
  - Shared Blackjack schema tests passed.

## Account XP Progression And Raid Rewards

- The town HUD now shows the signed-in player's current account XP, XP required for the next level, and a compact progress meter beneath the player name.
- Player bootstrap responses now include canonical `xp` values for both the public player and profile summary.
- Account progression uses the shared curve `100 + 50 * (current level - 1)` and carries excess XP across multiple levels.
- Raid victory XP is now awarded through the server-only `private.add_player_xp` RPC instead of a direct profile update.
- The XP RPC:
  - locks the player profile during settlement;
  - uses a unique idempotency key per player and raid;
  - records before/after level and XP values in the append-only `private.player_xp_ledger`;
  - prevents duplicate raid settlement from granting XP twice.
- A database trigger normalizes XP and account levels for all server-authoritative XP sources, including raid and quest rewards.
- The migration is implemented in `20260706000100_account_xp_progression.sql` but has not been pushed to the hosted Supabase project in this pass.
