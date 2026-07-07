// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryPanel } from "./InventoryPanel";
import { HeroInventoryPanel } from "./HeroInventoryPanel";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}));

vi.mock("../../lib/api", () => ({
  apiGet: apiMocks.get,
  apiPost: apiMocks.post,
  idempotencyKey: (prefix: string) => `${prefix}-test-key`
}));

const equippedStarter = [
  equipment("item-basic-bow", "basic-bow", "Basic Bow", "WEAPON", "WEAPON", { damage: 18, range: 12, critChance: 2 }),
  equipment("item-basic-armor", "basic-armor", "Basic Armor", "ARMOR", "ARMOR", { power: 50 }),
  equipment("item-basic-relic", "basic-relic", "Basic Relic", "RELIC", "RELIC", { bossDamage: 4 }),
  equipment("item-basic-charm", "basic-charm", "Basic Charm", "CHARM", "CHARM", { luck: 3 })
];

const replacements = [
  equipment("item-ember-bow", "ember-bow", "Emberstring Bow", "WEAPON", null, { damage: 32, critChance: 5, range: 14 }, "UNCOMMON"),
  equipment("item-tide-mantle", "tide-mantle", "Tideglass Mantle", "ARMOR", null, { power: 120, luck: 6 }, "RARE")
];

let swapped = false;

beforeEach(() => {
  swapped = false;
  apiMocks.get.mockImplementation((path: string) => {
    if (path === "/api/player/me") {
      return Promise.resolve({
        player: {
          id: "player-marky",
          displayName: "Marky",
          walletPublicKey: "DevMock",
          walletLinkedAt: "2026-06-29T00:00:00.000Z",
          accountLevel: 10,
          avatar: "M",
          power: swapped ? 286 : 269,
          status: "ACTIVE",
          marketFrozen: false,
          blackjackFrozen: false,
          unlockedMaps: [],
          balances: { EARNED_GOLD: 0, LOCKED_GOLD: 0, TEST_TOKEN: 0 }
        },
        selectedHeroId: "storm-archer"
      });
    }
    if (path === "/api/inventory") {
      return Promise.resolve({
        equipment: swapped
          ? [
              equipment("item-basic-bow", "basic-bow", "Basic Bow", "WEAPON", null, { damage: 18, range: 12, critChance: 2 }),
              equipment("item-ember-bow", "ember-bow", "Emberstring Bow", "WEAPON", "WEAPON", { damage: 32, critChance: 5, range: 14 }, "UNCOMMON"),
              equippedStarter[1],
              equippedStarter[2],
              equippedStarter[3],
              replacements[1]
            ]
          : [...equippedStarter, ...replacements],
        consumables: [],
        materials: []
      });
    }
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
  apiMocks.post.mockImplementation((path: string) => {
    if (path === "/api/inventory/swap") {
      swapped = true;
      return Promise.resolve({
        slot: "WEAPON",
        equippedItem: equipment("item-ember-bow", "ember-bow", "Emberstring Bow", "WEAPON", "WEAPON", { damage: 32, critChance: 5, range: 14 }, "UNCOMMON"),
        returnedItem: equipment("item-basic-bow", "basic-bow", "Basic Bow", "WEAPON", null, { damage: 18, range: 12, critChance: 2 }),
        power: 286
      });
    }
    return Promise.reject(new Error(`Unexpected POST ${path}`));
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InventoryPanel equipment swaps", () => {
  it("does not render Unequip for core slots and hides equipped items from Owned Equipment by default", async () => {
    renderWithClient(<InventoryPanel />);

    expect(await screen.findByText("Basic Bow")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Unequip/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Change" })).toHaveLength(4);

    const owned = screen.getByLabelText("Owned equipment");
    expect(within(owned).queryByText("Basic Bow")).toBeNull();
    expect(within(owned).getByText("Emberstring Bow")).toBeTruthy();
    expect(within(owned).getByText("Tideglass Mantle")).toBeTruthy();
  });

  it("filters replacements by exact slot, confirms swap, returns old item, and refreshes stat totals", async () => {
    renderWithClient(<InventoryPanel />);

    await screen.findByText("Basic Bow");
    expect(screen.getAllByText("Damage")[0].parentElement?.textContent).toContain("82");

    await userEvent.click(screen.getAllByRole("button", { name: "Change" })[0]);
    const picker = screen.getByLabelText("Weapon replacement picker");
    expect(within(picker).getByText("Emberstring Bow")).toBeTruthy();
    expect(within(picker).queryByText("Tideglass Mantle")).toBeNull();
    expect(picker.querySelector(".stat-positive")?.textContent).toBe("+14");

    await userEvent.click(within(picker).getByRole("button", { name: "Equip Emberstring Bow" }));
    expect(screen.getByText("Equip Emberstring Bow?")).toBeTruthy();
    expect(screen.getByText("Your Basic Bow will return to your Inventory.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Confirm Swap" }));

    await waitFor(() =>
      expect(apiMocks.post).toHaveBeenCalledWith("/api/inventory/swap", {
        equipmentId: "item-ember-bow",
        slot: "WEAPON",
        idempotencyKey: "equipment-swap-test-key"
      })
    );
    expect(await screen.findByText("Emberstring Bow equipped. Basic Bow returned to Inventory.")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText("Damage")[0].parentElement?.textContent).toContain("96"));
  });
});

describe("HeroInventoryPanel equipment swaps", () => {
  it("shows four equipped slots with Change actions and no Unequip action", async () => {
    renderWithClient(<HeroInventoryPanel />);
    await userEvent.click(await screen.findByRole("tab", { name: "Equipment" }));

    expect(await screen.findByText("Basic Bow")).toBeTruthy();
    expect(screen.getAllByText("Equipped")).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: "Change" })).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /Unequip/i })).toBeNull();
    expect(screen.queryByText("No equipment yet")).toBeNull();
  });
});

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function equipment(
  id: string,
  definitionId: string,
  name: string,
  slot: "WEAPON" | "ARMOR" | "RELIC" | "CHARM",
  equippedSlot: "WEAPON" | "ARMOR" | "RELIC" | "CHARM" | null,
  stats: Record<string, number>,
  rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC" = "COMMON"
) {
  return {
    id,
    definitionId,
    name,
    rarity,
    slot,
    equippedSlot,
    level: 1,
    bound: true,
    relistable: false,
    stats
  };
}
