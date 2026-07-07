// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBoardPanel } from "./EventBoardPanel";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn()
}));

vi.mock("../../lib/api", () => ({
  apiGet: apiMocks.get
}));

beforeEach(() => {
  apiMocks.get.mockImplementation((path: string) => {
    if (path === "/api/events/leaderboard?period=weekly") {
      return Promise.resolve({
        period: "weekly",
        generatedAt: "2026-07-04T08:00:00.000Z",
        entries: [
          {
            playerId: "player-1",
            displayName: "CozyAnsem",
            heroId: "tide-mage",
            accountLevel: 4,
            power: 515,
            clears: 6,
            bosses: 2,
            earnedGold: 180,
            xp: 500,
            fastestSeconds: 252,
            latestClearAt: "2026-07-04T07:00:00.000Z"
          },
          {
            playerId: "player-2",
            displayName: "Booo",
            heroId: "storm-archer",
            accountLevel: 2,
            power: 455,
            clears: 2,
            bosses: 1,
            earnedGold: 70,
            xp: 220,
            fastestSeconds: 310,
            latestClearAt: "2026-07-04T06:00:00.000Z"
          }
        ]
      });
    }
    return Promise.resolve({
      period: path.includes("daily") ? "daily" : "all-time",
      generatedAt: "2026-07-04T08:00:00.000Z",
      entries: []
    });
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EventBoardPanel", () => {
  it("renders a real leaderboard with premium filters and no placeholder copy", async () => {
    renderEventBoard();

    expect(screen.getByText("Top Guardians")).toBeTruthy();
    expect(await screen.findByText("CozyAnsem")).toBeTruthy();
    expect(screen.getByText("Booo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Today" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gold" })).toBeTruthy();
    expect(screen.getByLabelText("Find guardian")).toBeTruthy();
    expect(screen.queryByText(/placeholder/i)).toBeNull();
  });

  it("filters by guardian search and shows an honest empty state", async () => {
    renderEventBoard();

    expect(await screen.findByText("CozyAnsem")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Find guardian"), { target: { value: "Nobody" } });

    await waitFor(() => expect(screen.queryByText("CozyAnsem")).toBeNull());
    expect(screen.getByText("No leaderboard yet")).toBeTruthy();
    expect(screen.getByText(/No verified raid clears match these filters/i)).toBeTruthy();
  });
});

function renderEventBoard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EventBoardPanel />
    </QueryClientProvider>
  );
}
