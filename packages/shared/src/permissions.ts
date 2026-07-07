import type { AdminRole } from "./types";

export const adminPermissions = [
  "dashboard:view",
  "players:view",
  "players:moderate",
  "economy:view",
  "economy:adjust-dev",
  "economy:config-draft",
  "economy:config-publish-high-risk",
  "market:view",
  "market:cancel",
  "blackjack:view",
  "blackjack:freeze",
  "raids:view",
  "content:manage",
  "chat:moderate",
  "reports:manage",
  "audit:view",
  "admins:manage",
  "system:view",
  "devtools:run"
] as const;

export type AdminPermission = (typeof adminPermissions)[number];

export const rolePermissions: Record<AdminRole, readonly AdminPermission[]> = {
  OWNER: adminPermissions,
  ADMIN: [
    "dashboard:view",
    "players:view",
    "players:moderate",
    "economy:view",
    "economy:adjust-dev",
    "market:view",
    "market:cancel",
    "blackjack:view",
    "blackjack:freeze",
    "raids:view",
    "content:manage",
    "chat:moderate",
    "reports:manage",
    "audit:view",
    "system:view",
    "devtools:run"
  ],
  ECONOMY_MANAGER: [
    "dashboard:view",
    "players:view",
    "economy:view",
    "economy:config-draft",
    "market:view",
    "blackjack:view",
    "raids:view",
    "audit:view",
    "system:view"
  ],
  GAME_DESIGNER: [
    "dashboard:view",
    "raids:view",
    "content:manage",
    "economy:config-draft",
    "system:view"
  ],
  MODERATOR: [
    "dashboard:view",
    "players:view",
    "players:moderate",
    "chat:moderate",
    "reports:manage",
    "audit:view",
    "system:view"
  ],
  SUPPORT: ["dashboard:view", "players:view", "economy:view", "market:view", "blackjack:view", "audit:view", "system:view"]
};

export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return rolePermissions[role].includes(permission);
}
