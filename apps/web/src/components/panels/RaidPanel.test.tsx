// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RaidPanel } from "./RaidPanel";

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
          accountLevel: 10,
          power: 1280,
          unlockedMaps: ["tower-1-1", "tower-1-2", "tower-1-3", "tower-1-4", "tower-1-5", "tower-1-6", "tower-1-7", "tower-1-8", "tower-1-9"]
        },
        selectedHeroId: "storm-archer",
        profile: { selectedHero: "storm-archer" }
      });
    }
    if (path === "/api/lobbies") {
      return Promise.resolve({ lobbies: [] });
    }
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
  apiMocks.post.mockResolvedValue({ lobby: null });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RaidPanel", () => {
  it("renders generated stage thumbnails, selected-stage artwork, and enemy portraits", async () => {
    renderRaidPanel();

    expect(await screen.findByAltText("1-1 Sproutling Path preview")).toBeTruthy();
    expect(screen.getByAltText("1-1 Sproutling Path large preview")).toBeTruthy();
    expect(screen.getAllByAltText("Sproutling portrait").length).toBeGreaterThan(0);
    expect(screen.getByTestId("raid-stage-grid").querySelectorAll("img")).toHaveLength(5);
    expect(screen.queryByTestId("raid-wave-list")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Show Waves & Enemies/i }));
    expect(screen.getByTestId("raid-wave-list")).toBeTruthy();
    expect(screen.queryByText(/Prototype/i)).toBeNull();
  });

  it("paginates to the boss stage and renders the Solheart Sentinel boss portrait", async () => {
    renderRaidPanel();

    await screen.findByAltText("1-1 Sproutling Path preview");
    fireEvent.click(screen.getByRole("button", { name: "Next stage page" }));
    await waitFor(() => expect(screen.getByAltText("1-10 Solheart Sentinel preview")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /1-10 Solheart Sentinel/i }));

    expect(screen.getByAltText("1-10 Solheart Sentinel large preview")).toBeTruthy();
    expect(screen.getByTestId("raid-boss-portrait")).toBeTruthy();
    expect(screen.getAllByAltText("Solheart Sentinel portrait").length).toBeGreaterThan(0);
  });

  it("renders premium lobby rows with guardian display names, hero avatars, and no raw player IDs", async () => {
    mockLobbies([
      {
        id: "lobby-sproutling",
        mapId: "tower-1-1",
        lobbyType: "PUBLIC",
        recommendedPower: 515,
        members: [
          {
            playerId: "player-8ebc2b9f3fe0",
            displayName: "Booo",
            heroId: "storm-archer",
            accountLevel: 1,
            power: 420,
            ready: false,
            host: true
          }
        ]
      }
    ]);
    renderRaidPanel();

    expect(await screen.findByText("Booo")).toBeTruthy();
    expect(screen.getByAltText("1-1 Sproutling Path lobby preview")).toBeTruthy();
    expect(screen.getByText("Storm Archer · Level 1")).toBeTruthy();
    expect(screen.getByText("Host")).toBeTruthy();
    expect(screen.getByLabelText("Booo Storm Archer")).toBeTruthy();
    expect(screen.queryByText("player-8ebc2b9f3fe0")).toBeNull();
    expect((screen.getByRole("button", { name: /Join Party/i }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: /Start Raid/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("falls back to Unknown Guardian instead of rendering raw lobby player IDs", async () => {
    mockLobbies([
      {
        id: "lobby-unknown",
        mapId: "tower-1-1",
        lobbyType: "PUBLIC",
        recommendedPower: 515,
        members: [
          {
            playerId: "player-raw",
            displayName: "player-raw",
            heroId: "tide-mage",
            accountLevel: 2,
            ready: true,
            host: true
          }
        ]
      }
    ]);
    renderRaidPanel();

    expect(await screen.findByText("Unknown Guardian")).toBeTruthy();
    expect(screen.queryByText("player-raw")).toBeNull();
    expect(screen.getByText("Tide Mage · Level 2")).toBeTruthy();
  });

  it("keeps Start Raid host-only and readiness-gated while allowing solo hosts", async () => {
    mockLobbies([
      {
        id: "lobby-hosted",
        mapId: "tower-1-1",
        lobbyType: "PUBLIC",
        recommendedPower: 515,
        members: [
          {
            playerId: "player-marky",
            displayName: "Marky",
            heroId: "storm-archer",
            accountLevel: 10,
            ready: false,
            host: true
          },
          {
            playerId: "player-booo",
            displayName: "Booo",
            heroId: "tide-mage",
            accountLevel: 2,
            ready: false,
            host: false
          }
        ]
      }
    ]);
    renderRaidPanel();

    expect(await screen.findByText("Booo")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Kick Booo/i }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: /Disband Party/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Leave$/i })).toBeNull();
    expect((screen.getByRole("button", { name: /Start Raid/i }) as HTMLButtonElement).disabled).toBe(true);

    cleanup();
    mockLobbies([
      {
        id: "lobby-solo",
        mapId: "tower-1-1",
        lobbyType: "PUBLIC",
        recommendedPower: 515,
        members: [
          {
            playerId: "player-marky",
            displayName: "Marky",
            heroId: "storm-archer",
            accountLevel: 10,
            ready: false,
            host: true
          }
        ]
      }
    ]);
    renderRaidPanel();

    expect(await screen.findByText("Marky")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Disband Party/i })).toBeTruthy();
    expect((screen.getByRole("button", { name: /Start Raid/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("blocks joining or creating another party while the player is already in one", async () => {
    mockLobbies([
      {
        id: "lobby-my-party",
        mapId: "tower-1-1",
        lobbyType: "PUBLIC",
        recommendedPower: 515,
        members: [
          {
            playerId: "player-marky",
            displayName: "Marky",
            heroId: "storm-archer",
            accountLevel: 10,
            ready: false,
            host: true
          }
        ]
      },
      {
        id: "lobby-other-party",
        mapId: "tower-1-1",
        lobbyType: "PUBLIC",
        recommendedPower: 515,
        members: [
          {
            playerId: "player-other",
            displayName: "OtherHost",
            heroId: "tide-mage",
            accountLevel: 2,
            ready: false,
            host: true
          }
        ]
      }
    ]);
    renderRaidPanel();

    expect(await screen.findByText("OtherHost")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Disband Party/i })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Create Public Lobby" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Create Private Lobby" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Quick Join" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Join Party/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not render stale disbanded lobby shells with no members or no host", async () => {
    mockLobbies([
      {
        id: "lobby-empty-shell",
        mapId: "tower-1-1",
        lobbyType: "PUBLIC",
        recommendedPower: 515,
        members: []
      },
      {
        id: "lobby-hostless-shell",
        mapId: "tower-1-1",
        lobbyType: "PUBLIC",
        recommendedPower: 515,
        members: [
          {
            playerId: "player-orphan",
            displayName: "Orphan",
            heroId: "tide-mage",
            accountLevel: 3,
            ready: false,
            host: false
          }
        ]
      }
    ]);
    renderRaidPanel();

    expect(await screen.findByText("No open parties yet.")).toBeTruthy();
    expect(screen.queryByText("Host: Recruiting")).toBeNull();
    expect(screen.queryByRole("button", { name: /Join Party/i })).toBeNull();
  });

  it("creates lobbies with selected hero recruitment needs", async () => {
    renderRaidPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Tide Mage" }));
    fireEvent.click(screen.getByRole("button", { name: "Bombardier" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Public Lobby" }));

    await waitFor(() =>
      expect(apiMocks.post).toHaveBeenCalledWith(
        "/api/lobbies",
        expect.objectContaining({
          mapId: "tower-1-1",
          lobbyType: "PUBLIC",
          heroId: "storm-archer",
          neededHeroIds: ["tide-mage", "bombardier"]
        })
      )
    );
  });

  it("sorts and paginates open lobbies while hiding filled recruitment needs", async () => {
    mockLobbies([
      lobbyFixture("lobby-old", "2026-07-03T00:00:00.000Z", 1, ["tide-mage"]),
      lobbyFixture("lobby-newest", "2026-07-03T00:50:00.000Z", 1, ["bombardier"]),
      lobbyFixture("lobby-nearly-full", "2026-07-03T00:20:00.000Z", 3, ["starcaller"]),
      lobbyFixture("lobby-needs-storm", "2026-07-03T00:10:00.000Z", 2, ["storm-archer", "tide-mage"])
    ]);
    renderRaidPanel();

    await screen.findByText("Guardian newest");
    expect(screen.queryByText("Guardian old")).toBeNull();
    expect(screen.getByText("Page 1 / 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Older/i }));
    expect(await screen.findByText("Guardian old")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Near full" }));
    expect(await screen.findByText("Guardian nearly full")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Needs my hero" }));
    expect(await screen.findByText("Guardian needs storm")).toBeTruthy();
    expect(screen.getByText("Need Storm Archer")).toBeTruthy();
    expect(screen.queryByText("Need Tide Mage")).toBeNull();
  });

  it("calls server-backed lobby create and quick join actions", async () => {
    mockLobbies([
      {
        id: "lobby-joinable",
        mapId: "tower-1-1",
        lobbyType: "PUBLIC",
        recommendedPower: 515,
        members: [
          {
            playerId: "player-booo",
            displayName: "Booo",
            heroId: "tide-mage",
            accountLevel: 2,
            ready: false,
            host: true
          }
        ]
      }
    ]);
    renderRaidPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Create Public Lobby" }));
    await waitFor(() =>
      expect(apiMocks.post).toHaveBeenCalledWith(
        "/api/lobbies",
        expect.objectContaining({
          mapId: "tower-1-1",
          lobbyType: "PUBLIC",
          heroId: "storm-archer",
          neededHeroIds: []
        })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Private Lobby" }));
    await waitFor(() =>
      expect(apiMocks.post).toHaveBeenCalledWith(
        "/api/lobbies",
        expect.objectContaining({
          mapId: "tower-1-1",
          lobbyType: "PRIVATE"
        })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Quick Join" }));
    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledWith("/api/lobbies/lobby-joinable/join", {}));
  });
});

function renderRaidPanel() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RaidPanel />
    </QueryClientProvider>
  );
}

function lobbyFixture(id: string, createdAt: string, memberCount: number, neededHeroIds: string[]) {
  const label = id.replace("lobby-", "").replaceAll("-", " ");
  return {
    id,
    mapId: "tower-1-1",
    lobbyType: "PUBLIC",
    recommendedPower: 515,
    createdAt,
    neededHeroIds,
    members: Array.from({ length: memberCount }, (_, index) => ({
      playerId: index === 0 ? `${id}-host` : `${id}-member-${index}`,
      displayName: index === 0 ? `Guardian ${label}` : `Member ${index}`,
      heroId: index === 1 ? "tide-mage" : "bombardier",
      accountLevel: 10,
      power: 500,
      ready: index > 0,
      host: index === 0
    }))
  };
}

function mockLobbies(lobbies: unknown[]) {
  apiMocks.get.mockImplementation((path: string) => {
    if (path === "/api/player/me") {
      return Promise.resolve({
        player: {
          id: "player-marky",
          displayName: "Marky",
          accountLevel: 10,
          power: 1280,
          unlockedMaps: ["tower-1-1", "tower-1-2", "tower-1-3", "tower-1-4", "tower-1-5", "tower-1-6", "tower-1-7", "tower-1-8", "tower-1-9"]
        },
        selectedHeroId: "storm-archer",
        profile: { selectedHero: "storm-archer" }
      });
    }
    if (path === "/api/lobbies") {
      return Promise.resolve({ lobbies });
    }
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
}
