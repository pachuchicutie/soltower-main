import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.57.4";

export type JsonRecord = Record<string, unknown>;

export interface EdgeContext {
  body: JsonRecord;
  request: Request;
  service: SupabaseClient;
  anon: SupabaseClient;
  authHeader: string | null;
  user: User | null;
}

export type EdgeHandler = (context: EdgeContext) => Promise<unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

export class HttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function serveAction(name: string, handler: EdgeHandler): void {
  Deno.serve(async (request: Request) => {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      const context = await createContext(request);
      const data = await handler(context);
      return json(data);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 400;
      const message = error instanceof Error ? error.message : `${name} failed`;
      if (error instanceof HttpError && error.code) {
        return json({ ok: false, code: error.code, message }, status);
      }
      return json({ error: message }, status);
    }
  });
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

export async function createContext(request: Request): Promise<EdgeContext> {
  const url = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("Authorization");
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false }
  });
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false }
  });
  const body = await readBody(request);
  const user = authHeader ? await getUserFromHeader(anon, authHeader) : null;

  return {
    body,
    request,
    service,
    anon,
    authHeader,
    user
  };
}

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new HttpError(500, `${name} is not configured`);
  }
  return value;
}

export function optionalEnv(name: string): string | null {
  return Deno.env.get(name) ?? null;
}

export function requireUser(context: EdgeContext): User {
  if (!context.user) {
    throw new HttpError(401, "Authenticated Supabase session required");
  }
  return context.user;
}

export function isDevMode(): boolean {
  const value = optionalEnv("APP_ENV") ?? optionalEnv("VITE_APP_ENV") ?? "production";
  return value !== "production";
}

async function getUserFromHeader(client: SupabaseClient, authHeader: string): Promise<User | null> {
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

async function readBody(request: Request): Promise<JsonRecord> {
  if (request.method === "GET") {
    return Object.fromEntries(new URL(request.url).searchParams.entries());
  }
  const text = await request.text();
  if (!text) {
    return {};
  }
  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  return parsed;
}

export function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asRecord(value: unknown, label: string): JsonRecord {
  if (!isRecord(value)) {
    throw new HttpError(500, `${label} response was not an object`);
  }
  return value;
}

export function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function toStringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function toBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}
