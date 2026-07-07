import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminBrowserSupabaseClient } from "./supabase";

export async function apiGet<T>(path: string): Promise<T> {
  if (path === "/api/admin/me") {
    return invokeAdmin<T>("admin-bootstrap", { section: "me" });
  }
  const section = adminSectionForPath(path);
  if (section) {
    return invokeAdmin<T>("admin-bootstrap", { section });
  }
  throw new Error(`No Supabase admin route mapped for GET ${path}`);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  if (path === "/api/admin/auth/login") {
    const values = bodyRecord(body);
    const email = typeof values.email === "string" ? values.email : "";
    const password = typeof values.password === "string" ? values.password : "";
    const client = getSupabaseClient();
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error) {
      throw new Error(result.error.message);
    }
    return invokeAdmin<T>("admin-bootstrap", { section: "me" });
  }
  if (path === "/api/admin/devtools/adjust-balance") {
    return invokeAdmin<T>("admin-economy-action", body);
  }
  if (path === "/api/admin/devtools/reseed") {
    return invokeAdmin<T>("admin-config-action", {
      configKey: "devtools-reseed",
      config: { requestedAt: new Date().toISOString(), devMode: import.meta.env.VITE_APP_ENV !== "production" },
      reason: "DEV_MODE reseed marker requested from admin portal"
    });
  }
  throw new Error(`No Supabase admin route mapped for POST ${path}`);
}

export function idempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type JsonRecord = Record<string, unknown>;

function getSupabaseClient(): SupabaseClient {
  const client = createAdminBrowserSupabaseClient();
  if (!client) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  return client;
}

async function invokeAdmin<T>(name: string, body: unknown): Promise<T> {
  const client = getSupabaseClient();
  const session = await client.auth.getSession();
  if (session.error) {
    throw new Error(session.error.message);
  }
  const token = session.data.session?.access_token;
  if (!token) {
    throw new Error("Admin is not logged in");
  }
  const { data, error } = await client.functions.invoke(name, {
    body: bodyRecord(body),
    headers: { Authorization: `Bearer ${token}` }
  });
  if (error) {
    throw new Error(error.message);
  }
  return data as T;
}

function adminSectionForPath(path: string): string | null {
  const map: Record<string, string> = {
    "/api/admin/dashboard": "dashboard",
    "/api/admin/players": "players",
    "/api/admin/economy": "economy",
    "/api/admin/market": "market",
    "/api/admin/blackjack": "blackjack",
    "/api/admin/raids": "raids",
    "/api/admin/content": "content",
    "/api/admin/audit": "audit",
    "/api/admin/system": "system"
  };
  return map[path] ?? null;
}

function bodyRecord(body: unknown): JsonRecord {
  return body && typeof body === "object" && !Array.isArray(body) ? (body as JsonRecord) : {};
}
