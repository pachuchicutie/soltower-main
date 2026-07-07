import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";

const migrationDir = join(process.cwd(), "supabase", "migrations");
const migrationSql = readdirSync(migrationDir)
  .filter((file) => file.endsWith(".sql"))
  .map((file) => readFileSync(join(migrationDir, file), "utf8"))
  .join("\n");

describe("landing, spectator, and Supabase security", () => {
  it("allows public visitors to load backend landing stats without authentication", async () => {
    const { app } = await createApp();
    const response = await app.inject({ method: "GET", url: "/api/public/stats" });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ devMode: true, testWorldActive: true });
  });

  it("prevents spectators from invoking game mutations", async () => {
    const { app } = await createApp();
    await app.inject({ method: "POST", url: "/api/spectate/start", payload: {} });
    const market = await app.inject({
      method: "POST",
      url: "/api/market/listings",
      payload: { goldAmount: 100, pricePerGold: 2, idempotencyKey: "spectator-list" }
    });
    const blackjack = await app.inject({
      method: "POST",
      url: "/api/blackjack/deal",
      payload: { balanceType: "EARNED_GOLD", bet: 5, idempotencyKey: "spectator-bj" }
    });
    await app.close();
    expect(market.statusCode).not.toBe(200);
    expect(blackjack.statusCode).not.toBe(200);
  });

  it("lets spectators exit back to landing without creating an account", async () => {
    const { app, store } = await createApp();
    const before = store.players.size;
    await app.inject({ method: "POST", url: "/api/spectate/start", payload: {} });
    const exit = await app.inject({ method: "POST", url: "/api/spectate/end", payload: {} });
    await app.close();
    expect(exit.statusCode).toBe(200);
    expect(store.players.size).toBe(before);
  });

  it("does not reference the Supabase service-role key in frontend source", () => {
    const frontendFiles = [
      join(process.cwd(), "apps", "web", "src", "lib", "supabase.ts"),
      join(process.cwd(), "apps", "admin", "src", "lib", "supabase.ts")
    ];
    const combined = frontendFiles.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(combined).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("has RLS policies for player-visible data and no direct economy mutation policy", () => {
    expect(migrationSql).toContain("alter table public.player_profiles enable row level security");
    expect(migrationSql).toContain("create policy \"players can read own balances\"");
    expect(migrationSql).toContain("create policy \"players can read own ledger\"");
    expect(migrationSql).not.toMatch(/on public\.economy_ledger for insert/i);
    expect(migrationSql).not.toMatch(/on public\.player_balances for insert/i);
  });

  it("keeps admin data inaccessible through unauthenticated player APIs", async () => {
    const { app } = await createApp();
    const response = await app.inject({ method: "GET", url: "/api/admin/players" });
    await app.close();
    expect(response.statusCode).not.toBe(200);
  });

  it("does not grant unrestricted anonymous realtime reads", () => {
    expect(migrationSql).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(migrationSql).not.toMatch(/auth\.role\(\)\s*=\s*'anon'/i);
  });
});
