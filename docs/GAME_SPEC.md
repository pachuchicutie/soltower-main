# Game Spec

## First Screen

Visitors land on `playsoltower.fun`: a full-screen SolTower page with the SolBloom Village Phaser scene behind the title.

The asset-backed world currently includes the central stone plaza, Solheart Tower, raid portal, Moonpetal Market, Lanternroot Tavern, Emberforge, Starlight Vault, quest board, stalls, paths, lanterns, trees, flowers, dock/boat area, campfire props, blacksmith decoration, ambient particles, and demo guardians. Desktop framing shows the village as a whole; mobile framing prioritizes Solheart Tower and the plaza.

The landing page exposes:

- Play Now
- Spectate
- How to Play
- Docs

## Spectate

Spectate mode requires no player profile and is read-only. Spectators can drag to pan, use wheel/trackpad zoom on desktop, use touch drag/pinch zoom on compatible mobile browsers, and press Escape to exit Spectate.

Spectators cannot chat, trade, enter Blackjack, create/join raids, access player inventory, or mutate any data.

Selecting a town NPC shows a wallet-entry prompt rather than opening the protected NPC panel.

## Play Now

Play Now creates or reuses an anonymous Supabase Auth session, detects injected Solana wallets, signs a plain-text login message, and verifies ownership through `create-wallet-nonce` and `verify-wallet-signature`.

In production, entering authenticated town also requires at least `1,000 $TOWER` in the connected wallet. The temporary MVP mint is `FX1mwQ5CZHutv5jCAMJ4jxE7XYeYBpVuX2Qk5MuRpump`. DEV_MODE shows this requirement in the wallet UI but does not enforce the wallet-token check.

For a first-time wallet, profile creation is intentionally separate from signature verification:

1. The wallet signs a single-use, five-minute login nonce.
2. The Edge Function validates and consumes the nonce.
3. Character setup validates display-name availability.
4. `create-player-profile` accepts only the consumed, unexpired wallet proof.
5. The existing private RPC creates the profile and one idempotent starter ledger grant.

The starter state is Storm Archer, four starter equipment items, Tower 1-1, 180 Power, and exactly 50 Locked Gold. A returning wallet rotates its temporary anonymous-auth mapping and loads the existing profile; it does not create a second profile or starter grant.

Wallet login does not move funds, request approvals, or perform real Solana transfers.

## Authenticated Town

Authenticated town mode shows the player HUD, selected Hero portrait, shortened wallet address, level, Earned Gold, Locked Gold, DEV_MODE Test Token, and quick actions. The profile panel exposes the full public wallet address with copy support, selected Hero portrait, power, unlocked maps, sell capacity, Blackjack tier, settings, and disconnect.

NPC interactions use React modals for hero/inventory, Blacksmith, Market Board, Buy Orders, Blackjack, friends/chat, lobbies, quests, events, and settings.

The authenticated HUD presents desktop controls as compact fantasy keycaps:

- `W` `A` `S` `D`: move.
- `E`: interact.
- `I`: Inventory.
- `Q`: Quest Journal.

Camera modes are intentionally separate:

- Public landing: cinematic fixed camera, no player follow.
- Spectate: free drag/pinch/wheel camera, no player control.
- Authenticated town: smooth clamped camera follow on the active selected Hero.

Authenticated town controls:

- `W A S D` / arrow keys move the active Hero.
- `Shift` while moving runs on desktop.
- `E` interacts with the nearest eligible target.
- `I` opens/closes Inventory.
- `Q` opens/closes Quest Journal.
- `Escape` closes the topmost modal/panel.

On mobile, authenticated town exposes a movement pad. A short drag inside the inner area walks; dragging to the outer ring runs. Releasing the pad stops movement.

Town chat is available in authenticated town mode. Desktop shows a compact bottom-left chat HUD; mobile/tablet uses the Chat rail button and a modal message view. Chat inputs are marked as text-entry surfaces, so `W A S D`, `I`, `Q`, and `E` type normally while focused. A sent message appears above the active Hero for about 4-5 seconds, then fades. The HUD keeps only the latest 10 visible messages.

SolBloom Village has five town servers, `solbloom-1` through `solbloom-5`, capped at 40 active players each. Server selection and chat sends refresh server-side presence through Supabase Edge Functions.

Town shortcuts are disabled in editable fields, during IME composition, while wallet UI is open, and while React panels are active except for Escape and the safe same-panel `I`/`Q` close behavior. Opening a modal clears held movement keys so the Hero cannot remain moving.

Current interactable targets:

- Captain Rook -> Raid Lobby.
- Mira the Broker -> Market Board.
- Emberforge -> Blacksmith / Equipment.
- Lady Vesper -> Blackjack.
- Quest Board -> Quest Journal.
- Raid Portal -> Raid Lobby entry.
- Lanternroot Tavern -> Friends / chat.

Starlight Vault is configured as visible town infrastructure with `[E] Enter Starlight Vault` and uses the production local building asset at `/assets/soltower/environment/structures/starlight-vault.png`.

The active selected Hero is the player's town character, lobby character, and raid character. The player renderer loads generated local Hero sprites and tint-safe customization layers from `packages/shared/src/heroAssetManifest.ts`; neutral silhouette assets are used as fallback if a texture is missing.

## Inventory

Inventory is a React modal with Equipment, Consumables, Materials, and Cosmetics tabs.

Equipment shows the active selected Hero, Weapon, Armor, Relic, Charm, generated item icons, rarity frames, bound/tradeable state, item stats, and secure server-authoritative swap actions. Weapon, Armor, Relic, and Charm are protected core slots and cannot be emptied.

Consumables list the current MVP consumable definitions with quantities, generated icons, short descriptions, and bound/non-tradeable state. Materials show `No materials collected yet.` until material drops exist, plus the first generated material reference set.

Cosmetics shows a live customized Hero portrait preview, the current first-pass appearance controls, and the new Full Costume slot. Full Costume ownership is server-backed, account-wide, bound, and appearance-only. A selected Full Costume is stored per Hero, can be reset to default appearance, and does not mutate Weapon, Armor, Relic, Charm, stats, class, abilities, balances, wallet links, market state, quests, or raid access.

Vault reward icons and rarity frames are local production PNGs. Full Hero costume sprites remain a separate future asset requirement before full costume appearance swaps can visually replace Hero sprites.

## Starlight Vault

Starlight Vault is a separate Gold pull-shop system for Star Draws. It is not the Auction House, Gold Exchange, Blackjack, Raid Board, Inventory, or a normal shop.

The player panel separates pull categories from utility views.

Pull categories:

- Featured
- Weapons
- Armor
- Relics & Charms
- Costumes

Utility views:

- Collection
- Pull History
- Vault Odds

Payment choices are explicit:

- Locked Gold
- Earned Gold

Costs:

- 1 pull: 50 Gold
- 10 pulls: 450 Gold

Starlight Vault does not accept Test Token, `$TOWER`, wallet funds, real money, or silent mixed-balance fallback.

Player-facing registry odds include:

- Common 74.99%
- Uncommon 18.50%
- Rare 5.40%
- Epic 1.00%
- Legendary 0.10%
- Mythical 0.01%

Pity is per banner:

- Rare or higher within 10 draws
- Epic or higher within 75 draws
- Legendary within 300 draws
- Mythical within 600 draws in the shared UI/registry layer

The server owns RNG, pity, balance debit, duplicate conversion, reward grant, ownership, and Hero compatibility. Current hosted database rarity constraints support Common through Legendary live rewards; Mythical assets are generated and displayed in the UI/registry, but require a follow-up database rarity migration before live award selection.

## Hero / Loadout

Hero / Loadout is a React modal with Overview, Equipment, Stats, and Compare tabs.

Overview shows the active Hero portrait, role, core skill, class summary, and simplified stat block. Equipment shows the four protected equipped slots with icon cards, quick details, and `Change` actions only. Stats groups Power, Damage, Attack Speed, Range, Crit Chance, Crit Damage, Boss Damage, and Luck into readable sections using current equipment totals. Compare remains a polished coming-soon state until hero comparison is fully implemented.

## Quest Journal

Quest Journal is a React modal with Daily, Weekly, and Achievements tabs. It reads server-backed assignments and shows server UTC plus daily/weekly reset countdowns from a synced client offset. The timestamp and countdown tick every second without refetching from the server every second.

Daily quests assign three eligible quests from the possible DEV content pool. Unsupported party and skill-event quests are defined but not assigned until verified party/skill event streams exist. Weekly Full Crew is defined but not assigned until full-party raid validation exists.

Quest progress is server-authoritative. The browser cannot submit raw progress values; prototype raid completion updates progress from verified `raid_history` records. Quest claims are idempotent and issue Earned Gold through immutable ledger entries.

Quest rewards are tuned conservatively so practical daily Earned Gold remains around 12-20 from the assigned daily pool. The current reward table is documented in `docs/ECONOMY_BALANCE_NOTES.md`.

## Market Board

Market Board is a React modal with Browse, Sell Gold, Auction House, Buy Orders, My Activity, and Live Feed tabs.

- Browse shows active public Earned Gold listings, seller display, price per Gold, total `$TOWER` cost, listing time, and buy action.
- Sell Gold previews gross `$TOWER`, 10% market tax, and seller receives before creating a listing. Creating a Gold listing requires Level 10 and at least `10,000 $TOWER` in production.
- Auction House is the future player item-listing surface. Listing auction items requires Level 10 and at least `10,000 $TOWER` in production; buying auction items does not require the seller gate. No server-side auction listing mutation exists yet.
- Buy Orders shows public buy orders, escrowed `$TOWER`, fulfill actions, and create-order fields where supported. Fulfilling a buy order is a Gold-selling action and uses the same Level 10 plus `10,000 $TOWER` production gate.
- My Activity is scoped to the current account and separates listings, buy orders, purchases, sales, and history.
- Live Feed combines readable public listings, buy orders, and readable trade history with filters for All, Listings, Sales, Buy Orders, and Fills.

In development, the token label is `$TOWER (DEV)` to avoid implying a live on-chain settlement token. Market mutations remain server-authoritative through Edge Functions and database RPCs. Buying Gold does not require the `$TOWER` seller gate.

Current caveat: the Fills filter is present for the intended UX, but the current RLS-readable feed source does not expose a global public fill-event view yet.

## Settings And Account

Settings is a React modal with Audio, Motion, Accessibility, Controls, and Account tabs.

Audio includes master/music/SFX sliders, mute toggles, generated UI sound preview, generated village ambience preview, generated BGM preview, and stop-audio control. Values persist in local storage and apply immediately while respecting browser autoplay policies.

Motion includes Reduced Motion, Camera Follow, Camera Height, Center Camera, and a Screen Shake placeholder for later raid tuning. Camera Height is the authenticated town zoom preference and can also be adjusted with mouse wheel over the town view. Accessibility includes Larger UI Text, Higher Contrast, and Reduce Particle Intensity. Controls reuses the keycap shortcut pattern. Account shows connected wallet information, copy support, Disconnect Wallet, and Log Out to Landing with confirmation dialogs.

## Raid Board

Raid Board is the player-facing stage-selection and lobby surface for tower runs.

Map 1 is `Map 1: Solheart Outskirts` with stages `1-1` through `1-10`, Account Levels 1-10. Stage `1-10` is the Solheart Sentinel boss stage. Map 2 and Map 3 exist as locked progression data only for now.

Unlock rules:

- Stage `1-1` unlocks at Account Level 1.
- Each later stage requires its account level and completion of the previous stage.
- Stage `2-1` requires Account Level 11 and completion of `1-10`, but Map 2 remains content-locked in the current product phase.

The Raid Board uses a paginated selector instead of horizontal scrolling:

- Desktop shows 5 stage cards per page.
- Compact/tablet layouts show 3 cards per page.
- Phone widths show 1 card per page.

Every Map 1 stage card uses an original local generated thumbnail. The selected-stage panel shows a large stage preview, objective, level requirement, party size, rewards, enemy portraits, a collapsed-by-default wave list, and a boss portrait/badge on the Solheart Sentinel stage.

Raid Board assets live under `apps/web/public/assets/raids/`:

- `chapters/`
- `stages/`
- `enemies/`
- `rewards/`

Lobby creation, lobby joining, readiness, leave, kick, and run start remain server-authoritative through Supabase Edge Functions. The browser cannot grant itself access to locked stages; Edge Functions check account level, previous-stage completion, active content status, lobby capacity, host status, and non-host readiness before starts. Lobby member names resolve through guardian display names and fall back to `Unknown Guardian`; raw player ids are not player-facing lobby labels.

The MVP still uses the existing server-recorded run path for rewards and quest progress. The full 5-8 minute continuous real-time synchronized tower-defense battle remains a later raid-combat phase.

## Heroes

- Storm Archer: long-range boss damage and critical hits.
- Tide Mage: area damage and slows.
- Bombardier: explosive area damage and armor break.
- Coral Alchemist: poison and debuffs.
- Starcaller: shields, buffs, and core protection.

Each Hero now has a first-pass local character asset set under `apps/web/public/assets/soltower/heroes/`: a 96x96 transparent icon, a 192x192 transparent portrait, transparent 256x256 action sprite sheets, and tint-safe portrait/world customization layers. The production sprite standard uses 64x64 frames, four action sheets (`idle.png`, `walk.png`, `run.png`, `attack.png`), four columns of animation frames, and four direction rows in the exact order down, left, right, up.

The current visible customization set includes hair style, hair color, skin tone, outfit variant, accent color, cloak/back accessory, and weapon accent. Existing players receive safe default appearances based on their selected Hero.

## UI Direction

The visual language is original pixel-inspired fantasy: dark glass surfaces, warm lantern light, gold and blue highlights, rarity frames, compact keycaps, framed panels, and local generated Hero character art. It intentionally avoids copied game art, copied layouts, copied names, external icon packs, external music packs, and external sound packs.

The MVP now includes generated local UI, item, Hero character, currency, and lightweight synthesized audio assets. Full town-core environment art, NPC portraits, raid map art, enemy/boss sheets, combat effect sprite sheets, branded social icons, and deeper authored landmark art remain future asset work.
