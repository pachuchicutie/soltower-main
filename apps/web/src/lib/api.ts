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
    try {
      await withTimeout(client.auth.signOut(), AUTH_TIMEOUT_MS, "Sign out");
    } catch {
      // Always leave the local session even if Auth is unreachable.
    }
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
  if (path === "/api/inventory/gift") {
    return invokeFunction<T>("gift-inventory-item", body);
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
  if (path === "/api/raids/prototype/begin") {
    return invokeFunction<T>("start-prototype-raid", { ...bodyRecord(body), phase: "begin" });
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

const AUTH_TIMEOUT_MS = 5_000;
const FUNCTION_TIMEOUT_MS = 12_000;

function getSupabaseClient(): SupabaseClient {
  const client = createBrowserSupabaseClient();
  if (!client) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  return client;
}

/** Local-only peek — no network. Used so the app can skip bootstrap when logged out. */
export function hasStoredSupabaseSession(): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith("sb-") || !key.includes("auth-token")) {
        continue;
      }
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      const parsed = JSON.parse(raw) as { access_token?: unknown; currentSession?: { access_token?: unknown } };
      if (typeof parsed.access_token === "string" && parsed.access_token.length > 0) {
        return true;
      }
      if (
        parsed.currentSession &&
        typeof parsed.currentSession.access_token === "string" &&
        parsed.currentSession.access_token.length > 0
      ) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${ms}ms. The village servers may be waking up — try again.`));
        }, ms);
      })
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

async function ensureSession(client: SupabaseClient): Promise<string> {
  const current = await withTimeout(client.auth.getSession(), AUTH_TIMEOUT_MS, "Auth session check");
  if (current.error) {
    throw new Error(current.error.message);
  }
  if (current.data.session?.access_token) {
    return current.data.session.access_token;
  }
  const created = await withTimeout(client.auth.signInAnonymously(), AUTH_TIMEOUT_MS, "Anonymous sign-in");
  if (created.error || !created.data.session?.access_token) {
    throw new Error(created.error?.message ?? "Anonymous Supabase Auth is not enabled");
  }
  return created.data.session.access_token;
}

async function requireExistingSession(client: SupabaseClient): Promise<string> {
  const current = await withTimeout(client.auth.getSession(), AUTH_TIMEOUT_MS, "Auth session check");
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
  const { data, error } = await withTimeout(
    client.functions.invoke(name, {
      body: bodyRecord(body),
      headers: { Authorization: `Bearer ${token}` }
    }),
    FUNCTION_TIMEOUT_MS,
    `Edge function ${name}`
  );
  if (error) {
    // Some SDK versions put the JSON error body on `data` even when `error` is set.
    const detail = await functionErrorDetail(error, data);
    if (detail.code && isWalletAuthErrorCode(detail.code)) {
      throw new WalletAuthError(detail.code, detail.message);
    }
    throw new Error(detail.message);
  }
  if (data && typeof data === "object" && "error" in data && typeof (data as JsonRecord).error === "string") {
    throw new Error(String((data as JsonRecord).error));
  }
  return data as T;
}

async function invokePublicFunction<T>(name: string, body: unknown): Promise<T> {
  const client = getSupabaseClient();
  const { data, error } = await withTimeout(
    client.functions.invoke(name, { body: bodyRecord(body) }),
    FUNCTION_TIMEOUT_MS,
    `Edge function ${name}`
  );
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
        tradeable: row.is_tradeable === true,
        giftable: row.is_giftable === true,
        relistable: Boolean(row.relistable),
        acquiredFrom: String(row.acquired_from ?? ""),
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
      giftable: row.is_giftable === true,
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
  // Prefer service-role list (real names). One edge call only — sequential fallbacks made Ready/Leave feel laggy.
  try {
    const edge = await invokeFunction<unknown>("list-open-lobbies", {});
    if (isLobbyListPayload(edge)) {
      return edge as T;
    }
  } catch {
    // fall through to direct table read
  }
  return (await readLobbiesFromTables()) as T;
}

function isLobbyListPayload(value: unknown): value is { lobbies: unknown[] } {
  return Boolean(value && typeof value === "object" && Array.isArray((value as JsonRecord).lobbies));
}

async function readLobbiesFromTables(): Promise<{ lobbies: JsonRecord[] }> {
  const client = getSupabaseClient();
  await requireExistingSession(client);
  const activeSince = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const lobbiesResult = await checked<Array<JsonRecord>>(
    client
      .from("raid_lobbies")
      .select("*")
      .eq("status", "OPEN")
      .gte("created_at", activeSince)
      .order("created_at", { ascending: false })
      .limit(100)
  );
  const lobbyRows = lobbiesResult.data;
  if (lobbyRows.length === 0) {
    return { lobbies: [] };
  }
  const lobbyIds = lobbyRows.map((lobby) => stringValue(lobby.id)).filter(Boolean);
  const membersResult = await checked<Array<JsonRecord>>(
    client.from("raid_lobby_members").select("*").in("lobby_id", lobbyIds)
  );
  const memberRows = membersResult.data;
  const memberPlayerIds = [
    ...new Set(memberRows.map((member) => stringValue(member.player_id)).filter(Boolean))
  ];
  // Optional profile join — works once open-lobby profile RLS (or display_name column) is live.
  let profileByPlayerId = new Map<string, JsonRecord>();
  if (memberPlayerIds.length > 0) {
    try {
      const profiles = await checked<Array<JsonRecord>>(
        client
          .from("player_profiles")
          .select("player_id,display_name,account_level,power,selected_hero_id")
          .in("player_id", memberPlayerIds)
      );
      profileByPlayerId = new Map(
        profiles.data.map((profile) => [stringValue(profile.player_id), profile])
      );
    } catch {
      profileByPlayerId = new Map();
    }
  }
  const membersByLobby = new Map<string, JsonRecord[]>();
  for (const member of memberRows) {
    const lobbyId = stringValue(member.lobby_id);
    const playerId = stringValue(member.player_id);
    if (!lobbyId || !playerId) {
      continue;
    }
    const profile = profileByPlayerId.get(playerId);
    const rawName =
      stringValue(profile?.display_name) ||
      stringValue(member.display_name) ||
      stringValue(member.displayName);
    const list = membersByLobby.get(lobbyId) ?? [];
    list.push({
      playerId,
      displayName: resolveClientLobbyDisplayName(rawName, playerId),
      heroId:
        stringValue(member.hero_id) ||
        stringValue(profile?.selected_hero_id) ||
        "storm-archer",
      accountLevel:
        typeof member.account_level === "number"
          ? member.account_level
          : typeof profile?.account_level === "number"
            ? profile.account_level
            : 1,
      power:
        typeof member.power === "number"
          ? member.power
          : typeof profile?.power === "number"
            ? profile.power
            : 0,
      ready: Boolean(member.ready),
      host: Boolean(member.host)
    });
    membersByLobby.set(lobbyId, list);
  }
  const lobbies = lobbyRows
    .map((lobby) => {
      const id = stringValue(lobby.id);
      const members = membersByLobby.get(id) ?? [];
      return {
        ...camelRecord(lobby),
        neededHeroIds: parseHeroIdList(lobby.needed_hero_ids ?? lobby.neededHeroIds),
        members
      };
    })
    .filter(
      (lobby) =>
        Array.isArray(lobby.members) &&
        lobby.members.length > 0 &&
        lobby.members.some((member) => Boolean((member as JsonRecord).host))
    );
  return { lobbies };
}

function parseHeroIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function resolveClientLobbyDisplayName(value: string, playerId: string): string {
  const displayName = value.trim();
  if (displayName && !/^player[-_]/i.test(displayName)) {
    return displayName;
  }
  if (playerId && !/^player[-_]/i.test(playerId)) {
    return playerId;
  }
  return "Guardian";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
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
  const freshSince = new Date(Date.now() - 60 * 1000).toISOString();
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
  const playerIds = [
    ...new Set(result.data.map((message) => stringValue(message.from_player_id)).filter(Boolean))
  ];
  const profilesByPlayerId = new Map<string, JsonRecord>();
  if (playerIds.length > 0) {
    const profiles = await checked<Array<JsonRecord>>(
      client.from("player_profiles").select("player_id,display_name,selected_hero_id").in("player_id", playerIds)
    );
    for (const profile of profiles.data) {
      profilesByPlayerId.set(stringValue(profile.player_id), profile);
    }
  }
  return {
    messages: result.data
      .map((message) => {
        const playerId = stringValue(message.from_player_id);
        const profile = profilesByPlayerId.get(playerId);
        const displayName = stringValue(profile?.display_name).trim();
        return {
          ...camelRecord(message),
          fromDisplayName: displayName || null,
          fromHeroId: stringValue(profile?.selected_hero_id) || null
        };
      })
      .reverse()
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
  error: unknown,
  dataFallback?: unknown
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
      // Fall through to data / generic message parsing.
    }
  }
  const fromData = extractFunctionErrorPayload(dataFallback);
  if (fromData) {
    return fromData;
  }
  const fallback =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : "Supabase Edge Function request failed";
  // SDK often only says "Edge Function returned a non-2xx status code" — keep it readable.
  if (/non-2xx status code/i.test(fallback)) {
    return { code: null, message: "Chat request failed. Please try again in a moment." };
  }
  return { code: null, message: fallback };
}

export async function readFunctionErrorResponse(
  response: Response
): Promise<{ code: WalletAuthErrorCode | null; message: string }> {
  const payload = (await response.json()) as unknown;
  const extracted = extractFunctionErrorPayload(payload);
  if (extracted) {
    return extracted;
  }
  return {
    code: null,
    message: response.statusText?.trim() || "Supabase Edge Function request failed"
  };
}

function extractFunctionErrorPayload(
  payload: unknown
): { code: WalletAuthErrorCode | null; message: string } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as JsonRecord;
  const message =
    typeof record.message === "string" && record.message.trim().length > 0
      ? record.message.trim()
      : typeof record.error === "string" && record.error.trim().length > 0
        ? record.error.trim()
        : typeof record.msg === "string" && record.msg.trim().length > 0
          ? record.msg.trim()
          : null;
  if (!message) {
    return null;
  }
  return {
    code: isWalletAuthErrorCode(record.code) ? record.code : null,
    message
  };
}

export function isTowerGateErrorCode(value: unknown): value is Extract<WalletAuthErrorCode, "tower_token_gate" | "tower_token_check_unavailable"> {
  return value === "tower_token_gate" || value === "tower_token_check_unavailable";
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
