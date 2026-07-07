// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StarlightVaultPanel } from "./StarlightVaultPanel";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}));

vi.mock("../../lib/api", () => ({
  apiGet: apiMocks.get,
  apiPost: apiMocks.post,
  idempotencyKey: (prefix: string) => `${prefix}-test`
}));

beforeEach(() => {
  apiMocks.get.mockImplementation((path: string) => {
    if (path === "/api/player/me") {
      return Promise.resolve({
        player: {
          id: "player-marky",
          displayName: "Marky",
          balances: { EARNED_GOLD: 300, LOCKED_GOLD: 50, TEST_TOKEN: 250 }
        },
        profile: { selectedHero: "Storm Archer" },
        selectedHeroId: "storm-archer"
      });
    }
    if (path === "/api/starlight-vault") {
      return Promise.resolve({
        pityCounters: [
          {
            banner_id: "featured-starlight-selection",
            rare_counter: 7,
            epic_counter: 44,
            legendary_counter: 184,
            mythical_counter: 401
          }
        ],
        history: [],
        ownedCostumes: [{ costume_id: "banana-guardian" }],
        equippedCosmetics: [],
        assetValidation: []
      });
    }
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
  apiMocks.post.mockResolvedValue({
    results: [{ rewardId: "stormpiercer-bow", rarity: "LEGENDARY", rewardType: "WEAPON" }]
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StarlightVaultPanel", () => {
  it("renders production pull categories, banner art, and no placeholder manual-art copy", async () => {
    const { container } = renderVaultPanel();

    expect(await screen.findByRole("heading", { name: "Starlight Vault" })).toBeTruthy();
    for (const tab of ["Featured", "Weapons", "Armor", "Relics & Charms", "Costumes"]) {
      expect(screen.getByRole("tab", { name: tab })).toBeTruthy();
    }
    for (const utility of ["Collection", "Pull History", "Vault Odds"]) {
      expect(screen.getByRole("button", { name: utility })).toBeTruthy();
      expect(screen.queryByRole("tab", { name: utility })).toBeNull();
    }

    const banner = container.querySelector(".starlight-banner-art") as HTMLImageElement | null;
    expect(banner?.src).toContain("/assets/vault/banners/featured-starlight-selection.png");
    expect(screen.getAllByText("Featured Starlight Selection").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Stormpiercer Bow").length).toBeGreaterThan(0);
    expect(screen.queryByText(/pending_manual_art/i)).toBeNull();
    expect(screen.queryByText(/manual assets/i)).toBeNull();
    expect(screen.queryByText(/No rewards are live/i)).toBeNull();
    expect(screen.queryByText("Asset Registry")).toBeNull();
    expect(screen.queryByText(/Town asset path/i)).toBeNull();
    expect(screen.getAllByText(/Drop chance/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Duplicate/i).length).toBeGreaterThan(0);
  });

  it("filters reward cards by category without leaking Full Costume labels into equipment tabs", async () => {
    renderVaultPanel();

    await screen.findByRole("heading", { name: "Starlight Vault" });
    fireEvent.click(screen.getByRole("tab", { name: "Weapons" }));

    const pool = screen.getByLabelText("Weapons reward pool");
    expect(within(pool).getByText("Worn Driftwood Bow")).toBeTruthy();
    expect(within(pool).getByText("Astral Tempest Relic Bow")).toBeTruthy();
    expect(within(pool).queryByText(/FULL COSTUME/i)).toBeNull();
    expect(within(pool).queryByText("Village Initiate")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Armor" }));
    const armorPool = screen.getByLabelText("Armor reward pool");
    expect(within(armorPool).getByText("Scout Leather Set")).toBeTruthy();
    expect(within(armorPool).getByText("Celestial Aegis Armor")).toBeTruthy();
    expect(within(armorPool).queryByText(/FULL COSTUME/i)).toBeNull();
  });

  it("shows collection, pull history, odds, and Mythical pity as utility panels", async () => {
    renderVaultPanel();

    await screen.findByRole("heading", { name: "Starlight Vault" });
    fireEvent.click(screen.getByRole("button", { name: "Collection" }));
    const collection = screen.getByLabelText("Starlight Vault collection");
    expect(within(collection).getByText("Banana Guardian")).toBeTruthy();
    expect(within(collection).getByText(/Costume · Bound · Owned/)).toBeTruthy();
    expect(within(collection).getByText("Celestial Star Sovereign")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Pull History" }));
    expect(screen.getByText("No Star Draws yet.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Vault Odds" }));
    expect(screen.getAllByText("Mythical").length).toBeGreaterThan(0);
    expect(screen.getByText("0.01%")).toBeTruthy();
    expect(screen.getByText("401 / 600")).toBeTruthy();
  });

  it("requires explicit confirmation before submitting a server-authoritative Star Draw", async () => {
    renderVaultPanel();

    await screen.findByRole("heading", { name: "Starlight Vault" });
    const pullButton = screen.getByRole("button", { name: "Pull 1" }) as HTMLButtonElement;
    await waitFor(() => expect(pullButton.disabled).toBe(false));
    fireEvent.click(pullButton);
    expect(await screen.findByText("Draw from Featured Starlight Selection?")).toBeTruthy();
    expect(apiMocks.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm Star Draw" }));
    await waitFor(() =>
      expect(apiMocks.post).toHaveBeenCalledWith("/api/starlight-vault/draw", {
        bannerId: "featured-starlight-selection",
        paymentBalanceType: "LOCKED_GOLD",
        drawCount: 1,
        activeHeroId: "storm-archer",
        idempotencyKey: "starlight-vault-test"
      })
    );
    expect(await screen.findByText("Star Draw Results")).toBeTruthy();
  });
});

function renderVaultPanel() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StarlightVaultPanel />
    </QueryClientProvider>
  );
}
