// @vitest-environment jsdom

import React from "react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PlayerBootstrapData } from "@soltower/shared";
import { heroAppearanceStorageKey } from "../lib/heroAppearance";
import { useUiStore, type ModalKey } from "../store/ui";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}));
const reownMocks = vi.hoisted(() => ({
  configured: false,
  disconnect: vi.fn(),
  open: vi.fn(),
  state: {
    address: null as string | null,
    isConnected: false,
    provider: null,
    status: "disconnected",
    walletIcon: null as string | null,
    walletName: "Solana Wallet"
  }
}));

vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  apiGet: apiMocks.get,
  apiPost: apiMocks.post
}));

vi.mock("../lib/reown", () => ({
  get isReownConfigured() {
    return reownMocks.configured;
  },
  disconnectReownWallet: reownMocks.disconnect,
  openReownWalletPicker: reownMocks.open,
  signReownWalletMessage: (
    provider: { signMessage: (message: Uint8Array) => Promise<unknown> },
    _walletName: string,
    message: Uint8Array
  ) => provider.signMessage(message),
  useReownWallet: () => reownMocks.state
}));

vi.mock("./TownCanvas", () => ({
  TownCanvas: ({
    onNpc,
    mode,
    controlsEnabled,
    onNearbyInteraction,
    chatBubbleText,
    initialPosition,
    onPositionChange
  }: {
    onNpc: (npc: ModalKey) => void;
    mode: string;
    controlsEnabled?: boolean;
    chatBubbleText?: string;
    initialPosition?: { x: number; y: number; facingX: number; facingY: number };
    onPositionChange?: (position: { x: number; y: number; facingX: number; facingY: number }) => void;
    onNearbyInteraction?: (interaction: {
      id: string;
      modal: ModalKey;
      label: string;
      prompt: string;
    } | null) => void;
  }) => (
    <div>
      <button
        type="button"
        data-testid="town-canvas"
        data-mode={mode}
        data-controls={String(controlsEnabled !== false)}
        data-chat-bubble={chatBubbleText ?? ""}
        data-position={initialPosition ? `${initialPosition.x},${initialPosition.y}` : ""}
        onClick={() => onNpc("market-broker")}
      >
        SolBloom Village
      </button>
      <button
        type="button"
        data-testid="mock-nearby"
        onClick={() =>
          onNearbyInteraction?.({
            id: "market-broker",
            modal: "market-broker",
            label: "Open Auction House",
            prompt: "[E] Open Auction House"
          })
        }
      >
        Mock nearby Mira
      </button>
      <button
        type="button"
        data-testid="mock-move-player"
        onClick={() => onPositionChange?.({ x: 420, y: 840, facingX: -1, facingY: 0 })}
      >
        Mock move player
      </button>
    </div>
  )
}));

import { App } from "../App";
import { LandingPage } from "./LandingPage";
import { WalletOnboardingModal } from "./WalletOnboardingModal";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function walletChallenge(
  publicKey: string,
  requestId: unknown,
  message: string,
  index = 1
) {
  return {
    publicKey,
    challengeWalletPublicKey: publicKey,
    challengeId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    nonce: `nonce-${index}-123456789012`,
    messageBase64: btoa(message),
    messageSha256: `sha256-${index}`,
    expiresAt: "2099-01-01T00:00:00.000Z",
    requestId
  };
}

const bootstrap: PlayerBootstrapData = {
  player: {
    id: "player-marky",
    displayName: "Marky",
    walletPublicKey: "DevMockMarky111111111111111111111111111111111",
    walletLinkedAt: "2026-06-29T00:00:00.000Z",
    accountLevel: 10,
    xp: 300,
    avatar: "M",
    power: 1280,
    status: "ACTIVE",
    marketFrozen: false,
    blackjackFrozen: false,
    unlockedMaps: ["tower-1-1", "tower-1-2", "tower-1-3"],
    balances: {
      EARNED_GOLD: 300,
      LOCKED_GOLD: 50,
      TEST_TOKEN: 250
    }
  },
  profile: {
    fullWalletAddress: "DevMockMarky111111111111111111111111111111111",
    shortenedWalletAddress: "DevM...1111",
    accountLevel: 10,
    xp: 300,
    selectedHero: "storm-archer",
    power: 1280,
    balances: {
      EARNED_GOLD: 300,
      LOCKED_GOLD: 50,
      TEST_TOKEN: 250
    },
    unlockedMaps: ["tower-1-1", "tower-1-2", "tower-1-3"],
    marketSellCapacityToday: 1000,
    blackjackTableTier: { minBet: 10, maxBet: 100 }
  },
  selectedHeroId: "storm-archer",
  unlockedMapCount: 3,
  townPosition: { x: 900, y: 640, facingX: 1, facingY: 0 }
};

beforeEach(() => {
  apiMocks.get.mockReset();
  apiMocks.post.mockReset();
  reownMocks.configured = false;
  reownMocks.disconnect.mockReset();
  reownMocks.open.mockReset();
  reownMocks.state.address = null;
  reownMocks.state.isConnected = false;
  reownMocks.state.provider = null;
  reownMocks.state.status = "disconnected";
  reownMocks.state.walletIcon = null;
  reownMocks.state.walletName = "Solana Wallet";
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
  useUiStore.setState({ modal: null });
  sessionStorage.clear();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("public landing and Spectate mode", () => {
  it("renders the root experience without authentication and opens Play Now", async () => {
    apiMocks.get.mockImplementation((path: string) => {
      if (path === "/api/player/me") {
        return Promise.reject(new Error("No active Supabase session"));
      }
      return Promise.resolve({
        devMode: true,
        testWorldActive: true,
        demoPresenceCount: 1,
        activeTownCount: 0
      });
    });
    renderApp();

    expect(await screen.findByRole("heading", { name: "SolTower" })).toBeTruthy();
    expect(await screen.findByText("0 players in town")).toBeTruthy();
    await userEvent.click(screen.getAllByRole("button", { name: /Play Now/i })[0]);
    expect(
      await screen.findByRole("heading", { name: "Connect Your Wallet" })
    ).toBeTruthy();
  });

  it("keeps Spectate read-only and turns NPC clicks into wallet entry prompts", async () => {
    apiMocks.get.mockResolvedValue({
      devMode: true,
      testWorldActive: true,
      demoPresenceCount: 1,
      activeTownCount: 0
    });
    render(<LandingPage onPlay={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Spectate/i }));
    expect(screen.queryByRole("heading", { name: "SolTower" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Inventory" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Market" })).toBeNull();
    expect(screen.getByTestId("town-canvas").dataset.mode).toBe("spectate");

    await userEvent.click(screen.getByTestId("town-canvas"));
    expect(
      screen.getByText("Connect a wallet and enter SolBloom Village to interact.")
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Enter SolBloom/i })).toBeTruthy();
  });
});

describe("wallet onboarding", () => {
  const bootstrapWalletPublicKey = bootstrap.player.walletPublicKey ?? "DevMock11111111111111111111111111111111";

  it("shows a recoverable error when wallet onboarding fails", async () => {
    apiMocks.post.mockRejectedValue(new Error("Nonce service unavailable"));
    render(
      <WalletOnboardingModal
        onClose={vi.fn()}
        onEntered={vi.fn()}
        onSpectate={vi.fn()}
      />
    );

    expect(screen.getByText(/1,000 \$TOWER \(DEV\) required to enter SolBloom Village/)).toBeTruthy();
    expect(screen.getByText(/10,000 \$TOWER \(DEV\)/)).toBeTruthy();
    expect(screen.queryByText(/required to enter in production/i)).toBeNull();
    await openDeveloperWallet();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Nonce service unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeTruthy();
  });

  it("opens the Solana-only AppKit picker from the single connect command", async () => {
    reownMocks.configured = true;
    render(
      <WalletOnboardingModal
        onClose={vi.fn()}
        onEntered={vi.fn()}
        onSpectate={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    expect(reownMocks.open).toHaveBeenCalledTimes(1);
  });

  it("does not authenticate a remembered wallet until Connect Wallet is clicked", async () => {
    const walletAddress = "11111111111111111111111111111111";
    reownMocks.configured = true;
    reownMocks.state.address = walletAddress;
    reownMocks.state.isConnected = true;
    reownMocks.state.provider = {
      signMessage: vi.fn().mockResolvedValue(new Uint8Array(64))
    } as never;
    reownMocks.state.walletName = "OKX Wallet";
    apiMocks.post.mockImplementation((path: string, body: Record<string, unknown>) => {
      if (path === "/api/auth/wallet/nonce") {
        return Promise.resolve(walletChallenge(
          walletAddress,
          body.requestId,
          "SolTower wallet login message for remembered wallet"
        ));
      }
      if (path === "/api/auth/wallet/verify") {
        return Promise.resolve({
          ...bootstrap,
          isNewPlayer: false,
          requiresProfile: false,
          intro: "Returning profile loaded."
        });
      }
      return Promise.reject(new Error(`Unexpected path ${path}`));
    });

    render(
      <WalletOnboardingModal
        onClose={vi.fn()}
        onEntered={vi.fn()}
        onSpectate={vi.fn()}
      />
    );

    await act(async () => Promise.resolve());
    expect(apiMocks.post).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    expect(await screen.findByRole("heading", { name: "Welcome, Marky" })).toBeTruthy();
    expect(apiMocks.post.mock.calls.filter(([path]) => path === "/api/auth/wallet/nonce")).toHaveLength(1);
  });

  it("shows structured verification errors and retries with a fresh challenge", async () => {
    const { WalletAuthError } = await import("../lib/api");
    const walletAddress = "11111111111111111111111111111111";
    const signMessage = vi.fn().mockResolvedValue(new Uint8Array(64));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    reownMocks.configured = true;
    reownMocks.state.address = walletAddress;
    reownMocks.state.isConnected = true;
    reownMocks.state.provider = { signMessage } as never;
    reownMocks.state.walletName = "Test Wallet";
    let nonceCount = 0;
    apiMocks.post.mockImplementation((path: string, body: Record<string, unknown>) => {
      if (path === "/api/auth/wallet/nonce") {
        nonceCount += 1;
        return Promise.resolve(walletChallenge(
          walletAddress,
          body.requestId,
          `SolTower wallet login message ${nonceCount}`,
          nonceCount
        ));
      }
      if (path === "/api/auth/wallet/verify" && nonceCount === 1) {
        return Promise.reject(new WalletAuthError(
          "public_key_mismatch",
          "The connected wallet changed. Please sign again."
        ));
      }
      if (path === "/api/auth/wallet/verify") {
        return Promise.resolve({
          ...bootstrap,
          isNewPlayer: false,
          requiresProfile: false,
          intro: "Returning profile loaded."
        });
      }
      return Promise.reject(new Error(`Unexpected path ${path}`));
    });

    render(
      <WalletOnboardingModal
        onClose={vi.fn()}
        onEntered={vi.fn()}
        onSpectate={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    expect(await screen.findByText("The connected wallet changed. Please sign again.")).toBeTruthy();
    const firstVerifyPayload = apiMocks.post.mock.calls.find(
      ([path]) => path === "/api/auth/wallet/verify"
    )?.[1] as Record<string, unknown>;
    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(await screen.findByRole("heading", { name: "Welcome, Marky" })).toBeTruthy();

    const nonceCalls = apiMocks.post.mock.calls.filter(([path]) => path === "/api/auth/wallet/nonce");
    const verifyCalls = apiMocks.post.mock.calls.filter(([path]) => path === "/api/auth/wallet/verify");
    expect(nonceCalls).toHaveLength(2);
    expect(verifyCalls).toHaveLength(2);
    expect((verifyCalls[1][1] as Record<string, unknown>).requestId).not.toBe(firstVerifyPayload.requestId);
    expect(firstVerifyPayload).toMatchObject({
      challengeId: "00000000-0000-4000-8000-000000000001",
      provider: "Test Wallet"
    });
    expect(firstVerifyPayload).not.toHaveProperty("message");
    expect(firstVerifyPayload).not.toHaveProperty("nonce");
    expect(signMessage).toHaveBeenCalledTimes(2);
    expect(new TextDecoder().decode(signMessage.mock.calls[0][0] as Uint8Array)).toBe(
      "SolTower wallet login message 1"
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(String(firstVerifyPayload.signatureBase64));
  });

  it("does not refetch the player bootstrap merely because the browser tab regains focus", () => {
    const main = readFileSync(join(webRoot, "src/main.tsx"), "utf8");
    const app = readFileSync(join(webRoot, "src/App.tsx"), "utf8");
    expect(main).toContain("refetchOnWindowFocus: false");
    expect(main).toContain("refetchOnReconnect: false");
    expect(app).toContain("!me.data && me.isLoading");
  });

  it("creates a first-time profile once after name availability succeeds", async () => {
    const newPlayer = {
      ...bootstrap,
      player: {
        ...bootstrap.player,
        id: "player-new",
        displayName: "NewGuardian",
        accountLevel: 1,
        power: 180,
        balances: { EARNED_GOLD: 0, LOCKED_GOLD: 50, TEST_TOKEN: 0 },
        unlockedMaps: ["tower-1-1"]
      },
      selectedHeroId: "tide-mage",
      profile: {
        ...bootstrap.profile,
        selectedHero: "tide-mage",
        accountLevel: 1,
        power: 180,
        balances: { EARNED_GOLD: 0, LOCKED_GOLD: 50, TEST_TOKEN: 0 },
        unlockedMaps: ["tower-1-1"]
      },
      unlockedMapCount: 1
    };
    apiMocks.post.mockImplementation((path: string) => {
      if (path === "/api/auth/wallet/nonce") {
        return Promise.resolve(walletChallenge(
          bootstrapWalletPublicKey,
          "request-dev-profile",
          "SolTower wallet login message for DEV"
        ));
      }
      if (path === "/api/auth/wallet/verify") {
        return Promise.resolve({
          isNewPlayer: true,
          requiresProfile: true,
          intro: "Wallet verified.",
          verifiedWallet: {
            publicKey: bootstrap.player.walletPublicKey,
            nonce: "nonce-123456789012",
            expiresAt: "2026-06-29T12:05:00.000Z"
          }
        });
      }
      if (path === "/api/auth/wallet/display-name") {
        return Promise.resolve({ available: true });
      }
      if (path === "/api/auth/wallet/profile") {
        return Promise.resolve({
          ...newPlayer,
          isNewPlayer: true,
          requiresProfile: false,
          intro: "Welcome to SolBloom Village."
        });
      }
      return Promise.reject(new Error(`Unexpected path ${path}`));
    });
    render(
      <WalletOnboardingModal
        onClose={vi.fn()}
        onEntered={vi.fn()}
        onSpectate={vi.fn()}
      />
    );

    await openDeveloperWallet();
    expect(await screen.findByRole("heading", { name: "Choose Your First Guardian" })).toBeTruthy();
    for (const heroName of ["Storm Archer", "Tide Mage", "Bombardier", "Coral Alchemist", "Starcaller"]) {
      expect(screen.getByRole("option", { name: new RegExp(heroName) })).toBeTruthy();
    }
    expect(document.querySelectorAll(".starter-hero-card-frame img")).toHaveLength(5);
    expect(document.querySelector(".starter-hero-art")).toBeNull();
    const stormPreview = screen.getByRole("img", { name: "Storm Archer walking animation" });
    expect(stormPreview.getAttribute("style")).toContain("walk-8dir.png");
    await userEvent.click(screen.getByRole("option", { name: /Tide Mage/i }));
    expect(screen.getByRole("option", { name: /Tide Mage/i }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("img", { name: "Tide Mage walking animation" }).getAttribute("style")).toContain(
      "/assets/soltower/heroes/tide-mage/walk-8dir.png"
    );

    const nameInput = await screen.findByLabelText("Display name");
    await userEvent.type(nameInput, "NewGuardian");
    expect(await screen.findByText("Name available.", {}, { timeout: 1500 })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Create Guardian/i }));
    expect(await screen.findByRole("heading", { name: "Welcome, NewGuardian" })).toBeTruthy();
    expect(screen.getByText("50", { selector: "strong" })).toBeTruthy();
    expect(
      apiMocks.post.mock.calls.filter(([path]) => path === "/api/auth/wallet/profile")
    ).toHaveLength(1);
    const profileCall = apiMocks.post.mock.calls.find(([path]) => path === "/api/auth/wallet/profile");
    expect(profileCall?.[1]).toEqual(expect.objectContaining({ heroId: "tide-mage" }));
  });

  it("loads a returning profile without issuing another profile creation request", async () => {
    apiMocks.post.mockImplementation((path: string) => {
      if (path === "/api/auth/wallet/nonce") {
        return Promise.resolve(walletChallenge(
          bootstrapWalletPublicKey,
          "request-dev-returning",
          "SolTower wallet login message for DEV"
        ));
      }
      if (path === "/api/auth/wallet/verify") {
        return Promise.resolve({
          ...bootstrap,
          isNewPlayer: false,
          requiresProfile: false,
          intro: "Returning profile loaded."
        });
      }
      return Promise.reject(new Error(`Unexpected path ${path}`));
    });
    const onEntered = vi.fn();
    render(
      <WalletOnboardingModal
        onClose={vi.fn()}
        onEntered={onEntered}
        onSpectate={vi.fn()}
      />
    );

    await openDeveloperWallet();
    expect(await screen.findByRole("heading", { name: "Welcome, Marky" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Enter Village" }));
    expect(onEntered).toHaveBeenCalledWith(expect.objectContaining({ player: bootstrap.player }));
    expect(
      apiMocks.post.mock.calls.some(([path]) => path === "/api/auth/wallet/profile")
    ).toBe(false);
  });

  it("retains safe mobile modal spacing rules", () => {
    const css = readFileSync(join(webRoot, "src/styles/main.css"), "utf8");
    expect(css).toContain("max(24px, env(safe-area-inset-top))");
    expect(css).toContain("max(16px, env(safe-area-inset-right))");
    expect(css).toContain("max(24px, env(safe-area-inset-bottom))");
    expect(css).toContain("max(16px, env(safe-area-inset-left))");
    expect(css).toContain("min-height: 52px");
  });
});

describe("authenticated town", () => {
  beforeEach(() => {
    apiMocks.get.mockImplementation((path: string) => {
      if (path === "/api/player/me") {
        return Promise.resolve(bootstrap);
      }
      if (path === "/api/town/servers") {
        return Promise.resolve(mockTownServers());
      }
      if (path.startsWith("/api/chat/recent")) {
        return Promise.resolve({ messages: [] });
      }
      if (path === "/api/inventory") {
        return Promise.resolve({
          equipment: [
            {
              id: "item-bow",
              definitionId: "basic-bow",
              name: "Basic Bow",
              rarity: "COMMON",
              slot: "WEAPON",
              equippedSlot: "WEAPON",
              level: 1,
              bound: true,
              relistable: false,
              stats: { damage: 18, range: 12 }
            }
          ],
          consumables: [],
          materials: []
        });
      }
      if (path === "/api/quests") {
        return Promise.resolve({
          serverTime: "2026-06-29T12:00:00.000Z",
          dailyResetAt: "2026-06-30T00:00:00.000Z",
          weeklyResetAt: "2026-07-06T00:00:00.000Z",
          daily: [
            {
              assignmentId: "11111111-1111-4111-8111-111111111111",
              definitionId: "daily-first-defense",
              title: "First Defense",
              description: "Complete 1 raid.",
              progress: 0,
              target: 1,
              rewardEarnedGold: 4,
              rewardXp: 60,
              status: "ACTIVE"
            },
            {
              assignmentId: "22222222-2222-4222-8222-222222222222",
              definitionId: "daily-claimed-patrol",
              title: "Claimed Patrol",
              description: "Defeat 1 raid boss.",
              progress: 1,
              target: 1,
              rewardEarnedGold: 15,
              rewardXp: 100,
              status: "CLAIMED"
            }
          ],
          weekly: [],
          achievements: [],
          unavailableWeekly: []
        });
      }
      if (path === "/api/market/listings") {
        return Promise.resolve({ listings: [], history: [] });
      }
      if (path === "/api/market/buy-orders") {
        return Promise.resolve({ buyOrders: [] });
      }
      return Promise.resolve({
        devMode: true,
        testWorldActive: true,
        demoPresenceCount: 1,
        activeTownCount: 0
      });
    });
  });

  it("disconnects the local session and returns to the public landing page", async () => {
    apiMocks.post.mockResolvedValue({ ok: true });
    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: /Marky/i }));
    await userEvent.click(screen.getByRole("button", { name: "Disconnect Wallet" }));
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(await screen.findByRole("heading", { name: "SolTower" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Disconnect Wallet" })).toBeNull();
  });

  it("restores the saved town position and persists later movement", async () => {
    apiMocks.post.mockResolvedValue({ position: { x: 420, y: 840, facingX: -1, facingY: 0 } });
    renderApp();

    const town = await screen.findByTestId("town-canvas");
    expect(town.getAttribute("data-position")).toBe("900,640");
    await userEvent.click(screen.getByTestId("mock-move-player"));
    await waitFor(() =>
      expect(apiMocks.post).toHaveBeenCalledWith("/api/town/position", {
        townChannel: "solbloom-1",
        x: 420,
        y: 840,
        facingX: -1,
        facingY: 0
      })
    );
  });

  it("opens and closes Inventory with I while town controls are locked", async () => {
    renderApp();
    expect((await screen.findByTestId("town-canvas")).getAttribute("data-controls")).toBe("true");

    await userEvent.keyboard("i");
    expect(await screen.findByRole("heading", { name: "Inventory" })).toBeTruthy();
    expect(screen.getByTestId("town-canvas").getAttribute("data-controls")).toBe("false");

    await userEvent.keyboard("i");
    expect(screen.queryByRole("heading", { name: "Inventory" })).toBeNull();
    expect(screen.getByTestId("town-canvas").getAttribute("data-controls")).toBe("true");
  });

  it("uses one Inventory tab row and switches to one visible tab panel", async () => {
    renderApp();
    await screen.findByTestId("town-canvas");
    await userEvent.keyboard("i");
    expect(await screen.findByRole("heading", { name: "Inventory" })).toBeTruthy();
    expect(document.querySelectorAll("[role='tablist'][aria-label='Inventory tabs']")).toHaveLength(1);
    expect(screen.getByLabelText("Equipment inventory")).toBeTruthy();

    await userEvent.click(screen.getByRole("tab", { name: "Consumables" }));
    expect(screen.getByLabelText("Consumables")).toBeTruthy();
    expect(screen.queryByLabelText("Equipment inventory")).toBeNull();
  });

  it("renders premium shortcut keycaps in the town HUD and settings controls", async () => {
    renderApp();
    await screen.findByTestId("town-canvas");

    const townKeycaps = Array.from(
      document.querySelectorAll(".town-control-hint .shortcut-keycap")
    ).map((keycap) => keycap.textContent);
    expect(townKeycaps).toEqual(["W", "A", "S", "D", "Shift", "E", "I", "Q"]);

    await userEvent.click(screen.getAllByRole("button", { name: "Settings" })[0]);
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Controls" }));

    const settingsKeycaps = Array.from(
      document.querySelectorAll(".settings-shortcut-hint .shortcut-keycap")
    ).map((keycap) => keycap.textContent);
    expect(settingsKeycaps).toEqual(["W", "A", "S", "D", "Shift", "E", "I", "Q", "Esc"]);
    expect(document.querySelector(".mobile-move-pad")).toBeTruthy();
  });

  it("uses the selected Hero portrait in the idle HUD profile instead of a letter avatar", async () => {
    renderApp();
    await screen.findByTestId("town-canvas");

    const hudAvatar = document.querySelector(".hud-profile .hero-appearance-preview");
    expect(hudAvatar?.getAttribute("data-hero-id")).toBe("storm-archer");
    expect(document.querySelector(".hud-profile .avatar")).toBeNull();
    expect(document.querySelector(".hud-profile img")?.getAttribute("src")).toBe(
      "/assets/soltower/heroes/storm-archer/icon.png"
    );
  });

  it("updates the Cosmetics preview and saved appearance immediately", async () => {
    renderApp();
    await screen.findByTestId("town-canvas");
    await userEvent.keyboard("i");
    expect(await screen.findByRole("heading", { name: "Inventory" })).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Cosmetics" }));

    const preview = document.querySelector(".cosmetics-panel .hero-appearance-preview");
    expect(preview?.getAttribute("data-hair-style")).toBe("storm-swept");
    fireEvent.change(screen.getByLabelText("Hair"), { target: { value: "crest" } });
    expect(preview?.getAttribute("data-hair-style")).toBe("crest");
    expect(localStorage.getItem(heroAppearanceStorageKey)).toContain('"hairStyle":"crest"');

    await userEvent.click(screen.getByRole("button", { name: "Accent Color: Starlit Violet" }));
    expect(preview?.querySelector(".hero-preview-layer")).toBeNull();
    expect(localStorage.getItem(heroAppearanceStorageKey)).toContain('"accentColor":"#a78bfa"');
  });

  it("keeps Cosmetics metadata collision-safe and idle HUD focus styling restrained", () => {
    const css = readFileSync(join(webRoot, "src/styles/main.css"), "utf8");
    expect(css).toContain(".cosmetic-grid article");
    expect(css).toContain("grid-template-columns: minmax(118px, 0.36fr) minmax(0, 1fr)");
    expect(css).toContain(".hud-profile-button:focus-visible");
    expect(css).toContain("--focus-ring:");
    expect(css).not.toContain("border: 3px solid #7dd3fc");
    expect(css).not.toContain(".avatar {");
  });

  it("persists settings sliders and plays generated UI audio from the settings panel", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const audioFactory = vi.fn().mockImplementation(function MockAudio(this: HTMLAudioElement, src: string) {
      this.src = src;
      this.play = play;
      this.pause = vi.fn();
    });
    vi.stubGlobal("Audio", audioFactory);
    renderApp();
    await screen.findByTestId("town-canvas");

    await userEvent.click(screen.getAllByRole("button", { name: "Settings" })[0]);
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Master Volume/), { target: { value: "0.33" } });
    expect(localStorage.getItem("soltower:user-settings:v1")).toContain('"masterVolume":0.33');
    await userEvent.click(screen.getByRole("tab", { name: "Motion" }));
    fireEvent.change(screen.getByLabelText(/Camera Height/), { target: { value: "0.72" } });
    expect(localStorage.getItem("soltower:user-settings:v1")).toContain('"cameraZoom":0.72');

    await userEvent.click(screen.getByRole("tab", { name: "Audio" }));
    await userEvent.click(screen.getByRole("button", { name: "Test UI Sound" }));
    expect(audioFactory).toHaveBeenCalledWith("/assets/audio/ui/success.wav");
    expect(play).toHaveBeenCalled();
  });

  it("keeps gameplay shortcuts out of focused text fields", async () => {
    renderApp();
    await screen.findByTestId("town-canvas");
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();

    await userEvent.keyboard("iqe");
    expect(screen.queryByRole("heading", { name: "Inventory" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Quest Journal" })).toBeNull();
    input.remove();
  });

  it("uses Enter to focus and send town chat without trapping movement afterward", async () => {
    let resolveChat: ((value: unknown) => void) | undefined;
    apiMocks.post.mockImplementation((path: string, _body: Record<string, unknown>) => {
      if (path === "/api/chat/message") {
        return new Promise((resolve) => {
          resolveChat = resolve;
        });
      }
      return Promise.resolve({ ok: true });
    });
    renderApp();
    await screen.findByTestId("town-canvas");

    await userEvent.keyboard("{Enter}");
    const chatInput = await screen.findByLabelText("Town chat message");
    expect(document.activeElement).toBe(chatInput);
    await userEvent.type(chatInput, "wasd works");
    expect((chatInput as HTMLInputElement).value).toBe("wasd works");
    expect(screen.queryByRole("heading", { name: "Inventory" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Quest Journal" })).toBeNull();

    await userEvent.keyboard("{Enter}");
    expect(screen.getByTestId("town-canvas").getAttribute("data-chat-bubble")).toBe("wasd works");
    expect((chatInput as HTMLInputElement).value).toBe("");
    expect(document.activeElement).not.toBe(chatInput);
    expect(screen.getByText("wasd works")).toBeTruthy();
    await waitFor(() =>
      expect(apiMocks.post).toHaveBeenCalledWith("/api/chat/message", {
        channel: "TOWN",
        townChannel: "solbloom-1",
        message: "wasd works"
      })
    );
    resolveChat?.({
      message: {
        id: "chat-1",
        channel: "TOWN",
        townChannel: "solbloom-1",
        fromPlayerId: "player-marky",
        message: "wasd works",
        createdAt: "2026-06-30T00:00:00.000Z"
      }
    });
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledWith("/api/town/servers"));
  });

  it("opens Quest Journal with Q and closes the topmost panel with Escape", async () => {
    renderApp();
    await screen.findByTestId("town-canvas");

    await userEvent.keyboard("q");
    expect(await screen.findByRole("heading", { name: "Quest Journal" })).toBeTruthy();
    expect(await screen.findByText("First Defense")).toBeTruthy();
    const claimedCard = screen.getByText("Claimed Patrol").closest(".quest-card");
    expect(claimedCard?.classList.contains("quest-card--claimed")).toBe(true);
    expect(claimedCard?.classList.contains("quest-claimed-badge")).toBe(false);
    expect(claimedCard?.querySelector(".quest-claimed-badge")?.textContent).toContain("Claimed");

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("heading", { name: "Quest Journal" })).toBeNull();
  });

  it("ticks Quest Journal server time and reset countdown from synced server offset", async () => {
    renderApp();
    await screen.findByTestId("town-canvas");
    await userEvent.keyboard("q");
    await screen.findByText("First Defense");
    const resetRow = document.querySelector(".quest-reset-row");
    const initialTimerText = resetRow?.textContent ?? "";
    expect(initialTimerText).toMatch(/Server UTC 2026-06-29 (11:59:59|12:00:00)/);
    expect(resetRow?.textContent).toMatch(/Daily reset in (12h 0m 0s|11h 59m 59s)/);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1100));
    });

    await waitFor(() => {
      expect(resetRow?.textContent).not.toBe(initialTimerText);
      expect(resetRow?.textContent).toMatch(/Server UTC 2026-06-29 12:00:0[01]/);
    });
    expect(resetRow?.textContent).toMatch(/Daily reset in 11h 59m 5[89]s/);
  });

  it("switches Market Board tabs without showing overlapping panels", async () => {
    renderApp();
    await screen.findByTestId("town-canvas");
    await userEvent.click(screen.getByRole("button", { name: "Market" }));
    expect(await screen.findByRole("heading", { name: "Market Board" })).toBeTruthy();
    expect(await screen.findByText("No active listings")).toBeTruthy();
    expect(screen.queryByLabelText("Sell Gold")).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: "Sell Gold" }));
    expect(screen.getByLabelText("Sell Gold")).toBeTruthy();
    expect(screen.getByText("Seller receives")).toBeTruthy();
    expect(screen.getByText(/Selling Gold requires Level 10 and 10,000 \$TOWER \(DEV\)/)).toBeTruthy();
    expect(screen.queryByText("No active listings")).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: "Auction House" }));
    expect(screen.getByLabelText("Auction House")).toBeTruthy();
    expect(screen.getByText("Auction seller requirements")).toBeTruthy();
    expect(screen.getByText("No auction listings yet")).toBeTruthy();
  });

  it("previews market tax using the shared transaction rules", async () => {
    renderApp();
    await screen.findByTestId("town-canvas");
    await userEvent.click(screen.getByRole("button", { name: "Market" }));
    await userEvent.click(await screen.findByRole("tab", { name: "Sell Gold" }));

    expect(document.querySelector(".preview-box")?.textContent).toContain("Gross total200 $TOWER (DEV)");
    expect(document.querySelector(".preview-box")?.textContent).toContain("Market tax20 $TOWER (DEV)");
    expect(document.querySelector(".preview-box")?.textContent).toContain("Seller receives180 $TOWER (DEV)");

    fireEvent.change(screen.getByLabelText("Gold amount"), { target: { value: "125" } });
    fireEvent.change(screen.getByLabelText("Price per Gold"), { target: { value: "3" } });
    expect(document.querySelector(".preview-box")?.textContent).toContain("Gross total375 $TOWER (DEV)");
    expect(document.querySelector(".preview-box")?.textContent).toContain("Market tax37 $TOWER (DEV)");
    expect(document.querySelector(".preview-box")?.textContent).toContain("Seller receives338 $TOWER (DEV)");
  });

  it("keeps My Activity scoped to the current account", async () => {
    mockAuthenticatedMarketData();
    renderApp();
    await screen.findByTestId("town-canvas");
    await userEvent.click(screen.getByRole("button", { name: "Market" }));
    await userEvent.click(await screen.findByRole("tab", { name: "My Activity" }));

    const panel = screen.getByLabelText("My Activity");
    expect(panel.textContent).toContain("Active · 100 Gold · 200 $TOWER (DEV)");
    expect(panel.textContent).toContain("OPEN · 140 Gold open · escrow 280 $TOWER (DEV)");
    expect(panel.textContent).toContain("Bought · 45 Gold · gross 90 $TOWER (DEV)");
    expect(panel.textContent).toContain("Sold · 60 Gold · gross 120 $TOWER (DEV)");
    expect(panel.textContent).not.toContain("999 Gold");
    expect(panel.textContent).not.toContain("gross 999");
  });

  it("shows global market feed entries and filters public events", async () => {
    mockAuthenticatedMarketData();
    renderApp();
    await screen.findByTestId("town-canvas");
    await userEvent.click(screen.getByRole("button", { name: "Market" }));
    await userEvent.click(await screen.findByRole("tab", { name: "Live Feed" }));

    expect(await screen.findByText("Other listed 999 Gold")).toBeTruthy();
    expect(screen.getByText("Marky created a buy order")).toBeTruthy();
    expect(screen.getByText("Marky bought 45 Gold")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Sales" }));
    const feed = screen.getByLabelText("Live Feed");
    expect(feed.textContent).toContain("Marky bought 45 Gold");
    expect(feed.textContent).toContain("Other bought 999 Gold");
    expect(feed.textContent).not.toContain("listed 999 Gold");
    expect(feed.textContent).not.toContain("created a buy order");
  });

  it("uses the nearest contextual interaction for E and mobile/tap action", async () => {
    renderApp();
    await userEvent.click(await screen.findByTestId("mock-nearby"));

    await userEvent.keyboard("e");
    expect(await screen.findByRole("heading", { name: "Market Board" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByRole("button", { name: /Open Auction House/i }));
    expect(await screen.findByRole("heading", { name: "Market Board" })).toBeTruthy();
  });
});

function renderApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  );
}

async function openDeveloperWallet() {
  await userEvent.click(screen.getByText("Developer options"));
  await userEvent.click(
    screen.getByRole("button", { name: "DEV ONLY — NOT A REAL WALLET" })
  );
}

function mockAuthenticatedMarketData() {
  apiMocks.get.mockImplementation((path: string) => {
    if (path === "/api/player/me") {
      return Promise.resolve(bootstrap);
    }
    if (path === "/api/town/servers") {
      return Promise.resolve(mockTownServers());
    }
    if (path.startsWith("/api/chat/recent")) {
      return Promise.resolve({ messages: [] });
    }
    if (path === "/api/inventory") {
      return Promise.resolve({
        equipment: [],
        consumables: [],
        materials: []
      });
    }
    if (path === "/api/quests") {
      return Promise.resolve({
        serverTime: "2026-06-29T12:00:00.000Z",
        dailyResetAt: "2026-06-30T00:00:00.000Z",
        weeklyResetAt: "2026-07-06T00:00:00.000Z",
        daily: [],
        weekly: [],
        achievements: [],
        unavailableWeekly: []
      });
    }
    if (path === "/api/market/listings") {
      return Promise.resolve({
        listings: [
          {
            id: "listing-own",
            sellerPlayerId: "player-marky",
            goldAmount: 100,
            pricePerGold: 2,
            totalPrice: 200,
            status: "ACTIVE",
            createdAt: "2026-06-29T12:05:00.000Z"
          },
          {
            id: "listing-other",
            sellerPlayerId: "player-other",
            goldAmount: 999,
            pricePerGold: 3,
            totalPrice: 2997,
            status: "ACTIVE",
            createdAt: "2026-06-29T12:07:00.000Z"
          }
        ],
        history: [
          {
            id: "trade-purchase",
            buyerPlayerId: "player-marky",
            sellerPlayerId: "player-ana",
            goldAmount: 45,
            grossTestToken: 90,
            taxTestToken: 9,
            sellerNet: 81,
            createdAt: "2026-06-29T12:06:00.000Z"
          },
          {
            id: "trade-sale",
            buyerPlayerId: "player-rex",
            sellerPlayerId: "player-marky",
            goldAmount: 60,
            grossTestToken: 120,
            taxTestToken: 12,
            sellerNet: 108,
            createdAt: "2026-06-29T12:04:00.000Z"
          },
          {
            id: "trade-other",
            buyerPlayerId: "player-other",
            sellerPlayerId: "player-ana",
            goldAmount: 999,
            grossTestToken: 999,
            taxTestToken: 99,
            sellerNet: 900,
            createdAt: "2026-06-29T12:03:00.000Z"
          }
        ]
      });
    }
    if (path === "/api/market/buy-orders") {
      return Promise.resolve({
        buyOrders: [
          {
            id: "order-own",
            buyerPlayerId: "player-marky",
            goldAmount: 140,
            openGoldAmount: 140,
            pricePerGold: 2,
            escrowRemaining: 280,
            status: "OPEN",
            createdAt: "2026-06-29T12:08:00.000Z"
          },
          {
            id: "order-other",
            buyerPlayerId: "player-other",
            goldAmount: 999,
            openGoldAmount: 999,
            pricePerGold: 4,
            escrowRemaining: 3996,
            status: "OPEN",
            createdAt: "2026-06-29T12:09:00.000Z"
          }
        ]
      });
    }
    return Promise.resolve({
      devMode: true,
      testWorldActive: true,
      demoPresenceCount: 1,
      activeTownCount: 0
    });
  });
}

function mockTownServers() {
  return {
    servers: [
      { id: "solbloom-1", label: "SolBloom 1", online: 2, capacity: 40, isFull: false },
      { id: "solbloom-2", label: "SolBloom 2", online: 0, capacity: 40, isFull: false },
      { id: "solbloom-3", label: "SolBloom 3", online: 0, capacity: 40, isFull: false },
      { id: "solbloom-4", label: "SolBloom 4", online: 0, capacity: 40, isFull: false },
      { id: "solbloom-5", label: "SolBloom 5", online: 0, capacity: 40, isFull: false }
    ]
  };
}
