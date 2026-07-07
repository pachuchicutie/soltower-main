import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const requiredFunctions = [
  "create-wallet-nonce",
  "verify-wallet-signature",
  "create-player-profile",
  "get-player-bootstrap-data",
  "create-market-listing",
  "cancel-market-listing",
  "buy-market-listing",
  "create-buy-order",
  "cancel-buy-order",
  "fill-buy-order",
  "start-blackjack-hand",
  "blackjack-hit",
  "blackjack-stand",
  "blackjack-double-down",
  "buy-bound-shop-item",
  "equip-item",
  "unequip-item",
  "starlight-vault-state",
  "starlight-vault-draw",
  "equip-full-costume",
  "create-lobby",
  "join-lobby",
  "leave-lobby",
  "set-ready-state",
  "kick-lobby-player",
  "start-prototype-raid",
  "finalize-prototype-raid",
  "get-player-quests",
  "claim-quest-reward",
  "select-town-server",
  "save-town-position",
  "send-chat-message",
  "send-friend-request",
  "accept-friend-request",
  "block-player",
  "admin-player-action",
  "admin-market-action",
  "admin-economy-action",
  "admin-config-action",
  "admin-moderation-action"
];

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("Supabase-first MVP architecture", () => {
  it("provides every required Supabase Edge Function entrypoint", () => {
    for (const functionName of requiredFunctions) {
      const indexPath = join(root, "supabase", "functions", functionName, "index.ts");
      expect(existsSync(indexPath), functionName).toBe(true);
      expect(readFileSync(indexPath, "utf8")).toContain(`serveAction("${functionName}"`);
    }
  });

  it("keeps service-role secrets out of browser app source and env examples", () => {
    const browserFiles = [
      "apps/web/src/lib/api.ts",
      "apps/web/src/lib/supabase.ts",
      "apps/web/.env.example",
      "apps/admin/src/lib/api.ts",
      "apps/admin/src/lib/supabase.ts",
      "apps/admin/.env.example"
    ];
    for (const file of browserFiles) {
      expect(read(file), file).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });

  it("routes player and admin apps through Supabase instead of the legacy Fastify server", () => {
    expect(read("apps/web/src/lib/api.ts")).not.toContain("localhost:4000");
    expect(read("apps/web/src/lib/api.ts")).toContain("client.functions.invoke");
    expect(read("apps/admin/src/lib/api.ts")).not.toContain("localhost:4000");
    expect(read("apps/admin/src/lib/api.ts")).toContain("signInWithPassword");
    expect(read("apps/admin/src/lib/api.ts")).toContain("client.functions.invoke");
  });

  it("removes Fastify, Socket.IO, and Prisma from active root workspace scripts", () => {
    const rootPackage = read("package.json");
    const workspace = read("pnpm-workspace.yaml");
    expect(rootPackage).not.toContain("@soltower/server");
    expect(rootPackage).not.toContain("prisma");
    expect(workspace).not.toContain("apps/*");
    expect(workspace).not.toContain("apps/server");
  });

  it("defines private schema, RLS, immutable ledger RPCs, and market economy rules in migrations", () => {
    const migration = read("supabase/migrations/20260629000200_supabase_first_mvp.sql");
    expect(migration).toContain("create schema if not exists private");
    expect(migration).toContain("private.wallet_login_nonces");
    expect(migration).toContain("private.blackjack_hands");
    expect(migration).toContain('drop policy if exists "players can update own non-sensitive profile settings"');
    expect(migration).toContain("alter table public.inventory_items enable row level security");
    expect(migration).toContain("create or replace function private.apply_balance_delta");
    expect(migration).toContain("idempotency_key");
    expect(migration).toContain("v_tax := floor(v_listing.total_price * 0.10)");
    expect(migration).toContain("Market-purchased Gold becomes Locked Gold");
    expect(migration).toContain("Earned Gold listings unlock at Level 10");
  });

  it("guards wallet login nonce expiry, replay, signature validation, and one-time starter grants", () => {
    const actions = read("supabase/functions/_shared/actions.ts");
    const walletVerification = read("supabase/functions/_shared/walletVerification.ts");
    const initialMigration = read("supabase/migrations/20260629000100_initial_soltower.sql");
    const supabaseFirstMigration = read("supabase/migrations/20260629000200_supabase_first_mvp.sql");
    const starterHeroMigration = read("supabase/migrations/20260630000400_starter_hero_selection.sql");
    expect(actions).toContain("Date.now() + 5 * 60 * 1000");
    expect(actions).toContain(".is(\"consumed_at\", null)");
    expect(walletVerification).toContain('"expired_nonce"');
    expect(walletVerification).toContain('"consumed_nonce"');
    expect(walletVerification).toContain('"invalid_signature_encoding"');
    expect(walletVerification).toContain('"invalid_signature_length"');
    expect(walletVerification).toContain('"invalid_public_key_length"');
    expect(walletVerification).toContain('"invalid_signature"');
    expect(walletVerification).toContain('"message_bytes_mismatch"');
    expect(actions).toContain("nacl.sign.detached.verify");
    expect(actions).toContain("message_base64");
    expect(actions).toContain("message_sha256");
    expect(actions).toContain("requiresProfile: true");
    expect(actions).toContain(".not(\"consumed_at\", \"is\", null)");
    expect(actions).toContain("Verified wallet login expired");
    expect(actions).toContain('from("auth_user_mappings")');
    expect(actions).toContain('.delete()');
    expect(initialMigration).toContain("public_key text unique not null");
    expect(supabaseFirstMigration).toContain("'starter-locked-gold:' || v_player_id");
    expect(actions).toContain("p_selected_hero_id: body.heroId");
    expect(starterHeroMigration).toContain("v_selected_hero_id not in");
    expect(starterHeroMigration).toContain("selected_hero_id");
    expect(starterHeroMigration).toContain("values (v_player_id, v_selected_hero_id)");
    expect(actions).toContain("Request ID:");
    expect(actions).toContain("challengeId");
  });

  it("keeps public world status read-only and separates wallet proof from first-time profile creation", () => {
    const actions = read("supabase/functions/_shared/actions.ts");
    const api = read("apps/web/src/lib/api.ts");
    expect(actions).toContain('z.literal("public-stats")');
    expect(actions).toContain('context.service.from("player_presence")');
    expect(actions).toContain("createPlayerProfileSchema.parse");
    expect(actions).toContain("Wallet verified. Create your guardian profile.");
    expect(api).toContain('invokePublicFunction<T>("get-player-bootstrap-data"');
    expect(api).toContain('invokeFunction<T>("create-player-profile"');
  });

  it("caps SolBloom town chat servers through Edge Functions", () => {
    const actions = read("supabase/functions/_shared/actions.ts");
    const migration = read("supabase/migrations/20260630000500_town_chat_servers.sql");
    const api = read("apps/web/src/lib/api.ts");

    expect(actions).toContain("TOWN_SERVER_CAPACITY = 40");
    expect(actions).toContain("townServerIds");
    expect(actions).toContain('"select-town-server": selectTownServer');
    expect(actions).toContain("assertTownServerCapacity");
    expect(actions).toContain("updateTownPresence");
    expect(actions).toContain("town_channel: body.townChannel");
    expect(migration).toContain("add column if not exists town_channel");
    expect(migration).toContain("solbloom-5");
    expect(migration).toContain("idx_player_presence_town_channel");
    expect(api).toContain('if (path === "/api/town/server")');
    expect(api).toContain('routePath === "/api/town/servers"');
    expect(api).toContain('routePath === "/api/chat/recent"');
  });

  it("persists validated authenticated town positions through an Edge Function", () => {
    const actions = read("supabase/functions/_shared/actions.ts");
    const migration = read("supabase/migrations/20260704000100_player_town_position.sql");
    const api = read("apps/web/src/lib/api.ts");

    expect(actions).toContain("townPositionSchema");
    expect(actions).toContain("z.number().int().min(54).max(1200)");
    expect(actions).toContain("z.number().int().min(120).max(1208)");
    expect(actions).toContain('"save-town-position": saveTownPosition');
    expect(actions).toContain("townPosition:");
    expect(migration).toContain("add column if not exists world_x");
    expect(migration).toContain("add column if not exists world_y");
    expect(api).toContain('if (path === "/api/town/position")');
  });

  it("keeps economy, Blackjack, and admin authority in Edge Functions or private RPCs", () => {
    const actions = read("supabase/functions/_shared/actions.ts");
    const migration = read("supabase/migrations/20260629000200_supabase_first_mvp.sql");
    const practiceMigration = read("supabase/migrations/20260703000100_blackjack_practice_mode.sql");
    expect(migration).toContain("if v_player.account_level < 10");
    expect(migration).toContain("if p_gold_amount < 100");
    expect(migration).toContain("'LOCKED_GOLD'");
    expect(migration).toContain("v_tax := floor");
    expect(actions).toContain("crypto.getRandomValues");
    expect(actions).toContain("Blackjack profit over Earned cap becomes Locked Gold");
    expect(actions).toContain("practiceMode && !isDevMode()");
    expect(actions).toContain("status !== \"ACTIVE\" && !practiceMode");
    expect(actions).toContain("if (!practiceMode) {");
    expect(actions).toContain("practiceAllowed: isDevMode()");
    expect(practiceMigration).toContain("practice_mode boolean not null default false");
    expect(practiceMigration).toContain("practice_mode = true and bet = 0");
    expect(practiceMigration).toContain("practice_mode = false and bet > 0");
    expect(practiceMigration).toContain("Practice hands never debit or credit economy balances");
    expect(actions).toContain("requireAdmin(context");
    expect(actions).toContain("body.action === \"BAN\"");
    expect(actions).toContain("recordAdminAudit");
  });

  it("adds server-authoritative quest assignment, progress, and claim records", () => {
    const migration = read("supabase/migrations/20260629000400_quest_system.sql");
    const actions = read("supabase/functions/_shared/actions.ts");
    expect(migration).toContain("create table if not exists public.quest_definitions");
    expect(migration).toContain("create table if not exists public.player_quest_assignments");
    expect(migration).toContain("create table if not exists public.quest_progress_events");
    expect(migration).toContain("create table if not exists public.quest_reward_claims");
    expect(migration).toContain("create or replace function private.record_quest_progress");
    expect(migration).toContain("create or replace function private.claim_player_quest_reward");
    expect(migration).toContain("'QUEST_REWARD'");
    expect(migration).toContain("idempotency_key text unique not null");
    expect(actions).toContain("recordQuestProgressFromRaid");
    expect(actions).toContain('p_source_type: "raid_history"');
    expect(actions).toContain("dailyEligible");
    expect(actions).toContain("requires_skill_events");
    expect(actions).not.toContain("browserQuestProgress");
  });

  it("guards raid lobby create, join, and run start with server-side stage access checks", () => {
    const actions = read("supabase/functions/_shared/actions.ts");
    expect(actions).toContain("activeRaidStageIds");
    expect(actions).toContain("raidStageRequirement");
    expect(actions).toContain("assertRaidStageAccess");
    expect(actions).toContain("Requires Account Level");
    expect(actions).toContain("Requires completion of");
    expect(actions).toContain("loadOpenLobbyMembership");
    expect(actions).toContain("Leave or disband your current party before creating another.");
    expect(actions).toContain("Leave or disband your current party before joining another.");
    expect(actions).toContain("status: \"DISBANDED\"");
    expect(actions).toContain("Use Disband Party instead of kicking the host.");
    expect(actions).toContain("Only the lobby host can start the run");
    expect(actions).toContain("All non-host party members must be ready before the raid can start");
    expect(actions).toContain("Synchronized raid victory reward");
    expect(actions).toContain('status: "COMPLETED"');
    expect(actions).toContain("for (const memberId of partyPlayerIds)");
    expect(actions).toContain("recordQuestProgressFromRaid(context, { id: memberId }, raid)");
  });

  it("uses an atomic server-side equipment swap and blocks direct core-slot unequip", () => {
    const actions = read("supabase/functions/_shared/actions.ts");
    const migration = read("supabase/migrations/20260630000100_equipment_core_slot_swaps.sql");
    expect(actions).toContain('"swap-equipment": equipItem');
    expect(actions).toContain('rpc("swap_equipment_for_auth"');
    expect(actions).toContain("Core equipment slots cannot be unequipped");
    expect(migration).toContain("create table if not exists private.equipment_swap_requests");
    expect(migration).toContain("for update");
    expect(migration).toContain("Replacement equipment does not match");
    expect(migration).toContain("Replacement equipment is already equipped");
    expect(migration).toContain("Core equipment slots must each contain exactly one item");
    expect(migration).toContain("private.recalculate_player_power");
    expect(migration).toContain("idempotency_key");
  });

  it("adds Starlight Vault as a Gold-only server-authoritative pull system with local asset-backed rewards", () => {
    const actions = read("supabase/functions/_shared/actions.ts");
    const migration = read("supabase/migrations/20260630000200_starlight_vault.sql");
    const api = read("apps/web/src/lib/api.ts");
    const panel = read("apps/web/src/components/panels/StarlightVaultPanel.tsx");
    const inventory = read("apps/web/src/components/panels/InventoryPanel.tsx");
    const townManifest = read("apps/web/src/game/config/townAssetManifest.ts");
    const sharedRules = read("packages/shared/src/starlightVault.ts");
    const sharedTypes = read("packages/shared/src/types.ts");

    expect(migration).toContain("create table if not exists public.starlight_vault_banners");
    expect(migration).toContain("create table if not exists public.starlight_vault_pool_entries");
    expect(migration).toContain("create table if not exists public.starlight_vault_pity_counters");
    expect(migration).toContain("create table if not exists public.starlight_vault_pull_events");
    expect(migration).toContain("create table if not exists public.starlight_vault_duplicate_conversions");
    expect(migration).toContain("create table if not exists public.player_full_costumes");
    expect(migration).toContain("create table if not exists public.player_equipped_cosmetics");
    expect(migration).toContain("create table if not exists public.hero_compatible_item_tags");
    expect(migration).toContain("create table if not exists public.manual_asset_registry");
    expect(migration).toContain("create table if not exists private.starlight_vault_draw_requests");
    expect(migration).toContain("private.secure_random_basis_points");
    expect(migration).toContain("gen_random_bytes(4)");
    expect(migration).toContain("private.perform_starlight_vault_draw_for_auth");
    expect(migration).toContain("private.equip_full_costume_for_auth");
    expect(migration).toContain("p_payment_balance_type not in ('EARNED_GOLD', 'LOCKED_GOLD')");
    expect(migration).toContain("v_cost := case when p_draw_count = 10 then 450 else 50 end");
    expect(migration).toContain("'STARLIGHT_VAULT_DRAW'");
    expect(migration).toContain("enabled_for_player_use = true");
    expect(migration).toContain("asset_status = 'ready'");
    expect(migration).toContain("e.rarity = v_final_rarity");
    expect(migration).toContain("v_existing.player_id <> v_player.player_id");
    expect(migration).toContain("Hero is not owned");
    expect(migration).toContain("'wardrobe-threads'");
    expect(migration).toContain("'starlight-shards'");
    expect(migration).toContain("'costume-' || c.costume_id || '-' || h.hero_id");
    expect(migration).toContain("'/assets/costumes/' || c.costume_id || '/' || h.hero_id || '/preview.png'");
    expect(migration).toContain("'pool-storm-archer-vault-weapon'");
    expect(migration).toContain("'pool-tide-mage-vault-armor'");
    expect(migration).toContain("'pool-starcaller-vault-charm'");
    expect(migration).toContain("array['celestial-staff', 'star-focus', 'charm-weapon']");

    expect(actions).toContain('"starlight-vault-state": starlightVaultState');
    expect(actions).toContain('"starlight-vault-draw": starlightVaultDraw');
    expect(actions).toContain('"equip-full-costume": equipFullCostume');
    expect(actions).toContain("starlightVaultDrawSchema");
    expect(actions).toContain('paymentBalanceType: z.enum(["LOCKED_GOLD", "EARNED_GOLD"])');
    expect(actions).toContain('rpc("perform_starlight_vault_draw_for_auth"');
    expect(actions).toContain('rpc("equip_full_costume_for_auth"');

    expect(api).toContain('invokeFunction<T>("starlight-vault-state"');
    expect(api).toContain('invokeFunction<T>("starlight-vault-draw"');
    expect(api).toContain('invokeFunction<T>("equip-full-costume"');
    expect(api).toContain('client.from("player_full_costumes")');
    expect(api).toContain('client.from("player_equipped_cosmetics")');

    expect(panel).toContain("Draw powerful gear and full costumes for your Guardians.");
    expect(panel).toContain("selectedBanner.name");
    expect(panel).toContain("Vault Odds");
    expect(panel).toContain("starlightRewardDefinitions");
    expect(panel).not.toContain("Math.random");

    expect(inventory).toContain("Full Costume is separate from Weapon, Armor, Relic, and Charm");
    expect(inventory).toContain("Preview hidden until manual Hero assets are ready");
    expect(townManifest).toContain('path: "/assets/soltower/environment/structures/starlight-vault.png"');
    expect(townManifest).toContain('interactionLabel: "Enter Starlight Vault"');
    expect(townManifest).toContain('assetStatus: "ready"');
    expect(townManifest).toContain("enabledForPlayerUse: true");
    expect(sharedRules).toContain("starlightVaultTabs");
    expect(sharedRules).toContain("starlightVaultUtilityTabs");
    expect(sharedRules).toContain("MYTHICAL");
    expect(sharedRules).toContain("starlightCostumeDuplicateThreads");
    expect(sharedRules).toContain("starlightEquipmentDuplicateShards");
    expect(sharedRules).toContain("enabledForPlayerUse: true");
    expect(sharedTypes).toContain('"STARLIGHT_VAULT_DRAW"');
  });

  it("adds a non-destructive server-side quest reward rebalance migration", () => {
    const migration = read("supabase/migrations/20260629000500_quest_reward_rebalance.sql");
    expect(migration).toContain("update public.quest_definitions");
    expect(migration).toContain("('daily-first-defense', 4, 60)");
    expect(migration).toContain("('daily-tower-watch', 5, 70)");
    expect(migration).toContain("('daily-party-up', 6, 90)");
    expect(migration).toContain("('daily-skill-in-motion', 4, 65)");
    expect(migration).toContain("('daily-bossbound', 6, 100)");
    expect(migration).toContain("('daily-steady-defender', 4, 60)");
    expect(migration).toContain("('weekly-full-crew', 20, 300)");
    expect(migration).toContain("('weekly-tower-vanguard', 18, 260)");
    expect(migration).toContain("('weekly-veteran-solbloom', 22, 340)");
    expect(migration).toContain("2026-06-29-conservative-repeatable-quest-rewards");
  });
});
