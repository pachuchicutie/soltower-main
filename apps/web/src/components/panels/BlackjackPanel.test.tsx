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

  it("uses a zero-wager, zero-reward practice flow only when the server enables it", async () => {
    apiMocks.get.mockResolvedValue({
      practiceAllowed: true,
      limits: { minBet: 5, tableMaxBet: 15, balanceMaxBet: 0, actualMaxBet: 0 },
      profitCap: 100,
      profitProgress: 20,
      history: []
    });
    apiMocks.post.mockResolvedValue({
      hand: {
        ...activeHand,
        bet: 0,
        totalWager: 0,
        practiceMode: true
      }
    });
    renderBlackjack();

    expect(await screen.findByText("Practice mode is active")).toBeTruthy();
    expect(screen.getAllByText("0 Gold")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Earned Gold" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Deal Practice Hand" }));

    await waitFor(() =>
      expect(apiMocks.post).toHaveBeenCalledWith("/api/blackjack/deal", {
        balanceType: "EARNED_GOLD",
        bet: 0,
        practice: true,
        idempotencyKey: "deal-test"
      })
    );
    expect(await screen.findByText("Practice hand · 0 Gold")).toBeTruthy();
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
