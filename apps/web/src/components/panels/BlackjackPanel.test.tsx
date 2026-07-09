// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlackjackPanel } from "./BlackjackPanel";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}));

vi.mock("../../lib/api", () => ({
  apiGet: apiMocks.get,
  apiPost: apiMocks.post,
  idempotencyKey: (prefix: string) => `${prefix}-test`
}));

const activeHand = {
  id: "hand-private-uuid",
  balanceType: "LOCKED_GOLD",
  bet: 5,
  totalWager: 5,
  practiceMode: false,
  status: "ACTIVE",
  playerCards: [
    { rank: "4", suit: "C" },
    { rank: "J", suit: "C" }
  ],
  dealerCards: [{ rank: "A", suit: "D" }],
  shoeSeedHash: "0d38be4318a8605de2-private",
  resultMetadata: {},
  createdAt: "2026-07-02T00:00:00.000Z"
};

beforeEach(() => {
  apiMocks.get.mockResolvedValue({
    practiceAllowed: false,
    limits: { minBet: 5, tableMaxBet: 15, balanceMaxBet: 15, actualMaxBet: 15 },
    earnedLimits: { minBet: 5, tableMaxBet: 15, balanceMaxBet: 8, actualMaxBet: 8 },
    lockedLimits: { minBet: 5, tableMaxBet: 15, balanceMaxBet: 15, actualMaxBet: 15 },
    balances: { EARNED_GOLD: 40, LOCKED_GOLD: 100 },
    maxBetBalanceRate: 0.2,
    profitCap: 100,
    profitProgress: 20,
    history: [activeHand]
  });
  apiMocks.post.mockResolvedValue({
    hand: {
      ...activeHand,
      playerCards: [...activeHand.playerCards, { rank: "2", suit: "H" }]
    }
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BlackjackPanel", () => {
  it("renders readable cards and friendly hand details without exposing IDs or hashes", async () => {
    renderBlackjack();

    expect(await screen.findByLabelText("Ace of Diamonds")).toBeTruthy();
    expect(screen.getByLabelText("4 of Clubs")).toBeTruthy();
    expect(screen.getByLabelText("Jack of Clubs")).toBeTruthy();
    expect(screen.getByLabelText("Face-down card")).toBeTruthy();
    expect(screen.getByText("Showing 11")).toBeTruthy();
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.getByText("Fair shuffle secured")).toBeTruthy();
    expect(screen.queryByText(/shuffle hash/i)).toBeNull();
    expect(screen.queryByText(/hand-private-uuid/i)).toBeNull();
    expect(screen.queryByText(/0d38be/i)).toBeNull();
  });

  it("keeps the private hand ID only in the server-authoritative action request", async () => {
    renderBlackjack();

    fireEvent.click(await screen.findByRole("button", { name: "Hit" }));

    await waitFor(() =>
      expect(apiMocks.post).toHaveBeenCalledWith("/api/blackjack/hand-private-uuid/action", {
        action: "HIT",
        idempotencyKey: "hit-test"
      })
    );
    expect(screen.queryByText(/hand-private-uuid/i)).toBeNull();
  });

  it("always deals real-gold hands and never shows practice table copy", async () => {
    apiMocks.get.mockResolvedValue({
      practiceAllowed: true,
      limits: { minBet: 5, tableMaxBet: 15, balanceMaxBet: 15, actualMaxBet: 15 },
      earnedLimits: { minBet: 5, tableMaxBet: 15, balanceMaxBet: 8, actualMaxBet: 8 },
      lockedLimits: { minBet: 5, tableMaxBet: 15, balanceMaxBet: 15, actualMaxBet: 15 },
      balances: { EARNED_GOLD: 40, LOCKED_GOLD: 100 },
      maxBetBalanceRate: 0.2,
      profitCap: 100,
      profitProgress: 20,
      history: []
    });
    apiMocks.post.mockResolvedValue({
      hand: {
        ...activeHand,
        bet: 5,
        totalWager: 5,
        practiceMode: false
      }
    });
    renderBlackjack();

    expect(await screen.findByText("Village Table")).toBeTruthy();
    expect(screen.queryByText("Practice mode is active")).toBeNull();
    expect(screen.queryByText("Deal Practice Hand")).toBeNull();
    expect(screen.getByRole("button", { name: /Earned Gold/i })).toBeTruthy();
    const dealButton = await screen.findByRole("button", { name: /Deal Hand/i });
    await waitFor(() => expect((dealButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(dealButton);

    await waitFor(() =>
      expect(apiMocks.post).toHaveBeenCalledWith(
        "/api/blackjack/deal",
        expect.objectContaining({
          balanceType: "EARNED_GOLD",
          practice: false,
          idempotencyKey: "deal-test"
        })
      )
    );
    expect(apiMocks.post.mock.calls.some((call) => call[1]?.bet === 5 || call[1]?.bet > 0)).toBe(true);
  });

  it("shows full balance separately from max wager (20% rule)", async () => {
    renderBlackjack();

    expect(await screen.findByText("40 Gold")).toBeTruthy();
    expect(screen.getByText("Your balance")).toBeTruthy();
    expect(screen.getByText("Max wager")).toBeTruthy();
    expect(screen.getByText("8 Gold")).toBeTruthy();
    expect(screen.getByText(/Earned Gold · 40/i)).toBeTruthy();
    expect(screen.queryByText("Available now")).toBeNull();
    expect(screen.getByText(/20% of your selected balance/i)).toBeTruthy();
  });
});

function renderBlackjack() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BlackjackPanel />
    </QueryClientProvider>
  );
}
