import type { SupabaseClient } from "@supabase/supabase-js";
import {
  consumables,
  getBlackjackEarnedProfitCap,
  getBlackjackLimits,
  getBlackjackTableLimit,
  fullCostumeDefinitions,
  seededPlayer,
  shopEquipment,
  starterEquipment,
  starlightMaterialDefinitions,
  vaultEquipment,
  TOWN_PRESENCE_STALE_AFTER_SECONDS,
  TOWN_SERVER_CAPACITY,
  townServerIds,
  type BalanceSnapshot
} from "@soltower/shared";
import { heroDefinitions, mapDefinitions, prototypeWaves } from "@soltower/game-engine";
import { createBrowserSupabaseClient } from "./supabase";

export type WalletAuthErrorCode =
  | "stale_challenge"
  | "expired_nonce"
  | "consumed_nonce"
  | "wallet_changed"
  | "public_key_mismatch"
  | "message_bytes_mismatch"
  | "invalid_signature_encoding"
  | "invalid_signature_length"
  | "invalid_public_key_length"
  | "invalid_signature"
  | "unsupported_provider_signature_shape"
  | "ed25519_verifier_error"
  | "missing_request_field"
  | "duplicate_submission"
  | "provider_sign_message_failure"
  | "tower_token_gate"
  | "tower_token_check_unavailable"
  | "unknown_verification_error";

export class WalletAuthError extends Error {
  readonly code: WalletAuthErrorCode;

  constructor(code: WalletAuthErrorCode, message: string) {
    super(message);
    this.name = "WalletAuthError";
    this.code = code;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const request = parseApiPath(path);
  const routePath = request.pathname;
  if (routePath === "/api/public/stats") {
    return invokePublicFunction<T>("get-player-bootstrap-data", { section: "public-stats" });
  }
  if (routePath === "/api/player/me") {
    return invokeFunction<T>("get-player-bootstrap-data", { section: "me" });
  }
  if (routePath === "/api/blackjack") {
    return invokeFunction<T>("get-player-bootstrap-data", { section: "blackjack" });
  }
  if (routePath === "/api/events/leaderboard") {
    return invokeFunction<T>("get-player-bootstrap-data", {
      section: "raid-leaderboard",
      period: request.searchParams.get("period") ?? "weekly"
    });
  }
  if (routePath === "/api/inventory") {
    return readInventory<T>();
  }
  if (routePath === "/api/market/listings") {
    return readMarketListings<T>();
  }
  if (routePath === "/api/market/buy-orders") {
    return readBuyOrders<T>();
  }
  if (routePath === "/api/lobbies") {
    return readLobbies<T>();
  }
  if (routePath === "/api/friends") {
    return readFriends<T>();
  }
  if (routePath === "/api/town/servers") {
    return readTownServers<T>();
  }
  if (routePath === "/api/chat/recent") {
    return readChat<T>(request.searchParams.get("townChannel"));
  }
  if (routePath === "/api/quests") {
    return invokeFunction<T>("get-player-quests", {});
  }
  if (routePath === "/api/starlight-vault") {
    return invokeFunction<T>("starlight-vault-state", { includeDeveloperValidation: true });
  }
  if (routePath === "/api/content") {
    return {
      heroes: heroDefinitions,
      maps: mapDefinitions,
      waves: prototypeWaves
    } as T;
  }
  throw new Error(`No Supabase API route mapped for GET ${path}`);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  if (path === "/api/spectate/start" || path === "/api/spectate/end") {
    return { spectators: 1 } as T;
  }
  if (path === "/api/auth/logout") {
    const client = getSupabaseClient();
    await client.auth.signOut();
    return { ok: true } as T;
  }
  if (path === "/api/auth/wallet/nonce") {
    return invokeFunction<T>("create-wallet-nonce", body);
  }
  if (path === "/api/auth/wallet/verify") {
    return invokeFunction<T>("verify-wallet-signature", body);
  }
  if (path === "/api/auth/wallet/profile") {
    return invokeFunction<T>("create-player-profile", body);
  }
  if (path === "/api/auth/wallet/display-name") {
    return invokeFunction<T>("get-player-bootstrap-data", {
      section: "display-name-availability",
      ...bodyRecord(body)
    });
  }
  if (path === "/api/market/listings") {
    return invokeFunction<T>("create-market-listing", body);
  }
  const listingBuy = path.match(/^\/api\/market\/listings\/([^/]+)\/buy$/);
  if (listingBuy) {
    return invokeFunction<T>("buy-market-listing", { ...bodyRecord(body), listingId: listingBuy[1] });
  }
  if (path === "/api/market/buy-orders") {
    return invokeFunction<T>("create-buy-order", body);
  }
  const orderFill = path.match(/^\/api\/market\/buy-orders\/([^/]+)\/fill$/);
  if (orderFill) {
    return invokeFunction<T>("fill-buy-order", { ...bodyRecord(body), orderId: orderFill[1] });
  }
  if (path === "/api/blackjack/deal") {
    return invokeFunction<T>("start-blackjack-hand", body);
  }
  const blackjackAction = path.match(/^\/api\/blackjack\/([^/]+)\/action$/);
  if (blackjackAction) {
    const record = bodyRecord(body);
    const action = record.action;
    const functionName =
      action === "HIT"
        ? "blackjack-hit"
        : action === "STAND"
          ? "blackjack-stand"
          : action === "DOUBLE_DOWN"
            ? "blackjack-double-down"
            : null;
    if (!functionName) {
      throw new Error("Unsupported Blackjack action");
    }
    return invokeFunction<T>(functionName, { ...record, handId: blackjackAction[1] });
  }
  if (path === "/api/inventory/equip") {
    return invokeFunction<T>("equip-item", body);
  }
  if (path === "/api/inventory/swap") {
    return invokeFunction<T>("swap-equipment", body);
  }
  if (path === "/api/inventory/unequip") {
    return invokeFunction<T>("unequip-item", body);
  }
  if (path === "/api/blacksmith/buy") {
    return invokeFunction<T>("buy-bound-shop-item", body);
  }
  if (path === "/api/starlight-vault/draw") {
    return invokeFunction<T>("starlight-vault-draw", body);
  }
  if (path === "/api/inventory/full-costume") {
    return invokeFunction<T>("equip-full-costume", body);
  }
  if (path === "/api/lobbies") {
    return invokeFunction<T>("create-lobby", body);
  }
  if (path === "/api/town/server") {
    return invokeFunction<T>("select-town-server", body);
  }
  if (path === "/api/town/position") {
    return invokeFunction<T>("save-town-position", body);
  }
  const lobbyJoin = path.match(/^\/api\/lobbies\/([^/]+)\/join$/);
  if (lobbyJoin) {
    return invokeFunction<T>("join-lobby", { ...bodyRecord(body), lobbyId: lobbyJoin[1] });
  }
  const lobbyLeave = path.match(/^\/api\/lobbies\/([^/]+)\/leave$/);
  if (lobbyLeave) {
    return invokeFunction<T>("leave-lobby", { ...bodyRecord(body), lobbyId: lobbyLeave[1] });
  }
  const lobbyReady = path.match(/^\/api\/lobbies\/([^/]+)\/ready$/);
  if (lobbyReady) {
    return invokeFunction<T>("set-ready-state", { ...bodyRecord(body), lobbyId: lobbyReady[1] });
  }
  const lobbyKick = path.match(/^\/api\/lobbies\/([^/]+)\/kick$/);
  if (lobbyKick) {
    return invokeFunction<T>("kick-lobby-player", { ...bodyRecord(body), lobbyId: lobbyKick[1] });
  }
  if (path === "/api/raids/prototype/run") {
    return invokeFunction<T>("start-prototype-raid", body);
  }
  if (path === "/api/chat/message") {
    return invokeFunction<T>("send-chat-message", body);
  }
  if (path === "/api/quests/claim") {
    return invokeFunction<T>("claim-quest-reward", body);
  }
  throw new Error(`No Supabase API route mapped for POST ${path}`);
}

export function idempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type JsonRecord = Record<string, unknown>;

interface SupabaseResult<T> {
  data: T | null;
  error: { message: string } | null;
}

function getSupabaseClient(): SupabaseClient {
  const client = createBrowserSupabaseClient();
  if (!client) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  return client;
}

async function ensureSession(client: SupabaseClient): Promise<string> {
  const current = await client.auth.getSession();
  if (current.error) {
    throw new Error(current.error.message);
  }
  if (current.data.session?.access_token) {
    return current.data.session.access_token;
  }
  const created = await client.auth.signInAnonymously();
  if (created.error || !created.data.session?.access_token) {
    throw new Error(created.error?.message ?? "Anonymous Supabase Auth is not enabled");
  }
  return created.data.session.access_token;
}

async function requireExistingSession(client: SupabaseClient): Promise<string> {
  const current = await client.auth.getSession();
  if (current.error) {
    throw new Error(current.error.message);
  }
  const token = current.data.session?.access_token;
  if (!token) {
    throw new Error("No active Supabase session");
  }
  return token;
}

async function invokeFunction<T>(name: string, body: unknown): Promise<T> {
  const client = getSupabaseClient();
  const token =
    name === "create-wallet-nonce" || name === "verify-wallet-signature"
      ? await ensureSession(client)
      : await requireExistingSession(client);
  const { data, error } = await client.functions.invoke(name, {
    body: bodyRecord(body),
    headers: { Authorization: `Bearer ${token}` }
  });
  if (error) {
    const detail = await functionErrorDetail(error);
    if (name === "verify-wallet-signature" && detail.code) {
      throw new WalletAuthError(detail.code, detail.message);
    }
    throw new Error(detail.message);
  }
  return data as T;
}

async function invokePublicFunction<T>(name: string, body: unknown): Promise<T> {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke(name, { body: bodyRecord(body) });
  if (error) {
    throw new Error((await functionErrorDetail(error)).message);
  }
  return data as T;
}

async function readInventory<T>(): Promise<T> {
  const client = getSupabaseClient();
  await requireExistingSession(client);
  const [result, costumesResult, equippedCosmeticsResult] = await Promise.all([
    checked<Array<JsonRecord>>(client.from("inventory_items").select("*").order("created_at", { ascending: true })),
    checked<Array<JsonRecord>>(client.from("player_full_costumes").select("*").order("acquired_at", { ascending: true })),
    checked<Array<JsonRecord>>(client.from("player_equipped_cosmetics").select("*"))
  ]);
  const definitions = [...starterEquipment, ...shopEquipment, ...vaultEquipment];
  const equipment = result.data
    .filter((row) => row.item_type === "EQUIPMENT")
    .map((row) => {
      const definition = definitions.find((entry) => entry.id === row.definition_id);
      return {
        id: String(row.id),
        definitionId: String(row.definition_id),
        name: definition?.name ?? String(row.definition_id),
        rarity: definition?.rarity ?? "COMMON",
        slot: definition?.slot ?? "WEAPON",
        equippedSlot: typeof row.equipped_slot === "string" ? row.equipped_slot : null,
        level: 1,
        bound: row.bound !== false,
        relistable: Boolean(row.relistable),
        stats: definition?.stats ?? {}
      };
    });
  const consumableRows = result.data.filter((row) => row.item_type === "CONSUMABLE");
  const materialRows = result.data.filter((row) => row.item_type === "MATERIAL");
  const knownMaterials = [...starlightMaterialDefinitions];
  const cosmetics = costumesResult.data.map((row) => {
    const definition = fullCostumeDefinitions.find((entry) => entry.id === row.costume_id);
    return {
      id: String(row.costume_id),
      costumeId: String(row.costume_id),
      name: definition?.name ?? String(row.costume_id),
      rarity: definition?.rarity ?? String(row.rarity ?? "COMMON"),
      bound: row.is_bound !== false,
      tradeable: row.is_tradeable === true,
      source: String(row.source ?? "starlight_vault")
    };
  });
  return {
    equipment,
    consumables: consumables.map((definition) => {
      const row = consumableRows.find((entry) => entry.definition_id === definition.id);
      return {
        id: row ? String(row.id) : definition.id,
        definitionId: definition.id,
        name: definition.name,
        description: definition.description,
        quantity: typeof row?.quantity === "number" ? row.quantity : 0,
        bound: row?.bound !== false
      };
    }),
    materials: [
      ...knownMaterials.map((definition) => {
        const row = materialRows.find((entry) => entry.definition_id === definition.id);
        return {
          id: definition.id,
          definitionId: definition.id,
          name: definition.name,
          quantity: typeof row?.quantity === "number" ? row.quantity : 0,
          bound: row?.bound !== false,
          tradeable: false
        };
      }),
      ...materialRows
        .filter((row) => !knownMaterials.some((definition) => definition.id === row.definition_id))
        .map((row) => ({
          id: String(row.id),
          definitionId: String(row.definition_id),
          name: String(row.definition_id),
          quantity: typeof row.quantity === "number" ? row.quantity : 0,
          bound: row.bound !== false,
          tradeable: row.is_tradeable === true
        }))
    ],
    cosmetics,
    equippedCosmetics: equippedCosmeticsResult.data.map(camelRecord)
  } as T;
}

async function readMarketListings<T>(): Promise<T> {
  const client = getSupabaseClient();
  await requireExistingSession(client);
  const [listings, history] = await Promise.all([
    checked<Array<JsonRecord>>(
      client.from("market_listings").select("*").eq("status", "ACTIVE").order("created_at", { ascending: false }).limit(50)
    ),
    checked<Array<JsonRecord>>(client.from("market_trades").select("*").order("created_at", { ascending: false }).limit(25))
  ]);
  return {
    listings: listings.data.map(camelRecord),
    history: history.data.map(camelRecord)
  } as T;
}

async function readBuyOrders<T>(): Promise<T> {
  const client = getSupabaseClient();
  await requireExistingSession(client);
  const result = await checked<Array<JsonRecord>>(
    client.from("buy_orders").select("*").eq("status", "OPEN").order("created_at", { ascending: false }).limit(50)
  );
  return { buyOrders: result.data.map(camelRecord) } as T;
}

async function readLobbies<T>(): Promise<T> {
  const client = getSupabaseClient();
  await requireExistingSession(client);
  const activeSince = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [lobbies, members] = await Promise.all([
    checked<Array<JsonRecord>>(
      client
        .from("raid_lobbies")
        .select("*")
        .eq("status", "OPEN")
        .gte("created_at", activeSince)
        .order("created_at", { ascending: false })
        .limit(50)
    ),
    checked<Array<JsonRecord>>(client.from("raid_lobby_members").select("*"))
  ]);
  const memberPlayerIds = [...new Set(members.data.map((member) => stringValue(member.player_id)).filter(Boolean))];
  const profiles = memberPlayerIds.length
    ? await checked<Array<JsonRecord>>(
        client.from("player_profiles").select("player_id,display_name,account_level,power,selected_hero_id").in("player_id", memberPlayerIds)
      )
    : { data: [] };
  const profileByPlayerId = new Map(profiles.data.map((profile) => [stringValue(profile.player_id), profile]));
  const readableLobbies = lobbies.data
    .map((lobby) => {
      const id = stringValue(lobby.id);
      const lobbyMembers = members.data
        .filter((member) => stringValue(member.lobby_id) === id)
        .map((member) => ({
          playerId: stringValue(member.player_id),
          displayName: safeLobbyDisplayName(profileByPlayerId.get(stringValue(member.player_id))?.display_name),
          heroId: stringValue(member.hero_id) || stringValue(profileByPlayerId.get(stringValue(member.player_id))?.selected_hero_id) || "storm-archer",
          accountLevel:
            typeof member.account_level === "number"
              ? member.account_level
              : numberValue(profileByPlayerId.get(stringValue(member.player_id))?.account_level),
          power:
            typeof member.power === "number"
              ? member.power
              : numberValue(profileByPlayerId.get(stringValue(member.player_id))?.power),
          ready: Boolean(member.ready),
          host: Boolean(member.host)
        }));
      return {
        ...camelRecord(lobby),
        neededHeroIds: parseHeroIdList(lobby.needed_hero_ids),
        members: lobbyMembers
      };
    })
    .filter((lobby) => lobby.members.length > 0 && lobby.members.some((member) => member.host));
  return {
    lobbies: readableLobbies
  } as T;
}

function parseHeroIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function safeLobbyDisplayName(value: unknown): string {
  const displayName = stringValue(value);
  if (!displayName || /^player[-_]/i.test(displayName)) {
    return "Unknown Guardian";
  }
  return displayName;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

async function readFriends<T>(): Promise<T> {
  const client = getSupabaseClient();
  await requireExistingSession(client);
  const result = await checked<Array<JsonRecord>>(client.from("friendships").select("*").limit(50));
  return {
    friends: result.data.map((row) => ({
      id: String(row.id ?? `${row.player_a_id}-${row.player_b_id}`),
      status: "FRIEND",
      player: { ...seededPlayer, id: String(row.player_b_id), displayName: String(row.player_b_id) }
    }))
  } as T;
}

async function readTownServers<T>(): Promise<T> {
  const client = getSupabaseClient();
  await requireExistingSession(client);
  const freshSince = new Date(Date.now() - TOWN_PRESENCE_STALE_AFTER_SECONDS * 1000).toISOString();
  const result = await checked<Array<JsonRecord>>(
    client
      .from("player_presence")
      .select("player_id,town_channel,presence_status,last_seen_at")
      .eq("presence_status", "IN_TOWN")
      .gte("last_seen_at", freshSince)
  );
  const playersByServer = new Map<string, Set<string>>();
  for (const row of result.data) {
    const townChannel = String(row.town_channel ?? "solbloom-1");
    const playerId = String(row.player_id ?? "");
    if (!playerId) {
      continue;
    }
    const players = playersByServer.get(townChannel) ?? new Set<string>();
    players.add(playerId);
    playersByServer.set(townChannel, players);
  }
  return {
    servers: townServerIds.map((id, index) => {
      const online = playersByServer.get(id)?.size ?? 0;
      return {
        id,
        label: `SolBloom ${index + 1}`,
        online,
        capacity: TOWN_SERVER_CAPACITY,
        isFull: online >= TOWN_SERVER_CAPACITY
      };
    })
  } as T;
}

async function readChat<T>(townChannel: string | null): Promise<T> {
  const client = getSupabaseClient();
  await requireExistingSession(client);
  const channel = normalizeTownServerId(townChannel);
  const result = await checked<Array<JsonRecord>>(
    client
      .from("chat_messages")
      .select("*")
      .eq("town_channel", channel)
      .order("created_at", { ascending: false })
      .limit(10)
  );
  return {
    messages: result.data.map(camelRecord).reverse()
  } as T;
}

async function checked<T>(result: PromiseLike<SupabaseResult<T>>): Promise<{ data: T }> {
  const resolved = await result;
  if (resolved.error) {
    throw new Error(resolved.error.message);
  }
  return { data: resolved.data ?? ([] as T) };
}

function bodyRecord(body: unknown): JsonRecord {
  return body && typeof body === "object" && !Array.isArray(body) ? (body as JsonRecord) : {};
}

function parseApiPath(path: string): URL {
  return new URL(path, "https://local.soltower.invalid");
}

function normalizeTownServerId(value: string | null): (typeof townServerIds)[number] {
  return townServerIds.find((id) => id === value) ?? "solbloom-1";
}

function camelRecord(row: JsonRecord): JsonRecord {
  const output: JsonRecord = {};
  for (const [key, value] of Object.entries(row)) {
    output[key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())] = value;
  }
  return output;
}

async function functionErrorDetail(
  error: unknown
): Promise<{ code: WalletAuthErrorCode | null; message: string }> {
  if (
    error &&
    typeof error === "object" &&
    "context" in error &&
    error.context instanceof Response
  ) {
    try {
      return await readFunctionErrorResponse(error.context.clone());
    } catch {
      // The SDK fallback message remains useful when a response is not JSON.
    }
  }
  return {
    code: null,
    message: error instanceof Error ? error.message : "Supabase Edge Function request failed"
  };
}

export async function readFunctionErrorResponse(
  response: Response
): Promise<{ code: WalletAuthErrorCode | null; message: string }> {
  const payload = (await response.json()) as unknown;
  if (
    payload &&
    typeof payload === "object" &&
    "code" in payload &&
    isWalletAuthErrorCode(payload.code) &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return { code: payload.code, message: payload.message };
  }
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return { code: null, message: payload.error };
  }
  return { code: null, message: "Supabase Edge Function request failed" };
}

function isWalletAuthErrorCode(value: unknown): value is WalletAuthErrorCode {
  return [
    "stale_challenge",
    "expired_nonce",
    "consumed_nonce",
    "wallet_changed",
    "public_key_mismatch",
    "message_bytes_mismatch",
    "invalid_signature_encoding",
    "invalid_signature_length",
    "invalid_public_key_length",
    "invalid_signature",
    "unsupported_provider_signature_shape",
    "ed25519_verifier_error",
    "missing_request_field",
    "duplicate_submission",
    "provider_sign_message_failure",
    "tower_token_gate",
    "tower_token_check_unavailable",
    "unknown_verification_error"
  ].includes(String(value));
}

export function localBlackjackPreview(accountLevel: number, balances: BalanceSnapshot) {
  return {
    earnedProfitCap: getBlackjackEarnedProfitCap(accountLevel),
    earnedLimits: getBlackjackLimits(accountLevel, balances.EARNED_GOLD),
    lockedLimits: getBlackjackLimits(accountLevel, balances.LOCKED_GOLD),
    tableTier: getBlackjackTableLimit(accountLevel)
  };
}
